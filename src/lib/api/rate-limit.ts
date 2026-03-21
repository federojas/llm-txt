/**
 * API Rate Limiting
 *
 * Distributed per-IP rate limiting using Upstash Redis (serverless-native, HTTP-based).
 * Gracefully degrades when Redis is not configured (development mode).
 *
 * Production setup: See README.md for Upstash deployment instructions.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Create Redis client from environment variables
 * Returns null if not configured (disables rate limiting)
 */
function createRedisClient(): Redis | null {
  const isConfigured =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!isConfigured) {
    console.warn(
      "[Rate Limit] Upstash Redis not configured - rate limiting disabled"
    );
    return null;
  }

  try {
    return Redis.fromEnv();
  } catch (error) {
    console.error("[Rate Limit] Failed to create Redis client:", error);
    return null;
  }
}

const redis = createRedisClient();

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
export const createJobLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      prefix: "ratelimit:create-job",
      analytics: true,
    })
  : null;

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
export const globalJobLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(15, "1 m"),
      prefix: "ratelimit:global-jobs",
      analytics: true,
    })
  : null;

/**
 * Rate limiter for polling job status
 * Limit: 30 requests per minute (per IP)
 *
 * Rationale: Client polls every 5-15s with exponential backoff (~4-12 requests/min).
 * 30/min allows buffer for retries and multiple active jobs.
 *
 * Higher limit than job creation since polling is cheap (DB read only, no LLM API calls).
 */
export const pollJobLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "ratelimit:poll-job",
      analytics: true,
    })
  : null;

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
