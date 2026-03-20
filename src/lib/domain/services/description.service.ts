import { IDescriptionGenerator, IDescriptionService } from "../interfaces";
import { PageMetadata, SectionGroup } from "@/lib/domain/models";

/**
 * Description Service (Domain Layer)
 * Orchestrates description generation with fallback handling
 * Implements IDescriptionService (which extends IDescriptionGenerator) to provide
 * transparent fallback between AI and heuristic strategies
 */
export class DescriptionService implements IDescriptionService {
  constructor(
    private primaryGenerator: IDescriptionGenerator,
    private fallbackGenerator: IDescriptionGenerator
  ) {}

  /**
   * Check if any generator is available
   */
  isAvailable(): boolean {
    return (
      this.primaryGenerator.isAvailable() ||
      this.fallbackGenerator.isAvailable()
    );
  }

  /**
   * Generate business summary for homepage
   */
  async generateBusinessSummary(homepage: PageMetadata): Promise<string> {
    if (this.primaryGenerator.isAvailable()) {
      try {
        return await this.primaryGenerator.generateBusinessSummary(homepage);
      } catch (error) {
        console.warn(
          "Primary description generator failed for business summary, using fallback:",
          error
        );
      }
    }

    return await this.fallbackGenerator.generateBusinessSummary(homepage);
  }

  /**
   * Generate descriptions for multiple pages
   * Processes sequentially to respect rate limits
   */
  async generateDescriptions(
    pages: PageMetadata[]
  ): Promise<Map<string, string>> {
    const descriptions = new Map<string, string>();

    for (const page of pages) {
      const description = await this.generateDescription(page);
      descriptions.set(page.url, description);
    }

    return descriptions;
  }

  /**
   * Discover sections using AI clustering or fallback to heuristics
   */
  async discoverSections(pages: PageMetadata[]): Promise<SectionGroup[]> {
    if (this.primaryGenerator.isAvailable()) {
      try {
        return await this.primaryGenerator.discoverSections(pages);
      } catch (error) {
        console.warn(
          "Primary description generator failed for section discovery, using fallback:",
          error
        );
      }
    }

    return await this.fallbackGenerator.discoverSections(pages);
  }

  /**
   * Clean page titles using AI or fallback to heuristic patterns
   */
  async cleanTitles(titles: string[]): Promise<string[]> {
    if (this.primaryGenerator.isAvailable()) {
      try {
        return await this.primaryGenerator.cleanTitles(titles);
      } catch (error) {
        console.warn(
          "Primary description generator failed for title cleaning, using fallback:",
          error
        );
      }
    }

    return await this.fallbackGenerator.cleanTitles(titles);
  }

  /**
   * Generate description for a single page with fallback
   */
  async generateDescription(page: PageMetadata): Promise<string> {
    if (this.primaryGenerator.isAvailable()) {
      try {
        return await this.primaryGenerator.generateDescription(page);
      } catch (error) {
        console.warn(
          `Primary description generator failed for ${page.url}, using fallback:`,
          error
        );
      }
    }

    return await this.fallbackGenerator.generateDescription(page);
  }
}
