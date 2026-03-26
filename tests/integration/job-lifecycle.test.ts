/**
 * Integration Tests: Job Lifecycle
 * Tests job state transitions and business logic
 */

import { describe, test, expect } from "vitest";
import { testDb, createTestJob } from "./setup";
import { JobStatus } from "@prisma/client";

describe("Job Lifecycle", () => {
  test("should transition from PENDING to PROCESSING", async () => {
    const job = await createTestJob({ status: "PENDING" });

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

  test("should transition from PROCESSING to COMPLETED", async () => {
    const job = await createTestJob({ status: "PROCESSING" });

    const result = "# Example\n\nGenerated content";
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
    expect(updated.error).toBeNull();
  });

  test("should transition from PROCESSING to FAILED", async () => {
    const job = await createTestJob({ status: "PROCESSING" });

    const updated = await testDb.crawlJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        error: "Network timeout after 5 retries",
        completedAt: new Date(),
      },
    });

    expect(updated.status).toBe(JobStatus.FAILED);
    expect(updated.error).toBeDefined();
    expect(updated.result).toBeNull();
  });

  test("should calculate job duration", async () => {
    const startedAt = new Date("2024-01-01T12:00:00Z");
    const completedAt = new Date("2024-01-01T12:05:30Z");

    const job = await testDb.crawlJob.create({
      data: {
        url: "https://example.com",
        status: JobStatus.COMPLETED,
        startedAt,
        completedAt,
        result: "# Result",
      },
    });

    const duration =
      job.completedAt && job.startedAt
        ? job.completedAt.getTime() - job.startedAt.getTime()
        : 0;

    expect(duration).toBe(5 * 60 * 1000 + 30 * 1000); // 5 minutes 30 seconds
  });

  test("should track multiple jobs independently", async () => {
    const job1 = await createTestJob({ url: "https://site1.com" });
    const job2 = await createTestJob({ url: "https://site2.com" });

    await testDb.crawlJob.update({
      where: { id: job1.id },
      data: { status: JobStatus.COMPLETED, result: "Result 1" },
    });

    await testDb.crawlJob.update({
      where: { id: job2.id },
      data: { status: JobStatus.FAILED, error: "Error 2" },
    });

    const updated1 = await testDb.crawlJob.findUnique({
      where: { id: job1.id },
    });
    const updated2 = await testDb.crawlJob.findUnique({
      where: { id: job2.id },
    });

    expect(updated1?.status).toBe(JobStatus.COMPLETED);
    expect(updated1?.result).toBe("Result 1");

    expect(updated2?.status).toBe(JobStatus.FAILED);
    expect(updated2?.error).toBe("Error 2");
  });

  test("should support job retry by resetting status", async () => {
    const job = await createTestJob({
      status: "FAILED",
      error: "Temporary network error",
    });

    // Retry by resetting to PENDING
    const retried = await testDb.crawlJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.PENDING,
        error: null,
        startedAt: null,
        completedAt: null,
      },
    });

    expect(retried.status).toBe(JobStatus.PENDING);
    expect(retried.error).toBeNull();
    expect(retried.startedAt).toBeNull();
    expect(retried.completedAt).toBeNull();
  });

  test("should preserve original URL throughout lifecycle", async () => {
    const originalUrl = "https://example.com/path?query=value";
    const job = await createTestJob({ url: originalUrl });

    // Update through lifecycle
    await testDb.crawlJob.update({
      where: { id: job.id },
      data: { status: JobStatus.PROCESSING },
    });

    await testDb.crawlJob.update({
      where: { id: job.id },
      data: { status: JobStatus.COMPLETED, result: "Done" },
    });

    const final = await testDb.crawlJob.findUnique({ where: { id: job.id } });
    expect(final?.url).toBe(originalUrl);
  });
});
