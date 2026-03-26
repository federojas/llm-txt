/**
 * Integration Tests: Database Operations
 * Tests Prisma queries and database constraints
 */

import { describe, test, expect } from "vitest";
import { testDb, createTestJob } from "./setup";
import { JobStatus } from "@prisma/client";

describe("Database Operations", () => {
  test("should create job with PENDING status", async () => {
    const job = await testDb.crawlJob.create({
      data: {
        url: "https://example.com",
        status: JobStatus.PENDING,
      },
    });

    expect(job.id).toBeDefined();
    expect(job.url).toBe("https://example.com");
    expect(job.status).toBe(JobStatus.PENDING);
    expect(job.createdAt).toBeInstanceOf(Date);
    expect(job.result).toBeNull();
    expect(job.error).toBeNull();
  });

  // Records created in one operation aren't immediately visible to subsequent queries
  // This affects 6/15 integration tests. Unit and E2E tests work perfectly.
  test("should find job by ID", async () => {
    const created = await createTestJob({ url: "https://test.com" });

    const found = await testDb.crawlJob.findUnique({
      where: { id: created.id },
    });

    expect(found).not.toBeNull();
    expect(found?.url).toBe("https://test.com");
  });

  test("should update job status", async () => {
    const job = await createTestJob();

    const updated = await testDb.crawlJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    expect(updated.status).toBe(JobStatus.PROCESSING);
    expect(updated.startedAt).toBeInstanceOf(Date);
  });

  test("should update job with result", async () => {
    const job = await createTestJob();

    const result = "# Example\n\nGenerated content...";
    const updated = await testDb.crawlJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        result,
        completedAt: new Date(),
      },
    });

    expect(updated.status).toBe(JobStatus.COMPLETED);
    expect(updated.result).toBe(result);
    expect(updated.completedAt).toBeInstanceOf(Date);
  });

  test("should update job with error", async () => {
    const job = await createTestJob();

    const errorMessage = "Crawl failed: Network timeout";
    const updated = await testDb.crawlJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        error: errorMessage,
        completedAt: new Date(),
      },
    });

    expect(updated.status).toBe(JobStatus.FAILED);
    expect(updated.error).toBe(errorMessage);
    expect(updated.result).toBeNull();
  });

  test("should return null for non-existent job", async () => {
    const job = await testDb.crawlJob.findUnique({
      where: { id: "non-existent-id" },
    });

    expect(job).toBeNull();
  });

  test("should query jobs by status", async () => {
    await createTestJob({ url: "https://example1.com", status: "PENDING" });
    await createTestJob({ url: "https://example2.com", status: "COMPLETED" });
    await createTestJob({ url: "https://example3.com", status: "PENDING" });

    const pendingJobs = await testDb.crawlJob.findMany({
      where: { status: JobStatus.PENDING },
    });

    expect(pendingJobs).toHaveLength(2);
    expect(pendingJobs.every((j) => j.status === "PENDING")).toBe(true);
  });

  test("should order jobs by createdAt", async () => {
    const job1 = await createTestJob({ url: "https://first.com" });
    await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different timestamps
    const job2 = await createTestJob({ url: "https://second.com" });

    const jobs = await testDb.crawlJob.findMany({
      orderBy: { createdAt: "desc" },
    });

    expect(jobs[0].id).toBe(job2.id);
    expect(jobs[1].id).toBe(job1.id);
  });
});
