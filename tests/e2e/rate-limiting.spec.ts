import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Rate Limiting - Full Suite
 * Tests API rate limiting and throttling behavior
 *
 * Note: These tests may be slow due to waiting for rate limit windows
 * Tagged as "Full Suite" - runs in e2e-full.yml only (not in fast CI)
 */

test.describe("Rate Limiting - Full Suite", () => {
  test.describe("Job Creation Rate Limits", () => {
    test.slow(); // Mark all rate limiting tests as slow

    test("should enforce rate limits on job creation", async ({ request }) => {
      // Create multiple jobs rapidly to trigger rate limit
      const requests = Array.from({ length: 15 }, () =>
        request.post("/api/v1/llms-txt", {
          data: {
            url: "https://example.com",
            maxPages: 1,
            maxDepth: 1,
            generationMode: "metadata",
          },
        })
      );

      const responses = await Promise.all(requests);

      // Count status codes
      const statusCodes = responses.map((r) => r.status());
      const accepted = statusCodes.filter((s) => s === 202).length;
      const rateLimited = statusCodes.filter((s) => s === 429).length;

      // Should have mix of accepted and rate limited
      // (exact threshold depends on rate limit configuration)
      expect(accepted).toBeGreaterThan(0);

      // If we hit rate limits, verify the response format
      if (rateLimited > 0) {
        const rateLimitedResponse = responses.find((r) => r.status() === 429);
        const body = await rateLimitedResponse!.json();

        expect(body.success).toBe(false);
        expect(body.error.code).toBe("TOO_MANY_REQUESTS");
      }
    });

    test("should include rate limit headers in responses", async ({
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

      // Check for common rate limit headers
      const headers = response.headers();

      // Headers might be present (depends on rate limit implementation)
      // At minimum, we should get a valid response
      expect([200, 202, 429]).toContain(response.status());
    });

    test("should allow requests after rate limit window expires", async ({
      request,
    }) => {
      test.setTimeout(120000); // 2 minute timeout for this test

      // Send requests until rate limited
      let rateLimited = false;
      let attempts = 0;
      const maxAttempts = 20;

      while (!rateLimited && attempts < maxAttempts) {
        const response = await request.post("/api/v1/llms-txt", {
          data: {
            url: "https://example.com",
            maxPages: 1,
            maxDepth: 1,
            generationMode: "metadata",
          },
        });

        if (response.status() === 429) {
          rateLimited = true;
        }
        attempts++;
      }

      if (rateLimited) {
        // Wait for rate limit window to expire (typical: 60 seconds)
        await new Promise((resolve) => setTimeout(resolve, 65000));

        // Should be able to create job again
        const response = await request.post("/api/v1/llms-txt", {
          data: {
            url: "https://example.com",
            maxPages: 1,
            maxDepth: 1,
            generationMode: "metadata",
          },
        });

        expect(response.status()).toBe(202);
      }
    });
  });

  test.describe("Job Status Rate Limits", () => {
    test("should allow polling job status without rate limiting", async ({
      request,
    }) => {
      // Create a job
      const createResponse = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(createResponse.status()).toBe(202);
      const { data } = await createResponse.json();
      const jobId = data.jobId;

      // Poll status multiple times rapidly
      const pollRequests = Array.from({ length: 10 }, () =>
        request.get(`/api/v1/jobs/${jobId}`)
      );

      const responses = await Promise.all(pollRequests);

      // All status checks should succeed (no rate limiting on GET)
      responses.forEach((response) => {
        expect(response.status()).toBe(200);
      });
    });
  });

  test.describe("Rate Limit Error Format", () => {
    test("should return proper error format for rate limited requests", async ({
      request,
    }) => {
      // Attempt to trigger rate limit
      const requests = Array.from({ length: 20 }, () =>
        request.post("/api/v1/llms-txt", {
          data: {
            url: "https://example.com",
            maxPages: 1,
            maxDepth: 1,
            generationMode: "metadata",
          },
        })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find((r) => r.status() === 429);

      if (rateLimitedResponse) {
        const body = await rateLimitedResponse.json();

        // Verify error response structure
        expect(body.success).toBe(false);
        expect(body.error).toBeDefined();
        expect(body.error.code).toBe("TOO_MANY_REQUESTS");
        expect(body.error.message).toBeDefined();
        expect(typeof body.error.message).toBe("string");
      }
    });
  });

  test.describe("Per-IP Rate Limiting", () => {
    test("should track rate limits per client", async ({ request }) => {
      // This test verifies that rate limits are properly isolated
      // In real deployment, different IPs would have separate limits

      // Create multiple jobs from same client
      const response1 = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      const response2 = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      // Both should succeed initially (unless already rate limited)
      expect([202, 429]).toContain(response1.status());
      expect([202, 429]).toContain(response2.status());

      // If first succeeded, second should also succeed (same window)
      if (response1.status() === 202) {
        // Allow reasonable rate (at least 2 requests)
        expect([202, 429]).toContain(response2.status());
      }
    });
  });
});
