import { PageMetadata } from "@/lib/domain/models";

/**
 * Interface for description service
 * Orchestrates description generation with fallback handling
 */
export interface IDescriptionService {
  /**
   * Generate a business summary for the homepage
   * @param homepage - Homepage metadata
   * @returns 2-3 sentence business summary
   */
  generateBusinessSummary(homepage: PageMetadata): Promise<string>;

  /**
   * Generate descriptions for multiple pages
   * @param pages - Array of page metadata
   * @returns Map of URL to description
   */
  generateDescriptions(pages: PageMetadata[]): Promise<Map<string, string>>;
}
