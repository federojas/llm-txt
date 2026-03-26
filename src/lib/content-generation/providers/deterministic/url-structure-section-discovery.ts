import { PageMetadata, SectionGroup } from "@/lib/types";
import { ISectionDiscoveryService } from "../../core/types";

/**
 * URL Structure Section Discovery (Enhanced with Sitemap Intelligence)
 *
 * Non-AI section discovery that analyzes URL path structure and uses
 * relevance scores (from link scoring with sitemap priorities) for quality.
 *
 * Advantages:
 * - No API dependency (free, always available)
 * - Fast (simple string parsing)
 * - Deterministic (same input = same output)
 * - Respects site's own URL organization
 * - Uses sitemap priorities via relevanceScore (from link scoring)
 * - Detects and filters user-generated content
 *
 * Algorithm:
 * 1. Extract path prefixes from URLs (1-2 levels for subsections)
 * 2. Group pages by prefix
 * 3. Calculate average relevance score per section (from link scoring)
 * 4. Filter low-priority sections and UGC
 * 5. Generate human-readable section names
 *
 * Examples:
 * - /docs/api/reference → Section: "API Reference" (/docs/api/)
 * - /docs/tutorials/intro → Section: "Tutorials" (/docs/tutorials/)
 * - /credit-cards/overview → Section: "Credit Cards"
 * - /channel/* (many pages, low scores) → Filtered as UGC
 *
 * Part of the fallback chain when AI is unavailable.
 */
export class UrlStructureSectionDiscovery implements ISectionDiscoveryService {
  private readonly maxSections: number;
  private readonly minAvgRelevance: number;
  private readonly ugcThreshold: number;

  constructor(
    maxSections: number = 10,
    minAvgRelevance: number = 30, // Minimum average relevance score
    ugcThreshold: number = 15 // Pages threshold for UGC detection
  ) {
    this.maxSections = maxSections;
    this.minAvgRelevance = minAvgRelevance;
    this.ugcThreshold = ugcThreshold;
  }

  /**
   * Always available (no dependencies)
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Discover sections from URL path structure with quality filtering
   */
  async discoverSections(pages: PageMetadata[]): Promise<SectionGroup[]> {
    console.log(
      `[UrlStructureSectionDiscovery] Analyzing ${pages.length} pages by URL structure...`
    );

    // Group pages by URL prefix (1-2 levels for subsections)
    const prefixGroups = this.groupByUrlPrefix(pages);

    console.log(
      `[UrlStructureSectionDiscovery] Found ${prefixGroups.size} prefix groups`
    );

    // Convert to section groups with quality filtering
    const sections: SectionGroup[] = [];
    for (const [prefix, pageIndexes] of prefixGroups.entries()) {
      const sectionPages = pageIndexes.map((idx) => pages[idx]);

      // Calculate average relevance score (from link scoring)
      const avgRelevance = this.calculateAvgRelevance(sectionPages);

      // Filter sections using multiple criteria
      const isHighRelevanceSinglePage =
        avgRelevance >= 70 && pageIndexes.length === 1;
      const isLowRelevance = avgRelevance < this.minAvgRelevance;
      const isLowRelevanceSinglePage =
        avgRelevance < 70 && pageIndexes.length < 2;

      // Skip low-quality sections
      if (
        isLowRelevance ||
        (isLowRelevanceSinglePage && !isHighRelevanceSinglePage)
      ) {
        console.log(
          `[UrlStructureSectionDiscovery] Filtered low-relevance section "${prefix}" (${pageIndexes.length} pages, score: ${avgRelevance.toFixed(1)})`
        );
        continue;
      }

      // Detect and filter User-Generated Content
      if (this.isLikelyUGC(sectionPages, avgRelevance)) {
        console.log(
          `[UrlStructureSectionDiscovery] Filtered UGC section "${prefix}" (${pageIndexes.length} pages, score: ${avgRelevance.toFixed(1)})`
        );
        continue;
      }

      const name = this.deriveSectionName(prefix);
      sections.push({
        name,
        pageIndexes,
      });

      console.log(
        `[UrlStructureSectionDiscovery] ✓ Section "${name}" (${prefix}) - ${pageIndexes.length} pages, relevance: ${avgRelevance.toFixed(1)}`
      );
    }

    // Sort by average relevance score (highest first), then page count
    sections.sort((a, b) => {
      const aPages = a.pageIndexes.map((idx) => pages[idx]);
      const bPages = b.pageIndexes.map((idx) => pages[idx]);
      const aRelevance = this.calculateAvgRelevance(aPages);
      const bRelevance = this.calculateAvgRelevance(bPages);

      if (Math.abs(aRelevance - bRelevance) > 5) {
        return bRelevance - aRelevance; // Higher relevance first
      }
      return b.pageIndexes.length - a.pageIndexes.length; // More pages first
    });

    // Limit number of sections
    const limitedSections = sections.slice(0, this.maxSections);

    console.log(
      `[UrlStructureSectionDiscovery] Discovered ${limitedSections.length} sections from URL structure`
    );

    return limitedSections;
  }

  /**
   * Group pages by URL path prefix (1-2 levels for subsections)
   *
   * Strategy: Use 2-level prefixes for large sections to create semantic subsections
   * Examples:
   * - /docs/api/reference → /docs/api/ (subsection)
   * - /docs/tutorials/intro → /docs/tutorials/ (subsection)
   * - /blog/2024/post → /blog/ (no subsection for dates)
   * - /about/team → /about/ (standalone section)
   */
  private groupByUrlPrefix(pages: PageMetadata[]): Map<string, number[]> {
    const groups = new Map<string, number[]>();

    // Track first-level counts to detect subsections
    const firstLevelCounts = new Map<string, number>();

    // First pass: count pages per first-level segment
    pages.forEach((page) => {
      try {
        const url = new URL(page.url);
        const pathSegments = url.pathname
          .split("/")
          .filter((s) => s.length > 0);

        if (pathSegments.length > 0) {
          const firstSegment = pathSegments[0];
          firstLevelCounts.set(
            firstSegment,
            (firstLevelCounts.get(firstSegment) || 0) + 1
          );
        }
      } catch {
        // Invalid URL, skip
      }
    });

    // Second pass: group by prefix (1 or 2 levels)
    pages.forEach((page, index) => {
      try {
        const url = new URL(page.url);
        const pathSegments = url.pathname
          .split("/")
          .filter((s) => s.length > 0);

        // Homepage goes to root group
        if (pathSegments.length === 0) {
          const prefix = "/";
          const existing = groups.get(prefix) || [];
          existing.push(index);
          groups.set(prefix, existing);
          return;
        }

        const firstSegment = pathSegments[0];
        const firstLevelCount = firstLevelCounts.get(firstSegment) || 0;

        // Use 2-level prefix if:
        // 1. First level has enough pages (15+) to warrant subsection structure
        // 2. Second segment exists and is semantic (not a date/ID)
        // 3. First segment looks like a common parent
        const shouldUse2Levels =
          pathSegments.length >= 2 &&
          firstLevelCount >= 15 &&
          this.isSemanticSegment(pathSegments[1]) &&
          this.isCommonParent(firstSegment);

        const prefix = shouldUse2Levels
          ? `/${pathSegments[0]}/${pathSegments[1]}/`
          : `/${pathSegments[0]}/`;

        const existing = groups.get(prefix) || [];
        existing.push(index);
        groups.set(prefix, existing);
      } catch {
        // Invalid URL, skip
      }
    });

    return groups;
  }

  /**
   * Check if a path segment is semantic (not a date, ID, or numeric value)
   */
  private isSemanticSegment(segment: string): boolean {
    // Reject dates (2024, 01, etc.)
    if (/^\d{2,4}$/.test(segment)) {
      return false;
    }

    // Reject version numbers (v1, v2, etc.)
    if (/^v\d+$/.test(segment)) {
      return false;
    }

    // Reject UUIDs and hash-like IDs
    if (segment.length > 20 || /^[a-f0-9]{8,}$/.test(segment)) {
      return false;
    }

    // Must contain letters (not just numbers/symbols)
    return /[a-z]/i.test(segment);
  }

  /**
   * Check if a first-level segment is likely to have subsections
   */
  private isCommonParent(segment: string): boolean {
    // Accept any semantic segment (not a date/ID/version)
    // The 15+ page count check in the caller is the real filter
    return this.isSemanticSegment(segment);
  }

  /**
   * Derive human-readable section name from URL prefix
   *
   * Examples:
   * - / → "Overview"
   * - /docs/ → "Docs"
   * - /docs/api/ → "API Reference"
   * - /docs/tutorials/ → "Tutorials"
   * - /api/ → "API Reference"
   * - /credit-cards/ → "Credit Cards"
   * - /auto-loans/ → "Auto Loans"
   */
  private deriveSectionName(prefix: string): string {
    // Remove leading/trailing slashes
    const cleaned = prefix.replace(/^\/|\/$/g, "");

    if (!cleaned) {
      return "Overview";
    }

    // Split into segments (e.g., "docs/api" → ["docs", "api"])
    const segments = cleaned.split("/");

    // Special cases for 2-level paths (subsections)
    if (segments.length === 2) {
      const [parent, child] = segments;

      // For /docs/* paths, use the child segment as the name
      if (parent === "docs" || parent === "documentation") {
        return this.segmentToTitle(child);
      }

      // For other 2-level paths, use both segments
      return `${this.segmentToTitle(parent)} - ${this.segmentToTitle(child)}`;
    }

    // Single-level paths
    return this.segmentToTitle(segments[0]);
  }

  /**
   * Convert a single path segment to a human-readable title
   */
  private segmentToTitle(segment: string): string {
    // Uppercase known acronyms (language-agnostic, small list)
    const acronyms = [
      "api",
      "faq",
      "svg",
      "html",
      "css",
      "js",
      "xml",
      "json",
      "rest",
      "graphql",
      "sdk",
      "url",
      "ai",
      "ml",
    ];

    if (acronyms.includes(segment.toLowerCase())) {
      return segment.toUpperCase();
    }

    // Convert kebab-case/snake_case to Title Case
    return segment
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Calculate average relevance score for pages in a section
   * Uses relevanceScore from link scoring (includes sitemap priorities)
   */
  private calculateAvgRelevance(pages: PageMetadata[]): number {
    if (pages.length === 0) return 0;

    const scores = pages.map((p) => p.relevanceScore ?? 50); // Default 50 if not scored
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  }

  /**
   * Detect User-Generated Content using relevance scores
   *
   * Strategy: Many pages with consistently low relevance scores = UGC aggregation
   *
   * Decision rules:
   * 1. Many pages (15+) with low avg relevance (< 25) → UGC
   * 2. Respects robots.txt (if allowed) and sitemap priorities (via relevance score)
   *
   * Examples:
   * - YouTube /channel/* (21 pages, avg score 0) → UGC ✅
   * - YouTube /creators/ (3 pages, avg score 20) → Valid content ✅
   */
  private isLikelyUGC(pages: PageMetadata[], avgRelevance: number): boolean {
    const pageCount = pages.length;

    // Rule 1: Many pages + low relevance → UGC aggregation
    if (pageCount >= this.ugcThreshold && avgRelevance < 25) {
      return true;
    }

    // Default: Assume valid content
    return false;
  }
}
