/**
 * Unit Tests: Crawling Validation
 * Tests business rules for crawl configuration limits
 */

import { describe, it, expect } from "vitest";
import {
  validateMaxPages,
  validateMaxDepth,
  isValidUrl,
  CRAWL_LIMITS,
  CRAWL_DEFAULTS,
} from "@/lib/crawling/validation";

describe("Crawling Validation", () => {
  describe("CRAWL_LIMITS", () => {
    it("should define correct limits", () => {
      expect(CRAWL_LIMITS.MIN_PAGES).toBe(1);
      expect(CRAWL_LIMITS.MAX_PAGES).toBe(200);
      expect(CRAWL_LIMITS.MIN_DEPTH).toBe(1);
      expect(CRAWL_LIMITS.MAX_DEPTH).toBe(5);
    });
  });

  describe("CRAWL_DEFAULTS", () => {
    it("should define correct defaults", () => {
      expect(CRAWL_DEFAULTS.MAX_PAGES).toBe(50);
      expect(CRAWL_DEFAULTS.MAX_DEPTH).toBe(3);
      expect(CRAWL_DEFAULTS.TIMEOUT).toBe(10000);
      expect(CRAWL_DEFAULTS.CONCURRENCY).toBe(5);
    });

    it("should have defaults within limits", () => {
      expect(CRAWL_DEFAULTS.MAX_PAGES).toBeGreaterThanOrEqual(
        CRAWL_LIMITS.MIN_PAGES
      );
      expect(CRAWL_DEFAULTS.MAX_PAGES).toBeLessThanOrEqual(
        CRAWL_LIMITS.MAX_PAGES
      );
      expect(CRAWL_DEFAULTS.MAX_DEPTH).toBeGreaterThanOrEqual(
        CRAWL_LIMITS.MIN_DEPTH
      );
      expect(CRAWL_DEFAULTS.MAX_DEPTH).toBeLessThanOrEqual(
        CRAWL_LIMITS.MAX_DEPTH
      );
    });
  });

  describe("validateMaxPages", () => {
    it("should accept valid page counts", () => {
      expect(validateMaxPages(1)).toBe(true); // MIN
      expect(validateMaxPages(50)).toBe(true); // Default
      expect(validateMaxPages(100)).toBe(true); // Mid-range
      expect(validateMaxPages(200)).toBe(true); // MAX
    });

    it("should reject page count below minimum", () => {
      expect(validateMaxPages(0)).toBe(false);
      expect(validateMaxPages(-1)).toBe(false);
      expect(validateMaxPages(-100)).toBe(false);
    });

    it("should reject page count above maximum", () => {
      expect(validateMaxPages(201)).toBe(false);
      expect(validateMaxPages(500)).toBe(false);
      expect(validateMaxPages(1000)).toBe(false);
    });

    it("should reject non-integer values", () => {
      expect(validateMaxPages(1.5)).toBe(false);
      expect(validateMaxPages(50.9)).toBe(false);
      expect(validateMaxPages(Math.PI)).toBe(false);
    });

    it("should reject NaN", () => {
      expect(validateMaxPages(NaN)).toBe(false);
    });

    it("should reject Infinity", () => {
      expect(validateMaxPages(Infinity)).toBe(false);
      expect(validateMaxPages(-Infinity)).toBe(false);
    });

    it("should handle boundary values", () => {
      expect(validateMaxPages(CRAWL_LIMITS.MIN_PAGES)).toBe(true);
      expect(validateMaxPages(CRAWL_LIMITS.MAX_PAGES)).toBe(true);
      expect(validateMaxPages(CRAWL_LIMITS.MIN_PAGES - 1)).toBe(false);
      expect(validateMaxPages(CRAWL_LIMITS.MAX_PAGES + 1)).toBe(false);
    });
  });

  describe("validateMaxDepth", () => {
    it("should accept valid depth values", () => {
      expect(validateMaxDepth(1)).toBe(true); // MIN
      expect(validateMaxDepth(3)).toBe(true); // Default
      expect(validateMaxDepth(5)).toBe(true); // MAX
    });

    it("should reject depth below minimum", () => {
      expect(validateMaxDepth(0)).toBe(false);
      expect(validateMaxDepth(-1)).toBe(false);
      expect(validateMaxDepth(-10)).toBe(false);
    });

    it("should reject depth above maximum", () => {
      expect(validateMaxDepth(6)).toBe(false);
      expect(validateMaxDepth(10)).toBe(false);
      expect(validateMaxDepth(100)).toBe(false);
    });

    it("should reject non-integer values", () => {
      expect(validateMaxDepth(1.5)).toBe(false);
      expect(validateMaxDepth(3.14)).toBe(false);
      expect(validateMaxDepth(2.999)).toBe(false);
    });

    it("should reject NaN", () => {
      expect(validateMaxDepth(NaN)).toBe(false);
    });

    it("should reject Infinity", () => {
      expect(validateMaxDepth(Infinity)).toBe(false);
      expect(validateMaxDepth(-Infinity)).toBe(false);
    });

    it("should handle boundary values", () => {
      expect(validateMaxDepth(CRAWL_LIMITS.MIN_DEPTH)).toBe(true);
      expect(validateMaxDepth(CRAWL_LIMITS.MAX_DEPTH)).toBe(true);
      expect(validateMaxDepth(CRAWL_LIMITS.MIN_DEPTH - 1)).toBe(false);
      expect(validateMaxDepth(CRAWL_LIMITS.MAX_DEPTH + 1)).toBe(false);
    });

    it("should accept all valid depth levels", () => {
      for (
        let depth = CRAWL_LIMITS.MIN_DEPTH;
        depth <= CRAWL_LIMITS.MAX_DEPTH;
        depth++
      ) {
        expect(validateMaxDepth(depth)).toBe(true);
      }
    });
  });

  describe("isValidUrl", () => {
    describe("valid URLs", () => {
      it("should accept http URLs", () => {
        expect(isValidUrl("http://example.com")).toBe(true);
        expect(isValidUrl("http://www.example.com")).toBe(true);
        expect(isValidUrl("http://example.com/path")).toBe(true);
        expect(isValidUrl("http://example.com:8080")).toBe(true);
      });

      it("should accept https URLs", () => {
        expect(isValidUrl("https://example.com")).toBe(true);
        expect(isValidUrl("https://www.example.com")).toBe(true);
        expect(isValidUrl("https://example.com/path")).toBe(true);
        expect(isValidUrl("https://example.com:443")).toBe(true);
      });

      it("should accept URLs with paths", () => {
        expect(isValidUrl("https://example.com/docs/api")).toBe(true);
        expect(isValidUrl("https://example.com/path/to/page")).toBe(true);
        expect(isValidUrl("https://example.com/very/deep/nested/path")).toBe(
          true
        );
      });

      it("should accept URLs with query parameters", () => {
        expect(isValidUrl("https://example.com?query=value")).toBe(true);
        expect(isValidUrl("https://example.com/path?foo=bar&baz=qux")).toBe(
          true
        );
        expect(isValidUrl("https://example.com?param=value&another=123")).toBe(
          true
        );
      });

      it("should accept URLs with anchors", () => {
        expect(isValidUrl("https://example.com#section")).toBe(true);
        expect(isValidUrl("https://example.com/page#anchor")).toBe(true);
        expect(isValidUrl("https://example.com?q=test#result")).toBe(true);
      });

      it("should accept URLs with subdomains", () => {
        expect(isValidUrl("https://api.example.com")).toBe(true);
        expect(isValidUrl("https://blog.example.com")).toBe(true);
        expect(isValidUrl("https://sub.domain.example.com")).toBe(true);
      });

      it("should accept URLs with non-standard ports", () => {
        expect(isValidUrl("http://example.com:3000")).toBe(true);
        expect(isValidUrl("https://example.com:8443")).toBe(true);
        expect(isValidUrl("http://localhost:8080")).toBe(true);
      });

      it("should accept localhost URLs", () => {
        expect(isValidUrl("http://localhost")).toBe(true);
        expect(isValidUrl("http://localhost:3000")).toBe(true);
        expect(isValidUrl("https://localhost:8443")).toBe(true);
      });

      it("should accept IP address URLs", () => {
        expect(isValidUrl("http://127.0.0.1")).toBe(true);
        expect(isValidUrl("http://192.168.1.1:8080")).toBe(true);
        expect(isValidUrl("https://10.0.0.1")).toBe(true);
      });
    });

    describe("invalid URLs", () => {
      it("should reject non-http/https protocols", () => {
        expect(isValidUrl("ftp://example.com")).toBe(false);
        expect(isValidUrl("file:///path/to/file")).toBe(false);
        expect(isValidUrl("ws://example.com")).toBe(false);
        expect(isValidUrl("mailto:user@example.com")).toBe(false);
        expect(isValidUrl("tel:+1234567890")).toBe(false);
      });

      it("should reject malformed URLs", () => {
        expect(isValidUrl("not-a-url")).toBe(false);
        expect(isValidUrl("example.com")).toBe(false);
        expect(isValidUrl("//example.com")).toBe(false);
        expect(isValidUrl("http://")).toBe(false);
        expect(isValidUrl("https://")).toBe(false);
      });

      it("should reject empty strings", () => {
        expect(isValidUrl("")).toBe(false);
      });

      it("should reject URLs with spaces in hostname", () => {
        // Space in hostname causes URL constructor to throw
        expect(isValidUrl("http://example .com")).toBe(false);
      });

      it("should handle URLs with spaces in path", () => {
        // Spaces in path are percent-encoded by URL constructor
        expect(isValidUrl("https://example.com/path with spaces")).toBe(true);
      });

      it("should reject relative URLs", () => {
        expect(isValidUrl("/relative/path")).toBe(false);
        expect(isValidUrl("./relative")).toBe(false);
        expect(isValidUrl("../parent")).toBe(false);
      });

      it("should reject protocol-relative URLs", () => {
        expect(isValidUrl("//example.com")).toBe(false);
      });

      it("should handle special characters in path", () => {
        // URL constructor is permissive with special chars in path
        // isValidUrl only checks protocol, not character validity
        expect(isValidUrl("http://example.com/path<>")).toBe(true);
      });
    });
  });

  describe("Real-world validation scenarios", () => {
    it("should validate typical API request parameters", () => {
      const request = {
        maxPages: 50,
        maxDepth: 3,
        url: "https://example.com",
      };

      expect(validateMaxPages(request.maxPages)).toBe(true);
      expect(validateMaxDepth(request.maxDepth)).toBe(true);
      expect(isValidUrl(request.url)).toBe(true);
    });

    it("should reject invalid API request", () => {
      const request = {
        maxPages: 500, // Too high
        maxDepth: 10, // Too high
        url: "ftp://example.com", // Wrong protocol
      };

      expect(validateMaxPages(request.maxPages)).toBe(false);
      expect(validateMaxDepth(request.maxDepth)).toBe(false);
      expect(isValidUrl(request.url)).toBe(false);
    });

    it("should handle edge case minimums", () => {
      const request = {
        maxPages: 1, // Minimum
        maxDepth: 1, // Minimum
        url: "http://localhost",
      };

      expect(validateMaxPages(request.maxPages)).toBe(true);
      expect(validateMaxDepth(request.maxDepth)).toBe(true);
      expect(isValidUrl(request.url)).toBe(true);
    });

    it("should handle edge case maximums", () => {
      const request = {
        maxPages: 200, // Maximum
        maxDepth: 5, // Maximum
        url: "https://very.long.subdomain.example.com:8443/path/to/page?query=value#anchor",
      };

      expect(validateMaxPages(request.maxPages)).toBe(true);
      expect(validateMaxDepth(request.maxDepth)).toBe(true);
      expect(isValidUrl(request.url)).toBe(true);
    });
  });
});
