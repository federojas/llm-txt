/**
 * Default Crawl Configuration
 * Optimized for comprehensive coverage of documentation sites
 */

/**
 * Default crawl configuration
 * - 75 pages: Balanced coverage for most documentation sites
 * - Depth 3: Captures main sections without excessive traversal
 * - Avg time: 2-4 minutes for typical sites (with metadata mode)
 *
 * Rationale for 75 pages:
 * - Modern doc sites have 70-150+ pages (ElevenLabs, Cloudflare, etc.)
 * - 50 was insufficient, missing 60-80% of content
 * - 75 provides good coverage while keeping execution time reasonable
 * - In production with higher API rate limits, this executes much faster
 *
 * Note: Dev environment uses Groq free tier (30 req/min), so 75 pages takes ~3-4 min.
 * Production with paid tier (300+ req/min) will execute 10x faster (~1-2 min for 75 pages).
 * Users can override with maxPages parameter for comprehensive crawls (100-200).
 */
export const DEFAULT_MAX_PAGES = 75;
export const DEFAULT_MAX_DEPTH = 3;
