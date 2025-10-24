import { NextResponse } from "next/server";
import { getRedis } from "~/server/redis";

export async function GET() {
  try {
    const redis = getRedis();
    
    // Test script that mimics our game's HMSET operations
    const testScript = `
      local key = KEYS[1]
      local ttl = tonumber(ARGV[1])
      
      -- Test HMSET with multiple fields like in our game
      redis.call('HMSET', key, 'b','---------','n','X','w','-','t','0','x','user1','o','')
      redis.call('PEXPIRE', key, ttl)
      
      -- Read it back
      local vals = redis.call('HMGET', key, 'b','n','w','t','x','o')
      
      return vals
    `;
    
    const testKey = 'hmset-test:' + Date.now();
    const ttlMs = 24 * 60 * 60 * 1000; // 24 hours
    
    console.log('Testing HMSET with key:', testKey, 'ttl:', ttlMs);
    
    // Execute the Lua script
    const result = await (redis as any).eval(testScript, [testKey], [ttlMs.toString()]);
    
    console.log('HMSET script result:', result);
    
    // Also test direct read after script
    const directRead = await redis.hmget(testKey, 'b', 'n', 'w', 't', 'x', 'o');
    console.log('Direct HMGET result:', directRead);
    
    // Clean up
    await redis.del(testKey);
    
    return NextResponse.json({ 
      ok: true, 
      message: 'HMSET test completed',
      scriptResult: result,
      directRead: directRead
    });
  } catch (error) {
    console.error('HMSET test error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
