import { describe, it, expect } from "vitest";
import { normalizeUrl } from "@/lib/url/normalization";
import {
  toAbsoluteUrl,
  matchesPattern,
  extractDomain,
} from "@/lib/url/helpers";
import { isInternalUrl, getUrlDepth } from "@/lib/crawling/boundaries";

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
  });
});
