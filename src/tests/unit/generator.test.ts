import { describe, it, expect } from "vitest";
import { Formatter, validateLlmsTxt } from "@/lib/llms-txt";
import { PageMetadata } from "@/lib/types";
import {
  IDescriptionGenerator,
  ISectionDiscoveryService,
  ITitleCleaningService,
} from "@/lib/content-generation/core/types";

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

  // Mock description generator
  const mockDescriptionGenerator: IDescriptionGenerator = {
    isAvailable: () => true,
    generateDescription: async (page: PageMetadata) => page.description || "",
    generateBusinessSummary: async () => "A comprehensive example site",
  };

  // Mock section discovery service
  const mockSectionDiscovery: ISectionDiscoveryService = {
    isAvailable: () => true,
    discoverSections: async (pages: PageMetadata[]) => {
      // Mock section discovery: group by URL patterns
      return [
        {
          name: "Documentation",
          pageIndexes: pages
            .map((p, idx) => (p.url.includes("/docs") ? idx : -1))
            .filter((idx) => idx !== -1),
        },
        {
          name: "API Reference",
          pageIndexes: pages
            .map((p, idx) => (p.url.includes("/api") ? idx : -1))
            .filter((idx) => idx !== -1),
        },
      ];
    },
  };

  // Mock title cleaning service
  const mockTitleCleaning: ITitleCleaningService = {
    isAvailable: () => true,
    cleanTitles: async (titles: string[]) => {
      // Mock title cleaning: just return titles as-is for tests
      return titles;
    },
  };

  describe("Formatter", () => {
    it("should generate valid llms.txt content", async () => {
      const service = new Formatter(
        mockDescriptionGenerator,
        mockSectionDiscovery,
        mockTitleCleaning
      );
      const result = await service.generate(mockPages);
      expect(result).toContain("# Example Site");
      expect(result).toContain(">");
    });

    it("should include all pages", async () => {
      const service = new Formatter(
        mockDescriptionGenerator,
        mockSectionDiscovery,
        mockTitleCleaning
      );
      const result = await service.generate(mockPages);
      expect(result).toContain("[Documentation](https://example.com/docs)");
      expect(result).toContain("[API Reference](https://example.com/api)");
    });

    it("should organize pages into sections", async () => {
      const service = new Formatter(
        mockDescriptionGenerator,
        mockSectionDiscovery,
        mockTitleCleaning
      );
      const result = await service.generate(mockPages);
      expect(result).toContain("## Documentation");
      expect(result).toContain("## API Reference");
    });

    it("should include descriptions when available", async () => {
      const service = new Formatter(
        mockDescriptionGenerator,
        mockSectionDiscovery,
        mockTitleCleaning
      );
      const result = await service.generate(mockPages);
      expect(result).toContain("Comprehensive documentation");
      expect(result).toContain("API documentation");
    });

    it("should throw error when no pages provided", async () => {
      const service = new Formatter(
        mockDescriptionGenerator,
        mockSectionDiscovery,
        mockTitleCleaning
      );
      await expect(service.generate([])).rejects.toThrow();
    });

    it("should use custom project name if provided", async () => {
      const service = new Formatter(
        mockDescriptionGenerator,
        mockSectionDiscovery,
        mockTitleCleaning
      );
      const result = await service.generate(mockPages, "Custom Project");
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
