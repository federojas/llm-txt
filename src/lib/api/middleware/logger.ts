/**
 * Logger Middleware for Next.js API Routes
 *
 * Adds correlation IDs to all API requests for distributed tracing
 * Logs request start, completion, and errors
 * Integrates with Sentry for error tracking
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createLogger, generateCorrelationId } from "@/lib/logger";
import type { Logger } from "@/lib/logger";

/**
 * Request context stored in headers
 */
export const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Extract correlation ID from request headers or generate new one
 */
export function getOrCreateCorrelationId(request: NextRequest): string {
  const existingId = request.headers.get(CORRELATION_ID_HEADER);
  return existingId || generateCorrelationId();
}

/**
 * Create logger with request context
 *
 * @param request - Next.js request object
 * @param additionalContext - Additional context fields
 * @returns Logger with correlation ID and request context
 */
export function createRequestLogger(
  request: NextRequest,
  additionalContext?: Record<string, unknown>
): { logger: Logger; correlationId: string } {
  const correlationId = getOrCreateCorrelationId(request);

  // Set Sentry tags for error tracking
  // This links Sentry errors back to Axiom logs via correlation ID
  Sentry.setTag("correlationId", correlationId);
  Sentry.setTag("path", request.nextUrl.pathname);
  Sentry.setTag("method", request.method);

  // Set Sentry context for richer error reports
  Sentry.setContext("request", {
    url: request.url,
    method: request.method,
    path: request.nextUrl.pathname,
    query: Object.fromEntries(request.nextUrl.searchParams),
  });

  const logger = createLogger({
    correlationId,
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent") || undefined,
    ...additionalContext,
  });

  return { logger, correlationId };
}

/**
 * Log request start
 */
export function logRequestStart(logger: Logger, request: NextRequest): void {
  logger.info("Request started", {
    event: "request.start",
    method: request.method,
    path: request.nextUrl.pathname,
    query: Object.fromEntries(request.nextUrl.searchParams),
  });
}

/**
 * Log request completion
 */
export function logRequestEnd(
  logger: Logger,
  request: NextRequest,
  response: NextResponse,
  startTime: number
): void {
  const duration = Date.now() - startTime;

  logger.info("Request completed", {
    event: "request.end",
    method: request.method,
    path: request.nextUrl.pathname,
    status: response.status,
    duration,
  });
}

/**
 * Log request error
 * Also captures error in Sentry with full context
 */
export function logRequestError(
  logger: Logger,
  request: NextRequest,
  error: Error | unknown,
  startTime: number
): void {
  const duration = Date.now() - startTime;

  // Log to Axiom
  logger.error("Request failed", {
    event: "request.error",
    method: request.method,
    path: request.nextUrl.pathname,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    duration,
  });

  // Capture in Sentry with additional context
  Sentry.captureException(error, {
    level: "error",
    tags: {
      errorType: "api_error",
    },
    contexts: {
      performance: {
        duration,
      },
    },
  });
}

/**
 * Middleware wrapper for API routes
 *
 * Automatically adds correlation ID and logs request lifecycle
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   return withLogging(request, async (logger, correlationId) => {
 *     logger.info('Processing request');
 *     return NextResponse.json({ success: true });
 *   });
 * }
 */
export async function withLogging<T extends NextResponse>(
  request: NextRequest,
  handler: (logger: Logger, correlationId: string) => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const { logger, correlationId } = createRequestLogger(request);

  logRequestStart(logger, request);

  try {
    const response = await handler(logger, correlationId);

    // Add correlation ID to response headers
    response.headers.set(CORRELATION_ID_HEADER, correlationId);

    logRequestEnd(logger, request, response, startTime);

    // Flush logs to Axiom (important for serverless)
    await logger.flush();

    return response;
  } catch (error) {
    logRequestError(logger, request, error, startTime);
    // Flush error logs before throwing
    await logger.flush();
    throw error;
  }
}
