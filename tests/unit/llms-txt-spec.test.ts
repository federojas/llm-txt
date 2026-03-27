/**
 * Unit Tests: llms.txt Format Specification
 * Tests the validator that defines valid llms.txt format
 */

import { describe, test, expect } from "vitest";
import {
  validateLlmsTxtFormat,
  assertValidLlmsTxt,
  EXAMPLE_LLMS_TXT,
  LLMS_TXT_REQUIREMENTS,
} from "@/lib/llms-txt/spec";

describe("llms.txt Format Validation", () => {
  test("should validate example llms.txt", () => {
    const result = validateLlmsTxtFormat(EXAMPLE_LLMS_TXT);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.stats.sectionCount).toBeGreaterThan(1);
    expect(result.stats.linkCount).toBeGreaterThan(3);
  });

  test("should reject content without title", () => {
    const content = `## Section\n\n- [Link](https://example.com)`;

    const result = validateLlmsTxtFormat(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing top-level heading (# Title)");
  });

  test("should reject content without sections", () => {
    const content = `# Title\n\nJust some text without sections`;

    const result = validateLlmsTxtFormat(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("No sections found (## Section Name)");
  });

  test("should reject content without links", () => {
    const content = `# Title\n\n## Section\n\nJust plain text, no links`;

    const result = validateLlmsTxtFormat(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("No links found ([text](url))");
  });

  test("should reject content too short", () => {
    const content = `# Title`;

    const result = validateLlmsTxtFormat(content);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too short"))).toBe(true);
  });

  test("should warn about few sections", () => {
    const content = `# Title\n\n## Only Section\n\n- [Link](https://example.com)`;

    const result = validateLlmsTxtFormat(content);

    expect(result.warnings.some((w) => w.includes("Only 1 section"))).toBe(
      true
    );
  });

  test("should warn about few links", () => {
    const content = `# Title\n\n## Section 1\n\n- [Link](https://example.com)\n\n## Section 2\n\nText`;

    const result = validateLlmsTxtFormat(content);

    expect(result.warnings.some((w) => w.includes("Only 1 links"))).toBe(true);
  });

  test("should count sections correctly", () => {
    const content = `# Title

## Section 1
- [Link 1](https://example.com/1)

## Section 2
- [Link 2](https://example.com/2)

## Section 3
- [Link 3](https://example.com/3)
`;

    const result = validateLlmsTxtFormat(content);

    expect(result.stats.sectionCount).toBe(3);
    expect(result.stats.linkCount).toBe(3);
  });

  test("should count URLs correctly", () => {
    const content = `# Title

## Section
- [Link 1](https://example.com/1): Description
- [Link 2](https://example.com/2): Another link
- Plain URL: https://example.com/3
`;

    const result = validateLlmsTxtFormat(content);

    expect(result.stats.urlCount).toBeGreaterThanOrEqual(3);
  });

  test("assertValidLlmsTxt should throw on invalid content", () => {
    const invalidContent = `Just some text`;

    expect(() => assertValidLlmsTxt(invalidContent)).toThrow(
      /Invalid llms\.txt format/
    );
  });

  test("assertValidLlmsTxt should not throw on valid content", () => {
    expect(() => assertValidLlmsTxt(EXAMPLE_LLMS_TXT)).not.toThrow();
  });

  test("should validate title pattern", () => {
    const validTitles = [
      "# Simple Title",
      "# Title With Multiple Words",
      "# Title: With Punctuation!",
    ];

    for (const title of validTitles) {
      expect(LLMS_TXT_REQUIREMENTS.titlePattern.test(title)).toBe(true);
    }
  });

  test("should validate section pattern", () => {
    const validSections = [
      "## Section Name",
      "## Getting Started",
      "## API Reference (Beta)",
    ];

    for (const section of validSections) {
      expect(LLMS_TXT_REQUIREMENTS.sectionPattern.test(section)).toBe(true);
    }
  });

  test("should validate link pattern", () => {
    const validLinks = [
      "[Text](https://example.com)",
      "[GitHub](https://github.com/repo)",
      "[API Docs](https://api.example.com/v1/docs)",
    ];

    for (const link of validLinks) {
      expect(LLMS_TXT_REQUIREMENTS.linkPattern.test(link)).toBe(true);
    }
  });

  test("should reject invalid link formats", () => {
    const invalidLinks = [
      "[Text](not-a-url)",
      "[Text](ftp://example.com)", // FTP not HTTP(S)
      "Text https://example.com", // Not a markdown link
    ];

    for (const link of invalidLinks) {
      expect(LLMS_TXT_REQUIREMENTS.linkPattern.test(link)).toBe(false);
    }
  });

  test("should provide detailed stats", () => {
    const content = `# Site Name

Brief description

## Section 1
- [Link 1](https://example.com/1): Description
- [Link 2](https://example.com/2): Description

## Section 2
- [Link 3](https://example.com/3): Description

## Section 3
Content with https://example.com/4 plain URL
`;

    const result = validateLlmsTxtFormat(content);

    expect(result.stats.lineCount).toBeGreaterThan(10);
    expect(result.stats.sectionCount).toBe(3);
    expect(result.stats.linkCount).toBe(3);
    expect(result.stats.urlCount).toBeGreaterThanOrEqual(4);
  });

  test("should warn about content that is too long", () => {
    // Create content with more than maxLines (10000)
    const sections = Array.from({ length: 2500 }, (_, i) => {
      return `## Section ${i + 1}\n- [Link ${i + 1}](https://example.com/${i + 1})\n- [Link ${i + 1}b](https://example.com/${i + 1}b)\n`;
    }).join("\n");
    const content = `# Title\n\n${sections}`;

    const result = validateLlmsTxtFormat(content);

    expect(result.warnings.some((w) => w.includes("very long"))).toBe(true);
  });

  test("should warn about empty sections", () => {
    const content = `# Title

## Section 1
- [Link 1](https://example.com/1)

## Empty Section
## Another Section
- [Link 2](https://example.com/2)
`;

    const result = validateLlmsTxtFormat(content);

    expect(result.warnings.some((w) => w.includes("empty sections"))).toBe(
      true
    );
  });
});
