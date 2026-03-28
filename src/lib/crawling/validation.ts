/**
 * Domain Validation Rules
 * Pure business logic validation - framework-agnostic
 * Can be used by API, CLI, workers, or any other consumer
 */

/**
 * Crawl configuration limits (business rules)
 * Only includes user-configurable parameters
 */
export const CRAWL_LIMITS = {
  MIN_PAGES: 1,
  MAX_PAGES: 200,
  MIN_DEPTH: 1,
  MAX_DEPTH: 5,
} as const;

/**
 * Default values for crawl configuration
 * Includes both user-configurable and hardcoded parameters for documentation
 *
 * MAX_PAGES: 200 (changed from 50)
 * MAX_DEPTH: 2 (changed from 3)
 *
 * Rationale: These defaults balance quality and coverage:
 * - maxDepth=2 focuses on platform pages (jobs, about, docs, API)
 * - maxPages=200 ensures comprehensive coverage within those shallow depths
 * - Depth 3+ typically contains articles/blogs that dominate AI clustering
 *   and push out more important platform pages
 * - Since maxDepth=2 limits scope, 200 pages is still fast (~60-90s)
 * - Users can override both values if needed
 */
export const CRAWL_DEFAULTS = {
  MAX_PAGES: 200,
  MAX_DEPTH: 2,
  TIMEOUT: 10000, // Hardcoded (not user-configurable)
  CONCURRENCY: 5, // Hardcoded (not user-configurable)
} as const;

/**
 * Validate maximum pages value
 */
export function validateMaxPages(pages: number): boolean {
  return (
    Number.isInteger(pages) &&
    pages >= CRAWL_LIMITS.MIN_PAGES &&
    pages <= CRAWL_LIMITS.MAX_PAGES
  );
}

/**
 * Validate maximum depth value
 */
export function validateMaxDepth(depth: number): boolean {
  return (
    Number.isInteger(depth) &&
    depth >= CRAWL_LIMITS.MIN_DEPTH &&
    depth <= CRAWL_LIMITS.MAX_DEPTH
  );
}

/**
 * Validate URL format (basic check)
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
