import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = redisUrl && redisToken
  ? Redis.fromEnv()
  : new Redis({
      url: redisUrl || '',
      token: redisToken || '',
    });

export async function isRateLimited(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  try {
    if (!redisUrl || !redisToken) {
      return { allowed: true, remaining: 1, reset: windowSeconds };
    }

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      reset: ttl > 0 ? ttl : windowSeconds,
    };
  } catch {
    return { allowed: true, remaining: 1, reset: windowSeconds };
  }
}