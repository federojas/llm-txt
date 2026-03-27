/**
 * Unit Tests: URL Structure Section Discovery
 * Tests deterministic section discovery from URL path structure
 */

import { describe, it, expect } from "vitest";
import { UrlStructureSectionDiscovery } from "@/lib/content-generation/providers/deterministic/url-structure-section-discovery";
import type { PageMetadata } from "@/lib/types";

describe("UrlStructureSectionDiscovery", () => {
  const createMockPage = (
    url: string,
    relevanceScore?: number
  ): PageMetadata => ({
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
    relevanceScore,
  });

  describe("isAvailable", () => {
    it("should always be available", () => {
      const discovery = new UrlStructureSectionDiscovery();
      expect(discovery.isAvailable()).toBe(true);
    });
  });

  describe("discoverSections", () => {
    describe("basic grouping", () => {
      it("should group pages by first-level path segment", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/docs/intro", 80),
          createMockPage("https://example.com/docs/api", 80),
          createMockPage("https://example.com/blog/post1", 70),
          createMockPage("https://example.com/blog/post2", 70),
        ];

        const sections = await discovery.discoverSections(pages);

        expect(sections).toHaveLength(2);
        expect(sections.find((s) => s.name === "Docs")).toBeDefined();
        expect(sections.find((s) => s.name === "Blog")).toBeDefined();
      });

      it("should handle homepage", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com", 90),
          createMockPage("https://example.com/", 90),
        ];

        const sections = await discovery.discoverSections(pages);

        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Overview");
        expect(sections[0].pageIndexes).toHaveLength(2);
      });

      it("should create separate section for each first-level segment", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/about", 80),
          createMockPage("https://example.com/pricing", 80),
          createMockPage("https://example.com/contact", 80),
        ];

        const sections = await discovery.discoverSections(pages);

        expect(sections).toHaveLength(3);
        expect(sections.map((s) => s.name).sort()).toEqual([
          "About",
          "Contact",
          "Pricing",
        ]);
      });
    });

    describe("subsection detection (2-level grouping)", () => {
      it("should create subsections for large first-level sections", async () => {
        const discovery = new UrlStructureSectionDiscovery();

        // Create 15+ /docs/* pages to trigger 2-level grouping
        const docsPages = Array.from({ length: 8 }, (_, i) =>
          createMockPage(`https://example.com/docs/api/endpoint${i}`, 80)
        );
        const tutorialPages = Array.from({ length: 8 }, (_, i) =>
          createMockPage(`https://example.com/docs/tutorials/lesson${i}`, 75)
        );

        const pages = [...docsPages, ...tutorialPages];

        const sections = await discovery.discoverSections(pages);

        // Should have 2 subsections: /docs/api/ and /docs/tutorials/
        expect(sections).toHaveLength(2);
        expect(sections.find((s) => s.name === "API")).toBeDefined();
        expect(sections.find((s) => s.name === "Tutorials")).toBeDefined();
      });

      it("should not create subsections for small sections", async () => {
        const discovery = new UrlStructureSectionDiscovery();

        // Only 5 /docs/* pages (below 15 threshold)
        const pages = [
          createMockPage("https://example.com/docs/api/v1", 80),
          createMockPage("https://example.com/docs/api/v2", 80),
          createMockPage("https://example.com/docs/tutorials/intro", 75),
          createMockPage("https://example.com/docs/tutorials/advanced", 75),
          createMockPage("https://example.com/docs/faq", 70),
        ];

        const sections = await discovery.discoverSections(pages);

        // Should group all under /docs/ (not create subsections)
        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Docs");
        expect(sections[0].pageIndexes).toHaveLength(5);
      });

      it("should not create subsections for date-based paths", async () => {
        const discovery = new UrlStructureSectionDiscovery();

        // 20 blog posts with date paths
        const pages = Array.from({ length: 20 }, (_, i) =>
          createMockPage(`https://example.com/blog/2024/post${i}`, 70)
        );

        const sections = await discovery.discoverSections(pages);

        // Should group all under /blog/ (not /blog/2024/ subsection)
        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Blog");
        expect(sections[0].pageIndexes).toHaveLength(20);
      });

      it("should not create subsections for version paths", async () => {
        const discovery = new UrlStructureSectionDiscovery();

        // 20 API docs with version paths
        const pages = Array.from({ length: 20 }, (_, i) =>
          createMockPage(`https://example.com/api/v1/endpoint${i}`, 80)
        );

        const sections = await discovery.discoverSections(pages);

        // Should group all under /api/ (not /api/v1/ subsection)
        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("API");
      });

      it("should not create subsections for ID-based paths", async () => {
        const discovery = new UrlStructureSectionDiscovery();

        // 20 user profiles with ID paths
        const pages = Array.from({ length: 20 }, (_, i) =>
          createMockPage(
            `https://example.com/users/abc123def${i.toString().padStart(3, "0")}`,
            40
          )
        );

        const sections = await discovery.discoverSections(pages);

        // Should group all under /users/ (not create ID-based subsections)
        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Users");
      });
    });

    describe("relevance score filtering", () => {
      it("should filter sections with low average relevance", async () => {
        const discovery = new UrlStructureSectionDiscovery(10, 30); // minAvgRelevance=30
        const pages = [
          createMockPage("https://example.com/docs/intro", 80),
          createMockPage("https://example.com/docs/api", 80),
          createMockPage("https://example.com/spam/page1", 10),
          createMockPage("https://example.com/spam/page2", 15),
        ];

        const sections = await discovery.discoverSections(pages);

        // Should only have "docs" section (spam filtered by low relevance)
        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Docs");
      });

      it("should accept single-page sections with high relevance", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/about", 85), // High relevance
          createMockPage("https://example.com/docs/intro", 80),
        ];

        const sections = await discovery.discoverSections(pages);

        // Both sections should be present
        expect(sections).toHaveLength(2);
        expect(sections.find((s) => s.name === "About")).toBeDefined();
        expect(sections.find((s) => s.name === "Docs")).toBeDefined();
      });

      it("should filter single-page sections with low relevance", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/docs/intro", 80),
          createMockPage("https://example.com/random", 40), // Low relevance, single page
        ];

        const sections = await discovery.discoverSections(pages);

        // Only "docs" should remain
        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Docs");
      });

      it("should use default relevance score of 50 when not provided", async () => {
        const discovery = new UrlStructureSectionDiscovery(10, 30);
        const pages = [
          createMockPage("https://example.com/docs/intro"), // No score
          createMockPage("https://example.com/docs/api"), // No score
        ];

        const sections = await discovery.discoverSections(pages);

        // Default score 50 > minAvgRelevance 30, so section should be included
        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Docs");
      });
    });

    describe("UGC detection", () => {
      it("should filter sections with many pages and low relevance (UGC)", async () => {
        const discovery = new UrlStructureSectionDiscovery(10, 30, 15); // ugcThreshold=15
        const pages = [
          createMockPage("https://example.com/docs/intro", 80),
          // 20 channel pages with low relevance (UGC)
          ...Array.from({ length: 20 }, (_, i) =>
            createMockPage(`https://example.com/channel/user${i}`, 10)
          ),
        ];

        const sections = await discovery.discoverSections(pages);

        // Only "docs" should remain (channels filtered as UGC)
        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Docs");
      });

      it("should not filter sections with many pages and moderate relevance", async () => {
        const discovery = new UrlStructureSectionDiscovery(10, 30, 15);
        const pages = [
          // 20 product pages with moderate relevance (not UGC)
          // Using numeric IDs to avoid 2-level grouping
          ...Array.from({ length: 20 }, (_, i) =>
            createMockPage(`https://example.com/products/${i}`, 60)
          ),
        ];

        const sections = await discovery.discoverSections(pages);

        // Products section should be present (not UGC)
        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Products");
      });

      it("should not filter small sections with low relevance as UGC", async () => {
        const discovery = new UrlStructureSectionDiscovery(10, 30, 15);
        const pages = [
          createMockPage("https://example.com/docs/intro", 80),
          // Only 5 pages (below UGC threshold)
          ...Array.from({ length: 5 }, (_, i) =>
            createMockPage(`https://example.com/users/user${i}`, 35)
          ),
        ];

        const sections = await discovery.discoverSections(pages);

        // Both sections should be present (users not flagged as UGC due to low count)
        expect(sections).toHaveLength(2);
      });
    });

    describe("section sorting", () => {
      it("should sort sections by relevance score (highest first)", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/docs/intro", 90),
          createMockPage("https://example.com/docs/api", 90),
          createMockPage("https://example.com/blog/post1", 50),
          createMockPage("https://example.com/blog/post2", 50),
          createMockPage("https://example.com/about", 70),
        ];

        const sections = await discovery.discoverSections(pages);

        // Order: docs (90), about (70), blog (50)
        expect(sections[0].name).toBe("Docs");
        expect(sections[1].name).toBe("About");
        expect(sections[2].name).toBe("Blog");
      });

      it("should sort by page count when relevance is similar", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/docs/intro", 80),
          createMockPage("https://example.com/docs/api", 80),
          createMockPage("https://example.com/docs/guide", 80),
          createMockPage("https://example.com/blog/post", 82), // Similar relevance, fewer pages
        ];

        const sections = await discovery.discoverSections(pages);

        // docs (3 pages) should come before blog (1 page)
        expect(sections[0].name).toBe("Docs");
        expect(sections[1].name).toBe("Blog");
      });
    });

    describe("section limit", () => {
      it("should limit number of sections", async () => {
        const discovery = new UrlStructureSectionDiscovery(3); // maxSections=3
        const pages = [
          createMockPage("https://example.com/section1/page", 80),
          createMockPage("https://example.com/section2/page", 75),
          createMockPage("https://example.com/section3/page", 70),
          createMockPage("https://example.com/section4/page", 65),
          createMockPage("https://example.com/section5/page", 60),
        ];

        const sections = await discovery.discoverSections(pages);

        // Only top 3 sections by relevance
        expect(sections).toHaveLength(3);
      });
    });

    describe("section naming", () => {
      it("should derive title case names from path segments", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/credit-cards/overview", 80),
          createMockPage("https://example.com/auto-loans/intro", 80),
          createMockPage("https://example.com/api-docs/reference", 80),
        ];

        const sections = await discovery.discoverSections(pages);

        expect(sections.map((s) => s.name).sort()).toEqual([
          "Api Docs",
          "Auto Loans",
          "Credit Cards",
        ]);
      });

      it("should uppercase known acronyms", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/api/endpoint", 80),
          createMockPage("https://example.com/faq/question", 80),
          createMockPage("https://example.com/sdk/install", 80),
        ];

        const sections = await discovery.discoverSections(pages);

        expect(sections.map((s) => s.name).sort()).toEqual([
          "API",
          "FAQ",
          "SDK",
        ]);
      });

      it("should name subsections under docs correctly", async () => {
        const discovery = new UrlStructureSectionDiscovery();

        // 16 pages to trigger 2-level grouping
        const pages = [
          ...Array.from({ length: 8 }, (_, i) =>
            createMockPage(`https://example.com/docs/api/page${i}`, 80)
          ),
          ...Array.from({ length: 8 }, (_, i) =>
            createMockPage(`https://example.com/docs/tutorials/page${i}`, 75)
          ),
        ];

        const sections = await discovery.discoverSections(pages);

        // Should use child segment name (not "Docs - API")
        expect(sections.find((s) => s.name === "API")).toBeDefined();
        expect(sections.find((s) => s.name === "Tutorials")).toBeDefined();
      });

      it("should name non-docs subsections with parent and child", async () => {
        const discovery = new UrlStructureSectionDiscovery();

        // 16 products pages to trigger 2-level grouping
        const pages = [
          ...Array.from({ length: 8 }, (_, i) =>
            createMockPage(
              `https://example.com/products/electronics/item${i}`,
              80
            )
          ),
          ...Array.from({ length: 8 }, (_, i) =>
            createMockPage(
              `https://example.com/products/furniture/item${i}`,
              75
            )
          ),
        ];

        const sections = await discovery.discoverSections(pages);

        expect(
          sections.find((s) => s.name === "Products - Electronics")
        ).toBeDefined();
        expect(
          sections.find((s) => s.name === "Products - Furniture")
        ).toBeDefined();
      });

      it("should handle snake_case path segments", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/getting_started/intro", 80),
        ];

        const sections = await discovery.discoverSections(pages);

        expect(sections[0].name).toBe("Getting Started");
      });
    });

    describe("edge cases", () => {
      it("should handle empty pages array", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages: PageMetadata[] = [];

        const sections = await discovery.discoverSections(pages);

        expect(sections).toHaveLength(0);
      });

      it("should handle single page", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [createMockPage("https://example.com/docs/intro", 80)];

        const sections = await discovery.discoverSections(pages);

        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Docs");
        expect(sections[0].pageIndexes).toEqual([0]);
      });

      it("should skip invalid URLs gracefully", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/docs/intro", 80),
          createMockPage("not-a-valid-url", 80),
          createMockPage("https://example.com/blog/post", 70),
        ];

        const sections = await discovery.discoverSections(pages);

        // Invalid URL should be skipped, but others should work
        expect(sections).toHaveLength(2);
        expect(sections.find((s) => s.name === "Docs")).toBeDefined();
        expect(sections.find((s) => s.name === "Blog")).toBeDefined();
      });

      it("should handle URLs with query parameters", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/docs/intro?tab=overview", 80),
          createMockPage("https://example.com/docs/api?version=2", 80),
        ];

        const sections = await discovery.discoverSections(pages);

        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Docs");
        expect(sections[0].pageIndexes).toHaveLength(2);
      });

      it("should handle URLs with anchors", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/docs/intro#section1", 80),
          createMockPage("https://example.com/docs/intro#section2", 80),
        ];

        const sections = await discovery.discoverSections(pages);

        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Docs");
      });

      it("should handle trailing slashes consistently", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://example.com/docs", 80),
          createMockPage("https://example.com/docs/", 80),
          createMockPage("https://example.com/docs/intro", 80),
        ];

        const sections = await discovery.discoverSections(pages);

        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe("Docs");
        expect(sections[0].pageIndexes).toHaveLength(3);
      });
    });

    describe("real-world scenarios", () => {
      it("should handle YouTube-like site structure", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://youtube.com/about", 80),
          createMockPage("https://youtube.com/creators", 75),
          createMockPage("https://youtube.com/advertisers", 75),
          // 21 random channel pages (UGC)
          ...Array.from({ length: 21 }, (_, i) =>
            createMockPage(`https://youtube.com/channel/random${i}`, 0)
          ),
        ];

        const sections = await discovery.discoverSections(pages);

        // Should have valid sections, not UGC channels
        expect(sections.length).toBeGreaterThan(0);
        expect(sections.some((s) => s.name === "Channel")).toBe(false);
      });

      it("should handle documentation site with subsections", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          // API Reference
          ...Array.from({ length: 10 }, (_, i) =>
            createMockPage(`https://docs.example.com/api/endpoint${i}`, 85)
          ),
          // Tutorials
          ...Array.from({ length: 8 }, (_, i) =>
            createMockPage(`https://docs.example.com/tutorials/lesson${i}`, 80)
          ),
          // Guides
          createMockPage("https://docs.example.com/guides/quickstart", 75),
          createMockPage("https://docs.example.com/guides/advanced", 75),
        ];

        const sections = await discovery.discoverSections(pages);

        // Should have meaningful sections
        expect(sections.length).toBeGreaterThan(0);
        expect(
          sections.some(
            (s) =>
              s.name.includes("API") ||
              s.name.includes("Tutorials") ||
              s.name.includes("Guides")
          )
        ).toBe(true);
      });

      it("should handle e-commerce site with product categories", async () => {
        const discovery = new UrlStructureSectionDiscovery();
        const pages = [
          createMockPage("https://store.com", 90),
          createMockPage("https://store.com/about", 70),
          createMockPage("https://store.com/contact", 70),
          ...Array.from({ length: 5 }, (_, i) =>
            createMockPage(`https://store.com/electronics/product${i}`, 65)
          ),
          ...Array.from({ length: 5 }, (_, i) =>
            createMockPage(`https://store.com/clothing/product${i}`, 65)
          ),
        ];

        const sections = await discovery.discoverSections(pages);

        // Should create sections for main pages and product categories
        expect(sections.length).toBeGreaterThan(2);
      });
    });
  });
});
