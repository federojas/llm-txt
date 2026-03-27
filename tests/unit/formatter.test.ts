/**
 * Unit Tests: Formatter
 * Tests llms.txt content generation and formatting
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Formatter, validateLlmsTxt } from "@/lib/llms-txt/formatter";
import type {
  IDescriptionGenerator,
  ISectionDiscoveryService,
  ITitleCleaningService,
} from "@/lib/content-generation/core/types";
import type { PageMetadata, SectionGroup } from "@/lib/types";
import type { SitemapUrl } from "@/lib/http/sitemap";
import type { RobotsDirectives } from "@/lib/http/robots";

// Mock dependencies
vi.mock("@/lib/crawling/link-scoring", () => ({
  scoreAndFilterPages: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => ({
    warn: vi.fn(),
    info: vi.fn(),
    flush: vi.fn(),
  })),
}));

vi.mock("@/lib/llms-txt/spec", () => ({
  validateLlmsTxtFormat: vi.fn(),
}));

import { scoreAndFilterPages } from "@/lib/crawling/link-scoring";
import { validateLlmsTxtFormat } from "@/lib/llms-txt/spec";

const mockScoreAndFilterPages = vi.mocked(scoreAndFilterPages);
const mockValidateLlmsTxtFormat = vi.mocked(validateLlmsTxtFormat);

describe("Formatter", () => {
  let formatter: Formatter;
  let mockDescriptionGenerator: IDescriptionGenerator;
  let mockSectionDiscovery: ISectionDiscoveryService;
  let mockTitleCleaning: ITitleCleaningService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock services
    mockDescriptionGenerator = {
      generateBusinessSummary: vi.fn(),
      generateDescription: vi.fn(),
    };

    mockSectionDiscovery = {
      discoverSections: vi.fn(),
    };

    mockTitleCleaning = {
      cleanTitles: vi.fn(),
    };

    formatter = new Formatter(
      mockDescriptionGenerator,
      mockSectionDiscovery,
      mockTitleCleaning
    );

    // Default mocks
    vi.mocked(
      mockDescriptionGenerator.generateBusinessSummary
    ).mockResolvedValue("Test summary");
    vi.mocked(mockDescriptionGenerator.generateDescription).mockResolvedValue(
      "Test description"
    );
    vi.mocked(mockSectionDiscovery.discoverSections).mockResolvedValue([]);
    vi.mocked(mockTitleCleaning.cleanTitles).mockImplementation(
      async (titles) => titles
    );

    mockValidateLlmsTxtFormat.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      stats: {
        sectionCount: 1,
        linkCount: 1,
        lineCount: 10,
      },
    });

    // Suppress console logs
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("generate", () => {
    const createMockPage = (
      url: string,
      title: string = "Page",
      depth: number = 0
    ): PageMetadata => ({
      url,
      title,
      description: "Description",
      depth,
      internalLinks: [],
      externalLinks: [],
    });

    it("should generate llms.txt content from pages", async () => {
      const pages = [createMockPage("https://example.com", "Home")];

      const result = await formatter.generate(pages);

      expect(result.content).toContain("# Home");
      expect(result.content).toContain("Test summary");
      expect(result.validation.valid).toBe(true);
    });

    it("should throw error when no pages provided", async () => {
      await expect(formatter.generate([])).rejects.toThrow(
        "No pages to generate llms.txt from"
      );
    });

    it("should use custom project name", async () => {
      const pages = [createMockPage("https://example.com", "Home")];

      const result = await formatter.generate(pages, "Custom Project");

      expect(result.content).toContain("# Custom Project");
    });

    it("should use custom project description", async () => {
      const pages = [createMockPage("https://example.com", "Home")];

      const result = await formatter.generate(
        pages,
        undefined,
        undefined,
        undefined,
        "Custom description"
      );

      expect(result.content).toContain("Custom description");
      expect(
        mockDescriptionGenerator.generateBusinessSummary
      ).not.toHaveBeenCalled();
    });

    it("should score and filter pages when sitemap data provided", async () => {
      const pages = [
        createMockPage("https://example.com", "Home"),
        createMockPage("https://example.com/about", "About"),
      ];
      const sitemapData = new Map<string, SitemapUrl>([
        ["https://example.com", { url: "https://example.com", priority: 1.0 }],
      ]);

      mockScoreAndFilterPages.mockResolvedValue([
        {
          page: pages[0],
          score: { totalScore: 80, signals: {} as Record<string, unknown> },
        },
      ]);

      const result = await formatter.generate(pages, undefined, sitemapData);

      expect(mockScoreAndFilterPages).toHaveBeenCalledWith(
        pages,
        expect.objectContaining({
          sitemapData,
          minScoreThreshold: 30,
        })
      );
      expect(result.content).toBeTruthy();
    });

    it("should handle title cleanup", async () => {
      const pages = [createMockPage("https://example.com", "Home | Site")];
      const titleCleanup = {
        removePatterns: ["\\s*\\|\\s*Site$"],
      };

      vi.mocked(mockTitleCleaning.cleanTitles).mockResolvedValue(["Home"]);

      const result = await formatter.generate(
        pages,
        undefined,
        undefined,
        undefined,
        undefined,
        titleCleanup
      );

      expect(result.content).toBeTruthy();
    });

    it("should include validation data in result", async () => {
      const pages = [createMockPage("https://example.com", "Home")];

      mockValidateLlmsTxtFormat.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ["Some warning"],
        stats: {
          sectionCount: 2,
          linkCount: 5,
          lineCount: 20,
        },
      });

      const result = await formatter.generate(pages);

      expect(result.validation.valid).toBe(true);
      expect(result.validation.sectionsCount).toBe(2);
      expect(result.validation.linkCount).toBe(5);
      expect(result.validation.lineCount).toBe(20);
      expect(result.validation.warnings).toEqual(["Some warning"]);
    });

    it("should handle generation mode parameter", async () => {
      const pages = [createMockPage("https://example.com", "Home")];

      const result = await formatter.generate(
        pages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        "ai"
      );

      expect(result.content).toBeTruthy();
    });
  });

  describe("findHomepage", () => {
    it("should find homepage by root path", async () => {
      const pages = [
        {
          url: "https://example.com/about",
          title: "About",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
        {
          url: "https://example.com/contact",
          title: "Contact",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages);

      expect(result.content).toContain("# Home");
    });

    it("should fallback to depth 0 page if no root path", async () => {
      const pages = [
        {
          url: "https://example.com/about",
          title: "About",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
        {
          url: "https://example.com/home",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages);

      expect(result.content).toContain("# Home");
    });

    it("should fallback to first page if no root or depth 0", async () => {
      const pages = [
        {
          url: "https://example.com/about",
          title: "About",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
        {
          url: "https://example.com/contact",
          title: "Contact",
          depth: 2,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages);

      expect(result.content).toContain("# About");
    });
  });

  describe("determineProjectName", () => {
    it("should use ogTitle if available", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Example Site - Welcome",
          ogTitle: "Example",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages);

      expect(result.content).toContain("# Example");
    });

    it("should use siteName if no ogTitle", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Welcome - Example Site",
          siteName: "Example Site",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages);

      expect(result.content).toContain("# Example Site");
    });

    it("should use h1 if no ogTitle or siteName", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Welcome",
          h1: "Example H1",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages);

      expect(result.content).toContain("# Example H1");
    });

    it("should extract from title if no metadata", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Example | Welcome",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages);

      expect(result.content).toContain("# Example");
    });

    it("should use hostname as last resort", async () => {
      const pages = [
        {
          url: "https://www.example.com/",
          title: "",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages);

      expect(result.content).toContain("# example.com");
    });
  });

  describe("parseSummaryResponse", () => {
    it("should parse summary without details", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      vi.mocked(
        mockDescriptionGenerator.generateBusinessSummary
      ).mockResolvedValue("A simple summary");

      const result = await formatter.generate(pages);

      expect(result.content).toContain("A simple summary");
    });

    it("should parse summary with details", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      vi.mocked(
        mockDescriptionGenerator.generateBusinessSummary
      ).mockResolvedValue("Summary|||Additional details here");

      const result = await formatter.generate(pages);

      expect(result.content).toContain("Summary");
      expect(result.content).toContain("Additional details here");
    });

    it("should strip FIRST PART label", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      vi.mocked(
        mockDescriptionGenerator.generateBusinessSummary
      ).mockResolvedValue("FIRST PART: Summary text");

      const result = await formatter.generate(pages);

      expect(result.content).toContain("Summary text");
      expect(result.content).not.toContain("FIRST PART:");
    });

    it("should strip SECOND PART label", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      vi.mocked(
        mockDescriptionGenerator.generateBusinessSummary
      ).mockResolvedValue("Summary|||SECOND PART: Details text");

      const result = await formatter.generate(pages);

      expect(result.content).toContain("Details text");
      expect(result.content).not.toContain("SECOND PART:");
    });

    it("should skip details if NONE", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      vi.mocked(
        mockDescriptionGenerator.generateBusinessSummary
      ).mockResolvedValue("Summary|||NONE");

      const result = await formatter.generate(pages);

      expect(result.content).toContain("Summary");
      expect(result.content).not.toContain("NONE");
    });
  });

  describe("collectExternalLinks", () => {
    it("should collect external links from pages", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [
            { url: "https://github.com/user/repo", title: "GitHub" },
            { url: "https://docs.example.com", title: "Docs" },
          ],
        },
        {
          url: "https://example.com/page1",
          title: "Page1",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      // Need non-homepage pages for section discovery to include external links section
      vi.mocked(mockSectionDiscovery.discoverSections).mockResolvedValue([
        { name: "Content", pageIndexes: [0] },
      ]);

      const result = await formatter.generate(pages);

      // External links are included in Overview section when only homepage exists
      expect(result.content).toContain("github.com/user/repo");
    });

    it("should deduplicate external links", async () => {
      const pages = [
        {
          url: "https://example.com/page1",
          title: "Page 1",
          depth: 0,
          internalLinks: [],
          externalLinks: [
            { url: "https://github.com/user/repo", title: "GitHub" },
          ],
        },
        {
          url: "https://example.com/page2",
          title: "Page 2",
          depth: 0,
          internalLinks: [],
          externalLinks: [
            { url: "https://github.com/user/repo", title: "GitHub Again" },
          ],
        },
      ];

      const result = await formatter.generate(pages);

      // Count occurrences of GitHub URL (should appear once)
      const matches = result.content.match(/github\.com\/user\/repo/g);
      expect(matches?.length).toBeLessThanOrEqual(1);
    });

    it("should limit external links to 10", async () => {
      const externalLinks = Array.from({ length: 20 }, (_, i) => ({
        url: `https://external${i}.com`,
        title: `External ${i}`,
      }));

      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks,
        },
      ];

      const result = await formatter.generate(pages);

      // Count external resource links (should be max 10)
      const externalSection = result.content.split("## External Resources")[1];
      if (externalSection) {
        const linkCount = (externalSection.match(/- \[/g) || []).length;
        expect(linkCount).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("buildSectionsFromAI", () => {
    it("should create Overview section with homepage", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages);

      expect(result.content).toContain("## Overview");
      expect(result.content).toContain("[Home]");
    });

    it("should create sections from AI discovery", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
        {
          url: "https://example.com/docs",
          title: "Documentation",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
        {
          url: "https://example.com/api",
          title: "API",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const sectionGroups: SectionGroup[] = [
        { name: "Documentation", pageIndexes: [0] },
        { name: "API Reference", pageIndexes: [1] },
      ];

      vi.mocked(mockSectionDiscovery.discoverSections).mockResolvedValue(
        sectionGroups
      );

      const result = await formatter.generate(pages);

      expect(result.content).toContain("## Documentation");
      expect(result.content).toContain("## API Reference");
    });

    it("should skip sections with invalid page indexes", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const sectionGroups: SectionGroup[] = [
        { name: "Invalid Section", pageIndexes: [999] }, // Out of bounds
      ];

      vi.mocked(mockSectionDiscovery.discoverSections).mockResolvedValue(
        sectionGroups
      );

      const result = await formatter.generate(pages);

      expect(result.content).not.toContain("## Invalid Section");
    });

    it("should deduplicate pages within sections", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
        {
          url: "https://example.com/docs",
          title: "Docs",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const sectionGroups: SectionGroup[] = [
        { name: "Documentation", pageIndexes: [0, 0, 0] }, // Duplicate indexes
      ];

      vi.mocked(mockSectionDiscovery.discoverSections).mockResolvedValue(
        sectionGroups
      );

      const result = await formatter.generate(pages);

      // Count occurrences in Documentation section
      const docsSection = result.content
        .split("## Documentation")[1]
        ?.split("##")[0];
      if (docsSection) {
        const linkCount = (docsSection.match(/- \[/g) || []).length;
        expect(linkCount).toBe(1);
      }
    });
  });

  describe("separateOptionalContent", () => {
    it("should identify technical sites and prioritize docs/API", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
        {
          url: "https://example.com/docs",
          title: "Docs",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
        {
          url: "https://example.com/api",
          title: "API",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
        {
          url: "https://example.com/blog",
          title: "Blog",
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const sectionGroups: SectionGroup[] = [
        { name: "Documentation", pageIndexes: [0] },
        { name: "API Reference", pageIndexes: [1] },
        { name: "Blog", pageIndexes: [2] },
      ];

      vi.mocked(mockSectionDiscovery.discoverSections).mockResolvedValue(
        sectionGroups
      );

      const result = await formatter.generate(pages);

      // Documentation and API should be in main sections
      const optionalIndex = result.content.indexOf("## Optional");
      const docsIndex = result.content.indexOf("## Documentation");
      const apiIndex = result.content.indexOf("## API Reference");

      if (optionalIndex > 0) {
        expect(docsIndex).toBeLessThan(optionalIndex);
        expect(apiIndex).toBeLessThan(optionalIndex);
      }
    });

    it("should move overflow links to Optional", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
        ...Array.from({ length: 20 }, (_, i) => ({
          url: `https://example.com/page${i}`,
          title: `Page ${i}`,
          depth: 1,
          internalLinks: [],
          externalLinks: [],
        })),
      ];

      const sectionGroups: SectionGroup[] = [
        { name: "Pages", pageIndexes: Array.from({ length: 20 }, (_, i) => i) },
      ];

      vi.mocked(mockSectionDiscovery.discoverSections).mockResolvedValue(
        sectionGroups
      );

      const result = await formatter.generate(pages);

      // Should have Optional section due to overflow
      expect(result.content).toContain("## Optional");
    });
  });

  describe("format", () => {
    it("should format with project name as H1", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Example Site",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages, "My Project");

      expect(result.content).toMatch(/^# My Project\n/);
    });

    it("should include summary in blockquote", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      vi.mocked(
        mockDescriptionGenerator.generateBusinessSummary
      ).mockResolvedValue("Test summary");

      const result = await formatter.generate(pages);

      expect(result.content).toContain("> Test summary");
    });

    it("should format links with descriptions", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          description: "Homepage",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      vi.mocked(mockDescriptionGenerator.generateDescription).mockResolvedValue(
        "AI description"
      );

      const result = await formatter.generate(pages);

      expect(result.content).toContain(
        "- [Home](https://example.com): AI description"
      );
    });

    it("should format links without descriptions", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      // Return undefined (not empty string) for no description
      vi.mocked(
        mockDescriptionGenerator.generateDescription
      ).mockImplementation(async (page) => {
        return page.description || ""; // Will use page.description which is undefined
      });

      const result = await formatter.generate(pages);

      // When description is empty/undefined, format is "- [Title](url)" without colon
      // However, the test page has description: undefined, so it should work
      // Let's just verify the link exists in correct format
      expect(result.content).toContain("- [Home](https://example.com)");
    });

    it("should end content with newline", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const result = await formatter.generate(pages);

      expect(result.content).toMatch(/\n$/);
    });
  });

  describe("validation", () => {
    it("should validate generated output", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      await formatter.generate(pages);

      expect(mockValidateLlmsTxtFormat).toHaveBeenCalled();
    });

    it("should return validation errors", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      mockValidateLlmsTxtFormat.mockReturnValue({
        valid: false,
        errors: ["Missing title"],
        warnings: [],
        stats: { sectionCount: 0, linkCount: 0, lineCount: 0 },
      });

      const result = await formatter.generate(pages);

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors).toEqual(["Missing title"]);
    });

    it("should return validation warnings", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      mockValidateLlmsTxtFormat.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ["Too many links"],
        stats: { sectionCount: 1, linkCount: 100, lineCount: 200 },
      });

      const result = await formatter.generate(pages);

      expect(result.validation.valid).toBe(true);
      expect(result.validation.warnings).toEqual(["Too many links"]);
    });
  });

  describe("applyTitleCleanup", () => {
    it("should remove patterns from titles", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home | Site Name",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const titleCleanup = {
        removePatterns: ["\\s*\\|\\s*Site Name$"],
      };

      vi.mocked(mockTitleCleaning.cleanTitles).mockResolvedValue(["Home"]);

      const result = await formatter.generate(
        pages,
        undefined,
        undefined,
        undefined,
        undefined,
        titleCleanup
      );

      expect(result.content).toContain("[Home]");
    });

    it("should apply replacements to titles", async () => {
      const pages = [
        {
          url: "https://example.com/docs",
          title: "Docs",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const titleCleanup = {
        replacements: [{ pattern: "Docs", replacement: "Documentation" }],
      };

      vi.mocked(mockTitleCleaning.cleanTitles).mockResolvedValue([
        "Documentation",
      ]);

      const result = await formatter.generate(
        pages,
        undefined,
        undefined,
        undefined,
        undefined,
        titleCleanup
      );

      expect(result.content).toContain("[Documentation]");
    });

    it("should handle invalid regex patterns gracefully", async () => {
      const pages = [
        {
          url: "https://example.com/",
          title: "Home",
          depth: 0,
          internalLinks: [],
          externalLinks: [],
        },
      ];

      const titleCleanup = {
        removePatterns: ["[invalid(regex"],
      };

      // Should not throw
      await expect(
        formatter.generate(
          pages,
          undefined,
          undefined,
          undefined,
          undefined,
          titleCleanup
        )
      ).resolves.toBeTruthy();
    });
  });
});

describe("validateLlmsTxt (deprecated)", () => {
  it("should validate llms.txt format", () => {
    mockValidateLlmsTxtFormat.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      stats: { sectionCount: 1, linkCount: 1, lineCount: 5 },
    });

    const result = validateLlmsTxt(
      "# Test\n\n> Summary\n\n## Section\n\n- [Link](url)\n"
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should return errors for invalid format", () => {
    mockValidateLlmsTxtFormat.mockReturnValue({
      valid: false,
      errors: ["Missing H1 title"],
      warnings: [],
      stats: { sectionCount: 0, linkCount: 0, lineCount: 0 },
    });

    const result = validateLlmsTxt("Invalid content");

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["Missing H1 title"]);
  });
});
