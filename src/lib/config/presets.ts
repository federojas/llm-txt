/**
 * Default Crawl Configuration
 * Optimized for any website URL input
 */

/**
 * Default crawl configuration
 * - 50 pages: Quality starting point for any website
 * - Depth 3: Captures main sections without excessive traversal
 * - Avg time: 2-3 minutes for typical sites (with metadata mode)
 *
 * Philosophy: "Good first draft"
 * - Provides quick results for immediate value
 * - Captures core content (homepage + main sections)
 * - User can review and request more pages if needed
 * - Override with maxPages parameter for comprehensive crawls (up to 100 max)
 *
 * Note: Dev environment uses Groq free tier (30 req/min), so 50 pages takes ~2-3 min.
 * Production with paid tier (300+ req/min) will execute 10x faster (~20-30 sec for 50 pages).
 */
export const DEFAULT_MAX_PAGES = 50;
export const DEFAULT_MAX_DEPTH = 3;
