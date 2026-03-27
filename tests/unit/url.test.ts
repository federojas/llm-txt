import { describe, it, expect } from "vitest";
import { normalizeUrl } from "@/lib/url/normalization";
import {
  toAbsoluteUrl,
  matchesPattern,
  extractDomain,
} from "@/lib/url/helpers";
import {
  isInternalUrl,
  getUrlDepth,
  isLanguageVariant,
} from "@/lib/crawling/boundaries";

describe("URL Utilities", () => {
  describe("normalizeUrl", () => {
    it("should remove trailing slashes", () => {
      expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
      expect(normalizeUrl("https://example.com/path/")).toBe(
        "https://example.com/path"
      );
    });

    it("should remove hash fragments", () => {
      expect(normalizeUrl("https://example.com/page#section")).toBe(
        "https://example.com/page"
      );
    });

    it("should remove tracking parameters", () => {
      expect(normalizeUrl("https://example.com?utm_source=test&page=1")).toBe(
        "https://example.com/?page=1"
      );
    });

    it("should sort query parameters", () => {
      expect(normalizeUrl("https://example.com?tab=1&page=2&section=3")).toBe(
        "https://example.com/?page=2&section=3&tab=1"
      );
    });

    it("should add default protocol to URLs without protocol", () => {
      // normalize-url is permissive - it adds protocol rather than throwing
      const urlWithoutProtocol = "not-a-valid-url";
      expect(normalizeUrl(urlWithoutProtocol)).toBe("https://not-a-valid-url");
    });

    it("should force HTTPS protocol", () => {
      expect(normalizeUrl("http://example.com")).toBe("https://example.com");
    });

    it("should keep www prefix", () => {
      expect(normalizeUrl("https://www.example.com")).toBe(
        "https://www.example.com"
      );
    });

    it("should keep whitelisted parameters", () => {
      expect(normalizeUrl("https://example.com?page=1")).toContain("page=1");
      expect(normalizeUrl("https://example.com?tab=2")).toContain("tab=2");
      expect(normalizeUrl("https://example.com?section=3")).toContain(
        "section=3"
      );
    });

    it("should remove non-whitelisted parameters", () => {
      const normalized = normalizeUrl(
        "https://example.com?utm_source=google&page=1&fbclid=123"
      );
      expect(normalized).toContain("page=1");
      expect(normalized).not.toContain("utm_source");
      expect(normalized).not.toContain("fbclid");
    });
  });

  describe("isInternalUrl", () => {
    it("should identify internal URLs", () => {
      expect(
        isInternalUrl("https://example.com/about", "https://example.com")
      ).toBe(true);
    });

    it("should identify external URLs", () => {
      expect(
        isInternalUrl("https://other.com/page", "https://example.com")
      ).toBe(false);
    });

    it("should handle relative URLs", () => {
      expect(isInternalUrl("/about", "https://example.com")).toBe(true);
    });
  });

  describe("toAbsoluteUrl", () => {
    it("should convert relative URLs to absolute", () => {
      expect(toAbsoluteUrl("/about", "https://example.com")).toBe(
        "https://example.com/about"
      );
    });

    it("should leave absolute URLs unchanged", () => {
      expect(
        toAbsoluteUrl("https://example.com/about", "https://example.com")
      ).toBe("https://example.com/about");
    });
  });

  describe("matchesPattern", () => {
    it("should match URL patterns", () => {
      expect(matchesPattern("https://example.com/docs/api", ["/docs/*"])).toBe(
        true
      );
      expect(matchesPattern("https://example.com/blog/post", ["/docs/*"])).toBe(
        false
      );
    });
  });

  describe("extractDomain", () => {
    it("should extract domain from URL", () => {
      expect(extractDomain("https://example.com/path")).toBe("example.com");
      expect(extractDomain("https://subdomain.example.com")).toBe(
        "subdomain.example.com"
      );
    });
  });

  describe("getUrlDepth", () => {
    it("should calculate URL depth", () => {
      expect(getUrlDepth("https://example.com/", "https://example.com")).toBe(
        0
      );
      expect(
        getUrlDepth("https://example.com/docs", "https://example.com")
      ).toBe(1);
      expect(
        getUrlDepth("https://example.com/docs/api", "https://example.com")
      ).toBe(2);
    });

    it("should return Infinity for external URLs", () => {
      expect(getUrlDepth("https://other.com/page", "https://example.com")).toBe(
        Infinity
      );
    });

    it("should handle www prefix normalization", () => {
      expect(
        getUrlDepth("https://www.example.com/docs", "https://example.com")
      ).toBe(1);
      expect(
        getUrlDepth("https://example.com/docs", "https://www.example.com")
      ).toBe(1);
    });

    it("should handle base URL with path", () => {
      expect(
        getUrlDepth("https://example.com/docs/api", "https://example.com/docs")
      ).toBe(1);
      expect(
        getUrlDepth(
          "https://example.com/docs/api/v1",
          "https://example.com/docs"
        )
      ).toBe(2);
    });

    it("should handle trailing slashes", () => {
      expect(
        getUrlDepth("https://example.com/docs/", "https://example.com/")
      ).toBe(1);
    });

    it("should return Infinity for invalid URLs", () => {
      expect(getUrlDepth("not-a-url", "https://example.com")).toBe(Infinity);
      expect(getUrlDepth("https://example.com", "not-a-url")).toBe(Infinity);
    });

    it("should handle homepage depth correctly", () => {
      expect(getUrlDepth("https://example.com", "https://example.com")).toBe(0);
      expect(getUrlDepth("https://example.com/", "https://example.com/")).toBe(
        0
      );
    });
  });

  describe("isLanguageVariant", () => {
    it("should detect /intl/ language variants", () => {
      expect(isLanguageVariant("https://example.com/intl/ar/")).toBe(true);
      expect(isLanguageVariant("https://example.com/intl/es/")).toBe(true);
      expect(isLanguageVariant("https://example.com/intl/fr/")).toBe(true);
    });

    it("should detect /intl/ALL_xx/ language variants", () => {
      expect(isLanguageVariant("https://example.com/intl/ALL_bg/")).toBe(true);
      expect(isLanguageVariant("https://example.com/intl/ALL_es/")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(isLanguageVariant("https://example.com/INTL/ar/")).toBe(true);
      expect(isLanguageVariant("https://example.com/Intl/es/")).toBe(true);
    });

    it("should not match non-language paths", () => {
      expect(isLanguageVariant("https://example.com/docs/")).toBe(false);
      expect(isLanguageVariant("https://example.com/international/")).toBe(
        false
      );
      expect(isLanguageVariant("https://example.com/about")).toBe(false);
    });

    it("should match intl patterns in any part of path", () => {
      expect(isLanguageVariant("https://example.com/prefix/intl/ar/")).toBe(
        true
      );
      expect(isLanguageVariant("https://example.com/intl/es/suffix/page")).toBe(
        true
      );
    });

    it("should return false for invalid URLs", () => {
      expect(isLanguageVariant("not-a-url")).toBe(false);
      expect(isLanguageVariant("")).toBe(false);
    });
  });

  describe("isInternalUrl - enhanced", () => {
    it("should handle www prefix normalization", () => {
      expect(
        isInternalUrl("https://www.example.com/page", "https://example.com")
      ).toBe(true);
      expect(
        isInternalUrl("https://example.com/page", "https://www.example.com")
      ).toBe(true);
      expect(
        isInternalUrl("https://www.example.com/page", "https://www.example.com")
      ).toBe(true);
    });

    it("should handle subdomains correctly", () => {
      expect(
        isInternalUrl("https://api.example.com", "https://example.com")
      ).toBe(false);
      expect(
        isInternalUrl("https://blog.example.com", "https://example.com")
      ).toBe(false);
    });

    it("should handle case-insensitive hostnames", () => {
      expect(
        isInternalUrl("https://Example.COM/page", "https://example.com")
      ).toBe(true);
    });

    it("should handle relative URLs with base URL", () => {
      // "not-a-url" is treated as relative URL with base "https://example.com"
      expect(isInternalUrl("not-a-url", "https://example.com")).toBe(true);
      expect(isInternalUrl("/relative/path", "https://example.com")).toBe(true);
    });

    it("should return false when base URL is invalid", () => {
      expect(isInternalUrl("https://example.com", "not-a-url")).toBe(false);
    });

    it("should handle different protocols", () => {
      expect(
        isInternalUrl("http://example.com/page", "https://example.com")
      ).toBe(true);
    });

    it("should handle URLs with query params and anchors", () => {
      expect(
        isInternalUrl(
          "https://example.com/page?query=1#anchor",
          "https://example.com"
        )
      ).toBe(true);
    });
  });
});
