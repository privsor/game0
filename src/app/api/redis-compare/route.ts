import { NextResponse } from "next/server";
import { getRedis } from "~/server/redis";

export async function GET(req: Request) {
  try {
    const redis = getRedis();
    const { searchParams } = new URL(req.url);
    const room = (searchParams.get('room') || '').toUpperCase();
    
    if (!room) {
      return NextResponse.json({ error: 'no room' }, { status: 400 });
    }

    const key = `ttt:room:${room}`;
    
    // Test different ways to read the data
    const hmgetResult = await (redis as any).hmget(key, 'b', 'n', 'w', 't', 'x', 'o');
    const hgetallResult = await redis.hgetall(key);
    const existsResult = await redis.exists(key);
    const keysResult = await redis.keys(`ttt:room:${room}*`);
    
    return NextResponse.json({ 
      ok: true,
      key,
      hmget: hmgetResult,
      hgetall: hgetallResult,
      exists: existsResult,
      keys: keysResult
    });
  } catch (error) {
    console.error('Redis compare error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
