/**
 * Unit Tests: Generic Section Discovery
 * Tests last-resort fallback that groups all pages into single section
 */

import { describe, it, expect, vi } from "vitest";
import { GenericSectionDiscovery } from "@/lib/content-generation/providers/deterministic/generic-section-discovery";
import type { PageMetadata } from "@/lib/types";

describe("GenericSectionDiscovery", () => {
  const discovery = new GenericSectionDiscovery();

  const createMockPage = (url: string): PageMetadata => ({
    url,
    title: "Test Page",
    description: "",
    ogDescription: "",
    ogTitle: "",
    ogType: "",
    h1: "",
    siteName: "",
    lang: "en",
    bodyText: "",
    depth: 0,
    internalLinks: [],
    externalLinks: [],
  });

  describe("isAvailable", () => {
    it("should always be available as last resort", () => {
      expect(discovery.isAvailable()).toBe(true);
    });
  });

  describe("discoverSections", () => {
    it("should create single Pages section for single page", async () => {
      const pages = [createMockPage("https://example.com")];

      const sections = await discovery.discoverSections(pages);

      expect(sections).toHaveLength(1);
      expect(sections[0].name).toBe("Pages");
      expect(sections[0].pageIndexes).toEqual([0]);
    });

    it("should group all pages into single section", async () => {
      const pages = [
        createMockPage("https://example.com"),
        createMockPage("https://example.com/about"),
        createMockPage("https://example.com/docs"),
        createMockPage("https://example.com/blog"),
      ];

      const sections = await discovery.discoverSections(pages);

      expect(sections).toHaveLength(1);
      expect(sections[0].name).toBe("Pages");
      expect(sections[0].pageIndexes).toEqual([0, 1, 2, 3]);
    });

    it("should handle empty pages array", async () => {
      const pages: PageMetadata[] = [];

      const sections = await discovery.discoverSections(pages);

      expect(sections).toHaveLength(1);
      expect(sections[0].name).toBe("Pages");
      expect(sections[0].pageIndexes).toEqual([]);
    });

    it("should preserve page order in indexes", async () => {
      const pages = [
        createMockPage("https://example.com/z"),
        createMockPage("https://example.com/a"),
        createMockPage("https://example.com/m"),
      ];

      const sections = await discovery.discoverSections(pages);

      // Should maintain input order (z, a, m) not sort alphabetically
      expect(sections[0].pageIndexes).toEqual([0, 1, 2]);
    });

    it("should log when used", async () => {
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const pages = [
        createMockPage("https://example.com"),
        createMockPage("https://example.com/about"),
      ];

      await discovery.discoverSections(pages);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[GenericSectionDiscovery] Using last resort: single "Pages" section with 2 pages'
      );

      consoleLogSpy.mockRestore();
    });

    it("should handle large number of pages", async () => {
      const pages = Array.from({ length: 100 }, (_, i) =>
        createMockPage(`https://example.com/page${i}`)
      );

      const sections = await discovery.discoverSections(pages);

      expect(sections).toHaveLength(1);
      expect(sections[0].pageIndexes).toHaveLength(100);
      expect(sections[0].pageIndexes).toEqual(
        Array.from({ length: 100 }, (_, i) => i)
      );
    });

    it("should not use metadata accumulator", async () => {
      const pages = [createMockPage("https://example.com")];
      const mockAccumulator = {
        addApiCall: vi.fn(),
        getAggregated: vi.fn(),
        hasData: vi.fn(),
      };

      await discovery.discoverSections(
        pages,
        mockAccumulator as Parameters<typeof discovery.discoverSections>[1]
      );

      // Should not call any methods on accumulator (no AI used)
      expect(mockAccumulator.addApiCall).not.toHaveBeenCalled();
    });
  });

  describe("real-world scenarios", () => {
    it("should be used as last resort when AI fails", async () => {
      // Simulates chained service falling back to generic after AI rate limit
      const pages = [
        createMockPage("https://example.com"),
        createMockPage("https://example.com/docs"),
        createMockPage("https://example.com/api"),
      ];

      const sections = await discovery.discoverSections(pages);

      // All pages grouped together
      expect(sections[0].pageIndexes).toHaveLength(3);
    });

    it("should work with diverse page types", async () => {
      const pages = [
        createMockPage("https://example.com"),
        createMockPage("https://example.com/docs/api"),
        createMockPage("https://example.com/blog/post-1"),
        createMockPage("https://example.com/about/team"),
        createMockPage("https://example.com/products/widgets"),
      ];

      const sections = await discovery.discoverSections(pages);

      // Doesn't try to categorize - just groups all
      expect(sections[0].pageIndexes).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
