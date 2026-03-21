/**
 * Crawl Boundaries
 * Domain rules for crawl limits and scope
 */

/**
 * Calculate URL depth from base URL
 * Determines how far a page is from the starting point
 *
 * @param url - URL to measure
 * @param baseUrl - Starting URL
 * @returns Depth (0 = homepage, 1 = first level, etc.)
 */
export function getUrlDepth(url: string, baseUrl: string): number {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseUrl);

    // Normalize hostnames by removing www prefix for comparison
    const normalizeHostname = (hostname: string) =>
      hostname.replace(/^www\./i, "");

    if (
      normalizeHostname(urlObj.hostname) !== normalizeHostname(baseObj.hostname)
    ) {
      return Infinity;
    }

    const urlPath = urlObj.pathname.replace(/^\/|\/$/g, "");
    const basePath = baseObj.pathname.replace(/^\/|\/$/g, "");

    if (!urlPath) return 0;
    if (!basePath) {
      return urlPath.split("/").filter(Boolean).length;
    }

    const urlParts = urlPath.split("/").filter(Boolean);
    const baseParts = basePath.split("/").filter(Boolean);

    return Math.max(0, urlParts.length - baseParts.length);
  } catch {
    return Infinity;
  }
}

/**
 * Check if URL is a language variant (business rule for content filtering)
 * Filters out localized versions like /intl/ar/, /intl/ALL_bg/
 *
 * @param url - URL to check
 * @returns true if it's a language variant
 */
export function isLanguageVariant(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    // Match /intl/xx/ or /intl/ALL_xx/ patterns
    return /\/intl\/[^/]+\//i.test(pathname);
  } catch {
    return false;
  }
}

/**
 * Check if URL is internal (business rule for crawl boundaries)
 * Determines if we should crawl a link
 *
 * @param url - URL to check
 * @param baseUrl - Base domain URL
 * @returns true if URL is same domain as base
 */
export function isInternalUrl(url: string, baseUrl: string): boolean {
  try {
    const urlObj = new URL(url, baseUrl);
    const baseObj = new URL(baseUrl);

    // Normalize hostnames by removing www prefix for comparison
    // Treats www.example.com and example.com as same domain
    const normalizeHostname = (hostname: string) =>
      hostname.replace(/^www\./i, "");

    return (
      normalizeHostname(urlObj.hostname) === normalizeHostname(baseObj.hostname)
    );
  } catch {
    return false;
  }
}
