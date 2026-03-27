/**
 * AI Generation Integration Tests
 * Tests real AI-powered description generation with actual websites
 *
 * NOTE: These tests make real API calls and can take 5-10 minutes
 * Run separately: npm run test:integration:ai
 * Not included in standard CI pipeline
 */

import { describe, test, expect } from "vitest";
import { generateLlmsTxtUseCase } from "@/lib/llms-txt";
import { validateLlmsTxtFormat } from "@/lib/llms-txt/spec";

describe("AI-Powered Generation", () => {
  // Use TEST_GROQ_API_KEY in tests, fallback to GROQ_API_KEY for local dev
  const apiKey = process.env.TEST_GROQ_API_KEY || process.env.GROQ_API_KEY;

  test("should generate quality llms.txt for real site with AI", async () => {
    if (!apiKey) {
      console.warn("Skipping AI test: No API key available");
      return;
    }

    const result = await generateLlmsTxtUseCase.execute({
      url: "https://www.fastht.ml",
      maxPages: 20,
      maxDepth: 2,
      languageStrategy: "prefer-english",
      generationMode: "ai",
    });

    // Validate format
    const validation = validateLlmsTxtFormat(result.content);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Check AI-generated content quality
    expect(result.stats.pagesFound).toBeGreaterThan(5);
    expect(validation.stats.sectionCount).toBeGreaterThan(1);
    expect(validation.stats.linkCount).toBeGreaterThan(5);

    // Verify AI descriptions exist (not just titles)
    const hasDescriptions = result.content.includes(":");
    expect(hasDescriptions).toBe(true);

    console.log("\n=== AI Generation Results ===");
    console.log("Pages found:", result.stats.pagesFound);
    console.log("Sections:", validation.stats.sectionCount);
    console.log("Links:", validation.stats.linkCount);
    console.log("Lines:", validation.stats.lineCount);

    if (validation.warnings.length > 0) {
      console.log("\nWarnings:", validation.warnings);
    }
  }, 600_000); // 10 minutes

  test("should handle sites with complex structure", async () => {
    if (!apiKey) {
      console.warn("Skipping AI test: No API key available");
      return;
    }

    const result = await generateLlmsTxtUseCase.execute({
      url: "https://nextjs.org",
      maxPages: 30,
      maxDepth: 2,
      languageStrategy: "prefer-english",
      generationMode: "ai",
    });

    const validation = validateLlmsTxtFormat(result.content);
    expect(validation.valid).toBe(true);

    // Complex sites should have multiple sections
    expect(validation.stats.sectionCount).toBeGreaterThanOrEqual(2);
    expect(result.stats.pagesFound).toBeGreaterThan(10);

    console.log("\n=== Complex Site Results ===");
    console.log("Pages found:", result.stats.pagesFound);
    console.log("Sections:", validation.stats.sectionCount);
  }, 600_000);

  test("should generate without AI (metadata mode)", async () => {
    // Test fallback mode without Groq API
    const originalKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    try {
      const result = await generateLlmsTxtUseCase.execute({
        url: "https://example.com",
        maxPages: 5,
        maxDepth: 1,
        languageStrategy: "prefer-english",
        generationMode: "metadata",
      });

      const validation = validateLlmsTxtFormat(result.content);
      expect(validation.valid).toBe(true);
      expect(result.stats.pagesFound).toBeGreaterThanOrEqual(1);

      console.log("\n=== Metadata Mode Results ===");
      console.log("Pages found:", result.stats.pagesFound);
      console.log("Mode worked without API key");
    } finally {
      // Restore API key
      if (originalKey) {
        process.env.GROQ_API_KEY = originalKey;
      }
    }
  }, 120_000); // 2 minutes
});
