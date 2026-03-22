/**
 * Generate llms.txt Use Case
 * Orchestrates the generation of llms.txt files from crawled websites
 */

import { Crawler, LanguageDetector, AdBlocker } from "@/lib/crawling";
import { Formatter } from "./formatter";
import { ContentGeneratorFactory } from "@/lib/ai-enhancement";
import { DEFAULT_MAX_PAGES, DEFAULT_MAX_DEPTH } from "@/lib/config";
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

      // Generate llms.txt content (uses this.crawler for sitemapData)
      const content = await this.generateContent(pages);

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
   * Uses defaults optimized for 60-90s execution: 50 pages, depth 3
   */
  private buildConfig(request: GenerateRequest): CrawlConfig {
    return {
      url: request.url,
      maxPages: request.maxPages ?? DEFAULT_MAX_PAGES,
      maxDepth: request.maxDepth ?? DEFAULT_MAX_DEPTH,
      timeout: request.timeout ?? 10000,
      concurrency: request.concurrency ?? 5,
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
  private async generateContent(pages: PageMetadata[]): Promise<string> {
    // Create content generator factory with provider configuration
    const factory = new ContentGeneratorFactory({
      groq: {
        apiKey: process.env.GROQ_API_KEY,
        rateLimit: 30,
      },
      // Future providers can be added here:
      // openai: { apiKey: process.env.OPENAI_API_KEY },
      // anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    });

    // Create focused AI services with automatic fallback chains
    // Each service tries Groq (if API key available) → falls back to heuristics
    const descriptionGenerator = factory.createDescriptionGenerator();
    const sectionDiscovery = factory.createSectionDiscovery();
    const titleCleaning = factory.createTitleCleaning();

    // Create formatter service with focused dependencies
    const formatterService = new Formatter(
      descriptionGenerator,
      sectionDiscovery,
      titleCleaning
    );

    // Get sitemap data and robots directives from crawler (for link scoring)
    const sitemapData = this.crawler?.getSitemapData();
    const robotsDirectives = this.crawler?.getRobotsDirectives();

    // Generate llms.txt content with crawler metadata
    return await formatterService.generate(
      pages,
      undefined,
      sitemapData,
      robotsDirectives
    );
  }
}

// Export singleton instance
export const generateLlmsTxtUseCase = new GenerateLlmsTxt();
