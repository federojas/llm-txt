import { ITitleCleaningService } from "../../core/types";

/**
 * Pattern Title Cleaner
 *
 * Non-AI title cleaner that uses regex patterns to remove redundant text.
 * Cleans page titles by removing site names, separators, and duplicate segments.
 * Detects duplicate titles and extracts meaningful names from URLs.
 *
 * Advantages:
 * - No API calls (free, fast)
 * - Always available (fallback when AI unavailable)
 * - Language-agnostic (works for any language)
 * - Handles duplicate titles by using URL slugs
 *
 * Used for all title cleaning (both AI and metadata modes).
 */
export class PatternTitleCleaner implements ITitleCleaningService {
  isAvailable(): boolean {
    return true; // Always available as fallback
  }

  /**
   * Clean page titles using regex patterns
   * Removes redundant suffixes, site names, and separators
   * Detects duplicate titles and uses URL slugs as fallback
   */
  async cleanTitles(titles: string[], urls?: string[]): Promise<string[]> {
    // First pass: detect duplicate titles
    const titleCounts = new Map<string, number>();
    for (const title of titles) {
      const normalized = title.trim().toLowerCase();
      titleCounts.set(normalized, (titleCounts.get(normalized) || 0) + 1);
    }

    // Second pass: clean titles, using URLs for duplicates
    return titles.map((title, index) => {
      const cleaned = this.cleanTitle(title);
      const normalized = cleaned.trim().toLowerCase();

      // If this title appears multiple times and we have URLs, use URL slug
      if (titleCounts.get(normalized)! > 1 && urls && urls[index]) {
        return this.extractTitleFromUrl(urls[index], cleaned);
      }

      return cleaned;
    });
  }

  /**
   * Extract a meaningful title from URL when page title is generic
   * Examples:
   * - /news/despacito-most-viewed-video → "Despacito Most Viewed Video"
   * - /articles/alan-walker → "Alan Walker"
   */
  private extractTitleFromUrl(url: string, fallback: string): string {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname
        .split("/")
        .filter((s) => s.length > 0);

      // Use last segment (the article slug)
      if (pathSegments.length > 0) {
        const slug = pathSegments[pathSegments.length - 1];

        // Convert slug to title case
        const title = slug
          .split(/[-_]/)
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");

        return title;
      }
    } catch {
      // Invalid URL, use fallback
    }

    return fallback;
  }

  /**
   * Clean a single title using heuristic patterns
   */
  private cleanTitle(title: string): string {
    let cleaned = title;

    // Remove duplicate segments (e.g., "About - FastHTML - FastHTML" → "About - FastHTML")
    // Only split on separators with surrounding whitespace (to preserve hyphenated words)
    const parts = cleaned.split(/\s+[-|—–]\s+/);
    const uniqueParts: string[] = [];
    const seen = new Set<string>();

    for (const part of parts) {
      const normalized = part.trim().toLowerCase();
      if (!seen.has(normalized) && part.trim().length > 0) {
        seen.add(normalized);
        uniqueParts.push(part.trim());
      }
    }

    // If we removed duplicates, reassemble and return
    if (uniqueParts.length < parts.length) {
      cleaned = uniqueParts.join(" - ");
      return cleaned.trim();
    }

    // No duplicates found - apply site name removal heuristics
    // If only one part remains, use it directly (no separator)
    if (uniqueParts.length === 1) {
      cleaned = uniqueParts[0];
    }
    // If two parts and second is very short (likely site acronym), remove it
    else if (uniqueParts.length === 2 && uniqueParts[1].length <= 10) {
      cleaned = uniqueParts[0]; // Remove site name suffix
    }
    // If multiple parts, keep first meaningful one (usually the page title)
    else if (uniqueParts.length > 2) {
      cleaned = uniqueParts[0];
    }

    return cleaned.trim();
  }
}
