import { NextResponse } from "next/server";
import { getRedis } from "~/server/redis";

export async function GET() {
  try {
    const redis = getRedis();
    
    // Test basic Redis operations
    const testKey = 'test:' + Date.now();
    
    // Set a value
    await redis.set(testKey, 'hello world');
    
    // Get the value back
    const value = await redis.get(testKey);
    
    // Delete the test key
    await redis.del(testKey);
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Redis is working',
      testValue: value 
    });
  } catch (error) {
    console.error('Redis test error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
