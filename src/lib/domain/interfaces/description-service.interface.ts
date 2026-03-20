import { IDescriptionGenerator } from "./description-generator.interface";
import { PageMetadata } from "@/lib/domain/models";

/**
 * Interface for description service
 * Orchestrates description generation with fallback handling
 *
 * Extends IDescriptionGenerator to maintain compatibility while providing
 * a semantic distinction between strategy implementations and the orchestrator.
 * This allows future extension with orchestration-specific methods if needed.
 */
export interface IDescriptionService extends IDescriptionGenerator {
  /**
   * Generate descriptions for multiple pages in batch
   * Processes sequentially to respect rate limits
   * @param pages - Array of page metadata
   * @returns Map of URL to description
   */
  generateDescriptions(pages: PageMetadata[]): Promise<Map<string, string>>;
}
