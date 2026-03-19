/**
 * URL Utilities (Shared Layer)
 * Generic, reusable URL manipulation functions
 *
 * These are framework-agnostic utilities with no business logic.
 * Could be extracted to a separate package or used across projects.
 */

/**
 * Normalize URL for deduplication and comparison
 * Removes tracking params, sorts query strings, removes trailing slashes
 *
 * @param url - URL to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);

    // Remove trailing slash
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

    // Remove hash
    parsedUrl.hash = "";

    // Sort query parameters
    parsedUrl.searchParams.sort();

    // Remove common tracking parameters
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
 * Convert relative URL to absolute URL
 *
 * @param url - Relative or absolute URL
 * @param baseUrl - Base URL for resolution
 * @returns Absolute URL
 */
export function toAbsoluteUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

/**
 * Extract domain/hostname from URL
 *
 * @param url - URL to extract from
 * @returns Hostname (e.g., "example.com")
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Check if URL matches any of the given patterns
 * Patterns support wildcards (*)
 *
 * @param url - URL to test
 * @param patterns - Array of patterns (e.g., ["*.pdf", "/api/*"])
 * @returns true if URL matches any pattern
 */
export function matchesPattern(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(pattern.replace("*", ".*"));
    return regex.test(url);
  });
}
