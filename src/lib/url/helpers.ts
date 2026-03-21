/**
 * URL Helpers (Infrastructure Utilities)
 * Pure technical utilities for URL manipulation
 *
 * These are framework-agnostic utilities with no business logic.
 * They are simple wrappers around the URL API for convenience.
 */

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
