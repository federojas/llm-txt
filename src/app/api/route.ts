import { NextResponse } from "next/server";

/**
 * GET /api
 * API root endpoint - provides version information and documentation links
 */
export async function GET() {
  return NextResponse.json({
    name: "llms.txt Generator API",
    version: "1.0.0",
    description: "Generate llms.txt documentation for any website",
    documentation: "https://github.com/your-repo/README.md",
    endpoints: {
      health: {
        path: "/api/health",
        methods: ["GET"],
        description: "Health check for monitoring and deployment verification",
      },
      v1: {
        baseUrl: "/api/v1",
        resources: {
          llmsTxt: {
            path: "/api/v1/llms-txt",
            methods: ["POST"],
            description: "Generate llms.txt for a given URL",
          },
          jobs: {
            path: "/api/v1/jobs/:id",
            methods: ["GET"],
            description: "Get job status and result",
          },
        },
      },
    },
  });
}
