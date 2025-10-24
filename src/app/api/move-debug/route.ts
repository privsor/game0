import { NextResponse } from "next/server";
import { getRedis } from "~/server/redis";

// Exact copy of the game's Lua script for debugging
const LUA_MOVE_DEBUG = `
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

export async function POST(req: Request) {
  try {
    const redis = getRedis();
    const body = await req.json();
    const room: string = (body?.room || '').toUpperCase();
    const idx: number = Number(body?.idx ?? -1);
    const userId: string = body?.userId || '';
    
    if (!room || Number.isNaN(idx) || !userId) {
      return NextResponse.json({ error: 'invalid-input' }, { status: 400 });
    }

    const key = `ttt:room:${room}`;
    const now = Date.now().toString();
    const ttlMs = String(24 * 60 * 60 * 1000); // 24 hours

    console.log('DEBUG MOVE: About to eval with:', { key, idx, userId, now, ttlMs });
    
    // Test the exact same script
    const res: unknown = await (redis as any).eval(LUA_MOVE_DEBUG, [key], [idx.toString(), userId, now, ttlMs]);
    
    console.log('DEBUG MOVE: Lua result:', res);
    
    // Also check what's actually in Redis after the script
    const afterScript = await redis.hmget(key, 'b', 'n', 'w', 't', 'x', 'o');
    console.log('DEBUG MOVE: Redis state after script:', afterScript);
    
    return NextResponse.json({ 
      ok: true, 
      luaResult: res,
      redisState: afterScript
    });
  } catch (error) {
    console.error('DEBUG MOVE error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
