/**
 * Unit Tests: URL Helpers
 * Tests for pattern matching and URL utilities
 */

import { describe, it, expect } from "vitest";
import {
  matchesPattern,
  toAbsoluteUrl,
  extractDomain,
} from "@/lib/url/helpers";

describe("matchesPattern", () => {
  describe("wildcard patterns", () => {
    it("should match simple wildcards", () => {
      expect(matchesPattern("file.pdf", ["*.pdf"])).toBe(true);
      expect(matchesPattern("image.jpg", ["*.jpg"])).toBe(true);
      expect(matchesPattern("document.pdf", ["*.pdf"])).toBe(true);
    });

    it("should not match different extensions", () => {
      expect(matchesPattern("file.txt", ["*.pdf"])).toBe(false);
      expect(matchesPattern("image.png", ["*.jpg"])).toBe(false);
    });

    it("should match any pattern in array", () => {
      expect(matchesPattern("file.pdf", ["*.jpg", "*.pdf"])).toBe(true);
      expect(matchesPattern("image.jpg", ["*.pdf", "*.jpg"])).toBe(true);
    });

    it("should handle multiple wildcards", () => {
      expect(matchesPattern("a/b/c/file.pdf", ["*/*/*.pdf"])).toBe(true);
      expect(matchesPattern("path/to/file.jpg", ["*/*/*"])).toBe(true);
    });
  });

  describe("path patterns", () => {
    it("should match path prefixes", () => {
      expect(matchesPattern("/api/users", ["/api/*"])).toBe(true);
      expect(matchesPattern("/api/posts/123", ["/api/*"])).toBe(true);
    });

    it("should match path segments", () => {
      expect(matchesPattern("/blog/2024/post-1", ["/blog/*"])).toBe(true);
      expect(matchesPattern("/docs/intro", ["/docs/*"])).toBe(true);
    });

    it("should match nested paths with double wildcards", () => {
      expect(matchesPattern("/admin/panel/settings", ["**/admin/**"])).toBe(
        true
      );
      expect(matchesPattern("/api/v1/admin/users", ["**/admin/**"])).toBe(true);
      expect(matchesPattern("/blog/2024/admin/post", ["**/admin/**"])).toBe(
        true
      );
    });

    it("should not match unrelated paths", () => {
      expect(matchesPattern("/public/file", ["/admin/*"])).toBe(false);
      expect(matchesPattern("/users/profile", ["/api/*"])).toBe(false);
    });
  });

  describe("URL patterns", () => {
    it("should match full URLs", () => {
      expect(matchesPattern("https://example.com/api/users", ["*/api/*"])).toBe(
        true
      );
      expect(matchesPattern("https://site.com/blog/post", ["*/blog/*"])).toBe(
        true
      );
    });

    it("should match query strings", () => {
      expect(
        matchesPattern("https://example.com?utm_source=test", ["*utm*"])
      ).toBe(true);
      expect(matchesPattern("/page?ref=social", ["*ref*"])).toBe(true);
    });

    it("should match domains", () => {
      expect(matchesPattern("https://api.example.com/data", ["*api.*"])).toBe(
        true
      );
      expect(matchesPattern("https://cdn.site.com/image", ["*cdn.*"])).toBe(
        true
      );
    });
  });

  describe("edge cases", () => {
    it("should return false for empty pattern array", () => {
      expect(matchesPattern("/any/path", [])).toBe(false);
    });

    it("should handle special regex characters", () => {
      expect(matchesPattern("/path/file.pdf", ["*/file.pdf"])).toBe(true);
      expect(matchesPattern("/api/v1/users", ["*/v1/*"])).toBe(true);
    });

    it("should be case sensitive", () => {
      expect(matchesPattern("/API/users", ["/api/*"])).toBe(false);
      expect(matchesPattern("/api/users", ["/API/*"])).toBe(false);
    });

    it("should match exact strings without wildcards", () => {
      expect(matchesPattern("/exact/path", ["/exact/path"])).toBe(true);
      expect(matchesPattern("/exact/path", ["/different/path"])).toBe(false);
    });
  });

  describe("practical URL filtering scenarios", () => {
    const urls = [
      "https://example.com/docs/intro",
      "https://example.com/blog/post-1",
      "https://example.com/api/v1/users",
      "https://example.com/admin/settings",
      "https://cdn.example.com/image.jpg",
      "https://example.com/file.pdf",
      "https://example.com/page?utm_source=email",
    ];

    it("should filter documentation pages", () => {
      const docsUrls = urls.filter((url) => matchesPattern(url, ["*/docs/*"]));
      expect(docsUrls).toHaveLength(1);
      expect(docsUrls[0]).toContain("/docs/intro");
    });

    it("should filter API endpoints", () => {
      const apiUrls = urls.filter((url) => matchesPattern(url, ["*/api/*"]));
      expect(apiUrls).toHaveLength(1);
      expect(apiUrls[0]).toContain("/api/v1/users");
    });

    it("should filter multiple patterns", () => {
      const filtered = urls.filter((url) =>
        matchesPattern(url, ["*/admin/*", "*/api/*"])
      );
      expect(filtered).toHaveLength(2);
    });

    it("should exclude tracking URLs", () => {
      const nonTracking = urls.filter(
        (url) => !matchesPattern(url, ["*utm*", "*ref=*"])
      );
      expect(nonTracking).toHaveLength(6);
    });

    it("should exclude media files", () => {
      const nonMedia = urls.filter(
        (url) => !matchesPattern(url, ["*.jpg", "*.pdf", "*.png"])
      );
      expect(nonMedia).toHaveLength(5);
    });
  });
});

describe("toAbsoluteUrl", () => {
  it("should convert relative URLs to absolute", () => {
    expect(toAbsoluteUrl("/path", "https://example.com")).toBe(
      "https://example.com/path"
    );
    expect(toAbsoluteUrl("page.html", "https://example.com/")).toBe(
      "https://example.com/page.html"
    );
  });

  it("should preserve absolute URLs", () => {
    expect(toAbsoluteUrl("https://other.com/path", "https://example.com")).toBe(
      "https://other.com/path"
    );
  });

  it("should handle protocol-relative URLs", () => {
    expect(toAbsoluteUrl("//cdn.example.com/file", "https://example.com")).toBe(
      "https://cdn.example.com/file"
    );
  });

  it("should return original on invalid URLs", () => {
    expect(toAbsoluteUrl("not a url", "invalid base")).toBe("not a url");
  });
});

describe("extractDomain", () => {
  it("should extract domain from URL", () => {
    expect(extractDomain("https://example.com/path")).toBe("example.com");
    expect(extractDomain("https://sub.example.com")).toBe("sub.example.com");
  });

  it("should handle different protocols", () => {
    expect(extractDomain("http://example.com")).toBe("example.com");
    expect(extractDomain("https://example.com")).toBe("example.com");
  });

  it("should return empty string for invalid URLs", () => {
    expect(extractDomain("not a url")).toBe("");
    expect(extractDomain("")).toBe("");
  });
});
