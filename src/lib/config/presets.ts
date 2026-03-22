/**
 * Default Crawl Configuration
 * Optimized for comprehensive coverage of documentation sites
 */

/**
 * Default crawl configuration
 * - 100 pages: Sufficient for most documentation sites (was 50, too low)
 * - Depth 3: Captures main sections without excessive traversal
 * - Avg time: 2-4 minutes for typical sites (with metadata mode)
 *
 * Rationale for 100 pages:
 * - Modern doc sites have 70-150+ pages (ElevenLabs, Cloudflare, etc.)
 * - 50 was insufficient, missing 60-80% of content
 * - 100 provides good coverage without overwhelming users
 */
export const DEFAULT_MAX_PAGES = 100;
export const DEFAULT_MAX_DEPTH = 3;
