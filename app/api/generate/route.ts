import { NextRequest, NextResponse } from "next/server";
import { Crawler } from "@/lib/crawler";
import { generateLlmsTxt } from "@/lib/generator";
import { crawlOptionsSchema } from "@/lib/validation/schemas";
import { CrawlConfig } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds max

/**
 * POST /api/generate
 * Generate llms.txt for a given URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = crawlOptionsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const options = validation.data;

    // Build config with preset defaults
    const config: CrawlConfig = {
      url: options.url,
      maxPages: options.maxPages ?? getPresetMaxPages(options.preset),
      maxDepth: options.maxDepth ?? getPresetMaxDepth(options.preset),
      timeout: options.timeout ?? 10000,
      concurrency: options.concurrency ?? 5,
      includePatterns: options.includePatterns,
      excludePatterns: options.excludePatterns,
    };

    // Create crawler
    const crawler = new Crawler(config);

    // Crawl the site
    const pages = await crawler.crawl();

    if (pages.length === 0) {
      return NextResponse.json(
        {
          error: "No pages found",
          details: "Could not crawl any pages from the provided URL",
        },
        { status: 404 }
      );
    }

    // Generate llms.txt
    const llmsTxt = generateLlmsTxt(pages);

    return NextResponse.json({
      success: true,
      content: llmsTxt,
      stats: {
        pagesFound: pages.length,
        url: config.url,
      },
    });
  } catch (error) {
    console.error("Error generating llms.txt:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Failed to generate llms.txt",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

function getPresetMaxPages(preset?: string): number {
  switch (preset) {
    case "quick":
      return 25;
    case "thorough":
      return 100;
    default:
      return 50;
  }
}

function getPresetMaxDepth(preset?: string): number {
  switch (preset) {
    case "quick":
      return 2;
    case "thorough":
      return 3;
    default:
      return 3;
  }
}
