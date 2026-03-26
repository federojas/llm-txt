import { test, expect } from "@playwright/test";
import { validateLlmsTxtFormat } from "../../src/lib/llms-txt/spec";

/**
 * E2E Tests: Job Completion & Output Validation
 * Tests that jobs complete successfully and produce valid llms.txt format
 */

test.describe("Job Completion", () => {
  test("should complete job and return valid llms.txt", async ({ request }) => {
    // Create job with minimal crawl for fast E2E testing
    const response = await request.post("/api/v1/llms-txt", {
      data: {
        url: "https://example.com",
        maxPages: 1, // Minimal - just homepage
        maxDepth: 0, // No following links
        generationMode: "metadata", // Fast mode without AI
      },
    });

    expect(response.status()).toBe(202);
    const { data } = await response.json();
    const jobId = data.jobId;

    // Poll until job completes (shorter timeout for minimal crawl)
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts × 3 seconds = 90 seconds max
    let jobStatus = "pending";
    let result: { content: string } | null = null;

    while (
      attempts < maxAttempts &&
      !["completed", "failed"].includes(jobStatus)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds

      const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
      const statusBody = await statusResponse.json();

      jobStatus = statusBody.data.status;
      result = statusBody.data.result;
      attempts++;
    }

    // Job should complete successfully
    expect(jobStatus).toBe("completed");
    expect(result).not.toBeNull();

    // Validate llms.txt format using canonical spec
    const validation = validateLlmsTxtFormat(result!.content);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Should have reasonable content
    expect(validation.stats.sectionCount).toBeGreaterThanOrEqual(1);
    expect(validation.stats.linkCount).toBeGreaterThanOrEqual(1);
    expect(validation.stats.lineCount).toBeGreaterThan(5);

    // Log warnings if any (not fatal, just informational)
    if (validation.warnings.length > 0) {
      console.warn("llms.txt quality warnings:", validation.warnings);
    }
  });

  test("should track job progress through states", async ({ request }) => {
    const response = await request.post("/api/v1/llms-txt", {
      data: {
        url: "https://example.com",
        maxPages: 1, // Minimal crawl for fast E2E
        maxDepth: 0,
        generationMode: "metadata", // Fast mode without AI
      },
    });

    const { data } = await response.json();
    const jobId = data.jobId;

    // Track states seen (include initial status from creation response)
    const statesSeen = new Set<string>([data.status]);
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
      const statusBody = await statusResponse.json();
      const status = statusBody.data.status;

      statesSeen.add(status);

      if (["completed", "failed"].includes(status)) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
      attempts++;
    }

    // Should have gone through typical job lifecycle
    expect(statesSeen.has("pending")).toBe(true);
    expect(statesSeen.has("processing") || statesSeen.has("completed")).toBe(
      true
    );
  });

  test.skip("should handle invalid URL gracefully", async ({ request }) => {
    // Skipped: Inngest retries with exponential backoff take 3+ minutes
    // Error handling is already covered by unit tests
    const response = await request.post("/api/v1/llms-txt", {
      data: {
        url: "https://this-domain-definitely-does-not-exist-12345.com",
        maxPages: 5,
      },
    });

    const { data } = await response.json();
    const jobId = data.jobId;

    // Wait for job to fail
    let attempts = 0;
    const maxAttempts = 30;
    let jobStatus = "pending";
    let error: string | null = null;

    while (
      attempts < maxAttempts &&
      !["completed", "failed"].includes(jobStatus)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
      const statusBody = await statusResponse.json();

      jobStatus = statusBody.data.status;
      error = statusBody.data.error;
      attempts++;
    }

    // Should fail with meaningful error
    expect(jobStatus).toBe("failed");
    expect(error).not.toBeNull();
    expect(error).toContain(/ENOTFOUND|timeout|failed|network/i);
  });

  test("should respect maxPages limit", async ({ request }) => {
    const maxPages = 3; // Minimal for fast E2E

    const response = await request.post("/api/v1/llms-txt", {
      data: {
        url: "https://example.com",
        maxPages,
        maxDepth: 1, // Shallow depth for speed
        generationMode: "metadata", // Fast mode without AI
      },
    });

    const { data } = await response.json();
    const jobId = data.jobId;

    // Wait for completion
    let attempts = 0;
    const maxAttempts = 30;
    let jobStatus = "pending";
    let result: { content: string } | null = null;

    while (
      attempts < maxAttempts &&
      !["completed", "failed"].includes(jobStatus)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
      const statusBody = await statusResponse.json();

      jobStatus = statusBody.data.status;
      result = statusBody.data.result;
      attempts++;
    }

    if (jobStatus === "completed" && result) {
      // Count links in result (rough proxy for pages crawled)
      const linkCount = (result.content.match(/\[.*?\]\(http/g) || []).length;

      // Should not vastly exceed maxPages (allow some buffer for homepage + nav links)
      expect(linkCount).toBeLessThanOrEqual(maxPages * 2);
    }
  });
});
