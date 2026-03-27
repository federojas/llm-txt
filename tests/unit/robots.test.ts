/**
 * Unit Tests: Robots.txt Client
 * Tests robots.txt parsing and caching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchRobotsTxt,
  isAllowedByRobots,
  getCrawlDelay,
  getSitemapsFromRobots,
  clearRobotsCache,
} from "@/lib/http/robots";
import { httpClient } from "@/lib/http/client";
import robotsParser from "robots-parser";

// Mock httpClient
vi.mock("@/lib/http/client", () => ({
  httpClient: {
    get: vi.fn(),
  },
}));

// Mock robots-parser
vi.mock("robots-parser", () => ({
  default: vi.fn(),
}));

describe("Robots.txt Client", () => {
  const mockHttpClient = vi.mocked(httpClient);
  const mockRobotsParser = vi.mocked(robotsParser);

  beforeEach(() => {
    vi.clearAllMocks();
    clearRobotsCache();
  });

  afterEach(() => {
    clearRobotsCache();
  });

  describe("fetchRobotsTxt", () => {
    it("should fetch and parse robots.txt successfully", async () => {
      const mockRobotsTxt = `User-agent: *
Disallow: /admin/
Sitemap: https://example.com/sitemap.xml`;

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(5),
        getSitemaps: vi
          .fn()
          .mockReturnValue(["https://example.com/sitemap.xml"]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const directives = await fetchRobotsTxt("https://example.com");

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        "https://example.com/robots.txt",
        { timeout: 5000, responseType: "text" }
      );
      expect(directives.isAllowed("https://example.com/page")).toBe(true);
      expect(directives.getCrawlDelay()).toBe(5);
      expect(directives.getSitemap()).toEqual([
        "https://example.com/sitemap.xml",
      ]);
    });

    it("should handle 404 robots.txt gracefully", async () => {
      mockHttpClient.get.mockResolvedValue({
        status: 404,
        data: "",
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const directives = await fetchRobotsTxt("https://example.com");

      expect(mockRobotsParser).toHaveBeenCalledWith(
        "https://example.com/robots.txt",
        ""
      );
      expect(directives.isAllowed("https://example.com/page")).toBe(true);
    });

    it("should cache robots.txt for the same domain", async () => {
      const mockRobotsTxt = "User-agent: *\nDisallow: /admin/";

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      // First call
      await fetchRobotsTxt("https://example.com");

      // Second call should use cache
      await fetchRobotsTxt("https://example.com");

      // Should only fetch once
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it("should cache per domain (not per URL)", async () => {
      const mockRobotsTxt = "User-agent: *\nDisallow:";

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      // Different paths, same domain
      await fetchRobotsTxt("https://example.com/docs");
      await fetchRobotsTxt("https://example.com/blog");

      // Should only fetch once
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it("should normalize URLs with trailing slashes", async () => {
      const mockRobotsTxt = "User-agent: *\nDisallow:";

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      await fetchRobotsTxt("https://example.com/");

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        "https://example.com/robots.txt",
        expect.any(Object)
      );
    });

    it("should handle network errors gracefully (fail open)", async () => {
      mockHttpClient.get.mockRejectedValue(new Error("Network error"));

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const directives = await fetchRobotsTxt("https://example.com");

      // Should return permissive directives
      expect(directives.isAllowed("https://example.com/admin")).toBe(true);
      expect(directives.getCrawlDelay()).toBeUndefined();
      expect(directives.getSitemap()).toEqual([]);

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it("should cache permissive directives after error", async () => {
      mockHttpClient.get.mockRejectedValue(new Error("Network error"));

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // First call fails
      await fetchRobotsTxt("https://example.com");

      // Second call should use cached permissive directives
      await fetchRobotsTxt("https://example.com");

      // Should only attempt fetch once
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);

      consoleWarnSpy.mockRestore();
    });

    it("should handle different protocols separately", async () => {
      const mockRobotsTxt = "User-agent: *\nDisallow:";

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      // HTTP and HTTPS are different domains
      await fetchRobotsTxt("http://example.com");
      await fetchRobotsTxt("https://example.com");

      // Should fetch twice (different protocols)
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it("should handle different ports separately", async () => {
      const mockRobotsTxt = "User-agent: *\nDisallow:";

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      await fetchRobotsTxt("https://example.com:443");
      await fetchRobotsTxt("https://example.com:8443");

      // Should fetch twice (different ports)
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it("should handle robots.txt with disallowed paths", async () => {
      const mockRobotsTxt = `User-agent: *
Disallow: /admin/
Disallow: /private/`;

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn((url) => {
          return !url.includes("/admin/") && !url.includes("/private/");
        }),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const directives = await fetchRobotsTxt("https://example.com");

      expect(directives.isAllowed("https://example.com/admin/")).toBe(false);
      expect(directives.isAllowed("https://example.com/public/")).toBe(true);
    });

    it("should handle robots.txt with crawl delay", async () => {
      const mockRobotsTxt = `User-agent: *
Crawl-delay: 10`;

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(10),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const directives = await fetchRobotsTxt("https://example.com");

      expect(directives.getCrawlDelay()).toBe(10);
    });

    it("should handle robots.txt with multiple sitemaps", async () => {
      const mockRobotsTxt = `User-agent: *
Sitemap: https://example.com/sitemap1.xml
Sitemap: https://example.com/sitemap2.xml`;

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi
          .fn()
          .mockReturnValue([
            "https://example.com/sitemap1.xml",
            "https://example.com/sitemap2.xml",
          ]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const directives = await fetchRobotsTxt("https://example.com");

      expect(directives.getSitemap()).toEqual([
        "https://example.com/sitemap1.xml",
        "https://example.com/sitemap2.xml",
      ]);
    });

    it("should handle null return from robots-parser isAllowed", async () => {
      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: "User-agent: *\nDisallow:",
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(null),
        getCrawlDelay: vi.fn().mockReturnValue(null),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const directives = await fetchRobotsTxt("https://example.com");

      // null should default to true (permissive)
      expect(directives.isAllowed("https://example.com/page")).toBe(true);
      expect(directives.getCrawlDelay()).toBeUndefined();
    });
  });

  describe("isAllowedByRobots", () => {
    it("should check if URL is allowed", async () => {
      const mockRobotsTxt = "User-agent: *\nDisallow: /admin/";

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn((url) => !url.includes("/admin/")),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const allowed = await isAllowedByRobots(
        "https://example.com/public/page",
        "https://example.com"
      );
      const disallowed = await isAllowedByRobots(
        "https://example.com/admin/page",
        "https://example.com"
      );

      expect(allowed).toBe(true);
      expect(disallowed).toBe(false);
    });

    it("should use cached directives", async () => {
      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: "User-agent: *\nDisallow:",
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      // First call
      await isAllowedByRobots(
        "https://example.com/page1",
        "https://example.com"
      );

      // Second call should use cache
      await isAllowedByRobots(
        "https://example.com/page2",
        "https://example.com"
      );

      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCrawlDelay", () => {
    it("should return crawl delay in seconds", async () => {
      const mockRobotsTxt = "User-agent: *\nCrawl-delay: 5";

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(5),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const delay = await getCrawlDelay("https://example.com");

      expect(delay).toBe(5);
    });

    it("should return undefined when no crawl delay", async () => {
      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: "User-agent: *\nDisallow:",
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const delay = await getCrawlDelay("https://example.com");

      expect(delay).toBeUndefined();
    });
  });

  describe("getSitemapsFromRobots", () => {
    it("should return sitemap URLs", async () => {
      const mockRobotsTxt =
        "User-agent: *\nSitemap: https://example.com/sitemap.xml";

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi
          .fn()
          .mockReturnValue(["https://example.com/sitemap.xml"]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const sitemaps = await getSitemapsFromRobots("https://example.com");

      expect(sitemaps).toEqual(["https://example.com/sitemap.xml"]);
    });

    it("should return empty array when no sitemaps", async () => {
      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: "User-agent: *\nDisallow:",
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const sitemaps = await getSitemapsFromRobots("https://example.com");

      expect(sitemaps).toEqual([]);
    });
  });

  describe("clearRobotsCache", () => {
    it("should clear the cache", async () => {
      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: "User-agent: *\nDisallow:",
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      // First call
      await fetchRobotsTxt("https://example.com");

      // Clear cache
      clearRobotsCache();

      // Second call should fetch again
      await fetchRobotsTxt("https://example.com");

      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("real-world scenarios", () => {
    it("should handle typical website robots.txt", async () => {
      const mockRobotsTxt = `User-agent: *
Disallow: /admin/
Disallow: /api/internal/
Crawl-delay: 1
Sitemap: https://example.com/sitemap.xml

User-agent: Googlebot
Crawl-delay: 0`;

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn((url) => {
          return !url.includes("/admin/") && !url.includes("/api/internal/");
        }),
        getCrawlDelay: vi.fn().mockReturnValue(1),
        getSitemaps: vi
          .fn()
          .mockReturnValue(["https://example.com/sitemap.xml"]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const directives = await fetchRobotsTxt("https://example.com");

      expect(directives.isAllowed("https://example.com/public")).toBe(true);
      expect(directives.isAllowed("https://example.com/admin/")).toBe(false);
      expect(directives.getCrawlDelay()).toBe(1);
      expect(directives.getSitemap()).toContain(
        "https://example.com/sitemap.xml"
      );
    });

    it("should handle permissive robots.txt (allow all)", async () => {
      const mockRobotsTxt = `User-agent: *
Disallow:`;

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(true),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const directives = await fetchRobotsTxt("https://example.com");

      expect(directives.isAllowed("https://example.com/any/path")).toBe(true);
    });

    it("should handle restrictive robots.txt (disallow all)", async () => {
      const mockRobotsTxt = `User-agent: *
Disallow: /`;

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: mockRobotsTxt,
      });

      const mockRobotsInstance = {
        isAllowed: vi.fn().mockReturnValue(false),
        getCrawlDelay: vi.fn().mockReturnValue(undefined),
        getSitemaps: vi.fn().mockReturnValue([]),
      };
      mockRobotsParser.mockReturnValue(mockRobotsInstance);

      const directives = await fetchRobotsTxt("https://example.com");

      expect(directives.isAllowed("https://example.com/any/path")).toBe(false);
    });
  });
});
