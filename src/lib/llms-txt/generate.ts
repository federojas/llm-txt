/**
 * Generate llms.txt Use Case
 * Orchestrates the generation of llms.txt files from crawled websites
 */

import { Crawler, LanguageDetector, AdBlocker } from "@/lib/crawling";
import { Formatter } from "./formatter";
import { ContentGeneratorFactory } from "@/lib/content-generation";
import { PatternTitleCleaner } from "@/lib/content-generation/providers/deterministic/pattern-title-cleaner";
import {
  DEFAULT_MAX_PAGES,
  DEFAULT_MAX_DEPTH,
  AI_MODE_MAX_PAGES,
} from "@/lib/config";
import { CRAWL_LIMITS } from "@/lib/crawling/validation";
import { NotFoundError, InternalServerError } from "@/lib/api";
import { CrawlConfig, PageMetadata } from "@/lib/types";
import { GenerateRequest, GenerateResponseData } from "@/lib/api";

export class GenerateLlmsTxt {
  private crawler?: Crawler; // Store crawler instance to access sitemapData

  /**
   * Execute the use case: generate llms.txt content for a given URL with options
   */
  async execute(request: GenerateRequest): Promise<GenerateResponseData> {
    try {
      // Build configuration from request
      const config = this.buildConfig(request);

      // Execute crawl
      const pages = await this.crawlWebsite(config);

      // Validate results
      if (pages.length === 0) {
        throw new NotFoundError(
          "No pages found",
          "Could not crawl any pages from the provided URL"
        );
      }

      // Generate llms.txt content (passes request for user overrides)
      const content = await this.generateContent(pages, request);

      // Return structured response
      return {
        content,
        stats: {
          pagesFound: pages.length,
          url: config.url,
        },
      };
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError) {
        throw error;
      }

      // Wrap unknown errors
      throw new InternalServerError(
        "Failed to generate llms.txt",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Builds crawl configuration from request options
   * Applies mode-specific page limits:
   * - Metadata mode (default): 200 pages, HTML meta tags for page descriptions
   * - AI mode: 50 pages, AI-generated page descriptions (higher API usage)
   * Note: Both modes use AI for site summary + section clustering (2 API calls total)
   * Note: timeout (10s) and concurrency (5) are hardcoded for security
   */
  private buildConfig(request: GenerateRequest): CrawlConfig {
    // Apply mode-specific page limits
    const generationMode = request.generationMode ?? "metadata"; // Default to metadata
    const isAiMode = generationMode === "ai";

    // Determine effective maxPages based on mode
    let effectiveMaxPages: number;
    if (request.maxPages !== undefined) {
      // User explicitly set maxPages - respect it but enforce upper limit
      effectiveMaxPages = Math.min(request.maxPages, CRAWL_LIMITS.MAX_PAGES);
    } else {
      // No explicit maxPages - use mode-specific default
      effectiveMaxPages = isAiMode ? AI_MODE_MAX_PAGES : DEFAULT_MAX_PAGES;
    }

    return {
      url: request.url,
      maxPages: effectiveMaxPages,
      maxDepth: request.maxDepth ?? DEFAULT_MAX_DEPTH,
      timeout: 10000, // Hardcoded: 10s timeout (not user-configurable)
      concurrency: 5, // Hardcoded: 5 concurrent requests (not user-configurable)
      includePatterns: request.includePatterns,
      excludePatterns: request.excludePatterns,
      languageStrategy: request.languageStrategy,
    };
  }

  /**
   * Executes website crawl with language detection
   */
  private async crawlWebsite(config: CrawlConfig): Promise<PageMetadata[]> {
    // Use lightweight language detection (URL patterns + HTML metadata)
    // Relies on Accept-Language header forcing English at HTTP layer
    const languageDetector = new LanguageDetector();

    // Initialize ad blocker for external link filtering
    const adBlocker = new AdBlocker();

    this.crawler = new Crawler(
      config,
      undefined,
      undefined,
      languageDetector,
      adBlocker
    );
    return this.crawler.crawl();
  }

  /**
   * Generates llms.txt content from crawled pages
   */
  private async generateContent(
    pages: PageMetadata[],
    request: GenerateRequest
  ): Promise<string> {
    // Generation mode control (Phase 1: User control)
    // Default to "metadata" for fast, reliable results
    const generationMode = request.generationMode ?? "metadata";
    const isAiMode = generationMode === "ai";

    // Initialize factory with API keys for AI services
    const factory = new ContentGeneratorFactory({
      groq: {
        apiKey: process.env.GROQ_API_KEY,
        rateLimit: 30,
      },
      // Future providers can be added here:
      // openai: { apiKey: process.env.OPENAI_API_KEY },
      // anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    });

    // Create services using factory's fallback chain (AI → heuristics)
    //
    // Site summary: Always uses AI (1 API call)
    // Section clustering: Always uses AI (1 API call) - fallback to heuristics if no API key
    // Page descriptions: Mode-dependent
    //   - "metadata": HTML meta tags (0 API calls per page)
    //   - "ai": AI-generated (~50 API calls)
    const descriptionGenerator = isAiMode
      ? factory.createDescriptionGenerator() // AI for all descriptions
      : factory.createHybridDescriptionGenerator(); // AI for site, metadata for pages

    const sectionDiscovery = factory.createSectionDiscovery(); // Always AI with heuristic fallback

    // Always use pattern-based title cleaning (language-agnostic, free, fast)
    // Pattern approach works for all languages and saves API calls
    const titleCleaning = new PatternTitleCleaner();

    console.log(
      isAiMode
        ? "[Generation Mode] ai mode: AI for site summary (1), section clustering (1), page descriptions (~50)"
        : "[Generation Mode] metadata mode: AI for site summary (1), section clustering (1), HTML meta for pages (0)"
    );

    // Create formatter service with focused dependencies
    const formatterService = new Formatter(
      descriptionGenerator,
      sectionDiscovery,
      titleCleaning
    );

    // Get sitemap data and robots directives from crawler (for link scoring)
    const sitemapData = this.crawler?.getSitemapData();
    const robotsDirectives = this.crawler?.getRobotsDirectives();

    // Generate llms.txt content with all user-provided overrides
    return await formatterService.generate(
      pages,
      request.projectName, // Manual project name override
      sitemapData,
      robotsDirectives,
      request.projectDescription, // Manual description override
      request.titleCleanup, // Manual title cleanup patterns
      generationMode // Page description mode (not used for section discovery)
    );
  }
}

// Export singleton instance
export const generateLlmsTxtUseCase = new GenerateLlmsTxt();
