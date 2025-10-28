import { NextResponse } from "next/server";
import Ably from "ably";
import { getRedis } from "~/server/redis";
import { env } from "~/env";
import { auth } from "~/server/auth";

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
    const nv = await (redis as any).hmget(key, 'xn', 'on', 'xa', 'oa');
    const xn = (nv?.xn ?? '') as string;
    const on = (nv?.on ?? '') as string;
    const xa = (nv?.xa ?? '') as string;
    const oa = (nv?.oa ?? '') as string;

    const state = {
      board: boardStringToArray(b),
      next,
      winner: w === '-' ? null : (w === 'D' ? 'Draw' : (w as 'X'|'O')),
      turn,
      players: { X: px || null, O: po || null },
      names: { X: (xn || null) as string | null, O: (on || null) as string | null },
      avatars: { X: (xa || null) as string | null, O: (oa || null) as string | null },
    };

    // Publish authoritative state to Ably
    const rest = new Ably.Rest(env.ABLY_API_KEY);
    await rest.channels.get(`room-${room}`).publish('state', { type: 'state', state });

    // Determine user's role for client
    const userRole = userId === px ? 'X' : userId === po ? 'O' : null;
    return NextResponse.json({ ok: true, state, userRole });
  } catch (err) {
    console.error('/api/tictactoe/move error', err);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
