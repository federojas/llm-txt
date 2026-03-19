import { NextResponse } from "next/server";

/**
 * GET /api/v1
 * API v1 index - lists all available resources in version 1
 */
export async function GET() {
  return NextResponse.json({
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
}
