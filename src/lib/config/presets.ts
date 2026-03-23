/**
 * Application Defaults for Crawl Configuration
 * Mode-specific defaults applied when user doesn't specify values
 *
 * Note: Validation limits are defined in @/lib/crawling/validation
 */

/**
 * Default crawl configuration per mode
 *
 * Metadata mode (default):
 * - 200 pages: Comprehensive coverage using HTML meta tags
 * - ~90s execution time for typical sites
 * - 2 AI calls total (site summary + section clustering)
 *
 * AI mode:
 * - 50 pages: Limited to control API usage
 * - ~52 AI calls total (1 summary + 1 clustering + ~50 page descriptions)
 *
 * Both modes:
 * - Depth 3: Captures main sections without excessive traversal
 * - Stay well within 30m Inngest timeout
 */
export const DEFAULT_MAX_PAGES = 200;
export const DEFAULT_MAX_DEPTH = 3;
export const AI_MODE_MAX_PAGES = 50;
