/**
 * Sentry Edge Configuration
 * Error tracking for Edge Runtime (middleware, edge API routes)
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Environment tracking
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",

  // Performance monitoring (lower sampling for edge)
  tracesSampleRate: 0.1,

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Don't send sensitive data
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }
    return event;
  },
});
