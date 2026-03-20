/**
 * Sitemap Client (Infrastructure Layer)
 * Handles HTTP fetching of sitemaps and delegates parsing to domain layer
 *
 * This separation follows Clean Architecture:
 * - HTTP concerns (infrastructure) separated from parsing logic (domain)
 * - Domain parser functions are pure (no side effects)
 * - Infrastructure orchestrates HTTP + parsing
 */

import { httpClient } from "./http-client";
import {
  SitemapUrl,
  parseSitemapXml,
  parseSitemapIndex,
  isSitemapIndex,
  extractSitemapFromRobotsTxt,
} from "../parsers/sitemap-parser";

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
      // Fetch and parse child sitemaps
      const childUrls = parseSitemapIndex(xmlContent);
      const allUrls: SitemapUrl[] = [];

      for (const childSitemapUrl of childUrls) {
        if (allUrls.length >= maxUrls) break;

        const childResults = await fetchAndParseSitemap(
          childSitemapUrl,
          maxUrls - allUrls.length
        );
        allUrls.push(...childResults);
      }

      return allUrls.slice(0, maxUrls);
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
