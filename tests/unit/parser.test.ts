/**
 * Unit Tests: HTML Parser
 * Tests Cheerio-based HTML parsing and metadata extraction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HtmlParser } from "@/lib/crawling/parser";
import type { IAdBlocker } from "@/lib/crawling/ad-blocker";
import { isValuableExternalLink } from "@/lib/crawling/external-links";

// Mock dependencies
vi.mock("@/lib/crawling/external-links", () => ({
  isValuableExternalLink: vi.fn(),
}));

const mockIsValuableExternalLink = vi.mocked(isValuableExternalLink);

describe("HtmlParser", () => {
  let parser: HtmlParser;
  let mockAdBlocker: IAdBlocker;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock ad blocker
    mockAdBlocker = {
      isAd: vi.fn().mockReturnValue(false),
      isTracker: vi.fn().mockReturnValue(false),
    };

    parser = new HtmlParser(mockAdBlocker);

    // Default: all external links are valuable
    mockIsValuableExternalLink.mockResolvedValue(true);
  });

  describe("extractCanonicalUrl", () => {
    it("should extract canonical URL", () => {
      const html =
        '<html><head><link rel="canonical" href="https://example.com/page"></head></html>';
      const result = parser.extractCanonicalUrl(
        html,
        "https://example.com/page?ref=twitter"
      );

      expect(result).toBe("https://example.com/page");
    });

    it("should convert relative canonical URL to absolute", () => {
      const html =
        '<html><head><link rel="canonical" href="/page"></head></html>';
      const result = parser.extractCanonicalUrl(
        html,
        "https://example.com/page?ref=twitter"
      );

      expect(result).toBe("https://example.com/page");
    });

    it("should return null if no canonical URL", () => {
      const html = "<html><head><title>Page</title></head></html>";
      const result = parser.extractCanonicalUrl(
        html,
        "https://example.com/page"
      );

      expect(result).toBeNull();
    });

    it("should handle malformed HTML gracefully", () => {
      const html = "<html><head><link rel=";
      const result = parser.extractCanonicalUrl(
        html,
        "https://example.com/page"
      );

      expect(result).toBeNull();
    });

    it("should normalize canonical URL", () => {
      const html =
        '<html><head><link rel="canonical" href="https://example.com/page?query=value"></head></html>';
      const result = parser.extractCanonicalUrl(
        html,
        "https://example.com/page"
      );

      // normalizeUrl removes query parameters
      expect(result).toBe("https://example.com/page");
    });
  });

  describe("isIndexable", () => {
    it("should return true for pages without robots meta", () => {
      const html = "<html><head><title>Page</title></head></html>";
      expect(parser.isIndexable(html)).toBe(true);
    });

    it("should return true for pages with robots: index", () => {
      const html =
        '<html><head><meta name="robots" content="index, follow"></head></html>';
      expect(parser.isIndexable(html)).toBe(true);
    });

    it("should return false for pages with robots: noindex", () => {
      const html =
        '<html><head><meta name="robots" content="noindex"></head></html>';
      expect(parser.isIndexable(html)).toBe(false);
    });

    it("should return false for pages with robots: noindex, nofollow", () => {
      const html =
        '<html><head><meta name="robots" content="noindex, nofollow"></head></html>';
      expect(parser.isIndexable(html)).toBe(false);
    });

    it("should handle case-insensitive robots meta", () => {
      const html =
        '<html><head><meta name="robots" content="NOINDEX"></head></html>';
      expect(parser.isIndexable(html)).toBe(false);
    });
  });

  describe("extractMetadata - title", () => {
    it("should extract title from <title> tag", async () => {
      const html =
        "<html><head><title>Page Title</title></head><body></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.title).toBe("Page Title");
    });

    it("should fallback to og:title if no <title>", async () => {
      const html =
        '<html><head><meta property="og:title" content="OG Title"></head><body></body></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.title).toBe("OG Title");
    });

    it("should fallback to h1 if no title or og:title", async () => {
      const html = "<html><body><h1>H1 Title</h1></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.title).toBe("H1 Title");
    });

    it("should fallback to 'Untitled' if no title sources", async () => {
      const html = "<html><body><p>Content</p></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.title).toBe("Untitled");
    });

    it("should trim whitespace from title", async () => {
      const html = "<html><head><title>  Spaced Title  </title></head></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.title).toBe("Spaced Title");
    });

    it("should prefer <title> over og:title", async () => {
      const html =
        '<html><head><title>Title Tag</title><meta property="og:title" content="OG Title"></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.title).toBe("Title Tag");
    });
  });

  describe("extractMetadata - description", () => {
    it("should extract meta description", async () => {
      const html =
        '<html><head><meta name="description" content="Page description"></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.description).toBe("Page description");
    });

    it("should fallback to og:description", async () => {
      const html =
        '<html><head><meta property="og:description" content="OG description"></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.description).toBe("OG description");
    });

    it("should return undefined if no description", async () => {
      const html = "<html><head><title>Page</title></head></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.description).toBeUndefined();
    });

    it("should prefer meta description over og:description", async () => {
      const html =
        '<html><head><meta name="description" content="Meta desc"><meta property="og:description" content="OG desc"></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.description).toBe("Meta desc");
    });
  });

  describe("extractMetadata - OpenGraph", () => {
    it("should extract og:description", async () => {
      const html =
        '<html><head><meta property="og:description" content="OG description"></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.ogDescription).toBe("OG description");
    });

    it("should extract og:title", async () => {
      const html =
        '<html><head><meta property="og:title" content="OG title"></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.ogTitle).toBe("OG title");
    });

    it("should extract og:type", async () => {
      const html =
        '<html><head><meta property="og:type" content="article"></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.ogType).toBe("article");
    });

    it("should extract og:site_name", async () => {
      const html =
        '<html><head><meta property="og:site_name" content="Example Site"></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.siteName).toBe("Example Site");
    });
  });

  describe("extractMetadata - h1", () => {
    it("should extract first h1", async () => {
      const html =
        "<html><body><h1>Main Heading</h1><h1>Second H1</h1></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.h1).toBe("Main Heading");
    });

    it("should return undefined if no h1", async () => {
      const html = "<html><body><h2>Subheading</h2></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.h1).toBeUndefined();
    });

    it("should trim whitespace from h1", async () => {
      const html = "<html><body><h1>  Spaced H1  </h1></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.h1).toBe("Spaced H1");
    });
  });

  describe("extractMetadata - language", () => {
    it("should extract language from html lang attribute", async () => {
      const html = '<html lang="en-US"><body></body></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.lang).toBe("en");
    });

    it("should fallback to content-language meta", async () => {
      const html =
        '<html><head><meta http-equiv="content-language" content="fr-FR"></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.lang).toBe("fr");
    });

    it("should fallback to og:locale", async () => {
      const html =
        '<html><head><meta property="og:locale" content="es_ES"></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.lang).toBe("es");
    });

    it("should extract only language code (not region)", async () => {
      const html = '<html lang="en-US"><body></body></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.lang).toBe("en");
    });

    it("should return undefined if no language", async () => {
      const html = "<html><body></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.lang).toBeUndefined();
    });

    it("should convert language to lowercase", async () => {
      const html = '<html lang="EN-US"><body></body></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.lang).toBe("en");
    });
  });

  describe("extractMetadata - bodyText", () => {
    it("should extract text from <main> tag", async () => {
      const html =
        "<html><body><main>Main content here</main><footer>Footer</footer></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.bodyText).toContain("Main content");
      expect(metadata.bodyText).not.toContain("Footer");
    });

    it("should fallback to <article> if no <main>", async () => {
      const html =
        "<html><body><article>Article content</article><footer>Footer</footer></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.bodyText).toContain("Article content");
      expect(metadata.bodyText).not.toContain("Footer");
    });

    it("should fallback to <body> if no <main> or <article>", async () => {
      const html = "<html><body><p>Body content</p></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.bodyText).toContain("Body content");
    });

    it("should remove scripts, styles, nav, footer from body text", async () => {
      const html = `
        <html>
          <body>
            <script>console.log('script');</script>
            <style>.class { color: red; }</style>
            <nav>Navigation</nav>
            <header>Header</header>
            <p>Main content</p>
            <footer>Footer</footer>
            <aside>Aside</aside>
          </body>
        </html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.bodyText).toContain("Main content");
      expect(metadata.bodyText).not.toContain("Navigation");
      expect(metadata.bodyText).not.toContain("Header");
      expect(metadata.bodyText).not.toContain("Footer");
      expect(metadata.bodyText).not.toContain("Aside");
      expect(metadata.bodyText).not.toContain("script");
      expect(metadata.bodyText).not.toContain("color: red");
    });

    it("should normalize whitespace", async () => {
      const html =
        "<html><body><main>Text   with    multiple     spaces</main></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.bodyText).toBe("Text with multiple spaces");
    });

    it("should limit text to 1500 characters", async () => {
      const longText = "a".repeat(2000);
      const html = `<html><body><main>${longText}</main></body></html>`;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.bodyText?.length).toBeLessThanOrEqual(1500);
    });

    it("should return undefined for empty body", async () => {
      const html = "<html><body></body></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.bodyText).toBeUndefined();
    });
  });

  describe("extractMetadata - internalLinks", () => {
    it("should extract internal links", async () => {
      const html = `
        <html><body>
          <a href="https://example.com/page1">Page 1</a>
          <a href="https://example.com/page2">Page 2</a>
        </body></html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.internalLinks).toContain("https://example.com/page1");
      expect(metadata.internalLinks).toContain("https://example.com/page2");
    });

    it("should convert relative URLs to absolute", async () => {
      const html = `
        <html><body>
          <a href="/page1">Page 1</a>
          <a href="page2">Page 2</a>
        </body></html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.internalLinks).toContain("https://example.com/page1");
      expect(metadata.internalLinks).toContain("https://example.com/page2");
    });

    it("should deduplicate links", async () => {
      const html = `
        <html><body>
          <a href="/page1">Page 1</a>
          <a href="/page1">Page 1 Again</a>
        </body></html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      const page1Links = metadata.internalLinks.filter(
        (l) => l === "https://example.com/page1"
      );
      expect(page1Links).toHaveLength(1);
    });

    it("should filter links by depth", async () => {
      const html = `
        <html><body>
          <a href="https://example.com/level1">Level 1</a>
          <a href="https://example.com/level1/level2">Level 2</a>
          <a href="https://example.com/level1/level2/level3">Level 3</a>
        </body></html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      // At depth 0, should include links up to depth 1
      // This depends on getUrlDepth implementation
      expect(metadata.internalLinks.length).toBeGreaterThan(0);
    });

    it("should skip external links", async () => {
      const html = `
        <html><body>
          <a href="https://example.com/page1">Internal</a>
          <a href="https://external.com/page">External</a>
        </body></html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.internalLinks).toContain("https://example.com/page1");
      expect(metadata.internalLinks).not.toContain("https://external.com/page");
    });

    it("should skip links without href", async () => {
      const html = `
        <html><body>
          <a>No href</a>
          <a href="">Empty href</a>
          <a href="https://example.com/page1">Valid</a>
        </body></html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.internalLinks).toContain("https://example.com/page1");
    });

    it("should handle malformed URLs gracefully", async () => {
      const html = `
        <html><body>
          <a href="javascript:void(0)">JS Link</a>
          <a href="https://example.com/page1">Valid</a>
        </body></html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.internalLinks).toContain("https://example.com/page1");
    });
  });

  describe("extractMetadata - externalLinks", () => {
    it("should extract external links", async () => {
      const html = `
        <html><body>
          <a href="https://github.com/user/repo">GitHub</a>
          <a href="https://docs.example.com/page">Docs</a>
        </body></html>
      `;
      mockIsValuableExternalLink.mockResolvedValue(true);

      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.externalLinks.length).toBe(2);
      expect(metadata.externalLinks[0].url).toBe(
        "https://github.com/user/repo"
      );
      expect(metadata.externalLinks[1].url).toBe(
        "https://docs.example.com/page"
      );
    });

    it("should filter out non-valuable links", async () => {
      const html = `
        <html><body>
          <a href="https://github.com/user/repo">GitHub</a>
          <a href="https://ads.example.com">Ad</a>
        </body></html>
      `;
      mockIsValuableExternalLink
        .mockResolvedValueOnce(true) // GitHub is valuable
        .mockResolvedValueOnce(false); // Ad is not valuable

      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.externalLinks).toHaveLength(1);
      expect(metadata.externalLinks[0].url).toBe(
        "https://github.com/user/repo"
      );
    });

    it("should extract link title", async () => {
      const html = `
        <html><body>
          <a href="https://github.com/user/repo" title="My Repo">GitHub</a>
        </body></html>
      `;
      mockIsValuableExternalLink.mockResolvedValue(true);

      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.externalLinks[0].title).toBe("My Repo");
    });

    it("should use link text as title if no title attribute", async () => {
      const html = `
        <html><body>
          <a href="https://github.com/user/repo">GitHub Repository</a>
        </body></html>
      `;
      mockIsValuableExternalLink.mockResolvedValue(true);

      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.externalLinks[0].title).toBe("GitHub Repository");
    });

    it("should detect context from HTML structure", async () => {
      const html = `
        <html><body>
          <main>
            <a href="https://github.com/user/repo">Main Link</a>
          </main>
          <footer>
            <a href="https://twitter.com/user">Footer Link</a>
          </footer>
        </body></html>
      `;
      mockIsValuableExternalLink.mockResolvedValue(true);

      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      const mainLink = metadata.externalLinks.find((l) =>
        l.url.includes("github")
      );
      const footerLink = metadata.externalLinks.find((l) =>
        l.url.includes("twitter")
      );

      expect(mainLink?.context).toBe("main");
      expect(footerLink?.context).toBe("footer");
    });

    it("should deduplicate external links", async () => {
      const html = `
        <html><body>
          <a href="https://github.com/user/repo">Link 1</a>
          <a href="https://github.com/user/repo">Link 2</a>
        </body></html>
      `;
      mockIsValuableExternalLink.mockResolvedValue(true);

      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.externalLinks).toHaveLength(1);
    });

    it("should skip internal links", async () => {
      const html = `
        <html><body>
          <a href="https://example.com/page1">Internal</a>
          <a href="https://external.com/page">External</a>
        </body></html>
      `;
      mockIsValuableExternalLink.mockResolvedValue(true);

      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.externalLinks).toHaveLength(1);
      expect(metadata.externalLinks[0].url).toBe("https://external.com/page");
    });

    it("should handle article context", async () => {
      const html = `
        <html><body>
          <article>
            <a href="https://github.com/user/repo">Article Link</a>
          </article>
        </body></html>
      `;
      mockIsValuableExternalLink.mockResolvedValue(true);

      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.externalLinks[0].context).toBe("main");
    });

    it("should pass rel attribute to filter", async () => {
      const html = `
        <html><body>
          <a href="https://github.com/user/repo" rel="nofollow">GitHub</a>
        </body></html>
      `;
      mockIsValuableExternalLink.mockResolvedValue(true);

      await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(mockIsValuableExternalLink).toHaveBeenCalledWith(
        "https://github.com/user/repo",
        mockAdBlocker,
        "nofollow",
        false
      );
    });

    it("should identify main content context correctly", async () => {
      const html = `
        <html><body>
          <main>
            <a href="https://github.com/user/repo">Main Link</a>
          </main>
        </body></html>
      `;
      mockIsValuableExternalLink.mockResolvedValue(true);

      await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(mockIsValuableExternalLink).toHaveBeenCalledWith(
        expect.any(String),
        mockAdBlocker,
        undefined,
        true // isInMainContent
      );
    });
  });

  describe("extractMetadata - canonical URL integration", () => {
    it("should use canonical URL if present", async () => {
      const html =
        '<html><head><link rel="canonical" href="https://example.com/canonical"><title>Page</title></head></html>';
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com/page?query=value",
        "https://example.com",
        0
      );

      expect(metadata.url).toBe("https://example.com/canonical");
    });

    it("should use requested URL if no canonical", async () => {
      const html = "<html><head><title>Page</title></head></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com/page",
        "https://example.com",
        0
      );

      expect(metadata.url).toBe("https://example.com/page");
    });
  });

  describe("extractMetadata - depth", () => {
    it("should include depth in metadata", async () => {
      const html = "<html><head><title>Page</title></head></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        2
      );

      expect(metadata.depth).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty HTML", async () => {
      const html = "";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.title).toBe("Untitled");
      expect(metadata.internalLinks).toEqual([]);
      expect(metadata.externalLinks).toEqual([]);
    });

    it("should handle HTML with no head or body", async () => {
      const html = "<html></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.title).toBe("Untitled");
    });

    it("should handle malformed HTML", async () => {
      const html =
        "<html><head><title>Title</title><body><p>Unclosed paragraph</html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.title).toBe("Title");
    });

    it("should handle HTML with special characters", async () => {
      const html =
        "<html><head><title>Title &amp; Special &lt;chars&gt;</title></head></html>";
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.title).toBe("Title & Special <chars>");
    });

    it("should handle links with fragments", async () => {
      const html = `
        <html><body>
          <a href="https://example.com/page#section">Page</a>
        </body></html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.internalLinks.length).toBeGreaterThan(0);
    });

    it("should handle deeply nested structures", async () => {
      const html = `
        <html><body>
          <div><div><div><div><div>
            <main>
              <article>
                <section>
                  <p>Deep content</p>
                </section>
              </article>
            </main>
          </div></div></div></div></div>
        </body></html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      expect(metadata.bodyText).toContain("Deep content");
    });

    it("should handle multiple language tags", async () => {
      const html = `
        <html lang="en">
          <head><meta http-equiv="content-language" content="fr"></head>
          <body></body>
        </html>
      `;
      const metadata = await parser.extractMetadata(
        html,
        "https://example.com",
        "https://example.com",
        0
      );

      // Should prefer html lang
      expect(metadata.lang).toBe("en");
    });
  });
});
