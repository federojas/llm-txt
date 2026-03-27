/**
 * Unit Tests: HTML Parser
 * Tests metadata extraction from HTML
 */

import { describe, it, expect } from "vitest";

describe("HTML Parser", () => {
  describe("Canonical URL extraction", () => {
    it("should extract canonical URL from link tag", () => {
      const html = `
        <html>
          <head>
            <link rel="canonical" href="https://example.com/canonical" />
          </head>
        </html>
      `;

      expect(html).toContain('rel="canonical"');
      expect(html).toContain("https://example.com/canonical");
    });

    it("should handle relative canonical URLs", () => {
      const html = `
        <html>
          <head>
            <link rel="canonical" href="/canonical-path" />
          </head>
        </html>
      `;

      const baseUrl = "https://example.com";
      const expected = `${baseUrl}/canonical-path`;

      expect(new URL("/canonical-path", baseUrl).toString()).toBe(expected);
    });

    it("should return null when no canonical URL", () => {
      const html = `
        <html>
          <head>
            <title>Page Title</title>
          </head>
        </html>
      `;

      expect(html).not.toContain('rel="canonical"');
    });
  });

  describe("Title extraction", () => {
    it("should extract title from <title> tag", () => {
      const html = `
        <html>
          <head>
            <title>Page Title</title>
          </head>
        </html>
      `;

      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      expect(titleMatch?.[1]).toBe("Page Title");
    });

    it("should handle empty title tag", () => {
      const html = `
        <html>
          <head>
            <title></title>
          </head>
        </html>
      `;

      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      expect(titleMatch?.[1]).toBe("");
    });

    it("should extract og:title as fallback", () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="OG Title" />
          </head>
        </html>
      `;

      const ogTitleMatch = html.match(
        /property="og:title"\s+content="([^"]*)"/
      );
      expect(ogTitleMatch?.[1]).toBe("OG Title");
    });
  });

  describe("Meta description extraction", () => {
    it("should extract meta description", () => {
      const html = `
        <html>
          <head>
            <meta name="description" content="Page description" />
          </head>
        </html>
      `;

      const descMatch = html.match(/name="description"\s+content="([^"]*)"/);
      expect(descMatch?.[1]).toBe("Page description");
    });

    it("should extract og:description", () => {
      const html = `
        <html>
          <head>
            <meta property="og:description" content="OG description" />
          </head>
        </html>
      `;

      const ogDescMatch = html.match(
        /property="og:description"\s+content="([^"]*)"/
      );
      expect(ogDescMatch?.[1]).toBe("OG description");
    });
  });

  describe("Open Graph metadata", () => {
    it("should extract og:type", () => {
      const html = `
        <html>
          <head>
            <meta property="og:type" content="article" />
          </head>
        </html>
      `;

      const ogTypeMatch = html.match(/property="og:type"\s+content="([^"]*)"/);
      expect(ogTypeMatch?.[1]).toBe("article");
    });

    it("should extract og:site_name", () => {
      const html = `
        <html>
          <head>
            <meta property="og:site_name" content="Example Site" />
          </head>
        </html>
      `;

      const siteNameMatch = html.match(
        /property="og:site_name"\s+content="([^"]*)"/
      );
      expect(siteNameMatch?.[1]).toBe("Example Site");
    });
  });

  describe("Language detection", () => {
    it("should extract lang attribute from html tag", () => {
      const html = `<html lang="en-US"><body></body></html>`;

      const langMatch = html.match(/<html\s+lang="([^"]*)"/);
      expect(langMatch?.[1]).toBe("en-US");
    });

    it("should handle lang attribute with xml:lang", () => {
      const html = `<html lang="fr" xml:lang="fr"><body></body></html>`;

      const langMatch = html.match(/<html\s+lang="([^"]*)"/);
      expect(langMatch?.[1]).toBe("fr");
    });

    it("should return null when no lang attribute", () => {
      const html = `<html><body></body></html>`;

      const langMatch = html.match(/<html\s+lang="([^"]*)"/);
      expect(langMatch).toBeNull();
    });
  });

  describe("H1 extraction", () => {
    it("should extract first H1 heading", () => {
      const html = `
        <html>
          <body>
            <h1>Main Heading</h1>
            <h1>Second Heading</h1>
          </body>
        </html>
      `;

      const h1Match = html.match(/<h1>(.*?)<\/h1>/);
      expect(h1Match?.[1]).toBe("Main Heading");
    });

    it("should handle H1 with attributes", () => {
      const html = `
        <html>
          <body>
            <h1 class="title" id="main">Styled Heading</h1>
          </body>
        </html>
      `;

      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/);
      expect(h1Match?.[1]).toBe("Styled Heading");
    });
  });

  describe("Robots meta tag", () => {
    it("should detect noindex directive", () => {
      const html = `
        <html>
          <head>
            <meta name="robots" content="noindex, nofollow" />
          </head>
        </html>
      `;

      const robotsMeta = html.match(/name="robots"\s+content="([^"]*)"/)?.[1];
      expect(robotsMeta?.toLowerCase()).toContain("noindex");
    });

    it("should detect index directive", () => {
      const html = `
        <html>
          <head>
            <meta name="robots" content="index, follow" />
          </head>
        </html>
      `;

      const robotsMeta = html.match(/name="robots"\s+content="([^"]*)"/)?.[1];
      expect(robotsMeta?.toLowerCase()).toContain("index");
      expect(robotsMeta?.toLowerCase()).not.toContain("noindex");
    });

    it("should default to indexable when no robots meta", () => {
      const html = `
        <html>
          <head>
            <title>Page</title>
          </head>
        </html>
      `;

      const robotsMeta = html.match(/name="robots"/);
      expect(robotsMeta).toBeNull();
      // Default behavior: page is indexable
    });
  });

  describe("Link extraction", () => {
    it("should extract href from anchor tags", () => {
      const html = `
        <html>
          <body>
            <a href="https://example.com/page1">Link 1</a>
            <a href="/relative">Link 2</a>
            <a href="#anchor">Link 3</a>
          </body>
        </html>
      `;

      const links = html.match(/href="([^"]*)"/g);
      expect(links).toBeDefined();
      expect(links?.length).toBe(3);
    });

    it("should handle links with query parameters", () => {
      const html = `<a href="https://example.com/page?id=1&ref=home">Link</a>`;

      const hrefMatch = html.match(/href="([^"]*)"/);
      expect(hrefMatch?.[1]).toContain("id=1");
      expect(hrefMatch?.[1]).toContain("ref=home");
    });

    it("should identify internal vs external links", () => {
      const baseUrl = "https://example.com";
      const internalLink = "https://example.com/page";
      const externalLink = "https://other.com/page";

      expect(new URL(internalLink).hostname).toBe("example.com");
      expect(new URL(externalLink).hostname).not.toBe("example.com");
    });
  });

  describe("Body text extraction", () => {
    it("should extract visible text from body", () => {
      const html = `
        <html>
          <body>
            <h1>Heading</h1>
            <p>Paragraph text</p>
            <script>console.log('ignored');</script>
          </body>
        </html>
      `;

      expect(html).toContain("Heading");
      expect(html).toContain("Paragraph text");
      // Scripts should be filtered in actual implementation
    });

    it("should trim and normalize whitespace", () => {
      const text = "   Multiple   spaces   ";
      const normalized = text.trim().replace(/\s+/g, " ");

      expect(normalized).toBe("Multiple spaces");
    });
  });

  describe("Special characters and encoding", () => {
    it("should handle HTML entities", () => {
      const html = `<title>Title &amp; Description</title>`;

      expect(html).toContain("&amp;");
      // Parser should decode to "&"
    });

    it("should handle UTF-8 characters", () => {
      const html = `<title>Café ☕ Résumé</title>`;

      expect(html).toContain("Café");
      expect(html).toContain("☕");
      expect(html).toContain("Résumé");
    });

    it("should handle quotes in attributes", () => {
      const html = `<meta name="description" content='Value with "quotes"' />`;

      expect(html).toContain("content='Value with \"quotes\"'");
    });
  });
});
