import { IDescriptionGenerator, IDescriptionService } from "../interfaces";
import { PageMetadata } from "@/types";

/**
 * Description Service (Domain Layer)
 * Orchestrates description generation with fallback handling
 */
export class DescriptionService implements IDescriptionService {
  constructor(
    private primaryGenerator: IDescriptionGenerator,
    private fallbackGenerator: IDescriptionGenerator
  ) {}

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
   * Generate description for a single page with fallback
   */
  private async generateDescription(page: PageMetadata): Promise<string> {
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
