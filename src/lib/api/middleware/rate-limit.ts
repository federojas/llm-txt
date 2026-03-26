/**
 * Rate Limiting Middleware
 * Wraps route handlers with rate limiting checks
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/api/rate-limit";
import type { Ratelimit } from "@upstash/ratelimit";
import { getLogger } from "@/lib/logger";
import { RateLimitError } from "@/lib/api/api-error";
import { handleApiError } from "./error-handler";

/**
 * Rate limit exceeded response
 * Throws RateLimitError which is caught by error handler middleware
 */
function throwRateLimitError(resetMs: number): never {
  const resetDate = new Date(resetMs);
  const retryAfterSeconds = Math.ceil((resetMs - Date.now()) / 1000);

  throw new RateLimitError(
    `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
    resetMs,
    `Too many requests. Reset at ${resetDate.toISOString()}.`
  );
}

/**
 * Rate limiting middleware wrapper
 * Checks rate limit before executing handler and adds rate limit headers to all responses
 * Includes built-in error handling for rate limit errors and handler errors
 *
 * @param getLimiter - Async function that returns Ratelimit instance (or null to disable)
 * @param handler - Route handler to wrap (can be wrapped with withErrorHandler or standalone)
 * @param getGlobalLimiter - Optional async function for global limiter (checks organization-level quota)
 * @returns Wrapped handler with rate limiting and error handling
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
 *
 * Note: withErrorHandler is optional inside withRateLimit since rate limiting
 * middleware includes its own error handling that properly formats rate limit errors
 * with appropriate headers (Retry-After, X-RateLimit-Reset).
 */
export function withRateLimit<T extends unknown[]>(
  getLimiter: () => Promise<Ratelimit | null>,
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  getGlobalLimiter?: () => Promise<Ratelimit | null>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const logger = getLogger();

    try {
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
          throwRateLimitError(globalResult.reset);
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
        throwRateLimitError(reset);
      }

      // Rate limit passed, execute handler
      const response = await handler(request, ...args);

      // Add rate limit headers to successful responses (industry standard)
      response.headers.set("X-RateLimit-Limit", limit.toString());
      response.headers.set("X-RateLimit-Remaining", remaining.toString());
      response.headers.set("X-RateLimit-Reset", new Date(reset).toISOString());

      return response;
    } catch (error) {
      // Handle rate limit errors and any other errors from handler
      return handleApiError(error);
    }
  };
}
