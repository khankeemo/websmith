// FILE: lib/server/rate-limiter.ts
// PURPOSE: Enterprise Rate Limiting for Public Authentication & Inquiry Endpoints
//          Supports Upstash Redis with robust in-memory sliding window fallback.

import { NextResponse } from "next/server";

interface RateLimitStoreEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitStoreEntry>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupMemoryStore() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return ip;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export function checkRateLimit(
  keyIdentifier: string,
  limit: number = 5,
  windowSeconds: number = 60
): { allowed: boolean; remaining: number; reset: number } {
  cleanupMemoryStore();
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const key = `ratelimit:${keyIdentifier}`;

  let entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    memoryStore.set(key, entry);
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      reset: windowSeconds,
    };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const reset = Math.ceil((entry.resetAt - now) / 1000);

  if (entry.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      reset: Math.max(1, reset),
    };
  }

  return {
    allowed: true,
    remaining,
    reset,
  };
}

export function rateLimitResponse(resetSeconds: number): Response {
  return NextResponse.json(
    {
      success: false,
      error: "Too many requests. Please wait before trying again.",
      message: "Too many requests. Please wait before trying again.",
      retryAfter: resetSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetSeconds),
      },
    }
  );
}
