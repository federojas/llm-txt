import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Job Generation Flow
 * Tests the core functionality - generating llms.txt for a website
 */

test.describe("Job Generation", () => {
  test("should create job and return 202 with job ID", async ({ request }) => {
    const response = await request.post("/api/v1/llms-txt", {
      data: {
        url: "https://example.com",
        maxPages: 1,
        maxDepth: 0,
        generationMode: "metadata", // Fast mode without AI
      },
    });

    expect(response.status()).toBe(202);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.jobId).toBeDefined();
    expect(body.data.status).toBe("pending");
    expect(body.data.statusUrl).toContain("/api/v1/jobs/");
  });

  test("should return correlation ID in response headers", async ({
    request,
  }) => {
    const response = await request.post("/api/v1/llms-txt", {
      data: {
        url: "https://example.com",
        generationMode: "metadata", // Fast mode without AI
      },
    });

    const correlationId = response.headers()["x-correlation-id"];
    expect(correlationId).toBeDefined();
    expect(correlationId.length).toBeGreaterThan(0);
  });

  test("should reject invalid URL", async ({ request }) => {
    const response = await request.post("/api/v1/llms-txt", {
      data: {
        url: "not-a-url",
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("should poll job status", async ({ request }) => {
    // Create job with minimal crawl for fast E2E
    const createResponse = await request.post("/api/v1/llms-txt", {
      data: {
        url: "https://example.com",
        maxPages: 1,
        maxDepth: 0,
        generationMode: "metadata", // Fast mode without AI
      },
    });

    const { data } = await createResponse.json();
    const jobId = data.jobId;

    // Poll job status
    const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
    expect(statusResponse.status()).toBe(200);

    const statusBody = await statusResponse.json();
    expect(statusBody.success).toBe(true);
    expect(statusBody.data.id).toBe(jobId);
    expect(statusBody.data.status).toMatch(
      /pending|processing|completed|failed/
    );
  });

  test("should return 404 for non-existent job", async ({ request }) => {
    const response = await request.get("/api/v1/jobs/non-existent-job-id");

    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("should accept all presets", async ({ request }) => {
    const presets = ["quick", "balanced", "thorough"];

    for (const preset of presets) {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          preset,
          maxPages: 1, // Override preset for fast E2E
          maxDepth: 0,
          generationMode: "metadata", // Fast mode without AI
        },
      });

      expect(response.status()).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
    }
  });

  test("should accept custom maxPages and maxDepth", async ({ request }) => {
    const response = await request.post("/api/v1/llms-txt", {
      data: {
        url: "https://example.com",
        maxPages: 2, // Minimal for fast E2E
        maxDepth: 1,
        generationMode: "metadata", // Fast mode without AI
      },
    });

    expect(response.status()).toBe(202);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.jobId).toBeDefined();
  });
});
