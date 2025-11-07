import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { getRedis } from "~/server/redis";
import { db } from "~/server/db";
import { wallets, walletTransactions } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { publishWalletUpdate } from "~/server/lib/ablyServer";

// POST /api/tictactoe/claim
// body: { room: string }
// Settles a pending claim for the authenticated winner, if present and valid.
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

    const raw = await (redis as any).hmget(key, 'claim','claimAmount','claimWinnerRole','claimExpiresAt','claimEphemeralId','x','o','authx','autho');
    let claim='0', claimAmount='0', claimWinnerRole='', claimExpiresAt='0', claimEphemeralId='', px='', po='', authx='0', autho='0';
    if (Array.isArray(raw)) {
      claim = String(raw[0] ?? '0');
      claimAmount = String(raw[1] ?? '0');
      claimWinnerRole = String(raw[2] ?? '');
      claimExpiresAt = String(raw[3] ?? '0');
      claimEphemeralId = String(raw[4] ?? '');
      px = String(raw[5] ?? '');
      po = String(raw[6] ?? '');
      authx = String(raw[7] ?? '0');
      autho = String(raw[8] ?? '0');
    } else if (raw && typeof raw === 'object') {
      const v: any = raw;
      claim = String(v.claim ?? '0');
      claimAmount = String(v.claimAmount ?? '0');
      claimWinnerRole = String(v.claimWinnerRole ?? '');
      claimExpiresAt = String(v.claimExpiresAt ?? '0');
      claimEphemeralId = String(v.claimEphemeralId ?? '');
      px = String(v.x ?? '');
      po = String(v.o ?? '');
      authx = String(v.authx ?? '0');
      autho = String(v.autho ?? '0');
    }

    if (claim !== '1') return NextResponse.json({ ok: false, error: 'no-claim' }, { status: 400 });
    const now = Date.now();
    const exp = Number(claimExpiresAt || '0');
    if (exp && now > exp) {
      // expire claim and return
      await (redis as any).hmset(key, { claim: '0', claimAmount: '0', claimWinnerRole: '', claimExpiresAt: '', claimEphemeralId: '' });
      return NextResponse.json({ ok: false, error: 'expired' }, { status: 400 });
    }

    // Determine if caller is eligible to claim:
    // - Caller matches current winner seat
    // - OR winner seat is currently unauthenticated (authx/autho==='0'), allowing post-auth claimant to redeem
    let userRole = userId === px ? 'X' : userId === po ? 'O' : null;
    const seatUnauthed = claimWinnerRole === 'X' ? (authx !== '1') : (autho !== '1');
    const roleOk = userRole === claimWinnerRole || seatUnauthed;
    if (!roleOk) {
      return NextResponse.json({ ok: false, error: 'not-claimant' }, { status: 403 });
    }

    // Atomically validate-and-clear claim using Lua to avoid double-credit
    const LUA_CLAIM = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local expectedRole = ARGV[2]
local claim = redis.call('HGET', key, 'claim')
if not claim or claim ~= '1' then return {0,'no-claim'} end
local role = redis.call('HGET', key, 'claimWinnerRole') or ''
if expectedRole ~= '' and role ~= expectedRole then return {0,'role-mismatch'} end
local exp = tonumber(redis.call('HGET', key, 'claimExpiresAt') or '0')
if exp and exp > 0 and now > exp then
  redis.call('HMSET', key, 'claim','0','claimAmount','0','claimWinnerRole','','claimExpiresAt','', 'claimEphemeralId','')
  return {0,'expired'}
end
local amt = tonumber(redis.call('HGET', key, 'claimAmount') or '0')
redis.call('HMSET', key, 'claim','0','claimAmount','0','claimWinnerRole','','claimExpiresAt','', 'claimEphemeralId','')
return {amt,'ok'}
`;

    let luaRes: any;
    try {
      luaRes = await (redis as any).eval(LUA_CLAIM, [key], [String(now), claimWinnerRole || '']);
    } catch (e) {
      console.error('claim lua error', e);
      return NextResponse.json({ ok: false, error: 'server-error' }, { status: 500 });
    }
    if (!Array.isArray(luaRes)) {
      return NextResponse.json({ ok: false, error: 'bad-redis' }, { status: 500 });
    }
    const amtFromLua = Number(luaRes[0] ?? 0) || 0;
    const luaCode = String(luaRes[1] ?? '');
    if (luaCode === 'expired') {
      return NextResponse.json({ ok: false, error: 'expired' }, { status: 400 });
    }
    if (amtFromLua <= 0) {
      return NextResponse.json({ ok: false, error: luaCode || 'no-claim' }, { status: 400 });
    }

    // await db.transaction(async (tx) => {
    //   const current = (
    //     await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
    //   )[0];
    //   const newBal = (current?.balance ?? 0) + amount;
    //   if (!current) {
    //     await tx.insert(wallets).values({ userId, balance: newBal });
    //   } else {
    //     await tx.update(wallets).set({ balance: newBal }).where(eq(wallets.userId, userId));
    //   }
    //   await tx.insert(walletTransactions).values({
    //     userId,
    //     amount,
    //     type: 'earn',
    //     reason: `ttt:claim:${room}:${userRole}`,
    //   });
    // });

    await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);
    // Rebind seat to authenticated claimant if seat unauthenticated
    if (seatUnauthed && claimWinnerRole) {
      if (claimWinnerRole === 'X') {
        await (redis as any).hmset(key, { x: userId, authx: '1' });
      } else if (claimWinnerRole === 'O') {
        await (redis as any).hmset(key, { o: userId, autho: '1' });
      }
      await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);
    }

    // Credit exactly once with the amount returned by Lua
    const newBal = await db.transaction(async (tx) => {
      const current = (
        await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
      )[0];
      const nextBalance = (current?.balance ?? 0) + amtFromLua;
      if (!current) {
        await tx.insert(wallets).values({ userId, balance: nextBalance });
      } else {
        await tx.update(wallets).set({ balance: nextBalance }).where(eq(wallets.userId, userId));
      }
      await tx.insert(walletTransactions).values({
        userId,
        amount: amtFromLua,
        type: 'earn',
        reason: `ttt:claim:${room}:${claimWinnerRole || userRole || ''}`,
      });
      return nextBalance;
    });

    // Notify clients to refresh wallet badge
    publishWalletUpdate(userId, {
      balance: newBal,
      delta: amtFromLua,
      reason: `ttt:claim:${room}:${claimWinnerRole || userRole || ''}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, settled: true, amount: amtFromLua });
  } catch (e) {
    console.error('claim error', e);
    return NextResponse.json({ ok: false, error: 'server-error' }, { status: 500 });
  }
}
