import { describe, it, expect } from "vitest";
import {
  CRAWL_LIMITS,
  CRAWL_DEFAULTS,
  validateMaxPages,
  validateMaxDepth,
  validateTimeout,
  validateConcurrency,
  isValidUrl,
  isValidPreset,
} from "@/lib/domain/validation";

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
      expect(validateMaxPages(200)).toBe(true);
    });

    it("should reject page counts below minimum", () => {
      expect(validateMaxPages(0)).toBe(false);
      expect(validateMaxPages(-1)).toBe(false);
    });

    it("should reject page counts above maximum", () => {
      expect(validateMaxPages(201)).toBe(false);
      expect(validateMaxPages(1000)).toBe(false);
    });

    it("should reject non-integer values", () => {
      expect(validateMaxPages(50.5)).toBe(false);
      expect(validateMaxPages(NaN)).toBe(false);
    });
  });

  describe("validateMaxDepth", () => {
    it("should accept valid depth values", () => {
      expect(validateMaxDepth(1)).toBe(true);
      expect(validateMaxDepth(3)).toBe(true);
      expect(validateMaxDepth(5)).toBe(true);
    });

    it("should reject depth values below minimum", () => {
      expect(validateMaxDepth(0)).toBe(false);
      expect(validateMaxDepth(-1)).toBe(false);
    });

    it("should reject depth values above maximum", () => {
      expect(validateMaxDepth(6)).toBe(false);
      expect(validateMaxDepth(10)).toBe(false);
    });
  });

  describe("validateTimeout", () => {
    it("should accept valid timeout values", () => {
      expect(validateTimeout(5000)).toBe(true);
      expect(validateTimeout(10000)).toBe(true);
      expect(validateTimeout(30000)).toBe(true);
    });

    it("should reject timeout values below minimum", () => {
      expect(validateTimeout(4999)).toBe(false);
      expect(validateTimeout(1000)).toBe(false);
    });

    it("should reject timeout values above maximum", () => {
      expect(validateTimeout(30001)).toBe(false);
      expect(validateTimeout(60000)).toBe(false);
    });
  });

  describe("validateConcurrency", () => {
    it("should accept valid concurrency values", () => {
      expect(validateConcurrency(1)).toBe(true);
      expect(validateConcurrency(5)).toBe(true);
      expect(validateConcurrency(10)).toBe(true);
    });

    it("should reject concurrency values below minimum", () => {
      expect(validateConcurrency(0)).toBe(false);
      expect(validateConcurrency(-1)).toBe(false);
    });

    it("should reject concurrency values above maximum", () => {
      expect(validateConcurrency(11)).toBe(false);
      expect(validateConcurrency(20)).toBe(false);
    });
  });

  describe("isValidUrl", () => {
    it("should accept valid HTTP URLs", () => {
      expect(isValidUrl("http://example.com")).toBe(true);
      expect(isValidUrl("http://example.com/path")).toBe(true);
    });

    it("should accept valid HTTPS URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("https://example.com/path?query=value")).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("")).toBe(false);
    });

    it("should reject non-HTTP(S) protocols", () => {
      expect(isValidUrl("ftp://example.com")).toBe(false);
      expect(isValidUrl("file:///path")).toBe(false);
    });
  });

  describe("isValidPreset", () => {
    it("should accept valid presets", () => {
      expect(isValidPreset("quick")).toBe(true);
      expect(isValidPreset("thorough")).toBe(true);
      expect(isValidPreset("custom")).toBe(true);
    });

    it("should reject invalid presets", () => {
      expect(isValidPreset("invalid")).toBe(false);
      expect(isValidPreset("")).toBe(false);
      expect(isValidPreset("QUICK")).toBe(false);
    });
  });
});
