import { NextResponse } from "next/server";
import Ably from "ably";
import { getRedis } from "~/server/redis";
import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { wallets, walletTransactions } from "~/server/db/schema";
import { eq } from "drizzle-orm";

// Redis state layout (hash at key ttt:room:{ROOM})
// b: 9-char string ("-" empty)
// n: next player ("X"|"O")
// w: winner ("-"|"X"|"O"|"D")
// t: turn number
// x: user id for X
// o: user id for O
// u: updatedAt (ms)

const LUA_MOVE = `
local key = KEYS[1]
local idx = tonumber(ARGV[1])
local user = ARGV[2]
local now = ARGV[3]
local ttl = tonumber(ARGV[4])

if redis.call('EXISTS', key) == 0 then
  redis.call('HMSET', key,
    'b','---------','n','X','w','-','t',0,'x',user,'o','', 'u', now)
  redis.call('PEXPIRE', key, ttl)
end

local vals = redis.call('HMGET', key, 'b','n','w','t','x','o')
local b = vals[1]
local n = vals[2]
local w = vals[3]
local t = tonumber(vals[4]) or 0
local px = vals[5]
local po = vals[6]
if not b then b='---------'; n='X'; w='-'; t=0; px=''; po='' end

-- assign role on first see
if (not px or px=='') then px=user; redis.call('HSET', key, 'x', px) end
if (not po or po=='') and user ~= px then po=user; redis.call('HSET', key, 'o', po) end

local role = nil
if user == px then role='X' elseif user == po then role='O' else return {'ERR','not-player'} end
if w ~= '-' then return {'ERR','finished'} end
-- Prevent the first player (X) from making a move until an opponent (O) has joined
if role == 'X' and (not po or po=='') then return {'ERR','need-opponent'} end
if n ~= role then return {'ERR','not-your-turn'} end

local pos = idx + 1
if pos < 1 or pos > 9 then return {'ERR','out-of-range'} end
if string.sub(b,pos,pos) ~= '-' then return {'ERR','occupied'} end

b = string.sub(b,1,pos-1)..role..string.sub(b,pos+1)

local lines = {
  {1,2,3},{4,5,6},{7,8,9},
  {1,4,7},{2,5,8},{3,6,9},
  {1,5,9},{3,5,7}
}
local winner='-'
for i=1,#lines do
  local a=lines[i][1]; local c=lines[i][2]; local d=lines[i][3]
  local va=string.sub(b,a,a)
  if va ~= '-' and va == string.sub(b,c,c) and va == string.sub(b,d,d) then winner=va; break end
end
if winner=='-' and not string.find(b,'-') then winner='D' end

local nextTurn = n
if winner=='-' then nextTurn = (n=='X') and 'O' or 'X' end
local nt = t + 1

redis.call('HMSET', key, 'b',b,'n',nextTurn,'w',winner,'t',nt,'u',now)
redis.call('PEXPIRE', key, ttl)

return {'OK', b, nextTurn, winner, nt, px, po}
`;

function boardStringToArray(b: string) {
  return b.split("").map((c) => (c === '-' ? null : (c as 'X'|'O')));
}

export async function POST(req: Request) {
  try {
    const redis = getRedis();
    const body = await req.json();
    const room: string = (body?.room || '').toUpperCase();
    const idx: number = Number(body?.idx);
    let userId: string = body?.userId || '';

    // Prefer authenticated user id if a session exists
    try {
      const session = await auth();
      if (session?.user?.id) {
        userId = session.user.id;
      }
    } catch {}
    if (!room || Number.isNaN(idx) || !userId) {
      return NextResponse.json({ error: 'invalid-input' }, { status: 400 });
    }

    const key = `ttt:room:${room}`;
    const now = Date.now().toString();
    const ttlMs = String(24 * 60 * 60 * 1000); // 24 hours

    console.log('DEBUG: About to eval Lua script with:', { key, idx, userId, now, ttlMs });
    
    // Upstash supports eval(script, keys, args)
    const res: unknown = await (redis as any).eval(LUA_MOVE, [key], [idx.toString(), userId, now, ttlMs]);
    
    console.log('DEBUG: Lua script result:', res);
    if (!Array.isArray(res)) {
      return NextResponse.json({ error: 'bad-eval' }, { status: 500 });
    }
    const tag = res[0];
    if (tag === 'ERR') {
      const code = res[1] as string | undefined;
      return NextResponse.json({ error: code || 'invalid' }, { status: 400 });
    }
    // ['OK', b, next, winner, turn, px, po]
    const b = String(res[1] ?? '---------');
    const next = String(res[2] ?? 'X') as 'X'|'O';
    const w = String(res[3] ?? '-') as '-'|'X'|'O'|'D';
    const turn = Number(res[4] ?? 0);
    const px = (res[5] ?? '') as string;
    const po = (res[6] ?? '') as string;

    // Read names and avatars if present
    const nv = await (redis as any).hmget(key, 'xn', 'on', 'xa', 'oa', 'effx', 'effo', 'rwd', 'selx', 'selo', 'authx', 'autho');
    let xn = '' as string, on = '' as string, xa = '' as string, oa = '' as string;
    let effx = '0' as string, effo = '0' as string, rwd = '0' as string;
    let selx = '' as string, selo = '' as string;
    let authx = '0' as string, autho = '0' as string;
    if (Array.isArray(nv)) {
      // Upstash may return an array in order of fields
      xn = String(nv[0] ?? '');
      on = String(nv[1] ?? '');
      xa = String(nv[2] ?? '');
      oa = String(nv[3] ?? '');
      effx = String(nv[4] ?? '0');
      effo = String(nv[5] ?? '0');
      rwd = String(nv[6] ?? '0');
      selx = String(nv[7] ?? '');
      selo = String(nv[8] ?? '');
      authx = String(nv[9] ?? '0');
      autho = String(nv[10] ?? '0');
    } else if (nv && typeof nv === 'object') {
      xn = String((nv as any).xn ?? '');
      on = String((nv as any).on ?? '');
      xa = String((nv as any).xa ?? '');
      oa = String((nv as any).oa ?? '');
      effx = String((nv as any).effx ?? '0');
      effo = String((nv as any).effo ?? '0');
      rwd = String((nv as any).rwd ?? '0');
      selx = String((nv as any).selx ?? '');
      selo = String((nv as any).selo ?? '');
      authx = String((nv as any).authx ?? '0');
      autho = String((nv as any).autho ?? '0');
    }

    let claimObj: { amount: number; winnerRole: 'X'|'O'; expiresAt: number } | null = null;
    const state = {
      board: boardStringToArray(b),
      next,
      winner: w === '-' ? null : (w === 'D' ? 'Draw' : (w as 'X'|'O')),
      turn,
      players: { X: px || null, O: po || null },
      names: { X: (xn || null) as string | null, O: (on || null) as string | null },
      avatars: { X: (xa || null) as string | null, O: (oa || null) as string | null },
      coinsMode: { X: effx === '1', O: effo === '1' },
      coinsModePending: { X: selx === 'daddy' && effx !== '1', O: selo === 'daddy' && effo !== '1' },
      claim: null as any,
    };

    // We'll publish after reward/claim logic to include any claim in state

    // Determine user's role for client
    const userRole = userId === px ? 'X' : userId === po ? 'O' : null;

    // On game conclusion, distribute DaddyCoins based on coins mode flags (idempotent)
    const winnerSymbol = state.winner === 'Draw' ? 'D' : state.winner; // 'X' | 'O' | 'D' | null
    if (winnerSymbol && winnerSymbol !== 'D') {
      try {
        // check and set reward flag atomically-ish
        if (rwd !== '1') {
          // compute award from effective daddy mode snapshot
          const xOn = effx === '1';
          const oOn = effo === '1';
          let award = 0;
          if (winnerSymbol === 'X') {
            if (xOn && oOn) award = 3; else if (xOn) award = 2; else if (oOn) award = 1; else award = 0;
          } else if (winnerSymbol === 'O') {
            if (xOn && oOn) award = 3; else if (oOn) award = 2; else if (xOn) award = 1; else award = 0;
          }

          console.log('[MOVE:end]', { room, winnerSymbol, effx, effo, selx, selo, authx, autho, award });
          if (award > 0) {
            const winnerUserId = winnerSymbol === 'X' ? px : po;
            const winnerAuthed = winnerSymbol === 'X' ? (authx === '1') : (autho === '1');
            if (winnerUserId && winnerAuthed) {
              await db.transaction(async (tx) => {
                const current = (
                  await tx.select().from(wallets).where(eq(wallets.userId, winnerUserId)).limit(1)
                )[0];
                const newBal = (current?.balance ?? 0) + award;
                if (!current) {
                  await tx.insert(wallets).values({ userId: winnerUserId, balance: newBal });
                } else {
                  await tx.update(wallets).set({ balance: newBal }).where(eq(wallets.userId, winnerUserId));
                }
                await tx.insert(walletTransactions).values({
                  userId: winnerUserId,
                  amount: award,
                  type: 'earn',
                  reason: `ttt:win:${room}:${winnerSymbol}:${turn}`,
                });
              });
            } else {
              // Winner unauthenticated: create a pending claim tied to the winner's ephemeral seat id
              const claimExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h
              const claimWinnerRole = winnerSymbol as 'X'|'O';
              const claimEphemeralId = winnerSymbol === 'X' ? px : po; // px/po are seat ids (may be empty if spectator won, but here winner is seat)
              await (redis as any).hmset(key, {
                claim: '1',
                claimAmount: String(award),
                claimWinnerRole,
                claimEphemeralId: claimEphemeralId || '',
                claimExpiresAt: String(claimExpiresAt),
              });
              console.log('[MOVE:claim-created]', { room, winnerSymbol, amount: award, claimExpiresAt });
              claimObj = { amount: award, winnerRole: claimWinnerRole, expiresAt: claimExpiresAt };
            }
          }
          // If no award due to ineffective half-daddy, but exactly one pending selection exists and winner is unauth, create +1 claim
          if (award === 0) {
            const pendingX = selx === 'daddy' && effx !== '1';
            const pendingO = selo === 'daddy' && effo !== '1';
            const exactlyOnePending = (pendingX ? 1 : 0) + (pendingO ? 1 : 0) === 1;
            const winnerAuthed = winnerSymbol === 'X' ? (authx === '1') : (autho === '1');
            if (exactlyOnePending && !winnerAuthed) {
              const claimExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h
              const claimWinnerRole = winnerSymbol as 'X'|'O';
              await (redis as any).hmset(key, {
                claim: '1',
                claimAmount: '1',
                claimWinnerRole,
                claimEphemeralId: '',
                claimExpiresAt: String(claimExpiresAt),
              });
              console.log('[MOVE:claim-created]', { room, winnerSymbol, amount: 1, claimExpiresAt });
              claimObj = { amount: 1, winnerRole: claimWinnerRole, expiresAt: claimExpiresAt };
            }
          }
          // Mark rewards distributed
          await (redis as any).hset(key, 'rwd', '1');
          await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);
        }
      } catch (e) {
        console.error('Error distributing DaddyCoins rewards', e);
      }
    }
    if (claimObj) (state as any).claim = claimObj;
    // Publish authoritative state to Ably (after computing claim/reward)
    const rest = new Ably.Rest(env.ABLY_API_KEY);
    await rest.channels.get(`room-${room}`).publish('state', { type: 'state', state });
    return NextResponse.json({ ok: true, state, userRole });
  } catch (err) {
    console.error('/api/tictactoe/move error', err);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
