import { test, expect } from "@playwright/test";
import { validateLlmsTxtFormat } from "../../src/lib/llms-txt/spec";

/**
 * E2E Tests: Pattern Matching
 * Tests that includePatterns and excludePatterns work correctly end-to-end
 *
 * Part of full E2E suite - validates actual crawling behavior with patterns
 */

test.describe("Pattern Matching - Full Suite", () => {
  test.describe("Exclude Patterns", () => {
    test("should exclude paths matching pattern", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 10,
          maxDepth: 2,
          generationMode: "metadata",
          excludePatterns: ["*/blog/*", "*/news/*"],
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for job completion
      let attempts = 0;
      const maxAttempts = 30;
      let jobStatus = "pending";
      let content: string | null = null;

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        content = statusBody.data.content;
        attempts++;
      }

      expect(jobStatus).toBe("completed");
      expect(content).not.toBeNull();

      // Verify excluded paths are not in output
      expect(content).not.toContain("/blog/");
      expect(content).not.toContain("/news/");
    });

    test("should exclude multiple file types", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 10,
          maxDepth: 2,
          generationMode: "metadata",
          excludePatterns: ["*.pdf", "*.jpg", "*.png"],
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for completion
      let attempts = 0;
      const maxAttempts = 30;
      let jobStatus = "pending";
      let content: string | null = null;

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        content = statusBody.data.content;
        attempts++;
      }

      expect(jobStatus).toBe("completed");
      expect(content).not.toBeNull();

      // Verify excluded file types are not in output
      expect(content).not.toMatch(/\.pdf\)/);
      expect(content).not.toMatch(/\.jpg\)/);
      expect(content).not.toMatch(/\.png\)/);
    });

    test("should exclude tracking parameters", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 10,
          maxDepth: 2,
          generationMode: "metadata",
          excludePatterns: ["*utm_*", "*ref=*", "*fbclid*"],
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for completion
      let attempts = 0;
      const maxAttempts = 30;
      let jobStatus = "pending";
      let content: string | null = null;

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        content = statusBody.data.content;
        attempts++;
      }

      expect(jobStatus).toBe("completed");
      expect(content).not.toBeNull();

      // Verify tracking params are not in output
      expect(content).not.toContain("utm_");
      expect(content).not.toContain("ref=");
      expect(content).not.toContain("fbclid");
    });
  });

  test.describe("Include Patterns", () => {
    test("should only include paths matching pattern", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 20,
          maxDepth: 3,
          generationMode: "metadata",
          includePatterns: ["*/docs/*"],
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for completion
      let attempts = 0;
      const maxAttempts = 30;
      let jobStatus = "pending";
      let content: string | null = null;

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        content = statusBody.data.content;
        attempts++;
      }

      expect(jobStatus).toBe("completed");
      expect(content).not.toBeNull();

      // Verify only docs pages are included (if any exist)
      const validation = validateLlmsTxtFormat(content!);
      expect(validation.valid).toBe(true);

      // If links exist, they should be docs or homepage
      const links = content!.match(/\[.*?\]\((http.*?)\)/g) || [];
      if (links.length > 1) {
        // Excluding homepage
        const nonHomepageLinks = links.filter((link) => {
          const url = link.match(/\((.*?)\)/)?.[1] || "";
          return !url.endsWith("example.com") && !url.endsWith("example.com/");
        });

        // All non-homepage links should contain /docs/
        nonHomepageLinks.forEach((link) => {
          const url = link.match(/\((.*?)\)/)?.[1] || "";
          expect(url).toContain("/docs/");
        });
      }
    });

    test("should include multiple pattern types", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 20,
          maxDepth: 3,
          generationMode: "metadata",
          includePatterns: ["*/docs/*", "*/api/*", "*/guides/*"],
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for completion
      let attempts = 0;
      const maxAttempts = 30;
      let jobStatus = "pending";
      let content: string | null = null;

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        content = statusBody.data.content;
        attempts++;
      }

      expect(jobStatus).toBe("completed");
      expect(content).not.toBeNull();

      const validation = validateLlmsTxtFormat(content!);
      expect(validation.valid).toBe(true);
    });
  });

  test.describe("Include and Exclude Combined", () => {
    test("should respect both include and exclude patterns", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 20,
          maxDepth: 3,
          generationMode: "metadata",
          includePatterns: ["*/docs/*"],
          excludePatterns: ["*/docs/internal/*", "*.pdf"],
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for completion
      let attempts = 0;
      const maxAttempts = 30;
      let jobStatus = "pending";
      let content: string | null = null;

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        content = statusBody.data.content;
        attempts++;
      }

      expect(jobStatus).toBe("completed");
      expect(content).not.toBeNull();

      // Should have docs but not internal docs or PDFs
      expect(content).not.toContain("/docs/internal/");
      expect(content).not.toMatch(/\.pdf\)/);

      const validation = validateLlmsTxtFormat(content!);
      expect(validation.valid).toBe(true);
    });

    test("should handle complex pattern precedence", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 30,
          maxDepth: 3,
          generationMode: "metadata",
          includePatterns: ["*/docs/*", "*/api/*"],
          excludePatterns: ["*/admin/*", "*.pdf", "*utm*", "**/private/**"],
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for completion
      let attempts = 0;
      const maxAttempts = 30;
      let jobStatus = "pending";
      let content: string | null = null;

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        content = statusBody.data.content;
        attempts++;
      }

      expect(jobStatus).toBe("completed");
      expect(content).not.toBeNull();

      // Verify exclusions
      expect(content).not.toContain("/admin/");
      expect(content).not.toContain("/private/");
      expect(content).not.toMatch(/\.pdf\)/);
      expect(content).not.toContain("utm");

      const validation = validateLlmsTxtFormat(content!);
      expect(validation.valid).toBe(true);
    });
  });

  test.describe("Pattern Edge Cases", () => {
    test("should handle empty patterns gracefully", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 5,
          maxDepth: 1,
          generationMode: "metadata",
          includePatterns: [],
          excludePatterns: [],
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for completion
      let attempts = 0;
      const maxAttempts = 30;
      let jobStatus = "pending";
      let content: string | null = null;

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        content = statusBody.data.content;
        attempts++;
      }

      expect(jobStatus).toBe("completed");
      expect(content).not.toBeNull();

      const validation = validateLlmsTxtFormat(content!);
      expect(validation.valid).toBe(true);
    });

    test("should handle wildcards in different positions", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 10,
          maxDepth: 2,
          generationMode: "metadata",
          excludePatterns: [
            "*/temp*", // Wildcard at end
            "*temp/*", // Wildcard at start and middle
            "**/cache/**", // Double wildcards
          ],
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for completion
      let attempts = 0;
      const maxAttempts = 30;
      let jobStatus = "pending";
      let content: string | null = null;

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        content = statusBody.data.content;
        attempts++;
      }

      expect(jobStatus).toBe("completed");
      expect(content).not.toBeNull();

      const validation = validateLlmsTxtFormat(content!);
      expect(validation.valid).toBe(true);
    });
  });
});
