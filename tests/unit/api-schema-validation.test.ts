/**
 * Unit Tests: API Schema Validation
 * Tests crawlOptionsSchema validation rules
 * Covers all parameter validation that was previously in E2E tests
 */

import { describe, it, expect } from "vitest";
import {
  crawlOptionsSchema,
  generationModeSchema,
  languageStrategySchema,
  titleCleanupSchema,
} from "@/lib/api/schemas";
import { ZodError } from "zod";

describe("API Schema Validation", () => {
  describe("crawlOptionsSchema", () => {
    describe("URL validation", () => {
      it("should accept valid HTTPS URL", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });
        expect(result.url).toBe("https://example.com");
      });

      it("should accept valid HTTP URL", () => {
        const result = crawlOptionsSchema.parse({
          url: "http://example.com",
        });
        expect(result.url).toBe("http://example.com");
      });

      it("should reject invalid URL format", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "not-a-valid-url",
          })
        ).toThrow(ZodError);
      });

      it("should reject URL without protocol", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "example.com",
          })
        ).toThrow(ZodError);
      });

      it("should reject missing URL", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            maxPages: 10,
          })
        ).toThrow(ZodError);
      });
    });

    describe("maxPages validation", () => {
      it("should accept minimum maxPages (1)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          maxPages: 1,
        });
        expect(result.maxPages).toBe(1);
      });

      it("should accept maximum maxPages (200)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          maxPages: 200,
        });
        expect(result.maxPages).toBe(200);
      });

      it("should accept valid middle value", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          maxPages: 50,
        });
        expect(result.maxPages).toBe(50);
      });

      it("should reject maxPages below minimum", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            maxPages: 0,
          })
        ).toThrow(ZodError);
      });

      it("should reject maxPages above maximum", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            maxPages: 201,
          })
        ).toThrow(ZodError);
      });

      it("should reject negative maxPages", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            maxPages: -5,
          })
        ).toThrow(ZodError);
      });

      it("should reject non-integer maxPages", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            maxPages: 10.5,
          })
        ).toThrow(ZodError);
      });

      it("should accept undefined maxPages (optional)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });
        expect(result.maxPages).toBeUndefined();
      });
    });

    describe("maxDepth validation", () => {
      it("should accept minimum maxDepth (1)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          maxDepth: 1,
        });
        expect(result.maxDepth).toBe(1);
      });

      it("should accept maximum maxDepth (5)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          maxDepth: 5,
        });
        expect(result.maxDepth).toBe(5);
      });

      it("should accept valid middle value", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          maxDepth: 3,
        });
        expect(result.maxDepth).toBe(3);
      });

      it("should reject maxDepth below minimum", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            maxDepth: 0,
          })
        ).toThrow(ZodError);
      });

      it("should reject maxDepth above maximum", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            maxDepth: 6,
          })
        ).toThrow(ZodError);
      });

      it("should reject negative maxDepth", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            maxDepth: -2,
          })
        ).toThrow(ZodError);
      });

      it("should accept undefined maxDepth (optional)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });
        expect(result.maxDepth).toBeUndefined();
      });
    });

    describe("generationMode validation", () => {
      it("should accept 'metadata' mode", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          generationMode: "metadata",
        });
        expect(result.generationMode).toBe("metadata");
      });

      it("should accept 'ai' mode", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          generationMode: "ai",
        });
        expect(result.generationMode).toBe("ai");
      });

      it("should reject invalid generationMode", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            generationMode: "invalid",
          })
        ).toThrow(ZodError);
      });

      it("should accept undefined generationMode (optional)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });
        expect(result.generationMode).toBeUndefined();
      });
    });

    describe("languageStrategy validation", () => {
      it("should accept 'prefer-english' strategy", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          languageStrategy: "prefer-english",
        });
        expect(result.languageStrategy).toBe("prefer-english");
      });

      it("should accept 'page-language' strategy", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          languageStrategy: "page-language",
        });
        expect(result.languageStrategy).toBe("page-language");
      });

      it("should reject invalid languageStrategy", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            languageStrategy: "invalid",
          })
        ).toThrow(ZodError);
      });

      it("should accept undefined languageStrategy (optional)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });
        expect(result.languageStrategy).toBeUndefined();
      });
    });

    describe("projectName validation", () => {
      it("should accept valid projectName", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          projectName: "My Project",
        });
        expect(result.projectName).toBe("My Project");
      });

      it("should accept empty projectName", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          projectName: "",
        });
        expect(result.projectName).toBe("");
      });

      it("should accept projectName at max length (100)", () => {
        const longName = "a".repeat(100);
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          projectName: longName,
        });
        expect(result.projectName).toBe(longName);
      });

      it("should reject projectName exceeding max length", () => {
        const tooLong = "a".repeat(101);
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            projectName: tooLong,
          })
        ).toThrow(ZodError);
      });

      it("should accept undefined projectName (optional)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });
        expect(result.projectName).toBeUndefined();
      });
    });

    describe("projectDescription validation", () => {
      it("should accept valid projectDescription", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          projectDescription: "A description of the project",
        });
        expect(result.projectDescription).toBe("A description of the project");
      });

      it("should accept projectDescription at max length (500)", () => {
        const longDesc = "a".repeat(500);
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          projectDescription: longDesc,
        });
        expect(result.projectDescription).toBe(longDesc);
      });

      it("should reject projectDescription exceeding max length", () => {
        const tooLong = "a".repeat(501);
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            projectDescription: tooLong,
          })
        ).toThrow(ZodError);
      });

      it("should accept undefined projectDescription (optional)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });
        expect(result.projectDescription).toBeUndefined();
      });
    });

    describe("includePatterns validation", () => {
      it("should accept single include pattern", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          includePatterns: ["*/docs/*"],
        });
        expect(result.includePatterns).toEqual(["*/docs/*"]);
      });

      it("should accept multiple include patterns", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          includePatterns: ["*/docs/*", "*/api/*", "*/guides/*"],
        });
        expect(result.includePatterns).toEqual([
          "*/docs/*",
          "*/api/*",
          "*/guides/*",
        ]);
      });

      it("should accept empty include patterns array", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          includePatterns: [],
        });
        expect(result.includePatterns).toEqual([]);
      });

      it("should accept wildcard patterns", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          includePatterns: ["**/*.html", "**/docs/**", "*.pdf"],
        });
        expect(result.includePatterns).toEqual([
          "**/*.html",
          "**/docs/**",
          "*.pdf",
        ]);
      });

      it("should reject string instead of array", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            includePatterns: "*/docs/*",
          })
        ).toThrow(ZodError);
      });

      it("should accept undefined includePatterns (optional)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });
        expect(result.includePatterns).toBeUndefined();
      });
    });

    describe("excludePatterns validation", () => {
      it("should accept single exclude pattern", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          excludePatterns: ["*/admin/*"],
        });
        expect(result.excludePatterns).toEqual(["*/admin/*"]);
      });

      it("should accept multiple exclude patterns", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          excludePatterns: ["*/admin/*", "*/api/*", "*.pdf"],
        });
        expect(result.excludePatterns).toEqual([
          "*/admin/*",
          "*/api/*",
          "*.pdf",
        ]);
      });

      it("should accept empty exclude patterns array", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          excludePatterns: [],
        });
        expect(result.excludePatterns).toEqual([]);
      });

      it("should accept wildcard patterns", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          excludePatterns: ["**/blog/**", "*.jpg", "*utm*"],
        });
        expect(result.excludePatterns).toEqual([
          "**/blog/**",
          "*.jpg",
          "*utm*",
        ]);
      });

      it("should reject string instead of array", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            excludePatterns: "*.pdf",
          })
        ).toThrow(ZodError);
      });

      it("should accept undefined excludePatterns (optional)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });
        expect(result.excludePatterns).toBeUndefined();
      });
    });

    describe("titleCleanup validation", () => {
      it("should accept titleCleanup with removePatterns", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          titleCleanup: {
            removePatterns: ["\\| SiteName$", "- Company Name"],
          },
        });
        expect(result.titleCleanup?.removePatterns).toEqual([
          "\\| SiteName$",
          "- Company Name",
        ]);
      });

      it("should accept titleCleanup with replacements", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          titleCleanup: {
            replacements: [
              { pattern: "&amp;", replacement: "&" },
              { pattern: "&nbsp;", replacement: " " },
            ],
          },
        });
        expect(result.titleCleanup?.replacements).toEqual([
          { pattern: "&amp;", replacement: "&" },
          { pattern: "&nbsp;", replacement: " " },
        ]);
      });

      it("should accept titleCleanup with both removePatterns and replacements", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          titleCleanup: {
            removePatterns: ["\\| SiteName$"],
            replacements: [{ pattern: "&amp;", replacement: "&" }],
          },
        });
        expect(result.titleCleanup?.removePatterns).toEqual(["\\| SiteName$"]);
        expect(result.titleCleanup?.replacements).toEqual([
          { pattern: "&amp;", replacement: "&" },
        ]);
      });

      it("should accept empty titleCleanup object", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          titleCleanup: {},
        });
        expect(result.titleCleanup).toEqual({});
      });

      it("should accept undefined titleCleanup (optional)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });
        expect(result.titleCleanup).toBeUndefined();
      });
    });

    describe("combined parameters", () => {
      it("should accept all parameters together", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          maxPages: 10,
          maxDepth: 3,
          generationMode: "metadata",
          languageStrategy: "prefer-english",
          projectName: "Custom Project",
          projectDescription: "A custom description",
          includePatterns: ["*/docs/*", "*/api/*"],
          excludePatterns: ["*/admin/*", "*.pdf"],
          titleCleanup: {
            removePatterns: ["\\| Site$"],
            replacements: [{ pattern: "&amp;", replacement: "&" }],
          },
        });

        expect(result.url).toBe("https://example.com");
        expect(result.maxPages).toBe(10);
        expect(result.maxDepth).toBe(3);
        expect(result.generationMode).toBe("metadata");
        expect(result.languageStrategy).toBe("prefer-english");
        expect(result.projectName).toBe("Custom Project");
        expect(result.projectDescription).toBe("A custom description");
        expect(result.includePatterns).toEqual(["*/docs/*", "*/api/*"]);
        expect(result.excludePatterns).toEqual(["*/admin/*", "*.pdf"]);
        expect(result.titleCleanup).toBeDefined();
      });

      it("should accept minimal valid input (URL only)", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
        });

        expect(result.url).toBe("https://example.com");
        expect(result.maxPages).toBeUndefined();
        expect(result.maxDepth).toBeUndefined();
        expect(result.generationMode).toBeUndefined();
      });

      it("should handle both include and exclude patterns together", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          includePatterns: ["*/docs/*"],
          excludePatterns: ["*/docs/internal/*"],
        });

        expect(result.includePatterns).toEqual(["*/docs/*"]);
        expect(result.excludePatterns).toEqual(["*/docs/internal/*"]);
      });
    });

    describe("validation edge cases", () => {
      it("should reject completely empty object", () => {
        expect(() => crawlOptionsSchema.parse({})).toThrow(ZodError);
      });

      it("should reject invalid data types", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: "https://example.com",
            maxPages: "not a number",
          })
        ).toThrow(ZodError);
      });

      it("should reject null values", () => {
        expect(() =>
          crawlOptionsSchema.parse({
            url: null,
          })
        ).toThrow(ZodError);
      });

      it("should preserve valid fields and ignore extra fields", () => {
        const result = crawlOptionsSchema.parse({
          url: "https://example.com",
          maxPages: 10,
          extraField: "should be ignored",
        });

        expect(result.url).toBe("https://example.com");
        expect(result.maxPages).toBe(10);
        // extraField is not in the type, so it won't appear
      });
    });
  });

  describe("generationModeSchema", () => {
    it("should accept 'metadata'", () => {
      const result = generationModeSchema.parse("metadata");
      expect(result).toBe("metadata");
    });

    it("should accept 'ai'", () => {
      const result = generationModeSchema.parse("ai");
      expect(result).toBe("ai");
    });

    it("should reject invalid mode", () => {
      expect(() => generationModeSchema.parse("invalid")).toThrow(ZodError);
    });

    it("should reject empty string", () => {
      expect(() => generationModeSchema.parse("")).toThrow(ZodError);
    });
  });

  describe("languageStrategySchema", () => {
    it("should accept 'prefer-english'", () => {
      const result = languageStrategySchema.parse("prefer-english");
      expect(result).toBe("prefer-english");
    });

    it("should accept 'page-language'", () => {
      const result = languageStrategySchema.parse("page-language");
      expect(result).toBe("page-language");
    });

    it("should reject invalid strategy", () => {
      expect(() => languageStrategySchema.parse("invalid")).toThrow(ZodError);
    });

    it("should reject empty string", () => {
      expect(() => languageStrategySchema.parse("")).toThrow(ZodError);
    });
  });

  describe("titleCleanupSchema", () => {
    it("should accept valid removePatterns", () => {
      const result = titleCleanupSchema.parse({
        removePatterns: ["pattern1", "pattern2"],
      });
      expect(result.removePatterns).toEqual(["pattern1", "pattern2"]);
    });

    it("should accept valid replacements", () => {
      const result = titleCleanupSchema.parse({
        replacements: [
          { pattern: "old", replacement: "new" },
          { pattern: "foo", replacement: "bar" },
        ],
      });
      expect(result.replacements).toHaveLength(2);
    });

    it("should accept both fields together", () => {
      const result = titleCleanupSchema.parse({
        removePatterns: ["pattern"],
        replacements: [{ pattern: "old", replacement: "new" }],
      });
      expect(result.removePatterns).toBeDefined();
      expect(result.replacements).toBeDefined();
    });

    it("should accept empty object", () => {
      const result = titleCleanupSchema.parse({});
      expect(result).toEqual({});
    });

    it("should reject invalid replacement structure", () => {
      expect(() =>
        titleCleanupSchema.parse({
          replacements: [{ pattern: "old" }], // Missing replacement field
        })
      ).toThrow(ZodError);
    });
  });
});
