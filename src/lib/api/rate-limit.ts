/**
 * API Rate Limiting
 *
 * Distributed per-IP rate limiting using Upstash Redis (serverless-native, HTTP-based).
 * Gracefully degrades when Redis is not configured (development mode).
 *
 * Uses dynamic imports for runtime loading while maintaining compile-time type safety.
 * Production setup: Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 */

import type { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

/**
 * Create Redis client from environment variables
 * Returns null if not configured (disables rate limiting)
 */
async function createRedisClient(): Promise<Redis | null> {
  const isConfigured =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!isConfigured) {
    console.warn(
      "[Rate Limit] Upstash Redis not configured - rate limiting disabled (dev mode)"
    );
    return null;
  }

  try {
    // Dynamic import to gracefully handle missing packages
    const { Redis } = await import("@upstash/redis");
    return Redis.fromEnv();
  } catch (error) {
    console.warn(
      "[Rate Limit] @upstash/redis not available - rate limiting disabled:",
      error
    );
    return null;
  }
}

/**
 * Create rate limiter instance with dynamic imports
 */
async function createRateLimiter(
  redis: Redis,
  window: number,
  period:
    | `${number} ms`
    | `${number} s`
    | `${number} m`
    | `${number} h`
    | `${number} d`,
  prefix: string
): Promise<Ratelimit | null> {
  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(window, period),
      prefix,
      analytics: true,
    });
  } catch (error) {
    console.warn(`[Rate Limit] Failed to create limiter ${prefix}:`, error);
    return null;
  }
}

// Lazy initialization
let redisPromise: Promise<Redis | null> | null = null;
function getRedis(): Promise<Redis | null> {
  if (!redisPromise) {
    redisPromise = createRedisClient();
  }
  return redisPromise;
}

let createJobLimiterPromise: Promise<Ratelimit | null> | null = null;
let globalJobLimiterPromise: Promise<Ratelimit | null> | null = null;
let pollJobLimiterPromise: Promise<Ratelimit | null> | null = null;

/**
 * Rate limiter for creating crawl jobs (per IP)
 * Limit: 5 requests per minute (per IP)
 *
 * Rationale: Jobs take 60-90s to complete, so 5/min allows normal usage while preventing abuse.
 *
 * Production tuning: Adjust based on actual infrastructure constraints:
 * - LLM API tier limits (Groq paid tier, not free tier)
 * - Server/database capacity
 * - Business requirements (concurrent users, SLA targets)
 */
export async function getCreateJobLimiter(): Promise<Ratelimit | null> {
  if (!createJobLimiterPromise) {
    createJobLimiterPromise = getRedis().then((redis) =>
      redis ? createRateLimiter(redis, 5, "1 m", "ratelimit:create-job") : null
    );
  }
  return createJobLimiterPromise;
}

/**
 * Global rate limiter for all job creation (organization-level)
 * Limit: 15 requests per minute (across all IPs)
 *
 * Rationale: Prevents org-level API quota exhaustion when multiple users create jobs simultaneously.
 * Each job makes ~52 Groq API calls, so 15 jobs/min = ~780 calls/min (safe for most paid tiers).
 *
 * Production tuning: Set based on your LLM API tier's RPM limit:
 * - Groq Developer: 1,000 RPM → allow ~18 jobs/min (950 calls/min with 5% buffer)
 * - Groq Pro: 5,000+ RPM → increase proportionally
 */
export async function getGlobalJobLimiter(): Promise<Ratelimit | null> {
  if (!globalJobLimiterPromise) {
    globalJobLimiterPromise = getRedis().then((redis) =>
      redis
        ? createRateLimiter(redis, 15, "1 m", "ratelimit:global-jobs")
        : null
    );
  }
  return globalJobLimiterPromise;
}

/**
 * Rate limiter for polling job status
 * Limit: 30 requests per minute (per IP)
 *
 * Rationale: Client polls every 5-15s with exponential backoff (~4-12 requests/min).
 * 30/min allows buffer for retries and multiple active jobs.
 *
 * Higher limit than job creation since polling is cheap (DB read only, no LLM API calls).
 */
export async function getPollJobLimiter(): Promise<Ratelimit | null> {
  if (!pollJobLimiterPromise) {
    pollJobLimiterPromise = getRedis().then((redis) =>
      redis ? createRateLimiter(redis, 30, "1 m", "ratelimit:poll-job") : null
    );
  }
  return pollJobLimiterPromise;
}

/**
 * Extract client IP from Next.js request headers
 * Tries multiple headers in order of preference
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;

  // Try various IP headers (in order of preference)
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;

  const cfConnectingIp = headers.get("cf-connecting-ip"); // Cloudflare
  if (cfConnectingIp) return cfConnectingIp;

  // Fallback to anonymous if no IP found
  return "anonymous";
}
