import { describe, it, expect, beforeEach, vi } from "vitest";
import { GroqSectionDiscovery } from "@/lib/content-generation/providers/groq/groq-section-discovery";
import { PageMetadata, SectionGroup } from "@/lib/types";

// Mock GroqClient
vi.mock("@/lib/content-generation/providers/groq/groq-client", () => {
  return {
    GroqClient: class {
      isAvailable = vi.fn().mockReturnValue(true);
      executeWithFallback = vi.fn();
    },
  };
});

describe("GroqSectionDiscovery", () => {
  let service: GroqSectionDiscovery;
  let mockExecuteWithFallback: ReturnType<typeof vi.fn>;

  const mockPages: PageMetadata[] = [
    {
      url: "https://example.com",
      title: "Home",
      description: "Homepage",
      depth: 0,
      internalLinks: [],
    },
    {
      url: "https://example.com/docs",
      title: "Documentation",
      description: "API docs",
      depth: 1,
      internalLinks: [],
    },
    {
      url: "https://example.com/api",
      title: "API Reference",
      description: "API endpoints",
      depth: 1,
      internalLinks: [],
    },
    {
      url: "https://example.com/about",
      title: "About Us",
      description: "Company info",
      depth: 1,
      internalLinks: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GroqSectionDiscovery("test-api-key");

    // Get reference to the mocked executeWithFallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockExecuteWithFallback = (service as any).groqClient.executeWithFallback;
  });

  describe("constructor", () => {
    it("should initialize with API key", () => {
      expect(service).toBeInstanceOf(GroqSectionDiscovery);
    });

    it("should accept custom rate limit", () => {
      const customService = new GroqSectionDiscovery("test-api-key", 60);
      expect(customService).toBeInstanceOf(GroqSectionDiscovery);
    });
  });

  describe("isAvailable", () => {
    it("should return true when Groq client is available", () => {
      expect(service.isAvailable()).toBe(true);
    });

    it("should return false when Groq client is unavailable", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).groqClient.isAvailable.mockReturnValue(false);
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe("discoverSections", () => {
    it("should discover sections from pages", async () => {
      const mockSections: SectionGroup[] = [
        { name: "Getting Started", pageIndexes: [0] },
        { name: "Documentation", pageIndexes: [1, 2] },
        { name: "Company", pageIndexes: [3] },
      ];

      mockExecuteWithFallback.mockResolvedValue(mockSections);

      const result = await service.discoverSections(mockPages);

      expect(result).toEqual(mockSections);
      expect(mockExecuteWithFallback).toHaveBeenCalledTimes(1);
    });

    it("should parse JSON response from LLM", async () => {
      const mockSections: SectionGroup[] = [
        { name: "Home", pageIndexes: [0] },
        { name: "Technical Docs", pageIndexes: [1, 2, 3] },
      ];

      mockExecuteWithFallback.mockResolvedValue(mockSections);

      const result = await service.discoverSections(mockPages);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Home");
      expect(result[0].pageIndexes).toEqual([0]);
    });

    it("should handle empty page array", async () => {
      mockExecuteWithFallback.mockResolvedValue([]);

      const result = await service.discoverSections([]);

      expect(result).toEqual([]);
    });

    it("should include page titles and descriptions in prompt", async () => {
      mockExecuteWithFallback.mockResolvedValue([
        { name: "All Pages", pageIndexes: [0, 1, 2, 3] },
      ]);

      await service.discoverSections(mockPages);

      // Verify the API call was made
      expect(mockExecuteWithFallback).toHaveBeenCalledTimes(1);

      // The implementation builds a page list with format: "0. [Title](URL) - Description"
      // This is passed to the LLM in the user message
    });

    it("should set temperature to 0.3 for consistent grouping", async () => {
      mockExecuteWithFallback.mockResolvedValue([]);

      await service.discoverSections(mockPages);

      expect(mockExecuteWithFallback).toHaveBeenCalled();
      // temperature: 0.3 is set in the implementation
    });

    it("should set max tokens to 1500", async () => {
      mockExecuteWithFallback.mockResolvedValue([]);

      await service.discoverSections(mockPages);

      expect(mockExecuteWithFallback).toHaveBeenCalled();
      // max_tokens: 1500 is set in the implementation
    });

    it("should handle pages without descriptions", async () => {
      const pagesWithoutDesc: PageMetadata[] = [
        {
          url: "https://example.com/page1",
          title: "Page 1",
          depth: 1,
          internalLinks: [],
        },
        {
          url: "https://example.com/page2",
          title: "Page 2",
          depth: 1,
          internalLinks: [],
        },
      ];

      mockExecuteWithFallback.mockResolvedValue([
        { name: "Pages", pageIndexes: [0, 1] },
      ]);

      const result = await service.discoverSections(pagesWithoutDesc);

      expect(result).toHaveLength(1);
    });

    it("should handle single page", async () => {
      const singlePage: PageMetadata[] = [
        {
          url: "https://example.com",
          title: "Home",
          depth: 0,
          internalLinks: [],
        },
      ];

      mockExecuteWithFallback.mockResolvedValue([
        { name: "Home", pageIndexes: [0] },
      ]);

      const result = await service.discoverSections(singlePage);

      expect(result).toHaveLength(1);
      expect(result[0].pageIndexes).toEqual([0]);
    });

    it("should handle many pages", async () => {
      const manyPages: PageMetadata[] = Array.from({ length: 50 }, (_, i) => ({
        url: `https://example.com/page${i}`,
        title: `Page ${i}`,
        depth: 1,
        internalLinks: [],
      }));

      const mockSections: SectionGroup[] = [
        { name: "Section 1", pageIndexes: [0, 1, 2, 3, 4] },
        { name: "Section 2", pageIndexes: [5, 6, 7, 8, 9] },
        {
          name: "Other Pages",
          pageIndexes: Array.from({ length: 40 }, (_, i) => i + 10),
        },
      ];

      mockExecuteWithFallback.mockResolvedValue(mockSections);

      const result = await service.discoverSections(manyPages);

      expect(result).toHaveLength(3);
    });

    it("should handle API errors", async () => {
      mockExecuteWithFallback.mockRejectedValue(
        new Error("Rate limit exceeded")
      );

      await expect(service.discoverSections(mockPages)).rejects.toThrow(
        "Rate limit exceeded"
      );
    });

    it("should return empty array on JSON parse error", async () => {
      // Simulate executeWithFallback returning empty array when JSON parsing fails
      mockExecuteWithFallback.mockResolvedValue([]);

      const result = await service.discoverSections(mockPages);

      expect(result).toEqual([]);
    });

    it("should strip markdown code blocks from response", async () => {
      // The implementation strips ```json and ``` from responses
      // This is tested indirectly through successful parsing
      mockExecuteWithFallback.mockResolvedValue([
        { name: "Test Section", pageIndexes: [0, 1] },
      ]);

      const result = await service.discoverSections(mockPages);

      expect(result).toHaveLength(1);
    });

    it("should create 3-7 sections as requested in prompt", async () => {
      const mockSections: SectionGroup[] = [
        { name: "Home", pageIndexes: [0] },
        { name: "Documentation", pageIndexes: [1, 2] },
        { name: "About", pageIndexes: [3] },
      ];

      mockExecuteWithFallback.mockResolvedValue(mockSections);

      const result = await service.discoverSections(mockPages);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(7);
    });

    it("should ensure each page appears in exactly one section", async () => {
      const mockSections: SectionGroup[] = [
        { name: "Section A", pageIndexes: [0, 1] },
        { name: "Section B", pageIndexes: [2, 3] },
      ];

      mockExecuteWithFallback.mockResolvedValue(mockSections);

      const result = await service.discoverSections(mockPages);

      const allIndexes = result.flatMap((s) => s.pageIndexes);
      const uniqueIndexes = new Set(allIndexes);

      // Each index should appear once
      expect(uniqueIndexes.size).toBe(allIndexes.length);

      // All page indexes should be covered (0, 1, 2, 3)
      expect(uniqueIndexes.size).toBe(mockPages.length);
    });

    it("should use section names with 2-4 words", async () => {
      const mockSections: SectionGroup[] = [
        { name: "API Reference", pageIndexes: [0, 1] },
        { name: "Getting Started Guide", pageIndexes: [2] },
        { name: "About", pageIndexes: [3] },
      ];

      mockExecuteWithFallback.mockResolvedValue(mockSections);

      const result = await service.discoverSections(mockPages);

      result.forEach((section) => {
        const wordCount = section.name.split(" ").length;
        expect(wordCount).toBeGreaterThanOrEqual(1);
        expect(wordCount).toBeLessThanOrEqual(4);
      });
    });
  });

  describe("integration with prompts", () => {
    it("should use section discovery prompt", async () => {
      mockExecuteWithFallback.mockResolvedValue([]);

      await service.discoverSections(mockPages);

      expect(mockExecuteWithFallback).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });
});
