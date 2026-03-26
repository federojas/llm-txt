import { describe, it, expect } from "vitest";
import { urlSchema, crawlConfigSchema } from "@/lib/api";

describe("Validation Schemas", () => {
  describe("urlSchema", () => {
    it("should accept valid HTTP URLs", () => {
      expect(urlSchema.safeParse("http://example.com").success).toBe(true);
    });

    it("should accept valid HTTPS URLs", () => {
      expect(urlSchema.safeParse("https://example.com").success).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(urlSchema.safeParse("not-a-url").success).toBe(false);
      expect(urlSchema.safeParse("ftp://example.com").success).toBe(false);
    });

    it("should reject localhost (SSRF protection)", () => {
      expect(urlSchema.safeParse("http://localhost").success).toBe(false);
      expect(urlSchema.safeParse("http://127.0.0.1").success).toBe(false);
    });

    it("should reject private networks (SSRF protection)", () => {
      expect(urlSchema.safeParse("http://192.168.1.1").success).toBe(false);
      expect(urlSchema.safeParse("http://10.0.0.1").success).toBe(false);
      expect(urlSchema.safeParse("http://172.16.0.1").success).toBe(false);
    });

    it("should reject AWS metadata endpoint (SSRF protection)", () => {
      expect(urlSchema.safeParse("http://169.254.169.254").success).toBe(false);
    });

    it("should reject .local domains", () => {
      expect(urlSchema.safeParse("http://myserver.local").success).toBe(false);
    });
  });

  describe("crawlConfigSchema", () => {
    it("should accept valid config", () => {
      const config = {
        url: "https://example.com",
        maxPages: 50,
        maxDepth: 3,
      };
      expect(crawlConfigSchema.safeParse(config).success).toBe(true);
    });

    it("should apply default values", () => {
      const config = {
        url: "https://example.com",
      };
      const result = crawlConfigSchema.parse(config);
      expect(result.maxPages).toBe(50);
      expect(result.maxDepth).toBe(3);
    });

    it("should enforce max page limits", () => {
      const config = {
        url: "https://example.com",
        maxPages: 201,
      };
      expect(crawlConfigSchema.safeParse(config).success).toBe(false);
    });

    it("should enforce max depth limits", () => {
      const config = {
        url: "https://example.com",
        maxDepth: 10,
      };
      expect(crawlConfigSchema.safeParse(config).success).toBe(false);
    });

    it("should enforce minimum values", () => {
      expect(
        crawlConfigSchema.safeParse({
          url: "https://example.com",
          maxPages: 0,
        }).success
      ).toBe(false);
      expect(
        crawlConfigSchema.safeParse({
          url: "https://example.com",
          maxDepth: 0,
        }).success
      ).toBe(false);
    });
  });
});
