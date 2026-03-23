import { ISectionDiscoveryService } from "../../core/types";
import { PageMetadata, SectionGroup } from "@/lib/types";

/**
 * Generic Section Discovery (Last Resort)
 *
 * Simple fallback that groups all pages into a single "Pages" section.
 * Used when all other discovery methods fail or return no sections.
 *
 * When used:
 * - AI is rate-limited or unavailable
 * - URL structure is flat (no prefixes to group by)
 * - Site has very few pages (< 2 per section)
 *
 * Strategy: Groups all pages into one generic section.
 *
 * Fallback chain position:
 * 1. AI (Groq) → semantic clustering
 * 2. URL structure → path-based grouping
 * 3. Generic → single section (this) ← Last resort
 */
export class GenericSectionDiscovery implements ISectionDiscoveryService {
  isAvailable(): boolean {
    return true; // Always available as last resort
  }

  /**
   * Returns all pages in a single generic "Pages" section
   * This ensures output always has at least one section
   */
  async discoverSections(pages: PageMetadata[]): Promise<SectionGroup[]> {
    console.log(
      `[GenericSectionDiscovery] Using last resort: single "Pages" section with ${pages.length} pages`
    );

    return [
      {
        name: "Pages",
        pageIndexes: pages.map((_, idx) => idx),
      },
    ];
  }
}
