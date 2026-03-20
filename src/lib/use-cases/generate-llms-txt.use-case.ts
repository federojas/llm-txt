/**
 * Generate llms.txt Use Case
 * Orchestrates the generation of llms.txt files from crawled websites
 */

import { CrawlerService } from "@/lib/domain/services/crawler.service";
import { LanguageDetectorService } from "@/lib/domain/services/language-detector.service";
import { GeneratorService } from "@/lib/domain/services/generator.service";
import { DescriptionService } from "@/lib/domain/services/description.service";
import { DescriptionGeneratorFactory } from "@/lib/infrastructure/adapters/description-generators";
import { getPresetMaxPages, getPresetMaxDepth } from "@/lib/config";
import { NotFoundError, InternalServerError } from "@/lib/api/errors";
import { CrawlConfig, PageMetadata } from "@/lib/domain/models";
import { GenerateRequest, GenerateResponseData } from "@/lib/api/dtos";

export class GenerateLlmsTxt {
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

      // Generate llms.txt content
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
      languageStrategy: request.languageStrategy,
    };
  }

  /**
   * Executes website crawl with language detection
   */
  private async crawlWebsite(config: CrawlConfig): Promise<PageMetadata[]> {
    // Use lightweight language detection (URL patterns + HTML metadata)
    // Relies on Accept-Language header forcing English at HTTP layer
    const languageDetector = new LanguageDetectorService();

    const crawler = new CrawlerService(
      config,
      undefined,
      undefined,
      languageDetector
    );
    return crawler.crawl();
  }

  /**
   * Generates llms.txt content from crawled pages
   */
  private async generateContent(pages: PageMetadata[]): Promise<string> {
    // Create description service dependencies
    const primaryGenerator =
      DescriptionGeneratorFactory.createPrimaryGenerator();
    const fallbackGenerator =
      DescriptionGeneratorFactory.createFallbackGenerator();
    const descriptionService = new DescriptionService(
      primaryGenerator || fallbackGenerator,
      fallbackGenerator
    );

    // Create generator service with injected dependencies
    const generatorService = new GeneratorService(descriptionService);

    // Generate llms.txt content
    return await generatorService.generate(pages);
  }
}

// Export singleton instance
export const generateLlmsTxtUseCase = new GenerateLlmsTxt();
