/**
 * Section Group Model
 * Represents a logical grouping of pages discovered by AI or heuristics
 */
export interface SectionGroup {
  name: string; // Section title (e.g., "About", "Legal & Policies")
  pageIndexes: number[]; // Indexes into the pages array
}
