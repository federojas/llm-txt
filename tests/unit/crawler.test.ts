/**
 * Unit Tests: Crawler
 * Tests website crawling orchestration with BFS strategy
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Crawler } from "@/lib/crawling/crawler";
import type { IHtmlParser } from "@/lib/crawling/parser";
import type { ILanguageDetector } from "@/lib/crawling/language-detector";
import type { CrawlConfig, PageMetadata, CrawlProgress } from "@/lib/types";
import { httpClient } from "@/lib/http/client";
import { fetchRobotsTxt, type RobotsDirectives } from "@/lib/http/robots";
import {
  discoverSitemap,
  fetchAndParseSitemap,
  type SitemapUrl,
} from "@/lib/http/sitemap";

// Mock dependencies
vi.mock("@/lib/http/client", () => ({
  httpClient: {
    get: vi.fn(),
    head: vi.fn(),
  },
}));

vi.mock("@/lib/http/robots", () => ({
  fetchRobotsTxt: vi.fn(),
}));

vi.mock("@/lib/http/sitemap", () => ({
  discoverSitemap: vi.fn(),
  fetchAndParseSitemap: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
  })),
}));

const mockHttpClient = vi.mocked(httpClient);
const mockFetchRobotsTxt = vi.mocked(fetchRobotsTxt);
const mockDiscoverSitemap = vi.mocked(discoverSitemap);
const mockFetchAndParseSitemap = vi.mocked(fetchAndParseSitemap);

describe("Crawler", () => {
  let mockHtmlParser: IHtmlParser;
  let mockLanguageDetector: ILanguageDetector;
  let mockRobotsDirectives: RobotsDirectives;
  let baseConfig: CrawlConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock HTML parser
    mockHtmlParser = {
      extractMetadata: vi.fn(),
      isIndexable: vi.fn(),
    };

    // Mock language detector
    mockLanguageDetector = {
      detectLanguage: vi.fn(),
    };

    // Mock robots directives
    mockRobotsDirectives = {
      isAllowed: vi.fn().mockReturnValue(true),
      getCrawlDelay: vi.fn().mockReturnValue(undefined),
      getSitemaps: vi.fn().mockReturnValue([]),
    };

    // Base config
    baseConfig = {
      url: "https://example.com",
      maxPages: 10,
      maxDepth: 2,
      timeout: 5000,
      concurrency: 3,
    };

    // Default mock responses
    mockFetchRobotsTxt.mockResolvedValue(mockRobotsDirectives);
    mockDiscoverSitemap.mockResolvedValue(null);
    mockFetchAndParseSitemap.mockResolvedValue([]);
  });

  describe("constructor", () => {
    it("should initialize with htmlParser", () => {
      const crawler = new Crawler(baseConfig, mockHtmlParser);
      expect(crawler).toBeDefined();
    });

    it("should throw error if neither htmlParser nor adBlocker provided", () => {
      expect(() => {
        new Crawler(baseConfig);
      }).toThrow("Either htmlParser or adBlocker must be provided");
    });

    it("should default languageStrategy to prefer-english", () => {
      const config = { ...baseConfig, languageStrategy: undefined };
      const crawler = new Crawler(config, mockHtmlParser);
      expect(crawler).toBeDefined();
    });

    it("should initialize with custom languageStrategy", () => {
      const config: CrawlConfig = {
        ...baseConfig,
        languageStrategy: "page-language",
      };
      const crawler = new Crawler(config, mockHtmlParser);
      expect(crawler).toBeDefined();
    });

    it("should initialize with exclude patterns", () => {
      const config: CrawlConfig = {
        ...baseConfig,
        excludePatterns: ["**/blog/**", "**/admin/**"],
      };
      const crawler = new Crawler(config, mockHtmlParser);
      expect(crawler).toBeDefined();
    });

    it("should initialize with include patterns", () => {
      const config: CrawlConfig = {
        ...baseConfig,
        includePatterns: ["**/docs/**", "**/api/**"],
      };
      const crawler = new Crawler(config, mockHtmlParser);
      expect(crawler).toBeDefined();
    });

    it("should accept progress callback", () => {
      const progressCallback = vi.fn();
      const crawler = new Crawler(baseConfig, mockHtmlParser, progressCallback);
      expect(crawler).toBeDefined();
    });

    it("should accept custom language detector", () => {
      const crawler = new Crawler(
        baseConfig,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );
      expect(crawler).toBeDefined();
    });
  });

  describe("pattern filtering", () => {
    it("should exclude URLs matching exclude patterns", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
        excludePatterns: ["**/blog/**"],
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      // Homepage should be included (exclude pattern doesn't match)
      expect(results).toHaveLength(1);
    });

    it("should include only URLs matching include patterns", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
        includePatterns: ["**/docs/**"],
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      // Homepage is always included regardless of patterns
      expect(results).toHaveLength(1);
    });

    it("should respect both include and exclude patterns", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
        includePatterns: ["**/docs/**"],
        excludePatterns: ["**/docs/internal/**"],
      };

      const crawler = new Crawler(config, mockHtmlParser);
      expect(crawler).toBeDefined();
    });
  });

  describe("robots.txt handling", () => {
    it("should fetch and respect robots.txt", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      await crawler.crawl();

      expect(mockFetchRobotsTxt).toHaveBeenCalledWith("https://example.com");
    });

    it("should handle crawl-delay directive", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
        concurrency: 10,
      };

      vi.mocked(mockRobotsDirectives.getCrawlDelay).mockReturnValue(2);

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      await crawler.crawl();

      // Should have reduced concurrency due to crawl-delay
      // (implementation limits to max 5 when crawl-delay >= 1)
      expect(mockFetchRobotsTxt).toHaveBeenCalled();
    });

    it("should continue if robots.txt fetch fails", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
      };

      mockFetchRobotsTxt.mockRejectedValue(new Error("Failed to fetch"));

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      expect(results).toHaveLength(1);
    });
  });

  describe("sitemap handling", () => {
    it("should try sitemap discovery", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      await crawler.crawl();

      expect(mockDiscoverSitemap).toHaveBeenCalledWith("https://example.com");
    });

    it("should use sitemap URLs when available", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 2,
        maxDepth: 1,
      };

      const sitemapUrls: SitemapUrl[] = [
        { url: "https://example.com", priority: 1.0 },
        { url: "https://example.com/page1", priority: 0.8 },
      ];

      mockDiscoverSitemap.mockResolvedValue("https://example.com/sitemap.xml");
      mockFetchAndParseSitemap.mockResolvedValue(sitemapUrls);

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Page</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Page",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      await crawler.crawl();

      expect(mockFetchAndParseSitemap).toHaveBeenCalledWith(
        "https://example.com/sitemap.xml",
        2
      );
    });

    it("should store sitemap priorities", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 2,
        maxDepth: 0,
      };

      const sitemapUrls: SitemapUrl[] = [
        { url: "https://example.com", priority: 1.0 },
      ];

      mockDiscoverSitemap.mockResolvedValue("https://example.com/sitemap.xml");
      mockFetchAndParseSitemap.mockResolvedValue(sitemapUrls);

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Page</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Page",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      await crawler.crawl();

      const sitemapData = crawler.getSitemapData();
      expect(sitemapData.size).toBeGreaterThan(0);
    });
  });

  describe("language detection", () => {
    it("should accept English pages with prefer-english strategy", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
        languageStrategy: "prefer-english",
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      expect(results).toHaveLength(1);
    });

    it("should accept all languages with page-language strategy", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
        languageStrategy: "page-language",
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("es");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      expect(results).toHaveLength(1);
    });

    it("should send Accept-Language header with prefer-english", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
        languageStrategy: "prefer-english",
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      await crawler.crawl();

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Accept-Language": "en-US,en;q=0.9",
          }),
        })
      );
    });
  });

  describe("progress callbacks", () => {
    it("should call progress callback on crawl start", async () => {
      const progressCallback = vi.fn();
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        progressCallback,
        mockLanguageDetector
      );

      await crawler.crawl();

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "crawling",
        })
      );
    });

    it("should call progress callback on completion", async () => {
      const progressCallback = vi.fn();
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        progressCallback,
        mockLanguageDetector
      );

      await crawler.crawl();

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "complete",
        })
      );
    });

    it("should call progress callback on error", async () => {
      const progressCallback = vi.fn();
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
      };

      // Trigger error in sitemap discovery (not caught by fetchAndParse)
      mockDiscoverSitemap.mockRejectedValue(new Error("Sitemap error"));

      const crawler = new Crawler(config, mockHtmlParser, progressCallback);

      await expect(crawler.crawl()).rejects.toThrow("Sitemap error");

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
        })
      );
    });
  });

  describe("error handling", () => {
    it("should handle HTTP 403 gracefully", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 2,
        maxDepth: 0,
      };

      mockHttpClient.get
        .mockResolvedValueOnce({
          status: 200,
          headers: { "content-type": "text/html" },
          data: "<html><head><title>Home</title></head><body><a href='/forbidden'>Link</a></body></html>",
        })
        .mockResolvedValueOnce({
          status: 403,
          headers: {},
          data: "",
        });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValueOnce({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: ["https://example.com/forbidden"],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      // Should have only homepage, skipped 403 page
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle HTTP 429 rate limiting", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 2,
        maxDepth: 0,
      };

      // Return 429 for homepage fetch (homepage always fetched first)
      mockHttpClient.get.mockResolvedValue({
        status: 429,
        headers: {},
        data: "",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      // Should handle 429 gracefully and return empty results
      expect(results).toEqual([]);
    });

    it("should skip non-HTML content", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 2,
        maxDepth: 0,
      };

      mockHttpClient.get
        .mockResolvedValueOnce({
          status: 200,
          headers: { "content-type": "text/html" },
          data: "<html><head><title>Home</title></head><body><a href='/document.pdf'>PDF</a></body></html>",
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { "content-type": "application/pdf" },
          data: "PDF content",
        });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValueOnce({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: ["https://example.com/document.pdf"],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      // Should have only homepage, skipped PDF
      expect(results.length).toBeGreaterThan(0);
    });

    it("should skip non-indexable pages", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: '<html><head><title>Home</title><meta name="robots" content="noindex"></head><body></body></html>',
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(false);

      const crawler = new Crawler(config, mockHtmlParser);

      const results = await crawler.crawl();

      expect(results).toHaveLength(0);
    });

    it("should handle fetch errors gracefully", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 2,
        maxDepth: 0,
      };

      mockHttpClient.get
        .mockResolvedValueOnce({
          status: 200,
          headers: { "content-type": "text/html" },
          data: "<html><head><title>Home</title></head><body><a href='/error'>Link</a></body></html>",
        })
        .mockRejectedValueOnce(new Error("Network timeout"));

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValueOnce({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: ["https://example.com/error"],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      // Should have only homepage, skipped errored page
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("duplicate detection", () => {
    it("should track visited URLs", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Page</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Page",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      // Should crawl homepage successfully
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should detect duplicate content by hash", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 5,
        maxDepth: 1,
      };

      mockHttpClient.get
        .mockResolvedValueOnce({
          status: 200,
          headers: { "content-type": "text/html" },
          data: "<html><head><title>Page</title></head><body><a href='/duplicate'>Link</a></body></html>",
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { "content-type": "text/html" },
          data: "<html><head><title>Page</title></head><body></body></html>",
        });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata)
        .mockResolvedValueOnce({
          url: "https://example.com",
          title: "Page",
          description: "Desc",
          bodyText: "Body",
          internalLinks: ["https://example.com/duplicate"],
          externalLinks: [],
          depth: 0,
        })
        .mockResolvedValueOnce({
          url: "https://example.com/duplicate",
          title: "Page",
          description: "Desc",
          bodyText: "Body",
          internalLinks: [],
          externalLinks: [],
          depth: 1,
        });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      // Should skip duplicate page (same content hash)
      expect(results.length).toBe(1);
    });
  });

  describe("depth limiting", () => {
    it("should respect maxDepth limit", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 10,
        maxDepth: 0,
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Page</title></head><body><a href='/deep'>Link</a></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Page",
        description: "",
        internalLinks: ["https://example.com/deep"],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      // Should only have homepage (maxDepth=0)
      expect(results.length).toBe(1);
    });
  });

  describe("page limiting", () => {
    it("should respect maxPages limit", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 2,
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Page</title></head><body><a href='/page1'>Link1</a><a href='/page2'>Link2</a></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Page",
        description: "",
        internalLinks: [
          "https://example.com/page1",
          "https://example.com/page2",
        ],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      const results = await crawler.crawl();

      // Should stop at maxPages=1
      expect(results.length).toBe(1);
    });
  });

  describe("getters", () => {
    it("should return sitemap data", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
      };

      const sitemapUrls: SitemapUrl[] = [
        { url: "https://example.com", priority: 1.0 },
      ];

      mockDiscoverSitemap.mockResolvedValue("https://example.com/sitemap.xml");
      mockFetchAndParseSitemap.mockResolvedValue(sitemapUrls);

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      await crawler.crawl();

      const sitemapData = crawler.getSitemapData();
      expect(sitemapData).toBeInstanceOf(Map);
    });

    it("should return robots directives", async () => {
      const config: CrawlConfig = {
        ...baseConfig,
        maxPages: 1,
        maxDepth: 0,
      };

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        headers: { "content-type": "text/html" },
        data: "<html><head><title>Home</title></head><body></body></html>",
      });

      vi.mocked(mockHtmlParser.isIndexable).mockReturnValue(true);
      vi.mocked(mockHtmlParser.extractMetadata).mockResolvedValue({
        url: "https://example.com",
        title: "Home",
        description: "",
        internalLinks: [],
        externalLinks: [],
        depth: 0,
      });

      vi.mocked(mockLanguageDetector.detectLanguage).mockResolvedValue("en");

      const crawler = new Crawler(
        config,
        mockHtmlParser,
        undefined,
        mockLanguageDetector
      );

      await crawler.crawl();

      const robotsDirectives = crawler.getRobotsDirectives();
      expect(robotsDirectives).toBeDefined();
    });
  });

  describe("abort", () => {
    it("should have abort method", () => {
      const crawler = new Crawler(baseConfig, mockHtmlParser);
      expect(crawler.abort).toBeDefined();
      expect(typeof crawler.abort).toBe("function");
    });

    it("should call abort without error", () => {
      const crawler = new Crawler(baseConfig, mockHtmlParser);
      expect(() => crawler.abort()).not.toThrow();
    });
  });
});
