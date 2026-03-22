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
 * - Keep only whitelisted query parameters (page, tab, section)
 * - Sort remaining query parameters
 *
 * Whitelist: page, tab, section (params that create distinct content)
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
      keepQueryParameters: ["page", "tab", "section"], // Only keep these params
      sortQueryParameters: true,
    });
  } catch {
    return url;
  }
}
