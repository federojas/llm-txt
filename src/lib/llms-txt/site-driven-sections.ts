/**
 * Site-Driven Section Discovery
 *
 * Discovers logical sections from URL structure using sitemap data.
 * This approach respects the site owner's organization instead of hardcoding assumptions.
 *
 * Strategy:
 * 1. Extract common URL path prefixes (e.g., /docs/*, /api/*, /blog/*)
 * 2. Group pages by prefix
 * 3. Calculate average sitemap priority per section
 * 4. Filter out low-priority sections (noise)
 * 5. Sort by priority and limit based on importance
 */

import type { PageMetadata } from "@/lib/types";
import type { SitemapUrl } from "@/lib/http/sitemap";

export interface DiscoveredSection {
  name: string; // Human-readable section name
  urlPrefix: string; // URL path prefix (e.g., "/docs/")
  priority: number; // Average sitemap priority (0.0-1.0)
  pageCount: number; // Number of pages in this section
  maxLinks: number; // Maximum links to show (based on priority)
  pages: PageMetadata[]; // Pages in this section
}

/**
 * Site-driven section discovery service
 * Uses URL structure and sitemap priorities to organize content
 */
export class SiteDataSectionDiscovery {
  /**
   * Discover sections from URL path structure and sitemap data
   *
   * @param pages - Crawled pages with metadata
   * @param sitemapData - Sitemap data with priorities
   * @returns Discovered sections sorted by priority
   */
  discoverSections(
    pages: PageMetadata[],
    sitemapData: Map<string, SitemapUrl>
  ): DiscoveredSection[] {
    // Extract common path prefixes and group pages
    const prefixGroups = this.groupByUrlPrefix(pages);

    // Build sections with priority data
    const sections: DiscoveredSection[] = [];

    for (const [prefix, pagesInSection] of prefixGroups.entries()) {
      const avgPriority = this.calculateAvgPriority(
        pagesInSection,
        sitemapData
      );

      // Filter sections using priority as quality signal
      // Strategy:
      // - Priority < 0.3: Always filter (low-value content)
      // - Priority >= 0.7 + single page: Allow (important single-page docs like API reference)
      // - Priority < 0.7 + single page: Filter (likely noise/changelog)
      // - Multiple pages: Rely on priority threshold only
      const isHighPrioritySinglePage =
        avgPriority >= 0.7 && pagesInSection.length === 1;
      const isLowPriority = avgPriority < 0.3;
      const isLowPrioritySinglePage =
        avgPriority < 0.7 && pagesInSection.length < 2;

      if (
        isLowPriority ||
        (isLowPrioritySinglePage && !isHighPrioritySinglePage)
      ) {
        continue;
      }

      sections.push({
        name: this.deriveSectionName(prefix),
        urlPrefix: prefix,
        priority: avgPriority,
        pageCount: pagesInSection.length,
        maxLinks: this.calculateMaxLinks(avgPriority, pagesInSection.length),
        pages: pagesInSection,
      });
    }

    // Sort by priority (high to low)
    return sections.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Group pages by URL path prefix
   * Extracts first 1-2 meaningful path segments for semantic subsections
   *
   * Strategy:
   * - Use 2 segments for common parent paths (docs, api, blog)
   * - This creates semantic subsections: /docs/api/, /docs/tutorials/, etc.
   * - Fall back to 1 segment for standalone sections
   *
   * Examples:
   * - /docs/api/reference → /docs/api/ (subsection)
   * - /docs/tutorials/intro → /docs/tutorials/ (subsection)
   * - /blog/2024/post → /blog/ (no subsection, dates not semantic)
   * - /about/team → /about/ (standalone section)
   */
  private groupByUrlPrefix(pages: PageMetadata[]): Map<string, PageMetadata[]> {
    const groups = new Map<string, PageMetadata[]>();

    // Track first-level groups to detect subsections
    const firstLevelCounts = new Map<string, number>();

    // First pass: count pages per first-level segment
    for (const page of pages) {
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
        continue;
      }
    }

    // Second pass: group by prefix (1 or 2 levels)
    for (const page of pages) {
      try {
        const url = new URL(page.url);
        const pathSegments = url.pathname
          .split("/")
          .filter((s) => s.length > 0);

        // Homepage goes to root group
        if (pathSegments.length === 0) {
          const prefix = "/";
          if (!groups.has(prefix)) {
            groups.set(prefix, []);
          }
          groups.get(prefix)!.push(page);
          continue;
        }

        const firstSegment = pathSegments[0];
        const firstLevelCount = firstLevelCounts.get(firstSegment) || 0;

        // Use 2-level prefix if:
        // 1. First level has enough pages (4+) to warrant subsection structure
        //    - Prevents noise from single-page sections (e.g., /docs/changelog.html)
        //    - Quality gates handle other filtering (priority, duplicates, merging)
        // 2. Second segment exists and is semantic (not a date/ID)
        // 3. First segment looks like a semantic parent (validated by isCommonParent)
        const shouldUse2Levels =
          pathSegments.length >= 2 &&
          firstLevelCount >= 4 &&
          this.isSemanticSegment(pathSegments[1]) &&
          this.isCommonParent(firstSegment);

        const prefix = shouldUse2Levels
          ? `/${pathSegments[0]}/${pathSegments[1]}/`
          : `/${pathSegments[0]}/`;

        if (!groups.has(prefix)) {
          groups.set(prefix, []);
        }
        groups.get(prefix)!.push(page);
      } catch {
        // Invalid URL, skip
        continue;
      }
    }

    return groups;
  }

  /**
   * Check if a path segment is semantic (not a date, ID, or numeric value)
   * Semantic: "api", "tutorials", "explains", "reference"
   * Non-semantic: "2024", "123", "v1", "abc123def"
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
   * Uses heuristic: segments with multiple pages (handled by caller) are likely parents
   *
   * This method is intentionally minimal to avoid hardcoding opinions about site structure.
   * The caller already checks page count (4+), so we just verify the segment looks semantic.
   */
  private isCommonParent(segment: string): boolean {
    // Accept any semantic segment (not a date/ID/version)
    // The 4+ page count check in the caller is the real filter
    return this.isSemanticSegment(segment);
  }

  /**
   * Calculate average sitemap priority for pages in a section
   * Defaults to 0.5 for pages not in sitemap
   */
  private calculateAvgPriority(
    pages: PageMetadata[],
    sitemapData: Map<string, SitemapUrl>
  ): number {
    let totalPriority = 0;
    let count = 0;

    for (const page of pages) {
      const sitemapEntry = sitemapData.get(page.url);
      const priority = sitemapEntry?.priority ?? 0.5; // Default to medium priority
      totalPriority += priority;
      count++;
    }

    return count > 0 ? totalPriority / count : 0.5;
  }

  /**
   * Derive human-readable section name from URL prefix
   *
   * Examples:
   * - /docs/ → "Documentation"
   * - /docs/api/ → "API Reference"
   * - /docs/tutorials/ → "Tutorials"
   * - /api/ → "API Reference"
   * - /blog/ → "Blog"
   * - /about/ → "About"
   * - /getting-started/ → "Getting Started"
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
   *
   * Generic transformation with minimal special cases (acronyms only).
   * Works for any language, any site structure.
   *
   * Examples:
   * - "docs" → "Docs"
   * - "api" → "API" (acronym)
   * - "tutorials" → "Tutorials"
   * - "getting-started" → "Getting Started"
   * - "dokumentation" → "Dokumentation" (German, works!)
   * - "howyoutubeworks" → "Howyoutubeworks" (no hardcoded opinions)
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
   * Calculate maximum links to show per section based on priority
   *
   * High priority (0.8-1.0) → 15 links
   * Medium priority (0.5-0.79) → 10 links
   * Low priority (0.3-0.49) → 5 links
   */
  private calculateMaxLinks(priority: number, pageCount: number): number {
    let maxLinks: number;

    if (priority >= 0.8) {
      maxLinks = 15;
    } else if (priority >= 0.5) {
      maxLinks = 10;
    } else {
      maxLinks = 5;
    }

    // Don't exceed actual page count
    return Math.min(maxLinks, pageCount);
  }
}
