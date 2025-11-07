import { NextResponse } from "next/server";
import Ably from "ably";
import { getRedis } from "~/server/redis";
import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { wallets, walletTransactions } from "~/server/db/schema";
import { eq } from "drizzle-orm";

// Join contract:
// POST /api/tictactoe/join
// body: { room: string, userId: string, name?: string, preferredRole?: 'X'|'O'|'auto', mode?: 'daddy'|'free' }
// behavior:
// - Creates room if missing
// - Assigns role X/O according to preferredRole and availability; if both taken and not this user, spectator
// - Updates name for existing role holder on rejoin
// - Returns { ok, state, userRole }

function boardStringToArray(b: string) {
  return b.split("").map((c) => (c === '-' ? null : (c as 'X'|'O')));
}

export async function POST(req: Request) {
  try {
    const redis = getRedis();
    const body = await req.json();
    const room: string = String(body?.room || '').toUpperCase();
    let userId: string = String(body?.userId || '');
    let name: string = String(body?.name || '').trim();
    const preferredRole: 'X'|'O'|'auto' = (body?.preferredRole === 'X' || body?.preferredRole === 'O') ? body.preferredRole : 'auto';
    const selectedMode: 'daddy'|'free' = body?.mode === 'daddy' ? 'daddy' : 'free';

    // If a NextAuth session exists, prefer the authenticated identity
    let session = null;
    try {
      session = await auth();
      if (session?.user?.id) {
        userId = session.user.id;
        // Force the account display name when available to ensure consistency
        if (session.user.name) name = session.user.name;
      }
    } catch {}

    if (!room || !userId) {
      return NextResponse.json({ error: 'invalid-input' }, { status: 400 });
    }

    const key = `ttt:room:${room}`;

    // Initialize room if not present
    const exists = await (redis as any).exists(key);
    if (!exists) {
      await (redis as any).hmset(key, {
        b: '---------',
        n: 'X',
        w: '-',
        t: 0,
        x: '',
        o: '',
        xn: '',
        on: '',
        xa: '',
        oa: '',
        // selection and auth/effective flags
        selx: '', // 'daddy' | 'free'
        selo: '',
        authx: '0',
        autho: '0',
        effx: '0', // effective daddy mode for this game
        effo: '0',
        chargedx: '0',
        chargedo: '0',
        rwd: '0',
        u: String(Date.now()),
      });
      // 24h TTL
      await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);
    }

    // Read current state
    const vals = await (redis as any).hmget(key, 'b','n','w','t','x','o','xn','on','xa','oa','selx','selo','authx','autho','effx','effo','chargedx','chargedo');
    let b = '---------', n: 'X'|'O' = 'X', w: '-'|'X'|'O'|'D' = '-', t = 0;
    let px = '', po = '', xn = '', on = '', xa = '', oa = '';
    let selx = '', selo = '';
    let authx = '0', autho = '0', effx = '0', effo = '0', chargedx = '0', chargedo = '0';
    if (Array.isArray(vals)) {
      [b, n, w, t, px, po, xn, on, xa, oa, selx, selo, authx, autho, effx, effo, chargedx, chargedo] = [
        String(vals[0] ?? '---------'),
        String(vals[1] ?? 'X') as 'X'|'O',
        String(vals[2] ?? '-') as '-'|'X'|'O'|'D',
        Number(vals[3] ?? 0),
        String(vals[4] ?? ''),
        String(vals[5] ?? ''),
        String(vals[6] ?? ''),
        String(vals[7] ?? ''),
        String(vals[8] ?? ''),
        String(vals[9] ?? ''),
        String(vals[10] ?? ''),
        String(vals[11] ?? ''),
        String(vals[12] ?? '0'),
        String(vals[13] ?? '0'),
        String(vals[14] ?? '0'),
        String(vals[15] ?? '0'),
        String(vals[16] ?? '0'),
        String(vals[17] ?? '0'),
      ];
    } else if (vals && typeof vals === 'object') {
      b = String((vals as any).b ?? '---------');
      n = String((vals as any).n ?? 'X') as 'X'|'O';
      w = String((vals as any).w ?? '-') as '-'|'X'|'O'|'D';
      t = Number((vals as any).t ?? 0);
      px = String((vals as any).x ?? '');
      po = String((vals as any).o ?? '');
      xn = String((vals as any).xn ?? '');
      on = String((vals as any).on ?? '');
      xa = String((vals as any).xa ?? '');
      oa = String((vals as any).oa ?? '');
      selx = String((vals as any).selx ?? '');
      selo = String((vals as any).selo ?? '');
      authx = String((vals as any).authx ?? '0');
      autho = String((vals as any).autho ?? '0');
      effx = String((vals as any).effx ?? '0');
      effo = String((vals as any).effo ?? '0');
      chargedx = String((vals as any).chargedx ?? '0');
      chargedo = String((vals as any).chargedo ?? '0');
    }

    // If the user already holds a role, reaffirm and optionally update name
    let assignedRole: 'X'|'O'|null = null;
    if (px && userId === px) {
      assignedRole = 'X';
      if (name) xn = name;
      if (body?.avatar || true) {
        // Prefer session avatar when available; fall back to provided body.avatar if any
        const img = (session?.user?.image || body?.avatar || '').trim();
        if (img) xa = img;
      }
      authx = session?.user ? '1' : '0';
      // set selection for X if provided
      if (selectedMode) selx = selectedMode;
    } else if (po && userId === po) {
      assignedRole = 'O';
      if (name) on = name;
      if (body?.avatar || true) {
        const img = (session?.user?.image || body?.avatar || '').trim();
        if (img) oa = img;
      }
      autho = session?.user ? '1' : '0';
      if (selectedMode) selo = selectedMode;
    } else {
      // Try to assign based on preference
      const wantX = preferredRole === 'X' || preferredRole === 'auto';
      const wantO = preferredRole === 'O' || preferredRole === 'auto';

      if (!px && wantX) {
        px = userId; assignedRole = 'X'; xn = name || xn;
        const img = (session?.user?.image || body?.avatar || '').trim();
        if (img) xa = img;
        authx = session?.user ? '1' : '0';
        selx = selectedMode || selx;
      } else if (!po && wantO) {
        po = userId; assignedRole = 'O'; on = name || on;
        const img = (session?.user?.image || body?.avatar || '').trim();
        if (img) oa = img;
        autho = session?.user ? '1' : '0';
        selo = selectedMode || selo;
      } else if (!po && preferredRole === 'auto') {
        // If X was taken and O free in auto mode
        po = userId; assignedRole = 'O'; on = name || on;
        const img = (session?.user?.image || body?.avatar || '').trim();
        if (img) oa = img;
        autho = session?.user ? '1' : '0';
        selo = selectedMode || selo;
      } else {
        assignedRole = null; // spectator
      }
    }

    // Persist updates
    const updates: Record<string,string> = { u: String(Date.now()) };
    if (assignedRole === 'X') { updates['x'] = px; updates['xn'] = xn; if (xa !== undefined) updates['xa'] = xa; updates['authx'] = authx; updates['selx'] = selx; }
    if (assignedRole === 'O') { updates['o'] = po; updates['on'] = on; if (oa !== undefined) updates['oa'] = oa; updates['autho'] = autho; updates['selo'] = selo; }
    if (Object.keys(updates).length) {
      await (redis as any).hmset(key, updates);
      await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);
    }

    // Server-side enforcement: if user selected 'daddy' but has <1 coin, reject selection
    if (assignedRole && selectedMode === 'daddy') {
      const meIsX = assignedRole === 'X';
      const myUserId = session?.user?.id;
      if (!myUserId) {
        return NextResponse.json({ error: 'auth-required' }, { status: 401 });
      }
      const balanceRow = (
        await db.select().from(wallets).where(eq(wallets.userId, myUserId)).limit(1)
      )[0];
      const bal = balanceRow?.balance ?? 0;
      if (bal < 1) {
        // Roll back selection to 'free'
        if (meIsX) { await (redis as any).hset(key, 'selx', 'free'); selx = 'free'; }
        else { await (redis as any).hset(key, 'selo', 'free'); selo = 'free'; }
        return NextResponse.json({ error: 'INSUFFICIENT_COINS_FOR_SELECTION' }, { status: 400 });
      }
    }

    // Promotion: if both seats are authenticated, set effective flags and charge as needed (charging independent of opponent's selection)
    // Read a fresh snapshot to avoid using stale px/po when deciding charges
    const afterVals = await (redis as any).hmget(
      key,
      'x','o','authx','autho','selx','selo','effx','effo','chargedx','chargedo'
    );

    // Support both Upstash array-style and object-style responses
    let _px = '', _po = '';
    let _authx = '0', _autho = '0';
    let _selx = '', _selo = '';
    let _effx = '0', _effo = '0';
    let _chargedx = '0', _chargedo = '0';
    if (Array.isArray(afterVals)) {
      _px = String(afterVals[0] ?? '');
      _po = String(afterVals[1] ?? '');
      _authx = String(afterVals[2] ?? '0');
      _autho = String(afterVals[3] ?? '0');
      _selx = String(afterVals[4] ?? '');
      _selo = String(afterVals[5] ?? '');
      _effx = String(afterVals[6] ?? '0');
      _effo = String(afterVals[7] ?? '0');
      _chargedx = String(afterVals[8] ?? '0');
      _chargedo = String(afterVals[9] ?? '0');
    } else if (afterVals && typeof afterVals === 'object') {
      _px = String((afterVals as any).x ?? '');
      _po = String((afterVals as any).o ?? '');
      _authx = String((afterVals as any).authx ?? '0');
      _autho = String((afterVals as any).autho ?? '0');
      _selx = String((afterVals as any).selx ?? '');
      _selo = String((afterVals as any).selo ?? '');
      _effx = String((afterVals as any).effx ?? '0');
      _effo = String((afterVals as any).effo ?? '0');
      _chargedx = String((afterVals as any).chargedx ?? '0');
      _chargedo = String((afterVals as any).chargedo ?? '0');
    }

    if (_authx === '1' && _autho === '1') {
      // effective daddy mode equals selection
      _effx = _selx === 'daddy' ? '1' : '0';
      _effo = _selo === 'daddy' ? '1' : '0';
      await (redis as any).hmset(key, { effx: _effx, effo: _effo });

      // Charge -1 for each effective daddy mode if not yet charged
      const toCharge: Array<{ who: 'X'|'O'; userId: string | null }> = [];
      if (_effx === '1' && _chargedx !== '1') toCharge.push({ who: 'X', userId: _px || null });
      if (_effo === '1' && _chargedo !== '1') toCharge.push({ who: 'O', userId: _po || null });

      if (toCharge.length > 0) {
        for (const charge of toCharge) {
          if (!charge.userId) continue;
          // Deduct -1 from wallet
          await db.transaction(async (tx) => {
            const cur = (
              await tx.select().from(wallets).where(eq(wallets.userId, charge.userId!)).limit(1)
            )[0];
            const bal = cur?.balance ?? 0;
            if (bal < 1) {
              // Not enough funds: revert effective flag to 0
              if (charge.who === 'X') { await (redis as any).hmset(key, { effx: '0' }); _effx = '0'; }
              if (charge.who === 'O') { await (redis as any).hmset(key, { effo: '0' }); _effo = '0'; }
              return; // skip credit
            }
            await tx.update(wallets).set({ balance: bal - 1 }).where(eq(wallets.userId, charge.userId!));
            await tx.insert(walletTransactions).values({
              userId: charge.userId!,
              amount: -1,
              type: 'spend',
              reason: `ttt:entry:${room}:${charge.who}`,
            });
          });
          // mark charged
          if (charge.who === 'X') { await (redis as any).hmset(key, { chargedx: '1' }); _chargedx = '1'; }
          if (charge.who === 'O') { await (redis as any).hmset(key, { chargedo: '1' }); _chargedo = '1'; }
          try {
            console.log('[JOIN:charged]', { room, who: charge.who, userId: charge.userId });
          } catch {}
        }
      }
    }

    const state = {
      board: boardStringToArray(b),
      next: n,
      winner: w === '-' ? null : (w === 'D' ? 'Draw' : (w as 'X'|'O')),
      turn: t,
      players: { X: px || null, O: po || null },
      names: { X: xn || null, O: on || null },
      avatars: { X: (xa || null) as string | null, O: (oa || null) as string | null },
      coinsMode: { X: (effx === '1'), O: (effo === '1') },
      coinsModePending: { X: selx === 'daddy' && effx !== '1', O: selo === 'daddy' && effo !== '1' },
    } as const;

    // Publish state so UIs show names/roles immediately
    // On serverless platforms (e.g., Vercel) background work may be cancelled after returning.
    // Await the publish to guarantee delivery before the function ends.
    try {
      const rest = new Ably.Rest(env.ABLY_API_KEY);
      await rest.channels.get(`room-${room}`).publish('state', { type: 'state', state });
    } catch {}

    return NextResponse.json({ ok: true, state, userRole: assignedRole });
  } catch (err) {
    console.error('/api/tictactoe/join error', err);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
