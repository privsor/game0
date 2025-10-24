import { NextResponse } from "next/server";
import { getRedis } from "~/server/redis";

export async function GET() {
  try {
    const redis = getRedis();
    
    // Simple Lua script to test HMSET and HMGET
    const testScript = `
      local key = KEYS[1]
      local value = ARGV[1]
      
      -- Set a hash field
      redis.call('HSET', key, 'test', value)
      
      -- Get it back
      local result = redis.call('HGET', key, 'test')
      
      return result
    `;
    
    const testKey = 'lua-test:' + Date.now();
    const testValue = 'hello-lua';
    
    console.log('Testing Lua script with key:', testKey, 'value:', testValue);
    
    // Execute the Lua script
    const result = await (redis as any).eval(testScript, [testKey], [testValue]);
    
    console.log('Lua script result:', result);
    
    // Clean up
    await redis.del(testKey);
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Lua script test completed',
      result: result 
    });
  } catch (error) {
    console.error('Lua test error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
