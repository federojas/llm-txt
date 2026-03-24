/**
 * Sentry Server Configuration
 * Error tracking and performance monitoring for server-side code
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Environment tracking
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",

  // Performance monitoring
  tracesSampleRate: 1.0,

  // Capture 100% of errors (free tier: 5k events/month)
  sampleRate: 1.0,

  // Don't send sensitive data
  beforeSend(event) {
    // Remove PII from event data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }
    return event;
  },

  // Integration with Axiom correlation IDs
  beforeSendTransaction(transaction) {
    // Correlation ID will be set via Sentry.setTag in middleware
    return transaction;
  },

  // Release tracking (auto-detected from Vercel)
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Ignore known errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "Can't find variable: ZiteReader",
    // Network errors
    "NetworkError",
    "Network request failed",
    // Rate limit errors (expected)
    "Rate limit exceeded",
  ],
});
