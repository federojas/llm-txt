/**
 * Sentry Client Configuration
 * Error tracking and session replay for browser-side code
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Environment tracking
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",

  // Performance monitoring
  tracesSampleRate: 1.0,

  // Browser tracing
  integrations: [
    Sentry.browserTracingIntegration({
      // Track navigation timing
      traceFetch: true,
      traceXHR: true,
    }),
    Sentry.replayIntegration({
      // Session replay (10% of sessions, 100% of errors)
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Session replay sampling
  replaysSessionSampleRate: 0.1, // 10% of normal sessions
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions

  // Release tracking (auto-detected from Vercel)
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Don't send sensitive data
  beforeSend(event) {
    // Remove PII
    if (event.request) {
      delete event.request.cookies;
    }
    return event;
  },

  // Ignore known errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "Can't find variable: ZiteReader",
    // Network errors
    "NetworkError",
    "Network request failed",
    "Failed to fetch",
    // ResizeObserver errors (benign)
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
  ],
});
