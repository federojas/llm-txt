/**
 * Unit Tests: Pattern Title Cleaner
 * Tests regex-based title cleaning logic
 */

import { describe, it, expect } from "vitest";
import { PatternTitleCleaner } from "@/lib/content-generation/providers/deterministic/pattern-title-cleaner";

describe("PatternTitleCleaner", () => {
  const cleaner = new PatternTitleCleaner();

  describe("isAvailable", () => {
    it("should always be available as fallback", () => {
      expect(cleaner.isAvailable()).toBe(true);
    });
  });

  describe("cleanTitles", () => {
    describe("duplicate segment removal", () => {
      it("should remove duplicate segments separated by dash", async () => {
        const titles = ["About - FastHTML - FastHTML"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("About - FastHTML");
      });

      it("should remove duplicate segments separated by pipe", async () => {
        const titles = ["Documentation | Site Name | Site Name"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Documentation - Site Name");
      });

      it("should handle em-dash separator", async () => {
        const titles = ["Guide — Company — Company"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Guide - Company");
      });

      it("should handle en-dash separator", async () => {
        const titles = ["API – Site – Site"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("API - Site");
      });

      it("should be case-insensitive for duplicate detection", async () => {
        const titles = ["About - FastHTML - fasthtml"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("About - FastHTML");
      });
    });

    describe("single part titles", () => {
      it("should keep single part titles as-is", async () => {
        const titles = ["Welcome"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Welcome");
      });

      it("should reduce to single part after duplicate removal", async () => {
        const titles = ["Home - Home"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Home");
      });
    });

    describe("two part titles", () => {
      it("should remove short site name suffix (≤10 chars)", async () => {
        const titles = ["Getting Started - FastHTML"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Getting Started");
      });

      it("should remove single character suffix", async () => {
        const titles = ["Documentation - X"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Documentation");
      });

      it("should remove short acronyms", async () => {
        const titles = ["API Guide - AWS"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("API Guide");
      });

      it("should keep two parts when second is longer than 10 chars", async () => {
        const titles = ["Introduction - Very Long Site Name"];
        const result = await cleaner.cleanTitles(titles);

        // Keeps both parts since suffix is long
        expect(result[0]).toBe("Introduction - Very Long Site Name");
      });
    });

    describe("multiple part titles", () => {
      it("should keep first part when multiple segments", async () => {
        const titles = ["Quick Start - Docs - FastHTML"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Quick Start");
      });

      it("should extract page title from multi-level breadcrumbs", async () => {
        const titles = ["Installation - Guide - Documentation - Site"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Installation");
      });
    });

    describe("whitespace handling", () => {
      it("should trim whitespace from segments", async () => {
        const titles = ["  About  -  Company  "];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("About");
      });

      it("should handle mixed spacing around separators", async () => {
        const titles = ["API-Reference - Site"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("API-Reference");
      });

      it("should remove empty segments", async () => {
        const titles = ["Title -  - Site"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Title");
      });
    });

    describe("batch processing", () => {
      it("should clean multiple titles at once", async () => {
        const titles = ["Home - Site", "About - Company", "Contact - Help"];

        const result = await cleaner.cleanTitles(titles);

        expect(result).toHaveLength(3);
        expect(result[0]).toBe("Home");
        expect(result[1]).toBe("About");
        expect(result[2]).toBe("Contact");
      });

      it("should handle empty array", async () => {
        const titles: string[] = [];
        const result = await cleaner.cleanTitles(titles);

        expect(result).toHaveLength(0);
      });
    });

    describe("special cases", () => {
      it("should preserve titles without separators", async () => {
        const titles = ["SingleWordTitle"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("SingleWordTitle");
      });

      it("should handle Unicode characters", async () => {
        const titles = ["Über uns - Firma"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Über uns");
      });

      it("should handle CJK characters", async () => {
        const titles = ["关于我们 - 公司"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("关于我们");
      });

      it("should handle numbers in titles", async () => {
        const titles = ["API v2.0 - Docs"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("API v2.0");
      });

      it("should handle special characters in content", async () => {
        const titles = ["C++ Guide - Site"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("C++ Guide");
      });
    });

    describe("real-world examples", () => {
      it("should clean typical blog post titles", async () => {
        const titles = [
          "How to Build APIs - Tech Blog - Company",
          "New Product Launch - News - Site",
          "10 Tips for Developers - Blog",
        ];

        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("How to Build APIs");
        expect(result[1]).toBe("New Product Launch");
        expect(result[2]).toBe("10 Tips for Developers");
      });

      it("should clean documentation page titles", async () => {
        const titles = [
          "Getting Started - Documentation - FastHTML",
          "API Reference - Docs - Site",
          "Configuration - Guide - Project",
        ];

        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Getting Started");
        expect(result[1]).toBe("API Reference");
        expect(result[2]).toBe("Configuration");
      });

      it("should handle e-commerce product titles", async () => {
        const titles = [
          "Product Name - Category - Store",
          "Item Details - Shop - Brand",
        ];

        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Product Name");
        expect(result[1]).toBe("Item Details");
      });

      it("should handle social media platform patterns", async () => {
        const titles = ["Profile - Twitter", "Post - X", "Video - YouTube"];

        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Profile");
        expect(result[1]).toBe("Post");
        expect(result[2]).toBe("Video");
      });
    });

    describe("edge cases to preserve", () => {
      it("should not break titles with hyphens in content", async () => {
        const titles = ["State-of-the-art AI - Company"];
        const result = await cleaner.cleanTitles(titles);

        // First segment has hyphens in the actual content
        expect(result[0]).toBe("State-of-the-art AI");
      });

      it("should handle ratios and mathematical expressions", async () => {
        const titles = ["Performance 10-1 Comparison - Site"];
        const result = await cleaner.cleanTitles(titles);

        expect(result[0]).toBe("Performance 10-1 Comparison");
      });
    });
  });
});
