/**
 * Robots.txt Client
 * Parses and respects robots.txt directives for ethical crawling
 */

import robotsParser from "robots-parser";
import { httpClient } from "./http-client";
import { CRAWLER_USER_AGENT } from "@/lib/config/constants";

/**
 * Robots.txt directives for a website
 */
export interface RobotsDirectives {
  isAllowed: (url: string) => boolean;
  getCrawlDelay: () => number | undefined;
  getSitemap: () => string[];
}

/**
 * Cache for robots.txt to avoid repeated fetches
 */
const robotsCache = new Map<string, RobotsDirectives>();

/**
 * Fetch and parse robots.txt for a given domain
 * Returns directives that can check if URLs are allowed
 */
export async function fetchRobotsTxt(
  baseUrl: string
): Promise<RobotsDirectives> {
  // Normalize base URL (remove trailing slash, path, etc.)
  const url = new URL(baseUrl);
  const domain = `${url.protocol}//${url.host}`;

  // Check cache first
  const cached = robotsCache.get(domain);
  if (cached) {
    return cached;
  }

  try {
    const robotsUrl = `${domain}/robots.txt`;
    const response = await httpClient.get(robotsUrl, {
      timeout: 5000, // Quick timeout for robots.txt
      responseType: "text",
    });

    // Parse robots.txt (even on 404, robots-parser handles gracefully)
    const robotsTxt = response.status === 200 ? (response.data as string) : "";
    const robots = robotsParser(robotsUrl, robotsTxt);

    const directives: RobotsDirectives = {
      isAllowed: (url: string) =>
        robots.isAllowed(url, CRAWLER_USER_AGENT) ?? true,
      getCrawlDelay: () =>
        robots.getCrawlDelay(CRAWLER_USER_AGENT) ?? undefined,
      getSitemap: () => robots.getSitemaps(),
    };

    // Cache for future requests
    robotsCache.set(domain, directives);

    return directives;
  } catch (error) {
    // On error, return permissive directives (fail open)
    console.warn(`Failed to fetch robots.txt for ${domain}:`, error);

    const permissiveDirectives: RobotsDirectives = {
      isAllowed: () => true,
      getCrawlDelay: () => undefined,
      getSitemap: () => [],
    };

    robotsCache.set(domain, permissiveDirectives);
    return permissiveDirectives;
  }
}

/**
 * Check if a URL is allowed by robots.txt
 * Convenience function that fetches and checks in one call
 */
export async function isAllowedByRobots(
  url: string,
  baseUrl: string
): Promise<boolean> {
  const directives = await fetchRobotsTxt(baseUrl);
  return directives.isAllowed(url);
}

/**
 * Get crawl delay from robots.txt (in seconds)
 */
export async function getCrawlDelay(
  baseUrl: string
): Promise<number | undefined> {
  const directives = await fetchRobotsTxt(baseUrl);
  return directives.getCrawlDelay();
}

/**
 * Get sitemap URLs from robots.txt
 */
export async function getSitemapsFromRobots(
  baseUrl: string
): Promise<string[]> {
  const directives = await fetchRobotsTxt(baseUrl);
  return directives.getSitemap();
}

/**
 * Clear robots.txt cache (useful for testing)
 */
export function clearRobotsCache(): void {
  robotsCache.clear();
}
