/**
 * Crawl Boundaries
 * Domain rules for crawl limits and scope
 */

import { parse } from "tldts";

/**
 * Extract brand identifier from hostname using tldts library
 * Handles both traditional domains (.com, .org) and brand TLDs (.youtube, .google)
 *
 * Detection strategy:
 * - tldts returns publicSuffix = "youtube" for about.youtube (brand TLD)
 * - tldts returns publicSuffix = "com" for youtube.com (traditional TLD)
 * - We distinguish by checking if publicSuffix is a known traditional TLD
 *
 * Examples:
 * - youtube.com → "youtube" (publicSuffix=com is traditional, use domainWithoutSuffix)
 * - about.youtube → "youtube" (publicSuffix=youtube is brand TLD, use publicSuffix)
 * - contributors.youtube.com → "youtube" (publicSuffix=com, use domainWithoutSuffix)
 * - docs.github.com → "github" (publicSuffix=com, use domainWithoutSuffix)
 */
export function extractBrandIdentifier(hostname: string): string | null {
  const parsed = parse(hostname);
  if (!parsed.publicSuffix || !parsed.domainWithoutSuffix) return null;

  // Known traditional TLDs (from IANA + common country codes)
  // tldts handles the full PSL, but we need to distinguish traditional vs brand TLDs
  const traditionalTLDs = new Set([
    "com",
    "org",
    "net",
    "edu",
    "gov",
    "mil",
    "int", // Generic TLDs
    "io",
    "co",
    "ai",
    "app",
    "dev",
    "cloud", // Tech TLDs
    "us",
    "uk",
    "ca",
    "au",
    "de",
    "fr",
    "jp",
    "cn",
    "br",
    "in",
    "ru", // Country codes
  ]);

  // If publicSuffix is a traditional TLD, use domainWithoutSuffix as the brand
  if (traditionalTLDs.has(parsed.publicSuffix)) {
    return parsed.domainWithoutSuffix; // "youtube" from youtube.com
  }

  // Otherwise, publicSuffix is likely a brand TLD
  return parsed.publicSuffix; // "youtube" from about.youtube
}

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

    // Check if URLs belong to the same organization/brand
    const urlBrand = extractBrandIdentifier(urlObj.hostname);
    const baseBrand = extractBrandIdentifier(baseObj.hostname);

    if (!urlBrand || !baseBrand || urlBrand !== baseBrand) {
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

    // Check if URLs belong to the same organization/brand
    const urlBrand = extractBrandIdentifier(urlObj.hostname);
    const baseBrand = extractBrandIdentifier(baseObj.hostname);

    return urlBrand !== null && urlBrand === baseBrand;
  } catch {
    return false;
  }
}
