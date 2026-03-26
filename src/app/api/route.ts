import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";

/**
 * GET /api
 * API root endpoint - provides version information and documentation links
 */
export async function GET() {
  const logger = getLogger();
  const startTime = Date.now();

  logger.info("API documentation requested", {
    event: "api.docs.request",
    path: "/api",
  });

  const correlationId = crypto.randomUUID();

  const response = NextResponse.json({
    name: "llms.txt Generator API",
    version: "1.0.0",
    description: "Generate llms.txt documentation for any website",
    apiFeatures: {
      async: "Jobs processed asynchronously (202 Accepted, poll for results)",
      rateLimiting: "Per-IP and global rate limits applied",
      tracing: "Correlation IDs in x-correlation-id header",
      monitoring: "Structured logging (Axiom) + error tracking (Sentry)",
    },
    responseFormat: {
      success: {
        success: true,
        data: "Response data object",
      },
      error: {
        success: false,
        error: {
          code: "ERROR_CODE",
          message: "Human-readable error message",
        },
      },
    },
    endpoints: {
      root: {
        path: "/api",
        methods: ["GET"],
        description: "This endpoint - API documentation and version info",
      },
      health: {
        path: "/api/health",
        methods: ["GET"],
        description:
          "Health check for monitoring (checks database, Inngest, Groq, Redis)",
      },
      v1: {
        path: "/api/v1",
        methods: ["GET"],
        description:
          "API v1 index - lists all available v1 resources with examples",
      },
      v1Resources: {
        generate: {
          path: "/api/v1/llms-txt",
          methods: ["POST"],
          description: "Generate llms.txt for a URL (async, returns job ID)",
          async: true,
        },
        jobStatus: {
          path: "/api/v1/jobs/:id",
          methods: ["GET"],
          description:
            "Get job status and result (PENDING → PROCESSING → COMPLETED/FAILED)",
        },
      },
    },
  });

  response.headers.set("x-correlation-id", correlationId);

  logger.info("API documentation served", {
    event: "api.docs.response",
    responseTime: Date.now() - startTime,
    correlationId,
  });

  await logger.flush();
  return response;
}
