import * as cheerio from "cheerio";
import { normalizeUrl } from "../../utils/url";
import { httpClient } from "../../utils/http-client";

export interface SitemapUrl {
  url: string;
  priority?: number;
  lastmod?: string;
}

/**
 * Parse sitemap.xml and extract URLs
 */
export async function parseSitemap(
  sitemapUrl: string,
  maxUrls: number = 100
): Promise<SitemapUrl[]> {
  try {
    const response = await httpClient.get(sitemapUrl, {
      timeout: 10000,
      responseType: "text",
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to fetch sitemap: ${response.status}`);
    }

    const text = response.data as string;
    const $ = cheerio.load(text, { xmlMode: true });

    const urls: SitemapUrl[] = [];

    // Check if it's a sitemap index
    const sitemapElements = $("sitemap loc");
    if (sitemapElements.length > 0) {
      // This is a sitemap index, fetch child sitemaps
      const sitemapUrls = sitemapElements
        .map((_, el) => $(el).text())
        .get()
        .slice(0, 5); // Limit to 5 sitemaps

      for (const childSitemapUrl of sitemapUrls) {
        const childUrls = await parseSitemap(childSitemapUrl, maxUrls);
        urls.push(...childUrls);
        if (urls.length >= maxUrls) break;
      }
    } else {
      // Regular sitemap
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
    }

    // Sort by priority (descending)
    urls.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return urls.slice(0, maxUrls);
  } catch (error) {
    console.error("Failed to parse sitemap:", error);
    return [];
  }
}

/**
 * Try to find sitemap.xml URL
 */
export async function findSitemap(baseUrl: string): Promise<string | null> {
  const commonSitemapPaths = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/sitemap1.xml",
  ];

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
      const text = response.data as string;
      const sitemapMatch = text.match(/Sitemap:\s*(.+)/i);
      if (sitemapMatch) {
        return sitemapMatch[1].trim();
      }
    }
  } catch {
    // No robots.txt
  }

  return null;
}
