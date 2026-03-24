/**
 * Next.js Instrumentation
 * Initializes Sentry and other monitoring tools before app startup
 */

export async function register() {
  // Initialize Sentry for Node.js runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  // Initialize Sentry for Edge runtime
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
