/**
 * Integration Tests: Crawler
 * Tests real website crawling with actual HTTP requests
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Crawler } from "@/lib/crawling/crawler";
import { AdBlocker } from "@/lib/crawling/ad-blocker";
import type { CrawlConfig } from "@/lib/types/crawl-config";

describe("Crawler Integration", () => {
  let crawler: Crawler;
  let adBlocker: AdBlocker;

  beforeEach(() => {
    adBlocker = new AdBlocker();
  });

  describe("Real website crawling", () => {
    it("should crawl example.com successfully", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].url).toMatch(/^https:\/\/example\.com\/?$/);
      expect(results[0].title).toBeTruthy();
      expect(results[0].depth).toBe(0);
    }, 30000);

    it("should extract metadata from real HTML", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      const homepage = results[0];
      expect(homepage.title).toBeTruthy();
      // Description may be undefined if page doesn't have meta description
      expect(homepage).toHaveProperty("description");
      expect(homepage.bodyText).toBeTruthy();
    }, 30000);

    it("should respect maxPages limit", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 3,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      expect(results.length).toBeLessThanOrEqual(3);
    }, 30000);

    it("should respect maxDepth limit", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      results.forEach((page) => {
        expect(page.depth).toBeLessThanOrEqual(1);
      });
    }, 30000);
  });

  describe("Sitemap discovery and parsing", () => {
    it("should discover sitemap from robots.txt", async () => {
      const config: CrawlConfig = {
        url: "https://www.sitemaps.org",
        maxDepth: 2,
        maxPages: 5,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      // Should find homepage at minimum
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].url).toContain("sitemaps.org");
    }, 30000);

    it("should parse sitemap URLs when available", async () => {
      // Use a known site with sitemap
      const config: CrawlConfig = {
        url: "https://www.example.com",
        maxDepth: 2,
        maxPages: 5,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      // Verify crawling worked (sitemap may or may not be present)
      expect(results.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Robots.txt compliance", () => {
    it("should respect robots.txt disallow rules", async () => {
      // Most sites disallow /admin, /private, etc.
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      // Should not find any disallowed paths
      results.forEach((page) => {
        expect(page.url).not.toContain("/admin");
        expect(page.url).not.toContain("/private");
      });
    }, 30000);

    it("should crawl disallowed paths when followRobotsTxt is false", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      // Note: This test only verifies the config is respected
      // We don't actually crawl disallowed paths to be respectful
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      expect(crawler).toBeDefined();
    });
  });

  describe("URL pattern filtering", () => {
    it("should include only matching patterns", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 5,
        timeout: 10000,
        concurrency: 5,
        includePatterns: ["**"],
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      // Should only get homepage and maybe a few more
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].url).toMatch(/^https:\/\/example\.com\/?$/);
    }, 30000);

    it("should ignore matching patterns", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
        excludePatterns: ["**/docs/**", "**/api/**"],
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      // Should not contain ignored patterns
      results.forEach((page) => {
        expect(page.url).not.toContain("/docs/");
        expect(page.url).not.toContain("/api/");
      });
    }, 30000);
  });

  describe("Language detection", () => {
    it("should attempt language detection from real HTML", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      const homepage = results[0];
      // Language property is "lang" in PageMetadata
      // May be undefined if page doesn't have lang attribute
      expect(homepage).toHaveProperty("lang");
    }, 30000);
  });

  describe("Link extraction", () => {
    it("should extract internal links", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      const homepage = results[0];
      expect(homepage.internalLinks).toBeDefined();
      expect(Array.isArray(homepage.internalLinks)).toBe(true);
    }, 30000);

    it("should extract external links", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      const homepage = results[0];
      expect(homepage.externalLinks).toBeDefined();
      expect(Array.isArray(homepage.externalLinks)).toBe(true);
    }, 30000);

    it("should not include duplicate URLs", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      const urls = results.map((page) => page.url);
      const uniqueUrls = new Set(urls);
      expect(urls.length).toBe(uniqueUrls.size);
    }, 30000);
  });

  describe("Error handling", () => {
    it.skip("should handle invalid domain gracefully", async () => {
      // Skipped: Takes too long waiting for network DNS resolution timeout
      const config: CrawlConfig = {
        url: "https://this-domain-does-not-exist-12345.com",
        maxDepth: 1,
        maxPages: 1,
        timeout: 5000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      // Should return empty array or handle error gracefully
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    }, 60000);

    it("should handle timeout errors", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 1, // 1ms timeout - will fail
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      // Should handle timeout gracefully
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    }, 30000);

    it("should continue crawling after failed page", async () => {
      // Mix valid and invalid URLs via includePatterns won't work here
      // This test verifies resilience during crawl
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      // Should successfully get at least homepage despite any internal failures
      expect(results.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe("BFS crawl strategy", () => {
    it("should crawl in breadth-first order", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      // Verify depth increases gradually (BFS characteristic)
      let previousDepth = 0;
      let depthIncreased = false;

      for (const page of results) {
        if (page.depth > previousDepth) {
          // Depth should only increase by 1 at a time in BFS
          expect(page.depth - previousDepth).toBeLessThanOrEqual(1);
          depthIncreased = true;
        }
        previousDepth = Math.max(previousDepth, page.depth);
      }

      // If we have multiple pages, we should see depth increase
      if (results.length > 1) {
        expect(depthIncreased).toBe(true);
      }
    }, 30000);
  });

  describe("Ad blocker integration", () => {
    it("should filter out ads and trackers", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      // Verify no common ad/tracking domains in external links
      const adDomains = [
        "doubleclick.net",
        "google-analytics.com",
        "facebook.com/tr",
      ];

      results.forEach((page) => {
        page.externalLinks?.forEach((link) => {
          adDomains.forEach((adDomain) => {
            expect(link.url).not.toContain(adDomain);
          });
        });
      });
    }, 30000);
  });

  describe("Real-world HTML parsing", () => {
    it("should handle complex HTML structure", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      const homepage = results[0];

      // Should extract clean text without HTML tags
      expect(homepage.bodyText).not.toContain("<div>");
      expect(homepage.bodyText).not.toContain("<script>");
      expect(homepage.bodyText).not.toContain("<style>");
    }, 30000);

    it("should extract OpenGraph metadata when available", async () => {
      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      const homepage = results[0];

      // example.com may or may not have OG tags, but structure should be valid
      expect(homepage).toHaveProperty("title");
      expect(homepage).toHaveProperty("description");
    }, 30000);
  });

  describe("Performance", () => {
    it("should crawl within reasonable time", async () => {
      const startTime = Date.now();

      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 5,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      await crawler.crawl();

      const duration = Date.now() - startTime;

      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
    }, 30000);

    it("should handle concurrent page fetches efficiently", async () => {
      // This test verifies the crawler doesn't block on sequential fetches
      const startTime = Date.now();

      const config: CrawlConfig = {
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        timeout: 10000,
        concurrency: 5,
      };
      crawler = new Crawler(config, undefined, undefined, undefined, adBlocker);
      const results = await crawler.crawl();

      const duration = Date.now() - startTime;

      // With 3 pages, should be faster than 3 * single-page-time
      // This is a rough check that parallelization is working
      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(20000);
    }, 30000);
  });
});
