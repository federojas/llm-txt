/**
 * Hybrid Description Generator
 *
 * Strategy: Best of both worlds
 * - Site summary: AI (1 API call, high quality, appears at top)
 * - Page descriptions: Metadata/heuristics (0 API calls, fast)
 *
 * This provides high-quality summaries with fast execution for metadata mode.
 */

import { IDescriptionGenerator } from "../core/types";
import { PageMetadata } from "@/lib/types";
import { MetadataAccumulator } from "../metadata-accumulator";

export class HybridDescriptionGenerator implements IDescriptionGenerator {
  constructor(
    private summaryGenerator: IDescriptionGenerator, // AI generator for summaries
    private pageGenerator: IDescriptionGenerator // Heuristic generator for pages
  ) {}

  /**
   * Generate page description using heuristics (HTML meta tags)
   * Fast, no API calls
   */
  async generateDescription(
    page: PageMetadata,
    metadataAccumulator?: MetadataAccumulator
  ): Promise<string> {
    return this.pageGenerator.generateDescription(page, metadataAccumulator);
  }

  /**
   * Generate business summary using AI
   * 1 API call, high quality
   */
  async generateBusinessSummary(
    homepage: PageMetadata,
    metadataAccumulator?: MetadataAccumulator
  ): Promise<string> {
    return this.summaryGenerator.generateBusinessSummary(
      homepage,
      metadataAccumulator
    );
  }

  /**
   * Available if either generator is available
   */
  isAvailable(): boolean {
    return (
      this.summaryGenerator.isAvailable() || this.pageGenerator.isAvailable()
    );
  }
}
