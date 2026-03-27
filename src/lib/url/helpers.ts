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
 * Patterns support wildcards (single and double asterisk)
 *
 * Pattern syntax:
 * - Single asterisk matches anything except forward slash
 * - Double asterisk matches anything including forward slash
 * - Other characters are treated literally
 *
 * @param url - URL to test
 * @param patterns - Array of patterns (e.g., ["*.pdf", "/api/*"])
 * @returns true if URL matches any pattern
 */
export function matchesPattern(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Convert glob pattern to regex
    // 1. Escape special regex characters (except * and **)
    let regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

    // 2. Replace ** with placeholder to distinguish from *
    regexPattern = regexPattern.replace(/\*\*/g, "__DOUBLE_WILDCARD__");

    // 3. Replace single * with [^/]* (match anything except /)
    regexPattern = regexPattern.replace(/\*/g, "[^/]*");

    // 4. Replace placeholder back to .* (match anything including /)
    regexPattern = regexPattern.replace(/__DOUBLE_WILDCARD__/g, ".*");

    // 5. Create regex (no anchors - pattern can match anywhere in URL)
    const regex = new RegExp(regexPattern);
    return regex.test(url);
  });
}
