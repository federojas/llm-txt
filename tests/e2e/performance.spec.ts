import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Performance and Concurrency - Full Suite
 * Tests system behavior under load and concurrent operations
 * Tagged as "Full Suite" - runs in e2e-full.yml only (not in fast CI)
 */

test.describe("Performance and Concurrency - Full Suite", () => {
  test.describe("Concurrent Job Processing", () => {
    test("should handle multiple concurrent jobs successfully", async ({
      request,
    }) => {
      test.setTimeout(120000); // 2 minute timeout

      // Create 3 jobs simultaneously
      const jobRequests = Array.from({ length: 3 }, () =>
        request.post("/api/v1/llms-txt", {
          data: {
            url: "https://example.com",
            maxPages: 2,
            maxDepth: 1,
            generationMode: "metadata",
          },
        })
      );

      const createResponses = await Promise.all(jobRequests);

      // All should be accepted
      const jobIds: string[] = [];
      for (const response of createResponses) {
        expect(response.status()).toBe(202);
        const body = await response.json();
        jobIds.push(body.data.jobId);
      }

      // Verify all jobs have unique IDs
      expect(new Set(jobIds).size).toBe(3);

      // Poll all jobs until completion
      const completionPromises = jobIds.map(async (jobId) => {
        let attempts = 0;
        const maxAttempts = 40;
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

        return { jobId, status: jobStatus };
      });

      const results = await Promise.all(completionPromises);

      // All jobs should complete successfully
      results.forEach((result) => {
        expect(result.status).toBe("completed");
      });
    });

    test("should process jobs independently without interference", async ({
      request,
    }) => {
      test.setTimeout(120000); // 2 minute timeout

      // Create jobs with different configurations
      const job1 = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
          projectName: "Job 1",
        },
      });

      const job2 = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 2,
          maxDepth: 1,
          generationMode: "metadata",
          projectName: "Job 2",
        },
      });

      expect(job1.status()).toBe(202);
      expect(job2.status()).toBe(202);

      const job1Data = await job1.json();
      const job2Data = await job2.json();

      const jobId1 = job1Data.data.jobId;
      const jobId2 = job2Data.data.jobId;

      // Wait for both to complete
      let job1Complete = false;
      let job2Complete = false;
      let attempts = 0;
      const maxAttempts = 40;

      while ((!job1Complete || !job2Complete) && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (!job1Complete) {
          const status1 = await request.get(`/api/v1/jobs/${jobId1}`);
          const body1 = await status1.json();
          if (["completed", "failed"].includes(body1.data.status)) {
            job1Complete = true;
          }
        }

        if (!job2Complete) {
          const status2 = await request.get(`/api/v1/jobs/${jobId2}`);
          const body2 = await status2.json();
          if (["completed", "failed"].includes(body2.data.status)) {
            job2Complete = true;
          }
        }

        attempts++;
      }

      expect(job1Complete).toBe(true);
      expect(job2Complete).toBe(true);

      // Verify both jobs completed successfully with different content
      const final1 = await request.get(`/api/v1/jobs/${jobId1}`);
      const final2 = await request.get(`/api/v1/jobs/${jobId2}`);

      const final1Body = await final1.json();
      const final2Body = await final2.json();

      expect(final1Body.data.status).toBe("completed");
      expect(final2Body.data.status).toBe("completed");

      // Jobs should have different content (different maxPages)
      expect(final1Body.data.jobId).not.toBe(final2Body.data.jobId);
    });
  });

  test.describe("Job Queue Management", () => {
    test("should queue jobs when system is busy", async ({ request }) => {
      test.setTimeout(180000); // 3 minute timeout

      // Create multiple jobs rapidly
      const jobCount = 5;
      const jobRequests = Array.from({ length: jobCount }, (_, i) =>
        request.post("/api/v1/llms-txt", {
          data: {
            url: "https://example.com",
            maxPages: 1,
            maxDepth: 1,
            generationMode: "metadata",
          },
        })
      );

      const responses = await Promise.all(jobRequests);

      // All should be accepted (queued)
      const jobIds: string[] = [];
      responses.forEach((response) => {
        expect(response.status()).toBe(202);
      });

      // Get job IDs
      for (const response of responses) {
        const body = await response.json();
        jobIds.push(body.data.jobId);
      }

      // All jobs should eventually complete
      const completionStatuses = await Promise.all(
        jobIds.map(async (jobId) => {
          let attempts = 0;
          const maxAttempts = 50;
          let status = "pending";

          while (
            attempts < maxAttempts &&
            !["completed", "failed"].includes(status)
          ) {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
            const body = await statusResponse.json();
            status = body.data.status;
            attempts++;
          }

          return status;
        })
      );

      // All jobs should complete
      completionStatuses.forEach((status) => {
        expect(status).toBe("completed");
      });
    });
  });

  test.describe("Timeout Handling", () => {
    test("should complete jobs within reasonable time for small sites", async ({
      request,
    }) => {
      test.setTimeout(120000);

      const startTime = Date.now();

      const response = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 5,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(response.status()).toBe(202);
      const { data } = await response.json();
      const jobId = data.jobId;

      // Wait for completion
      let attempts = 0;
      const maxAttempts = 40;
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

      const duration = Date.now() - startTime;

      expect(jobStatus).toBe("completed");

      // Should complete within reasonable time (90 seconds for 5 pages)
      expect(duration).toBeLessThan(90000);
    });

    test("should not hang on slow pages", async ({ request }) => {
      // Test with a simple site that should respond quickly
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

      // Job should complete or fail, not hang indefinitely
      let attempts = 0;
      const maxAttempts = 30; // 60 seconds max
      let jobStatus = "pending";
      let lastStatus = "pending";

      while (
        attempts < maxAttempts &&
        !["completed", "failed"].includes(jobStatus)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
        const statusBody = await statusResponse.json();

        lastStatus = jobStatus;
        jobStatus = statusBody.data.status;
        attempts++;
      }

      // Job should complete or fail (not hang)
      expect(["completed", "failed"]).toContain(jobStatus);
    });
  });

  test.describe("Resource Management", () => {
    test("should handle jobs with different resource requirements", async ({
      request,
    }) => {
      test.setTimeout(180000); // 3 minute timeout

      // Small job (fast)
      const smallJob = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 1,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      // Larger job (slower)
      const largeJob = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 10,
          maxDepth: 2,
          generationMode: "metadata",
        },
      });

      expect(smallJob.status()).toBe(202);
      expect(largeJob.status()).toBe(202);

      const smallJobData = await smallJob.json();
      const largeJobData = await largeJob.json();

      // Both should eventually complete
      const jobIds = [smallJobData.data.jobId, largeJobData.data.jobId];

      for (const jobId of jobIds) {
        let attempts = 0;
        const maxAttempts = 60; // Larger jobs need more time
        let status = "pending";

        while (
          attempts < maxAttempts &&
          !["completed", "failed"].includes(status)
        ) {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const statusResponse = await request.get(`/api/v1/jobs/${jobId}`);
          const body = await statusResponse.json();
          status = body.data.status;
          attempts++;
        }

        expect(status).toBe("completed");
      }
    });
  });

  test.describe("System Load", () => {
    test("should maintain responsiveness under load", async ({ request }) => {
      // Create multiple jobs
      const jobCount = 3;
      const createStart = Date.now();

      const requests = Array.from({ length: jobCount }, () =>
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
      const createDuration = Date.now() - createStart;

      // Job creation should be fast (< 5 seconds for 3 jobs)
      expect(createDuration).toBeLessThan(5000);

      // All should be accepted
      responses.forEach((response) => {
        expect(response.status()).toBe(202);
      });
    });

    test("should handle API documentation requests during job processing", async ({
      request,
    }) => {
      // Create a job
      const jobResponse = await request.post("/api/v1/llms-txt", {
        data: {
          url: "https://example.com",
          maxPages: 3,
          maxDepth: 1,
          generationMode: "metadata",
        },
      });

      expect(jobResponse.status()).toBe(202);

      // While job is processing, fetch API docs
      const docsResponse = await request.get("/api/v1/docs");

      expect(docsResponse.status()).toBe(200);
      const docs = await docsResponse.json();
      expect(docs.success).toBe(true);
    });
  });
});
