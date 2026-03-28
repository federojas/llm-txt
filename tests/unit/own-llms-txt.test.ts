/**
 * Unit Tests: Validate Our Own llms.txt File
 * Ensures the project's public/llms.txt stays compliant with the spec
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { validateLlmsTxtFormat } from "@/lib/llms-txt/spec";

describe("Project's Own llms.txt", () => {
  test("public/llms.txt should pass validation", () => {
    // Read the project's own llms.txt file
    const llmsTxtPath = join(process.cwd(), "public", "llms.txt");
    const content = readFileSync(llmsTxtPath, "utf-8");

    // Validate against spec
    const result = validateLlmsTxtFormat(content);

    // Should be valid
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Should have quality content
    expect(result.stats.sectionCount).toBeGreaterThanOrEqual(5);
    expect(result.stats.linkCount).toBeGreaterThanOrEqual(20);
  });

  test("public/llms.txt should have required sections", () => {
    const llmsTxtPath = join(process.cwd(), "public", "llms.txt");
    const content = readFileSync(llmsTxtPath, "utf-8");

    // Check for expected sections
    expect(content).toContain("## Overview");
    expect(content).toContain("## Features");
    expect(content).toContain("## API Reference");
    expect(content).toContain("## Architecture");
  });

  test("public/llms.txt should have project metadata", () => {
    const llmsTxtPath = join(process.cwd(), "public", "llms.txt");
    const content = readFileSync(llmsTxtPath, "utf-8");

    // Check for project name and description
    expect(content).toContain("# llms.txt Generator");
    expect(content).toContain("llms.txt files");

    // Should link to GitHub and live demo
    expect(content).toContain("https://github.com/federojas/llms-txt");
    expect(content).toContain("https://llm-txt-nine.vercel.app");
  });

  test("public/llms.txt should use markdown link format", () => {
    const llmsTxtPath = join(process.cwd(), "public", "llms.txt");
    const content = readFileSync(llmsTxtPath, "utf-8");

    // All links should be in markdown format [text](url)
    const markdownLinks = content.match(/\[.+?\]\(https?:\/\/.+?\)/g) || [];

    // Should have many markdown links
    expect(markdownLinks.length).toBeGreaterThan(20);

    // Verify no bare URLs on link lines (simple heuristic)
    const lines = content.split("\n");
    const linkLines = lines.filter((line) => line.trim().startsWith("- ["));

    for (const line of linkLines) {
      // Each link line should have matching brackets and parentheses
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;

      expect(openBrackets).toBe(closeBrackets);
      expect(openParens).toBe(closeParens);
    }
  });

  test("public/llms.txt should not be too long", () => {
    const llmsTxtPath = join(process.cwd(), "public", "llms.txt");
    const content = readFileSync(llmsTxtPath, "utf-8");

    const lines = content.split("\n").length;

    // Should be concise (spec recommends < 10,000 lines)
    expect(lines).toBeLessThan(200); // Our own should be much shorter
  });

  test("public/llms.txt should not have many duplicate links", () => {
    const llmsTxtPath = join(process.cwd(), "public", "llms.txt");
    const content = readFileSync(llmsTxtPath, "utf-8");

    // Extract all URLs from markdown links
    const linkMatches = content.match(/\[.+?\]\((https?:\/\/.+?)\)/g) || [];
    const urls = linkMatches.map((link) => {
      const match = link.match(/\((https?:\/\/.+?)\)/);
      return match ? match[1] : "";
    });

    // Check for duplicates
    const uniqueUrls = new Set(urls);
    const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
    const uniqueDuplicates = [...new Set(duplicates)];

    if (uniqueDuplicates.length > 0) {
      console.log(`\n⚠️  Found ${uniqueDuplicates.length} duplicate URLs:`);
      uniqueDuplicates.forEach((url) => {
        const count = urls.filter((u) => u === url).length;
        console.log(`  - ${url} (appears ${count}x)`);
      });
    }

    // Allow some duplicates (e.g., homepage, GitHub repo linked in multiple contexts)
    // but warn if too many
    const duplicateRatio = 1 - uniqueUrls.size / urls.length;
    expect(duplicateRatio).toBeLessThan(0.15); // Less than 15% duplicates
  });
});
