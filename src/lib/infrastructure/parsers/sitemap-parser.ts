import * as cheerio from "cheerio";
import { normalizeUrl } from "../../domain/logic/url-normalization";

export interface SitemapUrl {
  url: string;
  priority?: number;
  lastmod?: string;
}

/**
 * Parse sitemap XML content and extract URLs
 * Pure function - no HTTP concerns, just XML parsing
 *
 * @param xmlContent - Raw XML string from sitemap
 * @param maxUrls - Maximum number of URLs to extract
 * @returns Array of sitemap URLs with metadata
 */
export function parseSitemapXml(
  xmlContent: string,
  maxUrls: number = 100
): SitemapUrl[] {
  try {
    const $ = cheerio.load(xmlContent, { xmlMode: true });
    const urls: SitemapUrl[] = [];

    // Parse regular sitemap (not sitemap index)
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
    });

    // Sort by priority (descending)
    urls.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return urls.slice(0, maxUrls);
  } catch (error) {
    console.error("Failed to parse sitemap XML:", error);
    return [];
  }
}

/**
 * Extract child sitemap URLs from sitemap index
 * Pure function - just XML parsing
 *
 * @param xmlContent - Raw XML string from sitemap index
 * @returns Array of child sitemap URLs
 */
export function parseSitemapIndex(xmlContent: string): string[] {
  try {
    const $ = cheerio.load(xmlContent, { xmlMode: true });
    const sitemapElements = $("sitemap loc");

    return sitemapElements
      .map((_, el) => $(el).text())
      .get()
      .slice(0, 5); // Limit to 5 child sitemaps
  } catch (error) {
    console.error("Failed to parse sitemap index:", error);
    return [];
  }
}

/**
 * Check if XML content is a sitemap index (vs regular sitemap)
 *
 * @param xmlContent - Raw XML string
 * @returns true if it's a sitemap index
 */
export function isSitemapIndex(xmlContent: string): boolean {
  try {
    const $ = cheerio.load(xmlContent, { xmlMode: true });
    return $("sitemap loc").length > 0;
  } catch {
    return false;
  }
}

/**
 * Extract sitemap URL from robots.txt content
 * Pure function - just text parsing
 *
 * @param robotsTxtContent - Raw robots.txt content
 * @returns Sitemap URL if found, null otherwise
 */
export function extractSitemapFromRobotsTxt(
  robotsTxtContent: string
): string | null {
  const sitemapMatch = robotsTxtContent.match(/Sitemap:\s*(.+)/i);
  return sitemapMatch ? sitemapMatch[1].trim() : null;
}
