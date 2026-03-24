import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { getLogger } from "@/lib/logger";

/**
 * GET /api/health
 * Health check endpoint for monitoring and deployment verification
 *
 * Used by:
 * - Vercel deployment verification
 * - Uptime monitoring (Datadog, Pingdom, UptimeRobot)
 * - Status pages
 * - CI/CD pipelines
 * - Kubernetes liveness/readiness probes
 *
 * Checks:
 * - Database connection (Neon Postgres) - CRITICAL
 * - Inngest background jobs (event/signing keys) - CRITICAL
 * - Groq API availability (key format validation) - NON-CRITICAL
 *
 * Returns:
 * - 200 OK with "healthy" - All services operational
 * - 200 OK with "degraded" - Critical services up, optional services down
 * - 503 Service Unavailable with "unhealthy" - Critical services down
 *
 * Note: Groq API failures return "degraded" not 503 (graceful degradation)
 */
interface HealthCheck {
  name: string;
  status: "healthy" | "unhealthy";
  responseTime: number;
  error?: string;
}

export async function GET() {
  const startTime = Date.now();
  const logger = getLogger();
  const checks: HealthCheck[] = [];

  // Check 1: Database (CRITICAL - blocks 503 if fails)
  const dbCheck = await checkDatabase();
  checks.push(dbCheck);

  // Check 2: Inngest (CRITICAL - background jobs won't process if down)
  const inngestCheck = await checkInngest();
  checks.push(inngestCheck);

  // Check 3: Groq API (NON-CRITICAL - logs warning but doesn't block)
  const groqCheck = await checkGroqAPI();
  checks.push(groqCheck);

  // Determine overall status
  // Note: Even if Inngest is down, API can accept requests (202) and queue jobs
  // Jobs will process once Inngest recovers (eventual consistency)
  const criticalChecks = checks.filter((c) =>
    ["database", "inngest"].includes(c.name)
  );
  const allCriticalHealthy = criticalChecks.every(
    (c) => c.status === "healthy"
  );
  const allHealthy = checks.every((c) => c.status === "healthy");

  const overallStatus = allCriticalHealthy
    ? allHealthy
      ? "healthy"
      : "degraded"
    : "unhealthy";

  const responseTime = Date.now() - startTime;

  // Log health check results
  logger.info("Health check completed", {
    event: "health.check",
    status: overallStatus,
    responseTime,
    checks: checks.map((c) => ({
      name: c.name,
      status: c.status,
      responseTime: c.responseTime,
    })),
  });

  // Capture in Sentry if unhealthy
  if (overallStatus === "unhealthy") {
    const failedChecks = checks.filter((c) => c.status === "unhealthy");
    Sentry.captureMessage("Health check failed", {
      level: "error",
      tags: {
        healthStatus: overallStatus,
      },
      contexts: {
        healthCheck: {
          failedChecks: failedChecks.map((c) => c.name),
          responseTime,
        },
      },
    });
  }

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime,
      checks:
        process.env.NODE_ENV === "development"
          ? checks
          : checks.map((c) => ({
              name: c.name,
              status: c.status,
              responseTime: c.responseTime,
            })),
    },
    { status: statusCode }
  );
}

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database timeout")), 3000)
      ),
    ]);

    return {
      name: "database",
      status: "healthy",
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: "database",
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkInngest(): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    // Check if required Inngest environment variables are configured
    const eventKey = process.env.INNGEST_EVENT_KEY;
    const signingKey = process.env.INNGEST_SIGNING_KEY;

    if (!eventKey || !signingKey) {
      return {
        name: "inngest",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        error: "Missing INNGEST_EVENT_KEY or INNGEST_SIGNING_KEY",
      };
    }

    // Validate key formats
    const validEventKey = eventKey.length > 0;
    const validSigningKey = signingKey.startsWith("signkey-");

    if (!validEventKey || !validSigningKey) {
      return {
        name: "inngest",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        error: "Invalid Inngest key format",
      };
    }

    // Note: We don't actually call Inngest API here to avoid:
    // 1. Adding latency to health checks
    // 2. Creating test events that count against quota
    // 3. Requiring network calls for every health check
    //
    // If Inngest is actually down, errors will show up in:
    // - Axiom logs (event: "inngest.job.failed")
    // - Sentry (job processing errors)
    // - Job status queries (jobs stuck in PROCESSING)

    return {
      name: "inngest",
      status: "healthy",
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: "inngest",
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkGroqAPI(): Promise<HealthCheck> {
  const startTime = Date.now();

  // Only check if API key is configured
  if (!process.env.GROQ_API_KEY) {
    return {
      name: "groq",
      status: "healthy",
      responseTime: 0,
      error: "Not configured (optional)",
    };
  }

  try {
    // Quick check: Just verify API key format is valid
    // Don't actually call the API (would be slow and count against quota)
    const isValidFormat = process.env.GROQ_API_KEY.startsWith("gsk_");

    return {
      name: "groq",
      status: isValidFormat ? "healthy" : "unhealthy",
      responseTime: Date.now() - startTime,
      error: isValidFormat ? undefined : "Invalid API key format",
    };
  } catch (error) {
    return {
      name: "groq",
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
