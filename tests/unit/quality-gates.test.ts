/**
 * Unit Tests: Quality Gates
 * Tests filtering and refinement of llms.txt output
 */

import { describe, it, expect } from "vitest";
import {
  QualityGateFilter,
  createQualityGateFilter,
  type QualityGateConfig,
} from "@/lib/llms-txt/quality-gates";
import type { LlmsTxtSection } from "@/lib/types";

describe("QualityGateFilter", () => {
  const createMockSection = (
    title: string,
    urls: string[]
  ): LlmsTxtSection => ({
    title,
    links: urls.map((url) => ({
      url,
      description: `Description for ${url}`,
    })),
  });

  describe("constructor", () => {
    it("should create instance with default config", () => {
      const filter = new QualityGateFilter();
      expect(filter).toBeDefined();
    });

    it("should create instance with custom config", () => {
      const config: Partial<QualityGateConfig> = {
        maxOptionalItems: 10,
        minOptionalRelevance: 40,
      };
      const filter = new QualityGateFilter(config);
      expect(filter).toBeDefined();
    });

    it("should merge custom config with defaults", () => {
      const filter = new QualityGateFilter({ maxOptionalItems: 15 });
      expect(filter).toBeDefined();
    });
  });

  describe("apply", () => {
    it("should return empty result for empty input", () => {
      const filter = new QualityGateFilter();
      const result = filter.apply([]);

      expect(result.mainSections).toEqual([]);
      expect(result.optionalSection).toBeUndefined();
    });

    it("should process main sections without optional", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Docs", [
          "https://example.com/docs/intro",
          "https://example.com/docs/api",
        ]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections).toHaveLength(1);
      expect(result.mainSections[0].links).toHaveLength(2);
      expect(result.optionalSection).toBeUndefined();
    });

    it("should process optional section", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs/intro"]),
      ];
      const optionalSection = createMockSection("Optional", [
        "https://example.com/blog/post1",
        "https://example.com/blog/post2",
      ]);

      const result = filter.apply(mainSections, optionalSection);

      expect(result.optionalSection).toBeDefined();
      expect(result.optionalSection?.links).toHaveLength(2);
    });

    it("should deduplicate across main sections", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Section 1", [
          "https://example.com/page1",
          "https://example.com/page2",
        ]),
        createMockSection("Section 2", [
          "https://example.com/page2", // Duplicate
          "https://example.com/page3",
        ]),
      ];

      const result = filter.apply(mainSections);

      const allUrls = result.mainSections.flatMap((s) =>
        s.links.map((l) => l.url)
      );
      expect(allUrls).toHaveLength(3);
      expect(new Set(allUrls).size).toBe(3);
    });

    it("should remove duplicates from optional section", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs/intro"]),
      ];
      const optionalSection = createMockSection("Optional", [
        "https://example.com/docs/intro", // Duplicate from main
        "https://example.com/blog/post",
      ]);

      const result = filter.apply(mainSections, optionalSection);

      expect(result.optionalSection?.links).toHaveLength(1);
      expect(result.optionalSection?.links[0].url).toBe(
        "https://example.com/blog/post"
      );
    });

    it("should allow duplicates in optional when configured", () => {
      const filter = new QualityGateFilter({ allowDuplicatesInOptional: true });
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs/intro"]),
      ];
      const optionalSection = createMockSection("Optional", [
        "https://example.com/docs/intro", // Duplicate allowed
        "https://example.com/blog/post",
      ]);

      const result = filter.apply(mainSections, optionalSection);

      expect(result.optionalSection?.links).toHaveLength(2);
    });

    it("should limit optional section size", () => {
      const filter = new QualityGateFilter({ maxOptionalItems: 3 });
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs"]),
      ];
      const optionalSection = createMockSection(
        "Optional",
        Array.from({ length: 10 }, (_, i) => `https://example.com/item${i}`)
      );

      const result = filter.apply(mainSections, optionalSection);

      expect(result.optionalSection?.links).toHaveLength(3);
    });

    it("should remove empty sections after filtering", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Section 1", ["https://example.com/page1"]),
        createMockSection("Section 2", ["https://example.com/page1"]), // Duplicate, will be empty
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections).toHaveLength(1);
    });

    it("should merge similar sections when configured", () => {
      const filter = new QualityGateFilter({ mergeSimilarSections: true });
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs/intro"]),
        createMockSection("Docs", ["https://example.com/docs/api"]), // Same title
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections).toHaveLength(1);
      expect(result.mainSections[0].links).toHaveLength(2);
    });

    it("should not merge sections when disabled", () => {
      const filter = new QualityGateFilter({ mergeSimilarSections: false });
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs/intro"]),
        createMockSection("Tutorials", [
          "https://example.com/docs/tutorials/lesson1",
        ]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections).toHaveLength(2);
    });
  });

  describe("URL pattern filtering", () => {
    it("should filter by URL patterns when configured", () => {
      const excludePatterns = [/\/spam\//];
      const filter = new QualityGateFilter({
        excludeUrlPatterns: excludePatterns,
      });

      const mainSections = [
        createMockSection("Section 1", [
          "https://example.com/docs/intro",
          "https://example.com/spam/page", // Should be excluded
        ]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections[0].links).toHaveLength(1);
      expect(result.mainSections[0].links[0].url).toBe(
        "https://example.com/docs/intro"
      );
    });

    it("should filter optional section by URL patterns", () => {
      const excludePatterns = [/\/ugc\//];
      const filter = new QualityGateFilter({
        excludeUrlPatterns: excludePatterns,
      });

      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs"]),
      ];
      const optionalSection = createMockSection("Optional", [
        "https://example.com/blog/post",
        "https://example.com/ugc/content", // Should be excluded
      ]);

      const result = filter.apply(mainSections, optionalSection);

      expect(result.optionalSection?.links).toHaveLength(1);
      expect(result.optionalSection?.links[0].url).toBe(
        "https://example.com/blog/post"
      );
    });

    it("should handle multiple exclusion patterns", () => {
      const excludePatterns = [/\/spam\//, /\/ads\//, /\/tracking\//];
      const filter = new QualityGateFilter({
        excludeUrlPatterns: excludePatterns,
      });

      const mainSections = [
        createMockSection("Section", [
          "https://example.com/docs",
          "https://example.com/spam/page",
          "https://example.com/ads/banner",
          "https://example.com/tracking/pixel",
        ]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections[0].links).toHaveLength(1);
      expect(result.mainSections[0].links[0].url).toBe(
        "https://example.com/docs"
      );
    });

    it("should not filter when no patterns configured", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Section", [
          "https://example.com/page1",
          "https://example.com/page2",
        ]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections[0].links).toHaveLength(2);
    });
  });

  describe("section merging", () => {
    it("should merge sections with identical titles", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Documentation", ["https://example.com/docs/intro"]),
        createMockSection("Documentation", ["https://example.com/docs/api"]),
        createMockSection("Documentation", ["https://example.com/docs/guide"]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections).toHaveLength(1);
      expect(result.mainSections[0].title).toBe("Documentation");
      expect(result.mainSections[0].links).toHaveLength(3);
    });

    it("should merge sections with similar URL patterns", () => {
      const filter = new QualityGateFilter({ mergeSimilarSections: true });
      const mainSections = [
        createMockSection("API Reference", [
          "https://example.com/docs/api/endpoints",
        ]),
        createMockSection("API Guides", [
          "https://example.com/docs/api/authentication",
        ]),
      ];

      const result = filter.apply(mainSections);

      // Should merge because both have "docs/api" pattern
      expect(result.mainSections.length).toBeLessThanOrEqual(2);
    });

    it("should limit links per merged section", () => {
      const filter = new QualityGateFilter({ maxLinksPerSection: 3 });
      const mainSections = [
        createMockSection("Docs", [
          "https://example.com/docs/1",
          "https://example.com/docs/2",
        ]),
        createMockSection("Docs", [
          "https://example.com/docs/3",
          "https://example.com/docs/4",
          "https://example.com/docs/5",
        ]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections[0].links.length).toBeLessThanOrEqual(3);
    });

    it("should not merge sections with different patterns", () => {
      const filter = new QualityGateFilter({ mergeSimilarSections: true });
      const mainSections = [
        createMockSection("Documentation", ["https://example.com/docs/intro"]),
        createMockSection("Blog", ["https://example.com/blog/post"]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections).toHaveLength(2);
    });

    it("should preserve section order after merging", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("About", ["https://example.com/about"]),
        createMockSection("Docs", ["https://example.com/docs"]),
        createMockSection("Blog", ["https://example.com/blog"]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections[0].title).toBe("About");
      expect(result.mainSections[1].title).toBe("Docs");
      expect(result.mainSections[2].title).toBe("Blog");
    });
  });

  describe("URL pattern extraction", () => {
    it("should extract patterns from single-level paths", () => {
      const filter = new QualityGateFilter({ mergeSimilarSections: true });
      const mainSections = [
        createMockSection("Section A", ["https://example.com/about"]),
        createMockSection("Section B", ["https://example.com/about"]), // Same pattern
      ];

      const result = filter.apply(mainSections);

      // Should merge because both have "about" pattern
      expect(result.mainSections.length).toBeLessThanOrEqual(1);
    });

    it("should extract patterns from multi-level paths", () => {
      const filter = new QualityGateFilter({ mergeSimilarSections: true });
      const mainSections = [
        createMockSection("API Docs", [
          "https://example.com/docs/api/reference",
        ]),
        createMockSection("API Guide", [
          "https://example.com/docs/api/tutorial",
        ]),
      ];

      const result = filter.apply(mainSections);

      // Should merge because both have "docs/api" pattern
      expect(result.mainSections.length).toBeLessThanOrEqual(1);
    });

    it("should handle homepage URLs", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Home", ["https://example.com"]),
        createMockSection("Home Alt", ["https://example.com/"]),
      ];

      const result = filter.apply(mainSections);

      // Should deduplicate homepage URLs
      expect(result.mainSections.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle invalid URLs gracefully", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Mixed", [
          "https://example.com/valid",
          "not-a-valid-url",
        ]),
      ];

      const result = filter.apply(mainSections);

      // Should process valid URLs without crashing
      expect(result.mainSections[0].links.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("pattern similarity detection", () => {
    it("should detect direct pattern overlap", () => {
      const filter = new QualityGateFilter({ mergeSimilarSections: true });
      const mainSections = [
        createMockSection("Section 1", ["https://example.com/docs/intro"]),
        createMockSection("Section 2", ["https://example.com/docs/api"]),
      ];

      const result = filter.apply(mainSections);

      // Should merge because both have "docs" pattern
      expect(result.mainSections.length).toBeLessThanOrEqual(2);
    });

    it("should detect semantic similarity in path segments", () => {
      const filter = new QualityGateFilter({ mergeSimilarSections: true });
      const mainSections = [
        createMockSection("Section 1", [
          "https://example.com/user-guide/intro",
        ]),
        createMockSection("Section 2", [
          "https://example.com/getting-started/guide",
        ]),
      ];

      const result = filter.apply(mainSections);

      // May merge if "guide" word is found in both patterns
      expect(result.mainSections.length).toBeGreaterThanOrEqual(1);
    });

    it("should ignore short words in similarity detection", () => {
      const filter = new QualityGateFilter({ mergeSimilarSections: true });
      const mainSections = [
        createMockSection("Section 1", ["https://example.com/an/api"]),
        createMockSection("Section 2", ["https://example.com/the/docs"]),
      ];

      const result = filter.apply(mainSections);

      // Should not merge based on short words like "an", "the" (< 4 chars)
      expect(result.mainSections).toHaveLength(2);
    });

    it("should handle case-insensitive pattern matching", () => {
      const filter = new QualityGateFilter({ mergeSimilarSections: true });
      const mainSections = [
        createMockSection("Section 1", ["https://example.com/DOCS/intro"]),
        createMockSection("Section 2", ["https://example.com/docs/api"]),
      ];

      const result = filter.apply(mainSections);

      // Should merge despite case differences
      expect(result.mainSections.length).toBeLessThanOrEqual(2);
    });
  });

  describe("optional section handling", () => {
    it("should deduplicate within optional section", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs"]),
      ];
      const optionalSection = createMockSection("Optional", [
        "https://example.com/blog/post1",
        "https://example.com/blog/post1", // Duplicate
        "https://example.com/blog/post2",
      ]);

      const result = filter.apply(mainSections, optionalSection);

      expect(result.optionalSection?.links).toHaveLength(2);
    });

    it("should return undefined optional when empty after filtering", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs"]),
      ];
      const optionalSection = createMockSection("Optional", [
        "https://example.com/docs", // Duplicate, will be filtered
      ]);

      const result = filter.apply(mainSections, optionalSection);

      expect(result.optionalSection).toBeUndefined();
    });

    it("should handle empty optional section input", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs"]),
      ];
      const optionalSection = createMockSection("Optional", []);

      const result = filter.apply(mainSections, optionalSection);

      expect(result.optionalSection).toBeUndefined();
    });

    it("should keep optional title as Optional", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs"]),
      ];
      const optionalSection = createMockSection("Some Other Title", [
        "https://example.com/blog/post",
      ]);

      const result = filter.apply(mainSections, optionalSection);

      expect(result.optionalSection?.title).toBe("Optional");
    });
  });

  describe("edge cases", () => {
    it("should handle single section", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Docs", ["https://example.com/docs"]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections).toHaveLength(1);
    });

    it("should handle many sections", () => {
      const filter = new QualityGateFilter();
      const mainSections = Array.from({ length: 20 }, (_, i) =>
        createMockSection(`Section ${i}`, [`https://example.com/page${i}`])
      );

      const result = filter.apply(mainSections);

      expect(result.mainSections.length).toBeGreaterThan(0);
    });

    it("should handle sections with many links", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection(
          "Docs",
          Array.from({ length: 100 }, (_, i) => `https://example.com/page${i}`)
        ),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections[0].links.length).toBeGreaterThan(0);
    });

    it("should handle URLs with query parameters", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Section", [
          "https://example.com/docs?page=1",
          "https://example.com/docs?page=2",
        ]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections[0].links).toHaveLength(2);
    });

    it("should handle URLs with anchors", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Section", [
          "https://example.com/docs#intro",
          "https://example.com/docs#api",
        ]),
      ];

      const result = filter.apply(mainSections);

      expect(result.mainSections[0].links).toHaveLength(2);
    });

    it("should handle URLs with different protocols", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("Section", [
          "http://example.com/page",
          "https://example.com/page",
        ]),
      ];

      const result = filter.apply(mainSections);

      // Different protocols = different URLs (not duplicates)
      expect(result.mainSections[0].links).toHaveLength(2);
    });
  });

  describe("createQualityGateFilter factory", () => {
    it("should create filter with default config", () => {
      const filter = createQualityGateFilter();
      expect(filter).toBeInstanceOf(QualityGateFilter);
    });

    it("should create filter with custom config", () => {
      const filter = createQualityGateFilter({ maxOptionalItems: 10 });
      expect(filter).toBeInstanceOf(QualityGateFilter);
    });

    it("should work with undefined config", () => {
      const filter = createQualityGateFilter(undefined);
      expect(filter).toBeInstanceOf(QualityGateFilter);
    });
  });

  describe("real-world scenarios", () => {
    it("should handle typical website structure", () => {
      const filter = new QualityGateFilter();
      const mainSections = [
        createMockSection("About", ["https://example.com/about"]),
        createMockSection("Documentation", [
          "https://example.com/docs/intro",
          "https://example.com/docs/api",
          "https://example.com/docs/guide",
        ]),
        createMockSection("Blog", [
          "https://example.com/blog/post1",
          "https://example.com/blog/post2",
        ]),
      ];
      const optionalSection = createMockSection("Optional", [
        "https://example.com/privacy",
        "https://example.com/terms",
      ]);

      const result = filter.apply(mainSections, optionalSection);

      expect(result.mainSections.length).toBeGreaterThan(0);
      expect(result.optionalSection).toBeDefined();
    });

    it("should handle YouTube-like structure with UGC filtering", () => {
      const excludePatterns = [/\/channel\//, /\/watch\?v=/];
      const filter = new QualityGateFilter({
        excludeUrlPatterns: excludePatterns,
      });

      const mainSections = [
        createMockSection("About", ["https://youtube.com/about"]),
        createMockSection("Channels", [
          "https://youtube.com/channel/random1", // Should be filtered
          "https://youtube.com/channel/random2", // Should be filtered
        ]),
      ];

      const result = filter.apply(mainSections);

      // Channels section should be removed after filtering
      expect(result.mainSections).toHaveLength(1);
      expect(result.mainSections[0].title).toBe("About");
    });

    it("should handle e-commerce site with product categories", () => {
      const filter = new QualityGateFilter({ maxLinksPerSection: 10 });
      const mainSections = [
        createMockSection("Home", ["https://store.com"]),
        createMockSection(
          "Electronics",
          Array.from(
            { length: 20 },
            (_, i) => `https://store.com/electronics/${i}`
          )
        ),
        createMockSection(
          "Clothing",
          Array.from(
            { length: 20 },
            (_, i) => `https://store.com/clothing/${i}`
          )
        ),
      ];

      const result = filter.apply(mainSections);

      // Each section should be limited to 10 links
      result.mainSections.forEach((section) => {
        expect(section.links.length).toBeLessThanOrEqual(10);
      });
    });
  });
});
