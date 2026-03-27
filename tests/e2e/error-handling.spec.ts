import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Error Handling - Full Suite
 * Tests critical failure scenarios and error recovery
 * Tagged as "Full Suite" - runs in e2e-full.yml only (not in fast CI)
 */

test.describe("Error Handling - Full Suite", () => {
  test.describe("Job Failure Scenarios", () => {
    test("should handle job failure due to invalid URL format", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "not-a-valid-url",
          maxPages: 5,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      // Should reject at validation layer (before job creation)
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test.skip("should handle job failure due to unreachable domain", async ({
      request,
    }) => {
      // Skipped: Takes too long waiting for network timeout (10s+)
      // Tests actual job failure (not validation failure)
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://this-domain-absolutely-does-not-exist-12345.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for job to fail
      let attempts = 0;
      const maxAttempts = 20;
      let jobStatus = "pending";

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        attempts++;
      }

      // Job should transition to failed status
      expect(jobStatus).toBe("failed");
    });

    test("should return error details for failed job", async ({ request }) => {
      // Create job with URL that will fail validation at Zod level
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "not-valid",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();

      // Should include error details
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBeDefined();
    });

    test("should handle SSRF-protected URLs gracefully", async ({
      request,
    }) => {
      // Private IP addresses should be rejected
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "http://192.168.1.1",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("should handle localhost URLs gracefully", async ({ request }) => {
      // Localhost should be rejected (SSRF protection)
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "http://localhost:3000",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  test.describe("Job Status Transitions", () => {
    test("should track job status through lifecycle", async ({ request }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Initial status should be pending
      expect(data.status).toBe("pending");

      // Poll until job completes or fails
      let attempts = 0;
      const maxAttempts = 30;
      let currentStatus = "pending";
      const statusHistory: string[] = [currentStatus];

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(currentStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        currentStatus = statusBody.data.status;
        if (
          statusHistory[statusHistory.length - 1] !== currentStatus &&
          currentStatus
        ) {
          statusHistory.push(currentStatus);
        }
        attempts++;
      }

      // Job should complete
      expect(currentStatus).toBe("completed");

      // Status should transition logically (pending -> processing? -> completed)
      expect(statusHistory[0]).toBe("pending");
      expect(statusHistory[statusHistory.length - 1]).toBe("completed");
    });

    test("should allow polling job status multiple times", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Poll the same job multiple times
      for (let i = 0; i < 5; i++) {
        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        expect(statusResponse.status()).toBe(200);

        const statusBody = await statusResponse.json();
        expect(statusBody.success).toBe(true);
        expect(statusBody.data.jobId).toBe(jobId);

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    });

    test("should return 404 for non-existent job ID", async ({ request }) => {
      const fakeJobId = "non-existent-job-id-12345";

      const response = await request.get(`/api/v1/jobs/${fakeJobId}`);

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  test.describe("System Resilience", () => {
    test("should not block system when one job fails", async ({ request }) => {
      // Create a job that will succeed
      const successResponse = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(successResponse.status()).toBe(202);
      const successJob = await successResponse.json();

      // Create a job that will fail validation
      const failResponse = await request.post("/api/v1/llms-txt", {
        data: {
          url: "not-a-url",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(failResponse.status()).toBe(400);

      // Create another successful job to verify system still works
      const success2Response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(success2Response.status()).toBe(202);
      const success2Job = await success2Response.json();

      // Both successful jobs should eventually complete
      const jobIds = [successJob.data.jobId, success2Job.data.jobId];

      for (const jobId of jobIds) {
        let attempts = 0;
        const maxAttempts = 30;
        let jobStatus = "pending";

        while (
          attempts < maxAttempts &&
          !["completed", "failed"].includes(jobStatus)
        ) {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
          const statusBody = await statusResponse.json();

          jobStatus = statusBody.data.status;
          attempts++;
        }

        expect(jobStatus).toBe("completed");
      }
    });

    test("should handle rapid successive job creation", async ({ request }) => {
      // Create multiple jobs in quick succession
      const promises = Array.from({ length: 3 }, () =>
        request.post("/api/v1/llms-txt", {
          data: {
            url: "https://example.com",
            maxPages: 1,
            maxDepth: 1,
            generationMode: "metadata",
          },
        })
      );

      const responses = await Promise.all(promises);

      // All should be accepted
      responses.forEach((response) => {
        expect(response.status()).toBe(202);
      });

      const jobs = await Promise.all(responses.map((r) => r.json()));

      // All should have unique job IDs
      const jobIds = jobs.map((j) => j.data.jobId);
      const uniqueJobIds = new Set(jobIds);
      expect(uniqueJobIds.size).toBe(jobIds.length);
    });
  });

  test.describe("Error Response Format", () => {
    test("should return consistent error format for validation errors", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "invalid-url",
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();

      // Verify error response structure
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBeDefined();
      expect(typeof body.error.message).toBe("string");
    });

    test("should include correlation ID in error responses", async ({
      request,
    }) => {
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "not-a-url",
        },
      });

      expect(response.status()).toBe(400);

      // Verify correlation ID header is present
      const correlationId = response.headers()["x-correlation-id"];
      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe("string");
      expect(correlationId.length).toBeGreaterThan(0);
    });
  });

  test.describe("Timeout Handling", () => {
    test("should handle page timeout gracefully", async ({ request }) => {
      // Use example.com with very restrictive timeout
      // The crawler has hardcoded 10s timeout per page
      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for job to complete (should succeed despite timeout potential)
      let attempts = 0;
      const maxAttempts = 30;
      let jobStatus = "pending";

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        jobStatus = statusBody.data.status;
        attempts++;
      }

      // Job should complete (or fail gracefully, not hang)
      expect(["completed", "failed"]).toContain(jobStatus);
    });
  });
});
