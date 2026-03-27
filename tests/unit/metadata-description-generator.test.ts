/**
 * Unit Tests: Metadata Description Generator
 * Tests fallback description generation from HTML metadata and URL patterns
 */

import { describe, it, expect } from "vitest";
import { MetadataDescriptionGenerator } from "@/lib/content-generation/providers/deterministic/metadata-description-generator";
import type { PageMetadata } from "@/lib/types";

describe("MetadataDescriptionGenerator", () => {
  const generator = new MetadataDescriptionGenerator();

  const createMockPage = (
    overrides: Partial<PageMetadata> = {}
  ): PageMetadata => ({
    url: "https://example.com",
    title: "Page Title",
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
    ...overrides,
  });

  describe("isAvailable", () => {
    it("should always be available as fallback", () => {
      expect(generator.isAvailable()).toBe(true);
    });
  });

  describe("generateDescription", () => {
    describe("metadata preference order", () => {
      it("should prefer og:description over regular description", async () => {
        const page = createMockPage({
          ogDescription: "OG Description",
          description: "Meta Description",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("OG Description");
      });

      it("should use regular description when og:description not available", async () => {
        const page = createMockPage({
          description: "Meta Description",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Meta Description");
      });
    });

    describe("URL pattern detection", () => {
      it("should detect documentation pages", async () => {
        const page = createMockPage({
          url: "https://example.com/docs/getting-started",
          title: "Getting Started Guide",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Documentation for Getting Started Guide");
      });

      it("should detect documentation with /documentation/ path", async () => {
        const page = createMockPage({
          url: "https://example.com/documentation/api",
          title: "API Documentation",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Documentation for API Documentation");
      });

      it("should detect blog posts", async () => {
        const page = createMockPage({
          url: "https://example.com/blog/my-post",
          title: "My Blog Post",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Blog post: My Blog Post");
      });

      it("should detect news articles", async () => {
        const page = createMockPage({
          url: "https://example.com/news/announcement",
          title: "Product Announcement",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Blog post: Product Announcement");
      });

      it("should detect API reference pages", async () => {
        const page = createMockPage({
          url: "https://example.com/api/users",
          title: "Users API",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("API reference for Users API");
      });

      it("should detect reference pages", async () => {
        const page = createMockPage({
          url: "https://example.com/reference/components",
          title: "Component Reference",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("API reference for Component Reference");
      });

      it("should detect guide pages", async () => {
        const page = createMockPage({
          url: "https://example.com/guide/installation",
          title: "Installation Guide",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Guide on Installation Guide");
      });

      it("should detect tutorial pages", async () => {
        const page = createMockPage({
          url: "https://example.com/tutorial/basics",
          title: "Basics Tutorial",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Guide on Basics Tutorial");
      });

      it("should detect about pages", async () => {
        const page = createMockPage({
          url: "https://example.com/about",
          title: "About Us",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Information about the company and team");
      });

      it("should detect pricing pages", async () => {
        const page = createMockPage({
          url: "https://example.com/pricing",
          title: "Pricing Plans",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Pricing plans and subscription options");
      });

      it("should detect contact pages", async () => {
        const page = createMockPage({
          url: "https://example.com/contact",
          title: "Contact Us",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Contact information and support resources");
      });

      it("should detect careers pages", async () => {
        const page = createMockPage({
          url: "https://example.com/careers",
          title: "Join Our Team",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Career opportunities and open positions");
      });

      it("should detect jobs pages", async () => {
        const page = createMockPage({
          url: "https://example.com/jobs",
          title: "Open Positions",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Career opportunities and open positions");
      });
    });

    describe("fallback to title", () => {
      it("should use title when no metadata or pattern match", async () => {
        const page = createMockPage({
          url: "https://example.com/random-page",
          title: "Random Page Title",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Random Page Title");
      });
    });

    describe("description cleaning", () => {
      it("should trim and normalize whitespace", async () => {
        const page = createMockPage({
          description: "  Text   with   extra   spaces  ",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Text with extra spaces");
      });

      it("should truncate long descriptions to 150 characters", async () => {
        const longDesc = "a".repeat(200);
        const page = createMockPage({
          description: longDesc,
        });

        const result = await generator.generateDescription(page);
        expect(result.length).toBe(150); // 147 + "..."
        expect(result.endsWith("...")).toBe(true);
      });

      it("should preserve descriptions under 150 characters", async () => {
        const shortDesc = "Short description";
        const page = createMockPage({
          description: shortDesc,
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe(shortDesc);
      });
    });

    describe("title topic extraction", () => {
      it("should extract topic from title with pipe separator", async () => {
        const page = createMockPage({
          url: "https://example.com/docs/intro",
          title: "Introduction | Site Name",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Documentation for Introduction");
      });

      it("should extract topic from title with dash separator", async () => {
        const page = createMockPage({
          url: "https://example.com/docs/setup",
          title: "Setup Guide - Company",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Documentation for Setup Guide");
      });

      it("should handle em-dash separator", async () => {
        const page = createMockPage({
          url: "https://example.com/docs/advanced",
          title: "Advanced Topics — Documentation",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Documentation for Advanced Topics");
      });

      it("should handle en-dash separator", async () => {
        const page = createMockPage({
          url: "https://example.com/docs/api",
          title: "API Guide – Site",
        });

        const result = await generator.generateDescription(page);
        expect(result).toBe("Documentation for API Guide");
      });
    });
  });

  describe("generateBusinessSummary", () => {
    describe("metadata preference", () => {
      it("should prefer og:description for homepage", async () => {
        const homepage = createMockPage({
          url: "https://example.com",
          ogDescription: "The best platform for developers",
          description: "Regular description",
        });

        const result = await generator.generateBusinessSummary(homepage);
        expect(result).toBe("The best platform for developers");
      });

      it("should use regular description when og:description unavailable", async () => {
        const homepage = createMockPage({
          url: "https://example.com",
          description: "Company homepage description",
        });

        const result = await generator.generateBusinessSummary(homepage);
        expect(result).toBe("Company homepage description");
      });
    });

    describe("domain-based fallbacks", () => {
      it("should recognize GitHub", async () => {
        const homepage = createMockPage({
          url: "https://github.com",
          siteName: "GitHub",
        });

        const result = await generator.generateBusinessSummary(homepage);
        expect(result).toBe(
          "GitHub - Software development platform and code hosting service."
        );
      });

      it("should recognize YouTube", async () => {
        const homepage = createMockPage({
          url: "https://youtube.com",
          siteName: "YouTube",
        });

        const result = await generator.generateBusinessSummary(homepage);
        expect(result).toBe("YouTube - Video sharing and streaming platform.");
      });

      it("should recognize Google domains", async () => {
        const homepage = createMockPage({
          url: "https://google.com",
          siteName: "Google",
        });

        const result = await generator.generateBusinessSummary(homepage);
        expect(result).toContain("Search engine and technology platform");
      });
    });

    describe("generic fallback", () => {
      it("should generate generic summary with site name", async () => {
        const homepage = createMockPage({
          url: "https://example.com",
          siteName: "Example Site",
        });

        const result = await generator.generateBusinessSummary(homepage);
        expect(result).toBe(
          "Example Site - Visit example.com to learn more about their services and offerings."
        );
      });

      it("should use title when siteName unavailable", async () => {
        const homepage = createMockPage({
          url: "https://example.com",
          title: "Example Homepage",
        });

        const result = await generator.generateBusinessSummary(homepage);
        expect(result).toBe(
          "Example Homepage - Visit example.com to learn more about their services and offerings."
        );
      });

      it("should strip www from domain in summary", async () => {
        const homepage = createMockPage({
          url: "https://www.example.com",
          siteName: "Example",
        });

        const result = await generator.generateBusinessSummary(homepage);
        expect(result).toContain("example.com");
        expect(result).not.toContain("www.example.com");
      });

      it("should use fallback when no metadata available", async () => {
        const homepage = createMockPage({
          url: "https://example.com",
          title: "", // No title available
          siteName: "", // No site name
        });

        const result = await generator.generateBusinessSummary(homepage);
        expect(result).toContain("This site");
        expect(result).toContain("example.com");
      });
    });
  });
});
