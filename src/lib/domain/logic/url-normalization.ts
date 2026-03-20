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
