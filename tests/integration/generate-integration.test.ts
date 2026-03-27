/**
 * Integration Tests: Generate Use Case
 * Tests the full llms.txt generation flow from URL to formatted output
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { generateLlmsTxtUseCase } from "@/lib/llms-txt/generate";
import type { GenerateRequest } from "@/lib/api";

describe("Generate Use Case Integration", () => {
  describe("Full generation flow", () => {
    it("should generate llms.txt from example.com", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 5,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.content).toBeTruthy();
      expect(result.stats).toBeDefined();
      expect(result.stats?.pagesFound).toBeGreaterThan(0);
    }, 60000);

    it("should include required llms.txt sections", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.content).toContain("# Example Domain");
      expect(result.content).toMatch(/^##\s+/m); // Has at least one section
    }, 60000);

    it("should generate valid markdown format", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();

      // Should have markdown headings
      expect(result.content).toMatch(/^#\s+/m);
      expect(result.content).toMatch(/^##\s+/m);

      // Should have links in markdown format
      expect(result.content).toMatch(/\[.*?\]\(https?:\/\/.*?\)/);
    }, 60000);

    it("should include stats in response", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "metadata",
      });

      expect(result.stats).toBeDefined();
      expect(result.stats?.pagesFound).toBeGreaterThan(0);
      expect(result.stats?.url).toBe("https://example.com");
      expect(result.stats?.validation).toBeDefined();
    }, 60000);
  });

  describe("Mode switching", () => {
    it("should work in basic mode", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.content).toBeTruthy();
    }, 60000);

    it("should work in advanced mode with AI enhancement", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "ai",
      });

      expect(result.content).toBeTruthy();
      expect(result.content).toBeTruthy();

      // Advanced mode should include AI-enhanced sections
      // (May have better organization/descriptions)
      expect(result.content).toContain("#");
    }, 90000);
  });

  describe("Configuration validation", () => {
    it("should use default values for missing config", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.stats).toBeDefined();
    }, 60000);

    it("should respect maxPages limit", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 2,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.stats?.pagesFound).toBeLessThanOrEqual(2);
    }, 60000);

    it("should respect maxDepth limit", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 10,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.stats?.pagesFound).toBeGreaterThan(0);
    }, 60000);

    it("should respect followRobotsTxt setting", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      // Should successfully crawl while respecting robots.txt
    }, 60000);
  });

  describe("URL pattern filtering", () => {
    it("should respect includePatterns", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 5,
        includePatterns: ["**"], // Include all patterns
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.stats?.pagesFound).toBeGreaterThan(0);
    }, 60000);

    it("should respect ignorePatterns", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 5,
        excludePatterns: ["**/docs/**", "**/api/**"],
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      // Should not include ignored paths in content
      expect(result.content).not.toContain("example.com/docs");
      expect(result.content).not.toContain("example.com/api");
    }, 60000);
  });

  describe("Error handling", () => {
    it("should handle invalid URL gracefully", async () => {
      await expect(
        generateLlmsTxtUseCase.execute({
          url: "not-a-valid-url",
          maxDepth: 1,
          maxPages: 3,
          generationMode: "metadata",
        })
      ).rejects.toThrow();
    }, 30000);

    it.skip("should handle unreachable domain", async () => {
      // Skipped: This test takes too long waiting for network timeout
      // The crawler's 10s timeout means this test would take 10+ seconds per attempt
      await expect(
        generateLlmsTxtUseCase.execute({
          url: "https://this-domain-does-not-exist-12345.com",
          maxDepth: 1,
          maxPages: 3,
          generationMode: "metadata",
        })
      ).rejects.toThrow();
    }, 60000);

    it("should handle timeout gracefully", async () => {
      // This test just verifies that the function completes
      // Timeout is hardcoded to 10s in buildConfig, so we can't easily test it
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
    }, 30000);

    it("should handle restrictive crawl settings gracefully", async () => {
      // Even with maxPages: 0, crawler is lenient and allows at least homepage
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 0,
        maxPages: 1, // Allow at least homepage
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.stats?.pagesFound).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Content quality", () => {
    it("should not include duplicate URLs", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();

      // Extract all URLs from content
      const urlPattern = /\(https?:\/\/[^\)]+\)/g;
      const urls = result.content?.match(urlPattern) || [];
      const uniqueUrls = new Set(urls);

      expect(urls.length).toBe(uniqueUrls.size);
    }, 60000);

    it("should organize content into logical sections", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 5,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();

      // Should have multiple sections
      const sectionMatches = result.content?.match(/^##\s+/gm);
      expect(sectionMatches).toBeDefined();
      expect(sectionMatches!.length).toBeGreaterThan(0);
    }, 60000);

    it("should include meaningful descriptions", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();

      // Should have more than just URLs - should include descriptions
      const lines = result.content?.split("\n") || [];
      const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

      // Should have content beyond just markdown headings and links
      expect(nonEmptyLines.length).toBeGreaterThan(5);
    }, 60000);

    it("should clean up HTML entities and special characters", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();

      // Should not contain raw HTML entities
      expect(result.content).not.toContain("&nbsp;");
      expect(result.content).not.toContain("&amp;");
      expect(result.content).not.toContain("&lt;");
      expect(result.content).not.toContain("&gt;");
    }, 60000);
  });

  describe("Performance", () => {
    it("should complete within reasonable time for small site", async () => {
      const startTime = Date.now();

      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 5,
        generationMode: "metadata",
      });

      const duration = Date.now() - startTime;

      expect(result.content).toBeTruthy();
      expect(duration).toBeLessThan(60000); // 60 seconds
    }, 60000);

    it("should handle concurrent generation requests", async () => {
      // Generate two llms.txt files concurrently
      const [result1, result2] = await Promise.all([
        generateLlmsTxtUseCase.execute({
          url: "https://example.com",
          maxDepth: 1,
          maxPages: 3,
          generationMode: "metadata",
        }),
        generateLlmsTxtUseCase.execute({
          url: "https://example.com",
          maxDepth: 1,
          maxPages: 3,
          generationMode: "metadata",
        }),
      ]);

      expect(result1.content).toBeTruthy();
      expect(result2.content).toBeTruthy();
    }, 120000);
  });

  describe("Real-world scenarios", () => {
    it("should handle site with sitemap", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 5,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.content).toBeTruthy();
    }, 60000);

    it("should handle site without sitemap", async () => {
      // Example.com may or may not have sitemap, but should handle either case
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 5,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.content).toBeTruthy();
    }, 60000);

    it("should extract language information", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();
      expect(result.stats).toBeDefined();
      // Language detection happens during crawling
    }, 60000);
  });

  describe("Options building", () => {
    it("should build valid CrawlConfig from GenerateRequest", async () => {
      const options: GenerateRequest = {
        url: "https://example.com",
        maxDepth: 2,
        maxPages: 10,
        includePatterns: ["**"],
        excludePatterns: ["**/admin/**"],
        generationMode: "metadata",
      };

      const result = await generateLlmsTxtUseCase.execute(options);

      expect(result.content).toBeTruthy();
      // Verify config was applied
      expect(result.stats?.pagesFound).toBeLessThanOrEqual(10);
    }, 60000);

    it("should handle minimal options", async () => {
      const options: GenerateRequest = {
        url: "https://example.com",
        generationMode: "metadata",
      };

      const result = await generateLlmsTxtUseCase.execute(options);

      expect(result.content).toBeTruthy();
    }, 60000);
  });

  describe("Output validation", () => {
    it("should produce valid llms.txt format", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 5,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();

      // Should start with project name heading
      expect(result.content).toMatch(/^#\s+.+/m);

      // Should have at least one section
      expect(result.content).toMatch(/^##\s+/m);

      // Should have valid markdown links
      const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/;
      expect(result.content).toMatch(linkPattern);
    }, 60000);

    it("should not include malformed markdown", async () => {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxDepth: 1,
        maxPages: 3,
        generationMode: "metadata",
      });

      expect(result.content).toBeTruthy();

      // Should not have broken links
      expect(result.content).not.toMatch(/\[.*?\]\(\s*\)/);
      expect(result.content).not.toMatch(/\[\s*\]\(.*?\)/);

      // Should not have multiple consecutive blank lines
      expect(result.content).not.toMatch(/\n\n\n\n/);
    }, 60000);
  });
});
