/**
 * Unit Tests: Link Scoring System
 * Tests relevance scoring using sitemap priorities, depth, and robots.txt
 */

import { describe, it, expect, vi } from "vitest";
import {
  LinkScorer,
  scoreAndFilterPages,
  type LinkScorerConfig,
} from "@/lib/crawling/link-scoring";
import type { PageMetadata } from "@/lib/types";
import type { SitemapUrl } from "@/lib/http/sitemap";

describe("LinkScorer", () => {
  // Helper to create mock page
  const createMockPage = (url: string, depth: number = 0): PageMetadata => ({
    url,
    title: "Test Page",
    description: "",
    ogDescription: "",
    ogTitle: "",
    ogType: "",
    h1: "",
    siteName: "",
    lang: "en",
    bodyText: "",
    depth,
    internalLinks: [],
    externalLinks: [],
  });

  // Helper to create mock sitemap data
  const createSitemapData = (
    entries: Array<{ url: string; priority?: number }>
  ): Map<string, SitemapUrl> => {
    const map = new Map<string, SitemapUrl>();
    entries.forEach(({ url, priority }) => {
      map.set(url, {
        url,
        priority,
        lastmod: undefined,
        changefreq: undefined,
      });
    });
    return map;
  };

  // Mock robots directives
  const createRobotsDirectives = (allowedUrls: string[]) => ({
    isAllowed: (url: string) => allowedUrls.includes(url),
    getCrawlDelay: () => undefined,
    getSitemaps: () => [],
  });

  describe("constructor", () => {
    it("should initialize with config", () => {
      const config: LinkScorerConfig = {
        sitemapData: new Map(),
      };
      const scorer = new LinkScorer(config);
      expect(scorer).toBeDefined();
    });

    it("should use default threshold of 40", async () => {
      const config: LinkScorerConfig = {
        sitemapData: new Map(),
      };
      const scorer = new LinkScorer(config);
      const page = createMockPage("https://example.com/low-score", 5);
      const scores = await scorer.scoreLinks([page]);
      expect(scores.size).toBe(0); // Filtered out (score too low)
    });

    it("should accept custom threshold", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/page", priority: 0.3 },
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 10, // Very low threshold
      };
      const scorer = new LinkScorer(config);
      const page = createMockPage("https://example.com/page", 2);
      const scores = await scorer.scoreLinks([page]);
      expect(scores.size).toBe(1); // Should pass
    });
  });

  describe("scoreLinks", () => {
    it("should score all pages and return map", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/page1", priority: 1.0 },
        { url: "https://example.com/page2", priority: 0.5 },
      ]);
      const config: LinkScorerConfig = { sitemapData };
      const scorer = new LinkScorer(config);

      const pages = [
        createMockPage("https://example.com/page1", 0),
        createMockPage("https://example.com/page2", 1),
      ];

      const scores = await scorer.scoreLinks(pages);
      expect(scores.size).toBe(2);
      expect(scores.has("https://example.com/page1")).toBe(true);
      expect(scores.has("https://example.com/page2")).toBe(true);
    });

    it("should filter out pages below threshold", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/high", priority: 1.0 },
      ]);
      const config: LinkScorerConfig = { sitemapData };
      const scorer = new LinkScorer(config);

      const pages = [
        createMockPage("https://example.com/high", 0), // Score: 40+30+20+5=95
        createMockPage("https://example.com/low", 5), // Score: 0+0+20+5=25 (< 40)
      ];

      const scores = await scorer.scoreLinks(pages);
      expect(scores.size).toBe(1);
      expect(scores.has("https://example.com/high")).toBe(true);
      expect(scores.has("https://example.com/low")).toBe(false);
    });

    it("should log scoring progress", async () => {
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const sitemapData = createSitemapData([
        { url: "https://example.com/page", priority: 1.0 },
      ]);
      const config: LinkScorerConfig = { sitemapData };
      const scorer = new LinkScorer(config);

      const pages = [createMockPage("https://example.com/page", 0)];
      await scorer.scoreLinks(pages);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Link Scoring]")
      );
      consoleLogSpy.mockRestore();
    });
  });

  describe("sitemap priority scoring (0-40 points)", () => {
    it("should score priority 1.0 as 40 points", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/page", priority: 1.0 },
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/page", 0);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/page");

      expect(score?.signals.sitemapPriority).toBe(40);
    });

    it("should score priority 0.5 as 20 points", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/page", priority: 0.5 },
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/page", 0);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/page");

      expect(score?.signals.sitemapPriority).toBe(20);
    });

    it("should score priority 0.0 as 0 points", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/page", priority: 0.0 },
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/page", 0);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/page");

      expect(score?.signals.sitemapPriority).toBe(0);
    });

    it("should default to priority 0.5 if not specified", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/page" }, // No priority
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/page", 0);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/page");

      expect(score?.signals.sitemapPriority).toBe(20); // 0.5 * 40
    });

    it("should score 0 points for pages not in sitemap", async () => {
      const sitemapData = new Map<string, SitemapUrl>();
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/not-in-sitemap", 0);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/not-in-sitemap");

      expect(score?.signals.sitemapPriority).toBe(0);
    });
  });

  describe("depth scoring (0-30 points)", () => {
    it("should score depth 0 (homepage) as 30 points", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com", priority: 0.5 },
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com", 0);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com");

      expect(score?.signals.depth).toBe(30);
    });

    it("should score depth 1 as 22.5 points", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/page", priority: 0.5 },
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/page", 1);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/page");

      expect(score?.signals.depth).toBe(22.5);
    });

    it("should score depth 2 as 15 points", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/a/b", priority: 0.5 },
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/a/b", 2);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/a/b");

      expect(score?.signals.depth).toBe(15);
    });

    it("should score depth 3 as 7.5 points", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/a/b/c", priority: 0.5 },
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/a/b/c", 3);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/a/b/c");

      expect(score?.signals.depth).toBe(7.5);
    });

    it("should score depth 4+ as 0 points", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/a/b/c/d", priority: 0.5 },
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/a/b/c/d", 4);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/a/b/c/d");

      expect(score?.signals.depth).toBe(0);
    });
  });

  describe("robots.txt scoring (0-20 points)", () => {
    it("should score allowed URL as 20 points", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/allowed", priority: 0.5 },
      ]);
      const robotsDirectives = createRobotsDirectives([
        "https://example.com/allowed",
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        robotsDirectives,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/allowed", 0);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/allowed");

      expect(score?.signals.robotsAllowed).toBe(20);
    });

    it("should score disallowed URL as 0 points", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/admin", priority: 0.5 },
      ]);
      const robotsDirectives = createRobotsDirectives([]); // Nothing allowed
      const config: LinkScorerConfig = {
        sitemapData,
        robotsDirectives,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/admin", 0);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/admin");

      expect(score?.signals.robotsAllowed).toBe(0);
    });

    it("should default to 20 points when no robots.txt", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/page", priority: 0.5 },
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        // No robotsDirectives
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/page", 0);
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/page");

      expect(score?.signals.robotsAllowed).toBe(20);
    });
  });

  describe("total score calculation", () => {
    it("should sum all signals correctly", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/page", priority: 1.0 }, // 40 points
      ]);
      const robotsDirectives = createRobotsDirectives([
        "https://example.com/page",
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        robotsDirectives,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/page", 0); // depth 0 = 30 points
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/page");

      // 40 (sitemap) + 30 (depth) + 20 (robots) + 5 (semantic) = 95
      expect(score?.totalScore).toBe(95);
      expect(score?.signals.sitemapPriority).toBe(40);
      expect(score?.signals.depth).toBe(30);
      expect(score?.signals.robotsAllowed).toBe(20);
      expect(score?.signals.semanticRelevance).toBe(5);
    });

    it("should handle minimum possible score", async () => {
      const sitemapData = new Map<string, SitemapUrl>(); // Not in sitemap = 0
      const robotsDirectives = createRobotsDirectives([]); // Disallowed = 0
      const config: LinkScorerConfig = {
        sitemapData,
        robotsDirectives,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com/page", 10); // Deep = 0
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/page");

      // 0 + 0 + 0 + 5 = 5 (minimum)
      expect(score?.totalScore).toBe(5);
    });

    it("should handle maximum possible score", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com", priority: 1.0 }, // 40 points
      ]);
      const robotsDirectives = createRobotsDirectives(["https://example.com"]);
      const config: LinkScorerConfig = {
        sitemapData,
        robotsDirectives,
        minScoreThreshold: 0,
      };
      const scorer = new LinkScorer(config);

      const page = createMockPage("https://example.com", 0); // Homepage = 30
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com");

      // 40 + 30 + 20 + 5 = 95 (maximum)
      expect(score?.totalScore).toBe(95);
    });
  });

  describe("scoreAndFilterPages helper", () => {
    it("should score, filter, and sort pages by total score", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/high", priority: 1.0 },
        { url: "https://example.com/medium", priority: 0.5 },
        { url: "https://example.com/low", priority: 0.1 },
      ]);
      const config: LinkScorerConfig = { sitemapData, minScoreThreshold: 30 };

      const pages = [
        createMockPage("https://example.com/low", 2), // Low score
        createMockPage("https://example.com/high", 0), // High score
        createMockPage("https://example.com/medium", 1), // Medium score
      ];

      const result = await scoreAndFilterPages(pages, config);

      // Should be sorted by score (high to low)
      expect(result.length).toBe(3);
      expect(result[0].page.url).toBe("https://example.com/high");
      expect(result[1].page.url).toBe("https://example.com/medium");
      expect(result[2].page.url).toBe("https://example.com/low");

      // Check scores are descending
      expect(result[0].score.totalScore).toBeGreaterThan(
        result[1].score.totalScore
      );
      expect(result[1].score.totalScore).toBeGreaterThan(
        result[2].score.totalScore
      );
    });

    it("should filter out pages below threshold", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/pass", priority: 1.0 },
      ]);
      const config: LinkScorerConfig = { sitemapData, minScoreThreshold: 50 };

      const pages = [
        createMockPage("https://example.com/pass", 0), // Score: 95 (passes)
        createMockPage("https://example.com/fail", 5), // Score: 25 (fails)
      ];

      const result = await scoreAndFilterPages(pages, config);

      expect(result.length).toBe(1);
      expect(result[0].page.url).toBe("https://example.com/pass");
    });

    it("should return empty array when all pages filtered out", async () => {
      const sitemapData = new Map<string, SitemapUrl>();
      const config: LinkScorerConfig = { sitemapData, minScoreThreshold: 50 };

      const pages = [
        createMockPage("https://example.com/low1", 5),
        createMockPage("https://example.com/low2", 5),
      ];

      const result = await scoreAndFilterPages(pages, config);

      expect(result.length).toBe(0);
    });
  });

  describe("real-world scenarios", () => {
    it("should prioritize homepage highest", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com", priority: 1.0 },
        { url: "https://example.com/about", priority: 0.8 },
        { url: "https://example.com/blog/post", priority: 0.5 },
      ]);
      const config: LinkScorerConfig = { sitemapData, minScoreThreshold: 0 };

      const pages = [
        createMockPage("https://example.com/blog/post", 2),
        createMockPage("https://example.com/about", 1),
        createMockPage("https://example.com", 0),
      ];

      const result = await scoreAndFilterPages(pages, config);

      expect(result[0].page.url).toBe("https://example.com");
      expect(result[0].score.totalScore).toBeGreaterThan(
        result[1].score.totalScore
      );
    });

    it("should filter out user-generated content not in sitemap", async () => {
      const sitemapData = createSitemapData([
        { url: "https://youtube.com/about", priority: 0.8 },
      ]);
      const config: LinkScorerConfig = { sitemapData, minScoreThreshold: 45 };

      const pages = [
        createMockPage("https://youtube.com/about", 1), // In sitemap: 32+22.5+20+5=79.5
        createMockPage("https://youtube.com/watch?v=random", 2), // Not in sitemap: 0+15+20+5=40
        createMockPage("https://youtube.com/@user/videos", 2), // Not in sitemap: 0+15+20+5=40
      ];

      const result = await scoreAndFilterPages(pages, config);

      // Only the official page should pass (scores above 45)
      expect(result.length).toBe(1);
      expect(result[0].page.url).toBe("https://youtube.com/about");
    });

    it("should penalize very deep pages", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/docs/api/v1/users/create", priority: 0.5 },
      ]);
      const config: LinkScorerConfig = { sitemapData, minScoreThreshold: 0 };
      const scorer = new LinkScorer(config);

      const page = createMockPage(
        "https://example.com/docs/api/v1/users/create",
        4
      );
      const scores = await scorer.scoreLinks([page]);
      const score = scores.get("https://example.com/docs/api/v1/users/create");

      // Depth 4 = 0 points, so total score lower
      expect(score?.signals.depth).toBe(0);
      expect(score?.totalScore).toBeLessThan(50);
    });

    it("should filter out admin/private paths via robots.txt", async () => {
      const sitemapData = createSitemapData([
        { url: "https://example.com/public", priority: 0.8 },
        { url: "https://example.com/admin", priority: 0.8 },
      ]);
      const robotsDirectives = createRobotsDirectives([
        "https://example.com/public",
        // /admin is disallowed
      ]);
      const config: LinkScorerConfig = {
        sitemapData,
        robotsDirectives,
        minScoreThreshold: 60, // Set high enough to filter admin (which scores 59.5)
      };

      const pages = [
        createMockPage("https://example.com/public", 1), // 32+22.5+20+5=79.5 (passes)
        createMockPage("https://example.com/admin", 1), // 32+22.5+0+5=59.5 (filtered)
      ];

      const result = await scoreAndFilterPages(pages, config);

      // Admin should be filtered out (robots score = 0, total 59.5 < 60)
      expect(result.length).toBe(1);
      expect(result[0].page.url).toBe("https://example.com/public");
    });
  });
});
