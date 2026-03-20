import { PageMetadata, SectionGroup } from "@/lib/domain/models";

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
   * Discover logical sections by analyzing page titles and URLs using AI
   * Groups pages into cohesive sections (e.g., "About", "Documentation", "Legal")
   * @param pages - All crawled pages (excluding homepage)
   * @returns Section groupings with names and page assignments
   */
  discoverSections(pages: PageMetadata[]): Promise<SectionGroup[]>;

  /**
   * Clean page titles by removing redundant suffixes and site names
   * Example: "About Us - FastHTML - FastHTML" → "About Us"
   * @param titles - Array of page titles to clean
   * @returns Cleaned titles in same order
   */
  cleanTitles(titles: string[]): Promise<string[]>;

  /**
   * Check if the generator is available/configured
   */
  isAvailable(): boolean;
}
