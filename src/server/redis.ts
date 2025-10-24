import { Redis } from "@upstash/redis";
import { env } from "~/env";

let _redis: Redis | null = null;

export function getRedis() {
  if (_redis) return _redis;
  _redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}
