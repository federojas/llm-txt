import { describe, it, expect } from "vitest";
import {
  CRAWL_LIMITS,
  CRAWL_DEFAULTS,
  validateMaxPages,
  validateMaxDepth,
  isValidUrl,
} from "@/lib/crawling/validation";

describe("Domain Validation Rules", () => {
  describe("CRAWL_LIMITS constants", () => {
    it("should define correct limits", () => {
      expect(CRAWL_LIMITS.MIN_PAGES).toBe(1);
      expect(CRAWL_LIMITS.MAX_PAGES).toBe(200);
      expect(CRAWL_LIMITS.MIN_DEPTH).toBe(1);
      expect(CRAWL_LIMITS.MAX_DEPTH).toBe(5);
    });
  });

  describe("CRAWL_DEFAULTS constants", () => {
    it("should define correct defaults", () => {
      expect(CRAWL_DEFAULTS.MAX_PAGES).toBe(50);
      expect(CRAWL_DEFAULTS.MAX_DEPTH).toBe(3);
      expect(CRAWL_DEFAULTS.TIMEOUT).toBe(10000);
      expect(CRAWL_DEFAULTS.CONCURRENCY).toBe(5);
    });
  });

  describe("validateMaxPages", () => {
    it("should accept valid page counts", () => {
      expect(validateMaxPages(1)).toBe(true);
      expect(validateMaxPages(50)).toBe(true);
      expect(validateMaxPages(100)).toBe(true);
      expect(validateMaxPages(200)).toBe(true);
    });

    it("should reject page counts below minimum", () => {
      expect(validateMaxPages(0)).toBe(false);
      expect(validateMaxPages(-1)).toBe(false);
    });

    it("should reject page counts above maximum", () => {
      expect(validateMaxPages(201)).toBe(false);
      expect(validateMaxPages(300)).toBe(false);
    });

    it("should reject non-integer values", () => {
      expect(validateMaxPages(50.5)).toBe(false);
      expect(validateMaxPages(NaN)).toBe(false);
    });
  });

  describe("validateMaxDepth", () => {
    it("should accept valid depths", () => {
      expect(validateMaxDepth(1)).toBe(true);
      expect(validateMaxDepth(3)).toBe(true);
      expect(validateMaxDepth(5)).toBe(true);
    });

    it("should reject depths below minimum", () => {
      expect(validateMaxDepth(0)).toBe(false);
      expect(validateMaxDepth(-1)).toBe(false);
    });

    it("should reject depths above maximum", () => {
      expect(validateMaxDepth(6)).toBe(false);
      expect(validateMaxDepth(10)).toBe(false);
    });

    it("should reject non-integer values", () => {
      expect(validateMaxDepth(3.5)).toBe(false);
      expect(validateMaxDepth(NaN)).toBe(false);
    });
  });

  describe("isValidUrl", () => {
    it("should accept valid HTTP URLs", () => {
      expect(isValidUrl("http://example.com")).toBe(true);
      expect(isValidUrl("http://example.com/path")).toBe(true);
      expect(isValidUrl("http://example.com:8080")).toBe(true);
    });

    it("should accept valid HTTPS URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("https://example.com/path")).toBe(true);
      expect(isValidUrl("https://example.com:443")).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(isValidUrl("not a url")).toBe(false);
      expect(isValidUrl("example.com")).toBe(false);
      expect(isValidUrl("ftp://example.com")).toBe(false);
      expect(isValidUrl("")).toBe(false);
    });
  });
});
