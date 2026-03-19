/**
 * LLMs Generator Service
 * Business logic layer for generating llms.txt files
 */

import { Crawler } from "@/lib/domain/crawler";
import { generateLlmsTxt } from "@/lib/domain/generator";
import { getPresetMaxPages, getPresetMaxDepth } from "@/lib/config";
import { NotFoundError, InternalServerError } from "@/lib/api/errors";
import { CrawlConfig, PageMetadata } from "@/types";
import { GenerateRequest, GenerateResponseData } from "@/lib/api/dtos";

export class LlmsGeneratorService {
  /**
   * Generates llms.txt content for a given URL with options
   */
  async generate(request: GenerateRequest): Promise<GenerateResponseData> {
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

      // Generate llms.txt content
      const content = this.generateContent(pages);

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
   */
  private buildConfig(request: GenerateRequest): CrawlConfig {
    return {
      url: request.url,
      maxPages: request.maxPages ?? getPresetMaxPages(request.preset),
      maxDepth: request.maxDepth ?? getPresetMaxDepth(request.preset),
      timeout: request.timeout ?? 10000,
      concurrency: request.concurrency ?? 5,
      includePatterns: request.includePatterns,
      excludePatterns: request.excludePatterns,
    };
  }

  /**
   * Executes website crawl
   */
  private async crawlWebsite(config: CrawlConfig): Promise<PageMetadata[]> {
    const crawler = new Crawler(config);
    return crawler.crawl();
  }

  /**
   * Generates llms.txt content from crawled pages
   */
  private generateContent(pages: PageMetadata[]): string {
    return generateLlmsTxt(pages);
  }
}

// Export singleton instance
export const llmsGeneratorService = new LlmsGeneratorService();
