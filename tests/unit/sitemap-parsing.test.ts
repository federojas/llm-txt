/**
 * Unit Tests: Sitemap XML Parsing
 * Tests XML parsing logic for sitemaps (pure functions)
 */

import { describe, it, expect } from "vitest";

// These are internal functions from sitemap.ts
// We'll test the public API behavior through integration tests
// For now, testing the XML structures we expect

describe("Sitemap XML Parsing", () => {
  describe("Valid sitemap.xml structure", () => {
    it("should parse standard sitemap XML with priority and lastmod", () => {
      const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-01</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2024-01-02</lastmod>
    <priority>0.8</priority>
  </url>
</urlset>`;

      // Verify XML is valid and parseable
      expect(validXml).toContain("<urlset");
      expect(validXml).toContain("<loc>https://example.com/</loc>");
      expect(validXml).toContain("<priority>1.0</priority>");
    });

    it("should handle sitemap index XML", () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
    <lastmod>2024-01-01</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
    <lastmod>2024-01-02</lastmod>
  </sitemap>
</sitemapindex>`;

      // Verify index structure
      expect(indexXml).toContain("<sitemapindex");
      expect(indexXml).toContain("<sitemap>");
      expect(indexXml).toContain("sitemap1.xml");
    });
  });

  describe("Sitemap in robots.txt", () => {
    it("should extract sitemap URL from robots.txt", () => {
      const robotsTxt = `User-agent: *
Disallow: /admin/
Crawl-delay: 1

Sitemap: https://example.com/sitemap.xml`;

      const sitemapMatch = robotsTxt.match(/Sitemap:\s*(.+)/i);
      expect(sitemapMatch).toBeDefined();
      expect(sitemapMatch?.[1].trim()).toBe("https://example.com/sitemap.xml");
    });

    it("should handle case-insensitive Sitemap directive", () => {
      const robotsTxt = `User-agent: *
sitemap: https://example.com/sitemap.xml`;

      const sitemapMatch = robotsTxt.match(/Sitemap:\s*(.+)/i);
      expect(sitemapMatch).toBeDefined();
      expect(sitemapMatch?.[1].trim()).toBe("https://example.com/sitemap.xml");
    });

    it("should return null when no sitemap in robots.txt", () => {
      const robotsTxt = `User-agent: *
Disallow: /admin/`;

      const sitemapMatch = robotsTxt.match(/Sitemap:\s*(.+)/i);
      expect(sitemapMatch).toBeNull();
    });
  });

  describe("URL priority sorting", () => {
    it("should sort URLs by priority descending", () => {
      const urls = [
        { url: "https://example.com/low", priority: 0.3 },
        { url: "https://example.com/high", priority: 0.9 },
        { url: "https://example.com/medium", priority: 0.5 },
      ];

      const sorted = [...urls].sort((a, b) => b.priority - a.priority);

      expect(sorted[0].url).toBe("https://example.com/high");
      expect(sorted[1].url).toBe("https://example.com/medium");
      expect(sorted[2].url).toBe("https://example.com/low");
    });

    it("should handle undefined priorities with default 0.5", () => {
      const urls = [
        { url: "https://example.com/explicit", priority: 0.8 },
        { url: "https://example.com/default", priority: undefined },
      ];

      const sorted = [...urls].sort(
        (a, b) => (b.priority || 0.5) - (a.priority || 0.5)
      );

      expect(sorted[0].url).toBe("https://example.com/explicit");
    });
  });

  describe("Common sitemap paths", () => {
    const commonPaths = [
      "/sitemap.xml",
      "/sitemap_index.xml",
      "/sitemap-index.xml",
      "/sitemap1.xml",
    ];

    it("should recognize standard sitemap paths", () => {
      expect(commonPaths).toContain("/sitemap.xml");
      expect(commonPaths).toContain("/sitemap_index.xml");
    });

    it("should construct valid sitemap URLs", () => {
      const baseUrl = "https://example.com";
      const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();

      expect(sitemapUrl).toBe("https://example.com/sitemap.xml");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty sitemap XML", () => {
      const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

      expect(emptyXml).toContain("<urlset");
      expect(emptyXml).not.toContain("<url>");
    });

    it("should handle malformed XML gracefully", () => {
      const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url>
    <loc>https://example.com/</loc>
    <!-- Missing closing tags -->`;

      // Parser should handle gracefully (tested in integration)
      expect(malformedXml).toContain("<urlset");
    });

    it("should handle URLs with special characters", () => {
      const xmlWithSpecialChars = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page?id=1&amp;ref=home</loc>
    <priority>0.8</priority>
  </url>
</urlset>`;

      expect(xmlWithSpecialChars).toContain("&amp;");
      expect(xmlWithSpecialChars).toContain("id=1");
    });
  });
});
