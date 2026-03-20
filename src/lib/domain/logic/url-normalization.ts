/**
 * URL Normalization (Domain Logic)
 * Contains business rules for URL normalization
 *
 * This module encodes business decisions about how URLs should be normalized
 * for deduplication and comparison in the context of web crawling.
 */

/**
 * Normalize URL for deduplication and comparison
 *
 * Business rules applied:
 * - Remove trailing slashes (except root)
 * - Remove hash fragments
 * - Sort query parameters
 * - Remove tracking parameters (business decision: we don't care about tracking)
 *
 * @param url - URL to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);

    // Remove trailing slash (business rule: /page and /page/ are the same)
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

    // Remove hash (business rule: fragments don't affect server-side content)
    parsedUrl.hash = "";

    // Sort query parameters (business rule: order doesn't matter for deduplication)
    parsedUrl.searchParams.sort();

    // Remove common tracking parameters (business rule: tracking params are noise)
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "source",
    ];
    trackingParams.forEach((param) => parsedUrl.searchParams.delete(param));

    return parsedUrl.toString();
  } catch {
    return url;
  }
}

/**
 * Aggressive URL normalization for llms.txt output
 *
 * Business rules for final output:
 * - Remove ALL query parameters (business rule: variants of same page = duplicate)
 * - Remove trailing slashes
 * - Remove hash fragments
 *
 * This is MORE aggressive than normalizeUrl() - use only for final deduplication
 * in llms.txt generation, NOT for crawling.
 *
 * Example: Both https://example.com/page?lang=en and https://example.com/page?tab=main
 * should be treated as the same page in llms.txt output.
 *
 * @param url - URL to normalize
 * @returns Aggressively normalized URL string
 */
export function normalizeUrlForOutput(url: string): string {
  try {
    const parsedUrl = new URL(url);

    // Remove trailing slash
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

    // Remove hash
    parsedUrl.hash = "";

    // Remove ALL query parameters for deduplication
    // (Business rule: we already crawled the page, params don't matter for output)
    parsedUrl.search = "";

    return parsedUrl.toString();
  } catch {
    return url;
  }
}
