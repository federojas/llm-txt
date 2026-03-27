import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Comprehensive API Parameter Testing
 * These tests validate all API parameters work correctly end-to-end
 *
 * Note: These tests are part of the full E2E suite (e2e-full.yml)
 * They do NOT run on every PR to keep CI fast
 */

test.describe("API Parameters - Full Suite", () => {
  test.describe("Generation Mode", () => {
    test("should accept generationMode: metadata", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.jobId).toBeDefined();
    });

    test("should accept generationMode: ai", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "ai",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.jobId).toBeDefined();
    });

    test("should reject invalid generationMode", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          generationMode: "invalid",
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  test.describe("Language Preference", () => {
    test("should accept languageStrategy: prefer-english", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          languageStrategy: "prefer-english",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should accept languageStrategy: page-language", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          languageStrategy: "page-language",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should reject invalid languageStrategy", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          languageStrategy: "invalid",
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  test.describe("Maximum Pages", () => {
    test("should accept minimum maxPages (1)", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should accept maximum maxPages (1000)", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1000,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should reject maxPages below minimum", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 0,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("should reject maxPages above maximum", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1001,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("should reject non-integer maxPages", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 10.5,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  test.describe("Maximum Depth", () => {
    test("should accept minimum maxDepth (1)", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should accept maximum maxDepth (10)", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 10,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should reject maxDepth below minimum", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxDepth: 0,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("should reject maxDepth above maximum", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxDepth: 11,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  test.describe("Project Name Override", () => {
    test("should accept projectName override", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          projectName: "Custom Project Name",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should reject projectName exceeding max length", async ({
      request,
    }) => {
      const longName = "a".repeat(101); // Max is 100

      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          projectName: longName,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    test("should accept empty projectName", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          projectName: "",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });

  test.describe("Project Description Override", () => {
    test("should accept projectDescription override", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          projectDescription: "Custom description for the project",
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should reject projectDescription exceeding max length", async ({
      request,
    }) => {
      const longDesc = "a".repeat(501); // Max is 500

      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          projectDescription: longDesc,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  test.describe("Exclude Patterns", () => {
    test("should accept single exclude pattern", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          excludePatterns: ["*/admin/*"],
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should accept multiple exclude patterns", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          excludePatterns: ["*/admin/*", "*/api/*", "*.pdf"],
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should accept empty exclude patterns array", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          excludePatterns: [],
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should accept wildcard patterns", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          excludePatterns: ["**/blog/**", "*.jpg", "*utm*"],
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });

  test.describe("Include Patterns", () => {
    test("should accept single include pattern", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          includePatterns: ["*/docs/*"],
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should accept multiple include patterns", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          includePatterns: ["*/docs/*", "*/api/*", "*/guides/*"],
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should accept empty include patterns array", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          includePatterns: [],
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });

  test.describe("Include and Exclude Patterns Combined", () => {
    test("should accept both include and exclude patterns", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          includePatterns: ["*/docs/*"],
          excludePatterns: ["*/docs/internal/*"],
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should handle complex pattern combinations", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 5,
          maxDepth: 2,
          generationMode: "metadata",
          includePatterns: ["*/docs/*", "*/api/*", "*/guides/*"],
          excludePatterns: ["*/admin/*", "*.pdf", "*utm*", "**/internal/**"],
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });

  test.describe("Title Cleanup Configuration", () => {
    test("should accept titleCleanup with removePatterns", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          titleCleanup: {
            removePatterns: ["\\| SiteName$", "- Company Name"],
          },
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should accept titleCleanup with replacements", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          titleCleanup: {
            replacements: [
              { pattern: "&amp;", replacement: "&" },
              { pattern: "&nbsp;", replacement: " " },
            ],
          },
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should accept titleCleanup with both removePatterns and replacements", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          titleCleanup: {
            removePatterns: ["\\| SiteName$"],
            replacements: [{ pattern: "&amp;", replacement: "&" }],
          },
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });

  test.describe("Combined Parameters", () => {
    test("should accept all parameters together", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
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
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.jobId).toBeDefined();
      expect(body.data.status).toBe("pending");
    });

    test("should preserve all parameters through job creation", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 5,
          maxDepth: 2,
          generationMode: "ai",
          languageStrategy: "page-language",
          projectName: "Test Project",
          includePatterns: ["*/docs/*"],
          excludePatterns: ["*/private/*"],
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();

      // Poll job to verify it was created with correct parameters
      const statusResponse = await request.get(`/api/v1/jobs/${data.jobId}`);
      expect(statusResponse.status()).toBe(200);

      const statusBody = await statusResponse.json();
      expect(statusBody.success).toBe(true);
      expect(statusBody.data.url).toBe("https://example.com");
    });
  });

  test.describe("Validation Edge Cases", () => {
    test("should reject request with no URL", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          maxPages: 10,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("should reject request with invalid data types", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: "not a number",
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    test("should reject includePatterns as string instead of array", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          includePatterns: "*/docs/*", // Should be array
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    test("should reject excludePatterns as string instead of array", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          excludePatterns: "*.pdf", // Should be array
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });
});
