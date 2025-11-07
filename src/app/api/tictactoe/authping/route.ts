import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { getRedis } from "~/server/redis";
import { db } from "~/server/db";
import { wallets, walletTransactions } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { publishWalletUpdate } from "~/server/lib/ablyServer";

// POST /api/tictactoe/authping
// body: { room: string }
// Purpose: When a user authenticates after room creation, promote any half-daddy selections
// to effective daddy mode if both seats are authenticated, and charge -1 entry fee idempotently.
export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json().catch(() => ({}));
    const room: string = String(body?.room || '').trim().toUpperCase();
    if (!room) return NextResponse.json({ ok: false, error: 'invalid-input' }, { status: 400 });

    const userId = session?.user?.id || '';
    if (!userId) return NextResponse.json({ ok: false, error: 'auth-required' }, { status: 401 });

    const redis = await getRedis();
    const key = `ttt:room:${room}`;

    const raw = await (redis as any).hmget(
      key,
      'x','o','authx','autho','selx','selo','effx','effo','chargedx','chargedo','xn','on','xa','oa','b','n','w','t'
    );

    // Handle Upstash array/object response
    let px = '', po = '', authx = '0', autho = '0', selx = '', selo = '', effx = '0', effo = '0', chargedx = '0', chargedo = '0';
    if (Array.isArray(raw)) {
      px = String(raw[0] ?? '');
      po = String(raw[1] ?? '');
      authx = String(raw[2] ?? '0');
      autho = String(raw[3] ?? '0');
      selx = String(raw[4] ?? '');
      selo = String(raw[5] ?? '');
      effx = String(raw[6] ?? '0');
      effo = String(raw[7] ?? '0');
      chargedx = String(raw[8] ?? '0');
      chargedo = String(raw[9] ?? '0');
    } else if (raw && typeof raw === 'object') {
      const vals: any = raw;
      px = String(vals.x ?? '');
      po = String(vals.o ?? '');
      authx = String(vals.authx ?? '0');
      autho = String(vals.autho ?? '0');
      selx = String(vals.selx ?? '');
      selo = String(vals.selo ?? '');
      effx = String(vals.effx ?? '0');
      effo = String(vals.effo ?? '0');
      chargedx = String(vals.chargedx ?? '0');
      chargedo = String(vals.chargedo ?? '0');
    }

    // Only proceed if both seats are present and authenticated
    const bothAuthed = authx === '1' && autho === '1' && px && po;
    if (!bothAuthed) {
      return NextResponse.json({ ok: true, changed: false });
    }

    // Recompute effective flags from selections
    let newEffX = selx === 'daddy' ? '1' : '0';
    let newEffO = selo === 'daddy' ? '1' : '0';

    // If already set, keep as-is
    if (effx !== newEffX || effo !== newEffO) {
      await (redis as any).hmset(key, { effx: newEffX, effo: newEffO });
    }

    // Prepare charges for any newly effective-but-not-charged seats
    const toCharge: Array<{ who: 'X' | 'O'; uid: string | null }> = [];
    if (newEffX === '1' && chargedx !== '1') toCharge.push({ who: 'X', uid: px || null });
    if (newEffO === '1' && chargedo !== '1') toCharge.push({ who: 'O', uid: po || null });

    for (const item of toCharge) {
      if (!item.uid) continue;
      const nextBalance = await db.transaction(async (tx) => {
        const cur = (
          await tx.select().from(wallets).where(eq(wallets.userId, item.uid!)).limit(1)
        )[0];
        const bal = cur?.balance ?? 0;
        if (bal < 1) {
          // Cannot charge now; leave effective flags but skip charge. Could optionally revert eff here.
          return null as number | null;
        }
        const newBal = bal - 1;
        await tx.update(wallets).set({ balance: newBal }).where(eq(wallets.userId, item.uid!));
        await tx.insert(walletTransactions).values({
          userId: item.uid!,
          amount: -1,
          type: 'spend',
          reason: `ttt:entry:${room}:${item.who}`,
        });
        return newBal;
      });
      if (item.who === 'X') chargedx = '1'; else chargedo = '1';
      await (redis as any).hmset(key, { chargedx, chargedo });
      if (nextBalance !== null) {
        publishWalletUpdate(item.uid!, {
          balance: nextBalance as number,
          delta: -1,
          reason: `ttt:entry:${room}:${item.who}`,
        }).catch(() => {});
      }
    }

    await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);

    return NextResponse.json({ ok: true, changed: true, eff: { X: newEffX, O: newEffO }, charged: { X: chargedx, O: chargedo } });
  } catch (e) {
    console.error('authping error', e);
    return NextResponse.json({ ok: false, error: 'server-error' }, { status: 500 });
  }
}
