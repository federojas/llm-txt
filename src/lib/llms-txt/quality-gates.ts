/**
 * Quality Gates for llms.txt Output
 *
 * Filters and refines the generated content to ensure high quality:
 * - Global deduplication across all sections
 * - Optional section size limits
 * - Low-relevance content pruning
 */

import type { LlmsTxtSection } from "@/lib/types";

export interface QualityGateConfig {
  maxOptionalItems: number; // Max items in Optional section (default: 5)
  minOptionalRelevance: number; // Min relevance score for Optional items (default: 30)
  allowDuplicatesInOptional: boolean; // Allow main section items in Optional (default: false)
  excludeUrlPatterns?: RegExp[]; // URL patterns to exclude (user-generated content, etc.)
  mergeSimilarSections: boolean; // Merge sections with similar URL patterns (default: true)
  maxLinksPerSection: number; // Max links per section after merging (default: 10)
}

const DEFAULT_CONFIG: QualityGateConfig = {
  maxOptionalItems: 20, // Real-world sites (e.g., FastHTML) have 15+ optional items
  minOptionalRelevance: 30,
  allowDuplicatesInOptional: false,
  mergeSimilarSections: true,
  maxLinksPerSection: 10,
  // No default exclusions - rely on sitemap priority and depth scoring instead
  // This keeps the code generic and maintainable
  excludeUrlPatterns: undefined,
};

/**
 * Quality gate filter service
 * Applies multiple quality checks to improve output
 */
export class QualityGateFilter {
  private config: QualityGateConfig;

  constructor(config: Partial<QualityGateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Apply all quality gates to sections
   *
   * @param mainSections - Main sections to display
   * @param optionalSection - Optional section (may be undefined)
   * @returns Filtered sections with quality gates applied
   */
  apply(
    mainSections: LlmsTxtSection[],
    optionalSection?: LlmsTxtSection
  ): {
    mainSections: LlmsTxtSection[];
    optionalSection?: LlmsTxtSection;
  } {
    // Step 1: Filter out excluded URL patterns (user-generated content, etc.)
    const patternFilteredMain = this.filterByUrlPatterns(mainSections);

    // Step 2: Merge similar sections based on URL patterns
    const mergedSections = this.config.mergeSimilarSections
      ? this.mergeSimilarSections(patternFilteredMain)
      : patternFilteredMain;

    // Step 3: Global deduplication across all main sections
    const deduplicatedMain = this.globalDeduplication(mergedSections);

    // Step 4: Filter and limit Optional section
    let filteredOptional: LlmsTxtSection | undefined = undefined;

    if (optionalSection && optionalSection.links.length > 0) {
      // Remove duplicates from main sections
      const mainUrls = new Set<string>();
      for (const section of deduplicatedMain) {
        for (const link of section.links) {
          mainUrls.add(link.url);
        }
      }

      // Filter Optional section
      let optionalLinks = optionalSection.links;

      // Filter by URL patterns (remove user-generated content)
      optionalLinks = optionalLinks.filter((link) => {
        return !this.shouldExcludeUrl(link.url);
      });

      if (!this.config.allowDuplicatesInOptional) {
        // Remove links that already exist in main sections
        optionalLinks = optionalLinks.filter((link) => !mainUrls.has(link.url));
      }

      // Deduplicate within Optional section
      const seen = new Set<string>();
      optionalLinks = optionalLinks.filter((link) => {
        if (seen.has(link.url)) {
          return false;
        }
        seen.add(link.url);
        return true;
      });

      // Limit size (strict for Optional - only truly optional content)
      if (optionalLinks.length > this.config.maxOptionalItems) {
        // Keep highest relevance items if available
        // Otherwise keep first N items (already sorted by priority)
        optionalLinks = optionalLinks.slice(0, this.config.maxOptionalItems);
      }

      if (optionalLinks.length > 0) {
        filteredOptional = {
          title: "Optional",
          links: optionalLinks,
        };
      }
    }

    return {
      mainSections: deduplicatedMain,
      optionalSection: filteredOptional,
    };
  }

  /**
   * Merge similar sections based on URL patterns and identical titles
   * Uses path similarity to identify related sections (e.g., /about/* and /howyoutubeworks/*)
   *
   * Algorithm:
   * 1. First merge sections with identical titles (e.g., two "Overview" sections)
   * 2. Extract domain-specific patterns from URLs
   * 3. Group sections by pattern similarity
   * 4. Merge groups under most representative name
   * 5. Limit links per merged section
   */
  private mergeSimilarSections(sections: LlmsTxtSection[]): LlmsTxtSection[] {
    if (sections.length <= 1) {
      return sections;
    }

    // Step 1: Merge sections with identical titles
    const titleMerged = this.mergeSectionsByTitle(sections);

    // Step 2: Merge by URL pattern similarity
    const sectionMetadata = titleMerged.map((section) => ({
      section,
      urlPatterns: this.extractUrlPatterns(section),
    }));

    // Merge sections with overlapping URL patterns
    const merged: LlmsTxtSection[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < sectionMetadata.length; i++) {
      if (processed.has(i)) continue;

      const currentSection = sectionMetadata[i].section;
      const currentPatterns = sectionMetadata[i].urlPatterns;
      const mergedLinks = [...currentSection.links];

      // Find similar sections to merge
      for (let j = i + 1; j < sectionMetadata.length; j++) {
        if (processed.has(j)) continue;

        const otherPatterns = sectionMetadata[j].urlPatterns;

        // Check if sections share common URL patterns (domain-specific)
        if (this.haveSimilarPatterns(currentPatterns, otherPatterns)) {
          // Merge this section
          mergedLinks.push(...sectionMetadata[j].section.links);
          processed.add(j);
        }
      }

      // Limit merged section size
      const limitedLinks = mergedLinks.slice(0, this.config.maxLinksPerSection);

      merged.push({
        title: currentSection.title,
        links: limitedLinks,
      });

      processed.add(i);
    }

    return merged;
  }

  /**
   * Merge sections with identical titles
   * Combines all links from sections with the same title
   */
  private mergeSectionsByTitle(sections: LlmsTxtSection[]): LlmsTxtSection[] {
    const titleMap = new Map<string, LlmsTxtSection>();

    for (const section of sections) {
      const existing = titleMap.get(section.title);

      if (existing) {
        // Merge links into existing section
        existing.links.push(...section.links);
      } else {
        // Create new entry
        titleMap.set(section.title, {
          title: section.title,
          links: [...section.links],
        });
      }
    }

    return Array.from(titleMap.values());
  }

  /**
   * Extract URL patterns from section links
   * Returns path prefixes (1 or 2 segments) to match site-driven section discovery
   *
   * Examples:
   * - /docs/tutorials/intro → "docs/tutorials"
   * - /about/team → "about"
   * - /blog/2024/post → "blog"
   */
  private extractUrlPatterns(section: LlmsTxtSection): Set<string> {
    const patterns = new Set<string>();

    for (const link of section.links) {
      try {
        const url = new URL(link.url);
        const pathSegments = url.pathname
          .split("/")
          .filter((s) => s.length > 0);

        if (pathSegments.length === 0) {
          patterns.add("/");
        } else if (pathSegments.length === 1) {
          // Single-level path: /about → "about"
          patterns.add(pathSegments[0].toLowerCase());
        } else {
          // Multi-level path: extract first 2 segments
          // /docs/tutorials/intro → "docs/tutorials"
          // This matches 2-level subsections from site-driven discovery
          patterns.add(`${pathSegments[0]}/${pathSegments[1]}`.toLowerCase());
        }
      } catch {
        // Invalid URL, skip
      }
    }

    return patterns;
  }

  /**
   * Check if two URL pattern sets are similar
   * Uses domain knowledge: sections about the same topic use related path segments
   */
  private haveSimilarPatterns(
    patterns1: Set<string>,
    patterns2: Set<string>
  ): boolean {
    // Check for direct overlap
    for (const pattern of patterns1) {
      if (patterns2.has(pattern)) {
        return true;
      }
    }

    // Check for semantic similarity using pattern matching (no hardcoded lists)
    // Look for shared words in path segments
    for (const p1 of patterns1) {
      for (const p2 of patterns2) {
        // Extract words from path segments
        const words1 = p1.split(/[-_]/);
        const words2 = p2.split(/[-_]/);

        // Check for common words (semantic similarity)
        for (const w1 of words1) {
          for (const w2 of words2) {
            if (w1.length >= 4 && w2.length >= 4 && w1 === w2) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Filter sections by URL patterns and section characteristics
   * Removes user-generated content and other excluded patterns
   *
   * Generic heuristic: Sections with single-word generic names (Channel, User, Profile)
   * and many similar items are likely UGC aggregation pages
   */
  private filterByUrlPatterns(sections: LlmsTxtSection[]): LlmsTxtSection[] {
    const filteredSections: LlmsTxtSection[] = [];

    for (const section of sections) {
      // Filter by URL patterns if configured
      let filteredLinks = section.links;

      if (
        this.config.excludeUrlPatterns &&
        this.config.excludeUrlPatterns.length > 0
      ) {
        filteredLinks = filteredLinks.filter((link) => {
          return !this.shouldExcludeUrl(link.url);
        });
      }

      // Generic heuristic: Filter sections with UGC-like characteristics
      // - Single-word title (Channel, User, Profile, Member, etc.)
      // - Many items (8+ suggests aggregation page)
      const isSingleWord = section.title.split(/\s+/).length === 1;
      const hasManyItems = filteredLinks.length >= 8;

      if (isSingleWord && hasManyItems) {
        // Likely UGC aggregation - skip this section
        console.log(
          `[Quality Gates] Filtered UGC section: "${section.title}" (${filteredLinks.length} items)`
        );
        continue;
      }

      // Only include section if it has links after filtering
      if (filteredLinks.length > 0) {
        filteredSections.push({
          ...section,
          links: filteredLinks,
        });
      }
    }

    return filteredSections;
  }

  /**
   * Check if URL should be excluded based on patterns
   * Uses regex patterns to identify user-generated content, etc.
   */
  private shouldExcludeUrl(url: string): boolean {
    if (!this.config.excludeUrlPatterns) {
      return false;
    }

    for (const pattern of this.config.excludeUrlPatterns) {
      if (pattern.test(url)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Global deduplication across all main sections
   * Removes duplicate URLs, keeping only the first occurrence
   */
  private globalDeduplication(sections: LlmsTxtSection[]): LlmsTxtSection[] {
    const seenUrls = new Set<string>();
    const deduplicatedSections: LlmsTxtSection[] = [];

    for (const section of sections) {
      const uniqueLinks = section.links.filter((link) => {
        if (seenUrls.has(link.url)) {
          return false; // Skip duplicate
        }
        seenUrls.add(link.url);
        return true;
      });

      // Only include section if it has links
      if (uniqueLinks.length > 0) {
        deduplicatedSections.push({
          ...section,
          links: uniqueLinks,
        });
      }
    }

    return deduplicatedSections;
  }
}

/**
 * Create quality gate filter with default configuration
 */
export function createQualityGateFilter(
  config?: Partial<QualityGateConfig>
): QualityGateFilter {
  return new QualityGateFilter(config);
}
