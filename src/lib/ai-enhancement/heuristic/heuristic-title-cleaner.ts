import { ITitleCleaningService } from "../types";

/**
 * Heuristic Title Cleaner Service
 * Implements ONLY title cleaning (Single Responsibility Principle)
 * Uses regex patterns - no AI/API required
 * Always available as fallback
 */
export class HeuristicTitleCleaner implements ITitleCleaningService {
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
    const parts = cleaned.split(/\s*[-|—–]\s*/);
    const uniqueParts: string[] = [];
    const seen = new Set<string>();

    for (const part of parts) {
      const normalized = part.trim().toLowerCase();
      if (!seen.has(normalized) && part.trim().length > 0) {
        seen.add(normalized);
        uniqueParts.push(part.trim());
      }
    }

    // If we removed duplicates, reassemble
    if (uniqueParts.length < parts.length) {
      cleaned = uniqueParts.join(" - ");
    }

    // If only one part remains, use it directly (no separator)
    if (uniqueParts.length === 1) {
      cleaned = uniqueParts[0];
    }
    // If two parts and second is very short (likely site acronym), keep both
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
