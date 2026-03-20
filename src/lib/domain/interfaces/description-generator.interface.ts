import { PageMetadata } from "@/lib/domain/models";

/**
 * Interface for description generation strategies
 * Abstracts the underlying description generation method (AI, heuristics, templates, etc.)
 */
export interface IDescriptionGenerator {
  /**
   * Generate a concise description for a single page
   * @param page - Page metadata
   * @returns Concise description (max 15 words)
   */
  generateDescription(page: PageMetadata): Promise<string>;

  /**
   * Generate a business summary for the homepage
   * @param homepage - Homepage metadata
   * @returns 2-3 sentence business summary
   */
  generateBusinessSummary(homepage: PageMetadata): Promise<string>;

  /**
   * Check if the generator is available/configured
   */
  isAvailable(): boolean;
}
