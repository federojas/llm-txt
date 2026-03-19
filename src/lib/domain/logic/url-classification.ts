/**
 * URL Classification Logic (Domain Layer)
 * Pure business rules for URL analysis and classification
 *
 * These are domain-specific business rules, not generic utilities.
 * They encode business logic about how we organize and crawl websites.
 */

/**
 * Classify URL by content type based on business rules
 * Determines which section a page belongs to in llms.txt
 *
 * @param url - URL to classify
 * @returns Section type (homepage, documentation, api, etc.)
 */
export function classifyUrl(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase();

  // Homepage
  if (pathname === "/" || pathname === "") return "homepage";

  // Legal & Policy pages
  if (
    pathname.includes("/terms") ||
    pathname.includes("/privacy") ||
    pathname.includes("/copyright") ||
    pathname.includes("/policies") ||
    pathname.includes("/contact")
  )
    return "legal";

  // Creator & Advertiser pages
  if (pathname.includes("/creators") || pathname.includes("/ads"))
    return "creators";

  // Documentation
  if (pathname.includes("/doc")) return "documentation";

  // Guides
  if (pathname.includes("/guide")) return "guides";

  // Tutorials
  if (pathname.includes("/tutorial")) return "tutorials";

  // API
  if (pathname.includes("/api")) return "api";

  // Blog
  if (pathname.includes("/blog")) return "blog";

  // About pages
  if (pathname.includes("/about") || pathname.includes("/yt/about"))
    return "about";

  // Pricing
  if (pathname.includes("/pricing")) return "pricing";

  return "other";
}

/**
 * Calculate URL depth from base URL (business rule for crawl boundaries)
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

    if (urlObj.hostname !== baseObj.hostname) {
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
    return urlObj.hostname === baseObj.hostname;
  } catch {
    return false;
  }
}
