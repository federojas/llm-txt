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
    resources: {
      llmsTxt: {
        path: "/api/v1/llms-txt",
        methods: ["POST"],
        description: "Generate llms.txt documentation for any website",
        requestFormat: {
          url: "string (required) - Website URL to generate llms.txt for",
          preset: "string (optional) - quick | thorough | custom",
          maxPages: "number (optional) - Maximum pages to crawl (1-200)",
          maxDepth: "number (optional) - Maximum crawl depth (1-5)",
        },
        example: {
          request: {
            url: "https://example.com",
            preset: "quick",
          },
          response: {
            success: true,
            data: {
              content: "# Example\n\n...",
              stats: {
                pagesFound: 25,
                url: "https://example.com",
              },
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
