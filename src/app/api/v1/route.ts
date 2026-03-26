import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";

/**
 * GET /api/v1
 * API v1 index - lists all available resources in version 1
 */
export async function GET() {
  const logger = getLogger();
  const startTime = Date.now();

  logger.info("API v1 documentation requested", {
    event: "api.v1.docs.request",
    path: "/api/v1",
  });

  const response = NextResponse.json({
    version: "1",
    description: "Async job-based API for llms.txt generation",
    workflow: {
      step1: "POST /api/v1/llms-txt - Create job (returns immediately)",
      step2: "Poll GET /api/v1/jobs/:id - Check status until completed",
      step3: "Extract content from completed job response",
    },
    resources: {
      createJob: {
        path: "/api/v1/llms-txt",
        methods: ["POST"],
        description:
          "Create async job for llms.txt generation (returns job ID immediately)",
        async: true,
        requestFormat: {
          url: "string (required) - Website URL to generate llms.txt for",
          maxPages:
            "number (optional) - Maximum pages to crawl (1-200, default: 200)",
          maxDepth: "number (optional) - Maximum crawl depth (1-5, default: 3)",
          generationMode:
            "string (optional) - 'metadata' | 'ai' (default: 'metadata')",
          includePatterns: "string[] (optional) - URL patterns to include",
          excludePatterns: "string[] (optional) - URL patterns to exclude",
          projectName:
            "string (optional) - Override auto-detected project name",
          projectDescription:
            "string (optional) - Override AI-generated description",
        },
        exampleRequest: {
          url: "https://example.com",
          maxPages: 50,
          maxDepth: 3,
          generationMode: "metadata",
        },
        exampleResponse: {
          success: true,
          data: {
            jobId: "abc123",
            status: "pending",
            statusUrl: "/api/v1/jobs/abc123",
          },
        },
        statusCode: 202,
      },
      getJobStatus: {
        path: "/api/v1/jobs/:id",
        methods: ["GET"],
        description:
          "Get job status and result (poll until status is 'completed' or 'failed')",
        exampleResponse: {
          pending: {
            success: true,
            data: {
              id: "abc123",
              url: "https://example.com",
              status: "pending",
              content: null,
              pagesFound: null,
              error: null,
              createdAt: "2026-03-26T10:00:00Z",
              completedAt: null,
            },
          },
          processing: {
            success: true,
            data: {
              id: "abc123",
              url: "https://example.com",
              status: "processing",
              content: null,
              pagesFound: null,
              error: null,
              createdAt: "2026-03-26T10:00:00Z",
              completedAt: null,
            },
          },
          completed: {
            success: true,
            data: {
              id: "abc123",
              url: "https://example.com",
              status: "completed",
              content:
                "# Example\n\n> Example description...\n\n## Links\n\n- [Home](https://example.com): Homepage...",
              pagesFound: 42,
              error: null,
              createdAt: "2026-03-26T10:00:00Z",
              completedAt: "2026-03-26T10:02:15Z",
            },
          },
          failed: {
            success: true,
            data: {
              id: "abc123",
              url: "https://example.com",
              status: "failed",
              content: null,
              pagesFound: null,
              error: "No pages found",
              createdAt: "2026-03-26T10:00:00Z",
              completedAt: "2026-03-26T10:00:30Z",
            },
          },
        },
      },
    },
  });

  logger.info("API v1 documentation served", {
    event: "api.v1.docs.response",
    responseTime: Date.now() - startTime,
  });

  await logger.flush();
  return response;
}
