/**
 * Sitemap Client (Infrastructure Layer)
 * Handles HTTP fetching and parsing of sitemaps
 */

import * as cheerio from "cheerio";
import { httpClient } from "./client";
import { normalizeUrl } from "@/lib/url/normalization";
import { isLanguageVariant } from "../crawling/boundaries";

export interface SitemapUrl {
  url: string;
  priority?: number;
  lastmod?: string;
}

// ============================================================================
// Pure Parsing Functions (no HTTP concerns)
// ============================================================================

/**
 * Parse sitemap XML content and extract URLs
 * Pure function - no HTTP concerns, just XML parsing
 */
function parseSitemapXml(
  xmlContent: string,
  maxUrls: number = 100
): SitemapUrl[] {
  try {
    const $ = cheerio.load(xmlContent, { xmlMode: true });
    const urls: SitemapUrl[] = [];

    $("url").each((_, element) => {
      if (urls.length >= maxUrls) return false;

      const loc = $(element).find("loc").text();
      const priority = parseFloat($(element).find("priority").text()) || 0.5;
      const lastmod = $(element).find("lastmod").text() || undefined;

      if (loc) {
        urls.push({
          url: normalizeUrl(loc),
          priority,
          lastmod,
        });
      }
      return; // Explicit return for TypeScript noImplicitReturns
    });

    urls.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return urls.slice(0, maxUrls);
  } catch (error) {
    console.error("Failed to parse sitemap XML:", error);
    return [];
  }
}

/**
 * Extract child sitemap URLs from sitemap index
 * Returns all child sitemaps (no hard limit - dynamic processing)
 */
function parseSitemapIndex(xmlContent: string): string[] {
  try {
    const $ = cheerio.load(xmlContent, { xmlMode: true });
    const sitemapElements = $("sitemap loc");

    return sitemapElements.map((_, el) => $(el).text()).get();
    // No .slice() limit - let the fetching loop decide when to stop
  } catch (error) {
    console.error("Failed to parse sitemap index:", error);
    return [];
  }
}

/**
 * Check if XML content is a sitemap index
 */
function isSitemapIndex(xmlContent: string): boolean {
  try {
    const $ = cheerio.load(xmlContent, { xmlMode: true });
    return $("sitemap loc").length > 0;
  } catch {
    return false;
  }
}

/**
 * Extract sitemap URL from robots.txt content
 */
function extractSitemapFromRobotsTxt(robotsTxtContent: string): string | null {
  const sitemapMatch = robotsTxtContent.match(/Sitemap:\s*(.+)/i);
  return sitemapMatch ? sitemapMatch[1].trim() : null;
}

// ============================================================================
// HTTP Fetching Functions (infrastructure concerns)
// ============================================================================

/**
 * Fetch and parse sitemap.xml
 * Handles both regular sitemaps and sitemap indexes
 *
 * @param sitemapUrl - URL to sitemap.xml
 * @param maxUrls - Maximum URLs to extract
 * @returns Array of sitemap URLs
 */
export async function fetchAndParseSitemap(
  sitemapUrl: string,
  maxUrls: number = 100
): Promise<SitemapUrl[]> {
  try {
    const response = await httpClient.get(sitemapUrl, {
      timeout: 10000,
      responseType: "text",
    });

    if (response.status < 200 || response.status >= 300) {
      console.error(`Failed to fetch sitemap: ${response.status}`);
      return [];
    }

    const xmlContent = response.data as string;

    // Check if it's a sitemap index
    if (isSitemapIndex(xmlContent)) {
      // Fetch ALL child sitemaps for comprehensive coverage
      const childUrls = parseSitemapIndex(xmlContent);
      const allUrls: SitemapUrl[] = [];

      console.log(
        `[Sitemap Index] Found ${childUrls.length} child sitemaps, fetching all for comprehensive coverage`
      );

      // Process ALL child sitemaps (don't stop early)
      for (let i = 0; i < childUrls.length; i++) {
        const childSitemapUrl = childUrls[i];
        const childResults = await fetchAndParseSitemap(
          childSitemapUrl,
          10000 // Large limit per child sitemap
        );

        // Filter language variants during collection
        const nonVariants = childResults.filter(
          ({ url }) => !isLanguageVariant(url)
        );

        if (nonVariants.length > 0) {
          allUrls.push(...nonVariants);
          console.log(
            `[Sitemap Index] Processed ${i + 1}/${childUrls.length}: ${childResults.length} URLs → ${nonVariants.length} non-variants (total: ${allUrls.length})`
          );
        }
      }

      console.log(
        `[Sitemap Index] Collected ${allUrls.length} total non-variant URLs from ${childUrls.length} sitemaps`
      );

      // Sort by priority (high to low)
      // Return ALL URLs - let link scoring handle filtering to top N
      allUrls.sort((a, b) => (b.priority || 0.5) - (a.priority || 0.5));
      return allUrls;
    }

    // Parse regular sitemap
    return parseSitemapXml(xmlContent, maxUrls);
  } catch (error) {
    console.error("Failed to fetch sitemap:", error);
    return [];
  }
}

/**
 * Try to discover sitemap.xml URL for a domain
 * Checks common paths and robots.txt
 *
 * @param baseUrl - Base URL of the website
 * @returns Sitemap URL if found, null otherwise
 */
export async function discoverSitemap(baseUrl: string): Promise<string | null> {
  const commonSitemapPaths = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/sitemap1.xml",
  ];

  // Try common sitemap paths
  for (const path of commonSitemapPaths) {
    try {
      const sitemapUrl = new URL(path, baseUrl).toString();
      const response = await httpClient.head(sitemapUrl, {
        timeout: 5000,
      });

      if (response.status >= 200 && response.status < 300) {
        return sitemapUrl;
      }
    } catch {
      // Continue to next path
    }
  }

  // Try robots.txt
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const response = await httpClient.get(robotsUrl, {
      timeout: 5000,
      responseType: "text",
    });

    if (response.status >= 200 && response.status < 300) {
      const robotsTxtContent = response.data as string;
      const sitemapUrl = extractSitemapFromRobotsTxt(robotsTxtContent);
      if (sitemapUrl) {
        return sitemapUrl;
      }
    }
  } catch {
    // No robots.txt
  }

  return null;
}
