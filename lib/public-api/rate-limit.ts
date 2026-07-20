// ============================================================
// FILE: lib/public-api/rate-limit.ts
// PURPOSE: Rate limiting using Upstash Redis
// ============================================================

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset: number; // seconds until reset
}

export async function checkRateLimit(
  apiKeyId: string,
  ip: string,
  endpoint: string,
  limit: number = 1000
): Promise<RateLimitResult> {
  try {
    const window = 60; // 1 minute
    
    // Primary: API key based
    const key = `ratelimit:${apiKeyId}:${endpoint}`;
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, window);
    }
    
    const remaining = Math.max(0, limit - current);
    const reset = window;
    
    if (current > limit) {
      // Check IP fallback
      const ipKey = `ratelimit:ip:${ip}:${endpoint}`;
      const ipCurrent = await redis.incr(ipKey);
      
      if (ipCurrent === 1) {
        await redis.expire(ipKey, window);
      }
      
      if (ipCurrent > 5000) {
        return {
          allowed: false,
          remaining: 0,
          limit: limit,
          reset: window
        };
      }
      
      return {
        allowed: false,
        remaining: 0,
        limit: limit,
        reset: window
      };
    }
    
    return {
      allowed: true,
      remaining: remaining,
      limit: limit,
      reset: reset
    };
    
  } catch (error) {
    console.error('Rate limit error:', error);
    // Allow on error (fail open)
    return {
      allowed: true,
      remaining: 1,
      limit: 1000,
      reset: 60
    };
  }
}

export async function getRateLimitHeaders(
  apiKeyId: string,
  endpoint: string
): Promise<{ limit: number; remaining: number; reset: number }> {
  try {
    const key = `ratelimit:${apiKeyId}:${endpoint}`;
    const current = await redis.get<number>(key);
    const ttl = await redis.ttl(key);
    
    return {
      limit: 1000,
      remaining: Math.max(0, 1000 - (current || 0)),
      reset: ttl > 0 ? ttl : 60
    };
  } catch {
    return { limit: 1000, remaining: 999, reset: 60 };
  }
}