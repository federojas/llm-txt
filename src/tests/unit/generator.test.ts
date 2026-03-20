import { describe, it, expect } from "vitest";
import { generateLlmsTxt, validateLlmsTxt } from "@/lib/domain/generator";
import { PageMetadata } from "@/lib/domain/models";

describe("LLMs.txt Generator", () => {
  const mockPages: PageMetadata[] = [
    {
      url: "https://example.com",
      title: "Example Site",
      description: "A great example site",
      depth: 0,
      internalLinks: [],
    },
    {
      url: "https://example.com/docs",
      title: "Documentation",
      description: "Comprehensive documentation",
      depth: 1,
      internalLinks: [],
    },
    {
      url: "https://example.com/api",
      title: "API Reference",
      description: "API documentation",
      depth: 1,
      internalLinks: [],
    },
  ];

  describe("generateLlmsTxt", () => {
    it("should generate valid llms.txt content", async () => {
      const result = await generateLlmsTxt(mockPages);
      expect(result).toContain("# Example Site");
      expect(result).toContain(">");
    });

    it("should include all pages", async () => {
      const result = await generateLlmsTxt(mockPages);
      expect(result).toContain("[Documentation](https://example.com/docs)");
      expect(result).toContain("[API Reference](https://example.com/api)");
    });

    it("should organize pages into sections", async () => {
      const result = await generateLlmsTxt(mockPages);
      expect(result).toContain("## Documentation");
      expect(result).toContain("## API Reference");
    });

    it("should include descriptions when available", async () => {
      const result = await generateLlmsTxt(mockPages);
      expect(result).toContain("Comprehensive documentation");
      expect(result).toContain("API documentation");
    });

    it("should throw error when no pages provided", async () => {
      await expect(generateLlmsTxt([])).rejects.toThrow();
    });

    it("should use custom project name if provided", async () => {
      const result = await generateLlmsTxt(mockPages, "Custom Project");
      expect(result).toContain("# Custom Project");
    });
  });

  describe("validateLlmsTxt", () => {
    it("should validate correct llms.txt format", () => {
      const content = `# Project Name

> Description

## Documentation

- [Link](https://example.com)
`;
      const result = validateLlmsTxt(content);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject missing H1", () => {
      const content = `## Section

- [Link](https://example.com)
`;
      const result = validateLlmsTxt(content);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Missing required H1 heading (project name)"
      );
    });

    it("should reject multiple H1s", () => {
      const content = `# Project One

# Project Two

## Section
`;
      const result = validateLlmsTxt(content);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Multiple H1 headings found (only one allowed)"
      );
    });
  });
});
