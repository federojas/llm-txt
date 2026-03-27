import { ITitleCleaningService } from "../../core/types";

/**
 * Pattern Title Cleaner
 *
 * Non-AI title cleaner that uses regex patterns to remove redundant text.
 * Cleans page titles by removing site names, separators, and duplicate segments.
 *
 * Advantages:
 * - No API calls (free, fast)
 * - Always available (fallback when AI unavailable)
 * - Language-agnostic (works for any language)
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
   */
  async cleanTitles(titles: string[]): Promise<string[]> {
    return titles.map((title) => this.cleanTitle(title));
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
