/**
 * Crawl Job Functions
 * Handles website crawling and llms.txt generation
 */

import * as Sentry from "@sentry/nextjs";
import { inngest } from "../client";
import { db } from "@/lib/db";
import { generateLlmsTxtUseCase } from "@/lib/llms-txt";
import { JobStatus } from "@prisma/client";
import { CRAWL_REQUESTED } from "../events";
import { createLogger } from "@/lib/logger";

/**
 * Process Crawl Job
 * Executes llms.txt generation in the background
 */
export const processCrawl = inngest.createFunction(
  {
    id: "process-crawl",
    name: "Process Crawl Job",
    triggers: { event: CRAWL_REQUESTED },
    timeouts: { finish: "30m" }, // Safety net for large crawls (maxPages up to 100)
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const {
      jobId,
      url,
      maxPages,
      maxDepth,
      languageStrategy,
      generationMode,
      includePatterns,
      excludePatterns,
      projectName,
      projectDescription,
      titleCleanup,
      correlationId, // Receive correlation ID from API for distributed tracing
    } = event.data;

    // Create logger with job context for distributed tracing
    // Use correlation ID from API if available for linking logs across services
    const logger = createLogger({
      jobId,
      url,
      correlationId, // Link Inngest logs back to API request
    });

    // Set Sentry tags for background job tracking
    Sentry.setTag("correlationId", correlationId);
    Sentry.setTag("jobId", jobId);
    Sentry.setTag("jobType", "crawl");
    Sentry.setContext("job", {
      url,
      maxPages,
      maxDepth,
      generationMode,
    });

    try {
      logger.info("Inngest job started", {
        event: "inngest.job.start",
        jobId,
        url,
        maxPages,
        maxDepth,
        generationMode,
      });

      // Step 1: Update job to PROCESSING
      await step.run("start-processing", async () => {
        logger.info("Job started processing", {
          event: "inngest.job.processing",
          jobId,
        });
        return db.crawlJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.PROCESSING,
            startedAt: new Date(),
          },
        });
      });

      // Step 2: Execute the crawl (this is your existing business logic)
      const { result, duration } = await step.run("crawl-website", async () => {
        const startTime = Date.now();
        logger.info("Starting website crawl", {
          event: "inngest.crawl.start",
          jobId,
          url,
        });

        const crawlResult = await generateLlmsTxtUseCase.execute({
          url,
          maxPages,
          maxDepth,
          languageStrategy,
          generationMode,
          includePatterns,
          excludePatterns,
          projectName,
          projectDescription,
          titleCleanup,
        });

        const duration = Date.now() - startTime;
        logger.info("Crawl completed successfully", {
          event: "inngest.crawl.complete",
          jobId,
          url,
          pagesFound: crawlResult.stats.pagesFound,
          duration,
        });

        return { result: crawlResult, duration };
      });

      // Step 3: Save result to database with performance metrics
      await step.run("complete-job", async () => {
        logger.info("Job completed successfully", {
          event: "inngest.job.complete",
          jobId,
          pagesFound: result.stats.pagesFound,
          duration,
          apiCallsCount: result.stats.apiCallsCount,
          tokensUsed: result.stats.tokensUsed,
        });

        // Extract result metadata for analytics
        const contentLines = result.content.split("\n");
        const sectionCount = contentLines.filter((line: string) =>
          line.startsWith("# ")
        ).length;

        return db.crawlJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.COMPLETED,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result: result as any,
            duration,
            pagesProcessed: result.stats.pagesFound,
            apiCallsCount: result.stats.apiCallsCount,
            tokensUsed: result.stats.tokensUsed,
            resultMetadata: {
              sectionsCount: sectionCount,
              contentLength: result.content.length,
              outputLines: contentLines.length,
            },
            completedAt: new Date(),
          },
        });
      });

      await logger.flush();
      return { success: true, jobId };
    } catch (error) {
      // Log to Axiom
      logger.error("Job failed", {
        event: "inngest.job.failed",
        jobId,
        url,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Capture in Sentry
      Sentry.captureException(error, {
        level: "error",
        tags: {
          errorType: "job_failure",
        },
      });

      // Handle failures: Update job to FAILED with categorized reason
      await step.run("mark-failed", async () => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        // Categorize failure reason for analytics
        let failureReason = "UNKNOWN_ERROR";
        if (
          errorMessage.includes("timeout") ||
          errorMessage.includes("TIMEOUT")
        ) {
          failureReason = "TIMEOUT";
        } else if (
          errorMessage.includes("rate limit") ||
          errorMessage.includes("429")
        ) {
          failureReason = "RATE_LIMIT";
        } else if (
          errorMessage.includes("API") ||
          errorMessage.includes("Groq")
        ) {
          failureReason = "API_ERROR";
        } else if (
          errorMessage.includes("validation") ||
          errorMessage.includes("invalid")
        ) {
          failureReason = "VALIDATION_ERROR";
        } else if (
          errorMessage.includes("network") ||
          errorMessage.includes("ENOTFOUND") ||
          errorMessage.includes("ECONNREFUSED")
        ) {
          failureReason = "NETWORK_ERROR";
        } else if (errorMessage.includes("No pages found")) {
          failureReason = "NO_PAGES_FOUND";
        }

        return db.crawlJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.FAILED,
            error: errorMessage,
            failureReason,
            completedAt: new Date(),
          },
        });
      });

      // Flush logs before throwing
      await logger.flush();

      // Re-throw to mark function as failed (triggers retries)
      throw error;
    }
  }
);
