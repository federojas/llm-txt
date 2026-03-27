/**
 * Unit Tests: Sitemap Client
 * Tests sitemap fetching, parsing, and discovery
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAndParseSitemap,
  discoverSitemap,
  type SitemapUrl,
} from "@/lib/http/sitemap";
import { httpClient } from "@/lib/http/client";

// Mock dependencies
vi.mock("@/lib/http/client", () => ({
  httpClient: {
    get: vi.fn(),
    head: vi.fn(),
  },
}));

const mockHttpClient = vi.mocked(httpClient);

describe("Sitemap Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchAndParseSitemap", () => {
    describe("regular sitemap", () => {
      it("should parse valid sitemap XML", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/page1</loc>
              <priority>0.8</priority>
              <lastmod>2024-01-01</lastmod>
            </url>
            <url>
              <loc>https://example.com/page2</loc>
              <priority>0.6</priority>
              <lastmod>2024-01-02</lastmod>
            </url>
          </urlset>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: xml,
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls).toHaveLength(2);
        expect(urls[0].url).toBe("https://example.com/page1");
        expect(urls[0].priority).toBe(0.8);
        expect(urls[0].lastmod).toBe("2024-01-01");
        expect(urls[1].url).toBe("https://example.com/page2");
        expect(urls[1].priority).toBe(0.6);
      });

      it("should sort URLs by priority descending", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/low</loc>
              <priority>0.3</priority>
            </url>
            <url>
              <loc>https://example.com/high</loc>
              <priority>0.9</priority>
            </url>
            <url>
              <loc>https://example.com/medium</loc>
              <priority>0.6</priority>
            </url>
          </urlset>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: xml,
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls[0].priority).toBe(0.9);
        expect(urls[0].url).toBe("https://example.com/high");
        expect(urls[1].priority).toBe(0.6);
        expect(urls[2].priority).toBe(0.3);
      });

      it("should use default priority 0.5 when not specified", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/page1</loc>
            </url>
          </urlset>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: xml,
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls[0].priority).toBe(0.5);
      });

      it("should respect maxUrls limit", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/1</loc></url>
            <url><loc>https://example.com/2</loc></url>
            <url><loc>https://example.com/3</loc></url>
            <url><loc>https://example.com/4</loc></url>
            <url><loc>https://example.com/5</loc></url>
          </urlset>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: xml,
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml",
          3
        );

        expect(urls).toHaveLength(3);
      });

      it("should normalize URLs", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/page?query=value</loc>
            </url>
          </urlset>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: xml,
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        // normalizeUrl removes query parameters
        expect(urls[0].url).toBe("https://example.com/page");
      });

      it("should skip entries without loc", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <priority>0.8</priority>
            </url>
            <url>
              <loc>https://example.com/valid</loc>
            </url>
          </urlset>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: xml,
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls).toHaveLength(1);
        expect(urls[0].url).toBe("https://example.com/valid");
      });

      it("should handle lastmod as optional", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/page1</loc>
              <lastmod>2024-01-01</lastmod>
            </url>
            <url>
              <loc>https://example.com/page2</loc>
            </url>
          </urlset>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: xml,
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls[0].lastmod).toBe("2024-01-01");
        expect(urls[1].lastmod).toBeUndefined();
      });
    });

    describe("sitemap index", () => {
      it("should detect and process sitemap index", async () => {
        const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
          <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap>
              <loc>https://example.com/sitemap1.xml</loc>
            </sitemap>
            <sitemap>
              <loc>https://example.com/sitemap2.xml</loc>
            </sitemap>
          </sitemapindex>`;

        const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page1</loc></url>
          </urlset>`;

        const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page2</loc></url>
          </urlset>`;

        mockHttpClient.get
          .mockResolvedValueOnce({
            status: 200,
            data: indexXml,
          })
          .mockResolvedValueOnce({
            status: 200,
            data: sitemap1Xml,
          })
          .mockResolvedValueOnce({
            status: 200,
            data: sitemap2Xml,
          });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls).toHaveLength(2);
        expect(urls[0].url).toBe("https://example.com/page1");
        expect(urls[1].url).toBe("https://example.com/page2");
      });

      it("should respect maxUrls across multiple child sitemaps", async () => {
        const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
          <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
          </sitemapindex>`;

        const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page1</loc></url>
            <url><loc>https://example.com/page2</loc></url>
          </urlset>`;

        const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page3</loc></url>
            <url><loc>https://example.com/page4</loc></url>
          </urlset>`;

        mockHttpClient.get
          .mockResolvedValueOnce({
            status: 200,
            data: indexXml,
          })
          .mockResolvedValueOnce({
            status: 200,
            data: sitemap1Xml,
          })
          .mockResolvedValueOnce({
            status: 200,
            data: sitemap2Xml,
          });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml",
          3
        );

        expect(urls).toHaveLength(3);
      });

      it("should stop fetching child sitemaps after reaching maxUrls", async () => {
        const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
          <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap3.xml</loc></sitemap>
          </sitemapindex>`;

        const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page1</loc></url>
            <url><loc>https://example.com/page2</loc></url>
          </urlset>`;

        mockHttpClient.get
          .mockResolvedValueOnce({
            status: 200,
            data: indexXml,
          })
          .mockResolvedValueOnce({
            status: 200,
            data: sitemap1Xml,
          });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml",
          2
        );

        expect(urls).toHaveLength(2);
        // Should only call get 2 times (index + first child)
        expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
      });
    });

    describe("error handling", () => {
      it("should return empty array on HTTP error", async () => {
        mockHttpClient.get.mockResolvedValue({
          status: 404,
          data: "",
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls).toEqual([]);
      });

      it("should return empty array on network error", async () => {
        mockHttpClient.get.mockRejectedValue(new Error("Network error"));

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls).toEqual([]);
      });

      it("should return empty array on invalid XML", async () => {
        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: "not valid xml <unclosed",
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls).toEqual([]);
      });

      it("should return empty array on malformed sitemap", async () => {
        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: "<html><body>This is not a sitemap</body></html>",
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls).toEqual([]);
      });

      it("should handle child sitemap errors gracefully", async () => {
        const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
          <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
          </sitemapindex>`;

        const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page1</loc></url>
          </urlset>`;

        mockHttpClient.get
          .mockResolvedValueOnce({
            status: 200,
            data: indexXml,
          })
          .mockResolvedValueOnce({
            status: 200,
            data: sitemap1Xml,
          })
          .mockRejectedValueOnce(new Error("Failed to fetch sitemap2"));

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        // Should still return URLs from successful child sitemaps
        expect(urls).toHaveLength(1);
        expect(urls[0].url).toBe("https://example.com/page1");
      });
    });

    describe("edge cases", () => {
      it("should handle empty sitemap", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          </urlset>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: xml,
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls).toEqual([]);
      });

      it("should handle sitemap index with no child sitemaps", async () => {
        const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
          <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          </sitemapindex>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: indexXml,
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls).toEqual([]);
      });

      it("should handle maxUrls of 0", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page1</loc></url>
          </urlset>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: xml,
        });

        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml",
          0
        );

        expect(urls).toEqual([]);
      });

      it("should handle default maxUrls parameter", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page1</loc></url>
          </urlset>`;

        mockHttpClient.get.mockResolvedValue({
          status: 200,
          data: xml,
        });

        // Should default to 100
        const urls = await fetchAndParseSitemap(
          "https://example.com/sitemap.xml"
        );

        expect(urls).toHaveLength(1);
      });
    });
  });

  describe("discoverSitemap", () => {
    it("should find sitemap at common path", async () => {
      mockHttpClient.head.mockResolvedValue({
        status: 200,
      });

      const url = await discoverSitemap("https://example.com");

      expect(url).toBe("https://example.com/sitemap.xml");
      expect(mockHttpClient.head).toHaveBeenCalledWith(
        "https://example.com/sitemap.xml",
        expect.any(Object)
      );
    });

    it("should try multiple common paths", async () => {
      mockHttpClient.head
        .mockResolvedValueOnce({
          status: 404,
        })
        .mockResolvedValueOnce({
          status: 200,
        });

      const url = await discoverSitemap("https://example.com");

      expect(url).toBe("https://example.com/sitemap_index.xml");
      expect(mockHttpClient.head).toHaveBeenCalledTimes(2);
    });

    it("should extract sitemap from robots.txt", async () => {
      mockHttpClient.head
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ status: 404 });

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: "User-agent: *\nDisallow: /admin/\nSitemap: https://example.com/custom-sitemap.xml",
      });

      const url = await discoverSitemap("https://example.com");

      expect(url).toBe("https://example.com/custom-sitemap.xml");
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        "https://example.com/robots.txt",
        expect.any(Object)
      );
    });

    it("should handle case-insensitive Sitemap directive", async () => {
      mockHttpClient.head.mockResolvedValue({ status: 404 });

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: "User-agent: *\nDisallow: /admin/\nsitemap: https://example.com/sitemap.xml",
      });

      const url = await discoverSitemap("https://example.com");

      expect(url).toBe("https://example.com/sitemap.xml");
    });

    it("should return null if no sitemap found", async () => {
      mockHttpClient.head.mockResolvedValue({ status: 404 });
      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: "User-agent: *\nDisallow: /admin/",
      });

      const url = await discoverSitemap("https://example.com");

      expect(url).toBeNull();
    });

    it("should return null if robots.txt not found", async () => {
      mockHttpClient.head.mockResolvedValue({ status: 404 });
      mockHttpClient.get.mockResolvedValue({ status: 404 });

      const url = await discoverSitemap("https://example.com");

      expect(url).toBeNull();
    });

    it("should handle network errors gracefully", async () => {
      mockHttpClient.head.mockRejectedValue(new Error("Network error"));
      mockHttpClient.get.mockRejectedValue(new Error("Network error"));

      const url = await discoverSitemap("https://example.com");

      expect(url).toBeNull();
    });

    it("should try all paths before checking robots.txt", async () => {
      mockHttpClient.head.mockResolvedValue({ status: 404 });
      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: "Sitemap: https://example.com/from-robots.xml",
      });

      const url = await discoverSitemap("https://example.com");

      // Should have tried 4 common paths
      expect(mockHttpClient.head).toHaveBeenCalledTimes(4);
      expect(mockHttpClient.head).toHaveBeenCalledWith(
        "https://example.com/sitemap.xml",
        expect.any(Object)
      );
      expect(mockHttpClient.head).toHaveBeenCalledWith(
        "https://example.com/sitemap_index.xml",
        expect.any(Object)
      );
      expect(mockHttpClient.head).toHaveBeenCalledWith(
        "https://example.com/sitemap-index.xml",
        expect.any(Object)
      );
      expect(mockHttpClient.head).toHaveBeenCalledWith(
        "https://example.com/sitemap1.xml",
        expect.any(Object)
      );
    });

    it("should handle base URL with trailing slash", async () => {
      mockHttpClient.head.mockResolvedValue({ status: 200 });

      const url = await discoverSitemap("https://example.com/");

      expect(url).toBe("https://example.com/sitemap.xml");
    });

    it("should handle base URL with path", async () => {
      mockHttpClient.head.mockResolvedValue({ status: 200 });

      const url = await discoverSitemap("https://example.com/blog");

      expect(url).toBe("https://example.com/sitemap.xml");
    });

    it("should extract first sitemap from robots.txt with multiple", async () => {
      mockHttpClient.head.mockResolvedValue({ status: 404 });
      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: `User-agent: *
Disallow: /admin/
Sitemap: https://example.com/sitemap1.xml
Sitemap: https://example.com/sitemap2.xml`,
      });

      const url = await discoverSitemap("https://example.com");

      expect(url).toBe("https://example.com/sitemap1.xml");
    });

    it("should handle robots.txt with whitespace", async () => {
      mockHttpClient.head.mockResolvedValue({ status: 404 });
      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: "Sitemap:   https://example.com/sitemap.xml   ",
      });

      const url = await discoverSitemap("https://example.com");

      expect(url).toBe("https://example.com/sitemap.xml");
    });
  });

  describe("integration patterns", () => {
    it("should handle complete discovery and parsing flow", async () => {
      // Discovery
      mockHttpClient.head.mockResolvedValue({ status: 200 });

      const discoveredUrl = await discoverSitemap("https://example.com");
      expect(discoveredUrl).toBe("https://example.com/sitemap.xml");

      // Parsing
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://example.com/page1</loc>
            <priority>0.8</priority>
          </url>
        </urlset>`;

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: xml,
      });

      const urls = await fetchAndParseSitemap(discoveredUrl);

      expect(urls).toHaveLength(1);
      expect(urls[0].url).toBe("https://example.com/page1");
      expect(urls[0].priority).toBe(0.8);
    });

    it("should handle sitemap index with priority sorting", async () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
          <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
        </sitemapindex>`;

      const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/low</loc><priority>0.3</priority></url>
        </urlset>`;

      const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/high</loc><priority>0.9</priority></url>
        </urlset>`;

      mockHttpClient.get
        .mockResolvedValueOnce({ status: 200, data: indexXml })
        .mockResolvedValueOnce({ status: 200, data: sitemap1Xml })
        .mockResolvedValueOnce({ status: 200, data: sitemap2Xml });

      const urls = await fetchAndParseSitemap(
        "https://example.com/sitemap.xml"
      );

      // URLs should be collected in order (sitemap1 then sitemap2)
      // Priority sorting is done within each individual sitemap, not across all
      expect(urls).toHaveLength(2);
      expect(urls[0].url).toBe("https://example.com/low");
      expect(urls[1].url).toBe("https://example.com/high");
    });
  });

  describe("HTTP client usage", () => {
    it("should use correct timeout for sitemap fetch", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page1</loc></url>
        </urlset>`;

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: xml,
      });

      await fetchAndParseSitemap("https://example.com/sitemap.xml");

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        "https://example.com/sitemap.xml",
        {
          timeout: 10000,
          responseType: "text",
        }
      );
    });

    it("should use correct timeout for discovery", async () => {
      mockHttpClient.head.mockResolvedValue({ status: 200 });

      await discoverSitemap("https://example.com");

      expect(mockHttpClient.head).toHaveBeenCalledWith(expect.any(String), {
        timeout: 5000,
      });
    });

    it("should use responseType text for sitemap fetch", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page1</loc></url>
        </urlset>`;

      mockHttpClient.get.mockResolvedValue({
        status: 200,
        data: xml,
      });

      await fetchAndParseSitemap("https://example.com/sitemap.xml");

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          responseType: "text",
        })
      );
    });
  });
});
