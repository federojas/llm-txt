import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/health
 * Health check endpoint for monitoring and deployment verification
 *
 * Used by:
 * - Vercel deployment verification
 * - Uptime monitoring (Datadog, Pingdom, UptimeRobot)
 * - Status pages
 * - CI/CD pipelines
 *
 * Checks:
 * - Database connection (Neon Postgres)
 *
 * Returns:
 * - 200 OK if healthy
 * - 503 Service Unavailable if database is unreachable
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Check database connection with 3 second timeout
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database timeout")), 3000)
      ),
    ]);

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : "Service unavailable",
      },
      { status: 503 }
    );
  }
}
