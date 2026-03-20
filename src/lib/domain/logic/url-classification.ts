/**
 * URL Classification Logic (Domain Layer)
 * Pure business rules for URL analysis and classification
 *
 * These are domain-specific business rules, not generic utilities.
 * They encode business logic about how we organize and crawl websites.
 *
 * Uses a hybrid approach:
 * 1. Sitemap priority (site owner's explicit importance signal)
 * 2. Page metadata (actual content analysis)
 * 3. URL pattern matching (fallback heuristic)
 */

import type { PageMetadata } from "@/lib/domain/models";
import type { SitemapUrl } from "../parser/sitemap";

/**
 * Classify URL by content type using hybrid strategy
 * Determines which section a page belongs to in llms.txt
 *
 * Priority order:
 * 1. Sitemap priority (most reliable - from site owner)
 * 2. Page metadata (content-based - from actual page)
 * 3. URL patterns (least reliable - heuristic fallback)
 *
 * @param url - URL to classify
 * @param metadata - Optional page metadata (title, description, ogType, etc.)
 * @param sitemapData - Optional sitemap data (priority, lastmod)
 * @returns Section type (homepage, documentation, api, etc.)
 */
export function classifyUrl(
  url: string,
  metadata?: PageMetadata,
  sitemapData?: SitemapUrl
): string {
  const pathname = new URL(url).pathname.toLowerCase();

  // Homepage always identified by path
  if (pathname === "/" || pathname === "") return "homepage";

  // Strategy 1: Use sitemap priority (site owner's signal)
  if (sitemapData?.priority !== undefined) {
    const sitemapCategory = classifyBySitemapPriority(sitemapData, pathname);
    if (sitemapCategory !== "other") return sitemapCategory;
  }

  // Strategy 2: Use page metadata (content-based)
  if (metadata) {
    const metadataCategory = classifyByMetadata(metadata);
    if (metadataCategory !== "other") return metadataCategory;
  }

  // Strategy 3: Fallback to URL pattern matching
  return classifyByUrlPattern(pathname);
}

/**
 * Classify by sitemap priority
 * Higher priority = more important content (docs, guides, API)
 * Lower priority = secondary content (blog, about)
 *
 * @param sitemapData - Sitemap metadata
 * @param pathname - URL pathname for additional context
 * @returns Category or "other" if can't determine
 */
function classifyBySitemapPriority(
  sitemapData: SitemapUrl,
  pathname: string
): string {
  const priority = sitemapData.priority || 0.5;

  // Very high priority (0.9+) = Core documentation/product pages
  if (priority >= 0.9) {
    // Refine with URL hints
    if (pathname.includes("/api")) return "api";
    return "documentation";
  }

  // High priority (0.7-0.9) = Important guides/tutorials
  if (priority >= 0.7) {
    if (pathname.includes("/tutorial")) return "tutorials";
    return "guides";
  }

  // Medium-high priority (0.6-0.7) = API reference
  if (priority >= 0.6) {
    if (pathname.includes("/api")) return "api";
    return "documentation";
  }

  // Medium priority (0.4-0.6) = About/info pages
  if (priority >= 0.4) {
    if (pathname.includes("/pricing")) return "pricing";
    return "about";
  }

  // Low priority (< 0.4) = Blog, press, secondary content
  if (pathname.includes("/blog") || pathname.includes("/press")) {
    return "blog";
  }

  return "other";
}

/**
 * Classify by page metadata (content-based)
 * Uses OpenGraph, meta tags, and title content
 * Checks more specific keywords first (e.g., "API" before "documentation")
 *
 * @param metadata - Page metadata
 * @returns Category or "other" if can't determine
 */
function classifyByMetadata(metadata: PageMetadata): string {
  // Check OpenGraph type
  if (metadata.ogType === "article") return "blog";

  const desc = (
    metadata.description ||
    metadata.ogDescription ||
    ""
  ).toLowerCase();
  const title = metadata.title.toLowerCase();

  // Check for API first (most specific)
  if (
    title.includes("api reference") ||
    title.includes("api docs") ||
    title.includes("api ") ||
    desc.includes("api") ||
    desc.includes("endpoint")
  ) {
    return "api";
  }

  // Check for tutorials (specific)
  if (title.includes("tutorial") || desc.includes("tutorial")) {
    return "tutorials";
  }

  // Check for guides (specific)
  if (title.includes("guide") || desc.includes("guide")) {
    return "guides";
  }

  // Check for pricing (specific)
  if (
    title.includes("pricing") ||
    desc.includes("pricing") ||
    desc.includes("plans")
  ) {
    return "pricing";
  }

  // Check for blog/news (specific)
  if (
    title.includes("blog") ||
    title.includes("news") ||
    desc.includes("blog")
  ) {
    return "blog";
  }

  // Check for about (specific)
  if (
    title.includes("about") ||
    title.includes("company") ||
    desc.includes("about")
  ) {
    return "about";
  }

  // Check for documentation (generic - check last)
  if (
    title.includes("docs") ||
    title.includes("documentation") ||
    desc.includes("documentation") ||
    desc.includes("reference")
  ) {
    return "documentation";
  }

  return "other";
}

/**
 * Classify by URL pattern (fallback heuristic)
 * Least reliable but works when no other data available
 *
 * @param pathname - URL pathname (lowercase)
 * @returns Category
 */
function classifyByUrlPattern(pathname: string): string {
  // Legal & Policy pages (expanded patterns)
  if (
    pathname.includes("/terms") ||
    pathname.includes("/privacy") ||
    pathname.includes("/copyright") ||
    pathname.includes("/policies") ||
    pathname.includes("/policy") ||
    pathname.includes("/legal") ||
    pathname.includes("/contact")
  )
    return "legal";

  // Creator & Advertiser pages (expanded patterns)
  if (
    pathname.includes("/creators") ||
    pathname.includes("/ads") ||
    pathname.includes("/advertise") ||
    pathname.includes("/business") ||
    pathname.includes("/partners") ||
    pathname.includes("/monetize")
  )
    return "creators";

  // Documentation
  if (pathname.includes("/doc")) return "documentation";

  // Guides
  if (pathname.includes("/guide")) return "guides";

  // Tutorials
  if (pathname.includes("/tutorial")) return "tutorials";

  // API
  if (pathname.includes("/api")) return "api";

  // Blog & Press (expanded patterns)
  if (pathname.includes("/blog") || pathname.includes("/press")) return "blog";

  // About pages (expanded patterns for YouTube and similar sites)
  if (
    pathname.includes("/about") ||
    pathname.includes("/yt/about") ||
    pathname.includes("/howyoutubeworks") ||
    pathname.includes("/how-it-works")
  )
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
