/**
 * Rate Limiting Middleware
 * Wraps route handlers with rate limiting checks
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/api/rate-limit";
import type { Ratelimit } from "@upstash/ratelimit";
import { getLogger } from "@/lib/logger";

/**
 * Rate limit exceeded response
 * Returns standardized 429 response with reset time
 */
function rateLimitExceededResponse(resetMs: number): NextResponse {
  const resetDate = new Date(resetMs);
  const retryAfterSeconds = Math.ceil((resetMs - Date.now()) / 1000);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
        details: `Too many requests. Reset at ${resetDate.toISOString()}.`,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfterSeconds.toString(),
        "X-RateLimit-Reset": resetDate.toISOString(),
      },
    }
  );
}

/**
 * Rate limiting middleware wrapper
 * Checks rate limit before executing handler and adds rate limit headers to all responses
 *
 * @param getLimiter - Async function that returns Ratelimit instance (or null to disable)
 * @param handler - Route handler to wrap
 * @param getGlobalLimiter - Optional async function for global limiter (checks organization-level quota)
 * @returns Wrapped handler with rate limiting
 *
 * @example
 * ```typescript
 * // Per-IP only
 * export const GET = withRateLimit(
 *   getPollJobLimiter,
 *   async (request) => { ... }
 * );
 *
 * // Per-IP + Global quota
 * export const POST = withRateLimit(
 *   getCreateJobLimiter,
 *   withErrorHandler(async (request) => { ... }),
 *   getGlobalJobLimiter
 * );
 * ```
 */
export function withRateLimit<T extends unknown[]>(
  getLimiter: () => Promise<Ratelimit | null>,
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  getGlobalLimiter?: () => Promise<Ratelimit | null>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const logger = getLogger();

    // Get limiters
    const limiter = await getLimiter();
    const globalLimiter = getGlobalLimiter ? await getGlobalLimiter() : null;

    // Skip rate limiting if limiter not configured (development mode)
    if (!limiter) {
      return handler(request, ...args);
    }

    const ip = getClientIp(request);

    // Check global quota first (if configured)
    if (globalLimiter) {
      const globalResult = await globalLimiter.limit("global");
      if (!globalResult.success) {
        logger.warn("Global rate limit exceeded", {
          event: "rate_limit.global.exceeded",
          ip,
          path: request.nextUrl.pathname,
          resetTime: new Date(globalResult.reset).toISOString(),
        });
        await logger.flush();
        return rateLimitExceededResponse(globalResult.reset);
      }
    }

    // Check per-IP rate limit
    const { success, limit, remaining, reset } = await limiter.limit(ip);

    // Rate limit exceeded
    if (!success) {
      logger.warn("Per-IP rate limit exceeded", {
        event: "rate_limit.ip.exceeded",
        ip,
        path: request.nextUrl.pathname,
        method: request.method,
        limit,
        resetTime: new Date(reset).toISOString(),
      });
      await logger.flush();
      return rateLimitExceededResponse(reset);
    }

    // Rate limit passed, execute handler
    const response = await handler(request, ...args);

    // Add rate limit headers to successful responses (industry standard)
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", new Date(reset).toISOString());

    return response;
  };
}
