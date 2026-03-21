import { ISectionDiscoveryService } from "../types";
import { PageMetadata, SectionGroup } from "@/lib/types";

/**
 * Heuristic Section Discovery Service
 * Simple fallback when AI is unavailable - no hardcoded patterns
 * Groups all pages into a single section
 */
export class HeuristicSectionDiscovery implements ISectionDiscoveryService {
  isAvailable(): boolean {
    return true; // Always available as fallback
  }

  /**
   * Heuristic section discovery (fallback when AI is unavailable)
   * Returns all pages in a single "Pages" section
   */
  async discoverSections(pages: PageMetadata[]): Promise<SectionGroup[]> {
    // Simple fallback: put all pages in one section
    return [
      {
        name: "Pages",
        pageIndexes: pages.map((_, idx) => idx),
      },
    ];
  }
}
