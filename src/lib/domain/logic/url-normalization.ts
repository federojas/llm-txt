/**
 * URL Normalization (Domain Logic)
 * Contains business rules for URL normalization using normalize-url library
 *
 * This module encodes business decisions about how URLs should be normalized
 * for deduplication and comparison in the context of web crawling.
 */

import normalizeUrlLib from "normalize-url";

/**
 * Normalize URL for deduplication and comparison
 *
 * Business rules applied:
 * - Force HTTPS protocol
 * - Remove trailing slashes (except root)
 * - Remove hash fragments
 * - Sort query parameters
 * - Remove tracking parameters (utm_*, ref, source)
 *
 * @param url - URL to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    return normalizeUrlLib(url, {
      defaultProtocol: "https",
      forceHttps: true,
      stripHash: true,
      stripWWW: false, // Keep www for consistency (don't assume www/non-www are same)
      removeQueryParameters: [
        /^utm_\w+/i, // All UTM parameters (utm_source, utm_medium, etc.)
        "ref",
        "source",
      ],
      sortQueryParameters: true,
    });
  } catch {
    return url;
  }
}

/**
 * Aggressive URL normalization for llms.txt output
 *
 * Business rules for final output:
 * - Force HTTPS protocol
 * - Remove ALL query parameters (variants of same page = duplicate)
 * - Remove trailing slashes
 * - Remove hash fragments
 *
 * This is MORE aggressive than normalizeUrl() - use only for final deduplication
 * in llms.txt generation, NOT for crawling.
 *
 * Example: Both http://example.com/page?lang=en and https://example.com/page?tab=main
 * normalize to https://example.com/page
 *
 * @param url - URL to normalize
 * @returns Aggressively normalized URL string
 */
export function normalizeUrlForOutput(url: string): string {
  try {
    return normalizeUrlLib(url, {
      defaultProtocol: "https",
      forceHttps: true,
      stripHash: true,
      stripWWW: false,
      removeQueryParameters: true, // Remove ALL query params
      sortQueryParameters: false, // No point sorting if removing all
    });
  } catch {
    return url;
  }
}
