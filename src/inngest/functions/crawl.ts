/**
 * Crawl Job Functions
 * Handles website crawling and llms.txt generation
 */

import { inngest } from "../client";
import { db } from "@/lib/db";
import { generateLlmsTxtUseCase } from "@/lib/llms-txt";
import { JobStatus } from "@prisma/client";
import { CRAWL_REQUESTED } from "../events";

/**
 * Process Crawl Job
 * Executes llms.txt generation in the background
 */
export const processCrawl = inngest.createFunction(
  {
    id: "process-crawl",
    name: "Process Crawl Job",
    triggers: { event: CRAWL_REQUESTED },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { jobId, url, maxPages, maxDepth, languageStrategy } = event.data;

    try {
      // Step 1: Update job to PROCESSING
      await step.run("start-processing", async () => {
        return db.crawlJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.PROCESSING,
            startedAt: new Date(),
          },
        });
      });

      // Step 2: Execute the crawl (this is your existing business logic)
      const result = await step.run("crawl-website", async () => {
        return generateLlmsTxtUseCase.execute({
          url,
          maxPages,
          maxDepth,
          languageStrategy,
        });
      });

      // Step 3: Save result to database
      await step.run("complete-job", async () => {
        return db.crawlJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.COMPLETED,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result: result as any,
            completedAt: new Date(),
          },
        });
      });

      return { success: true, jobId };
    } catch (error) {
      // Handle failures: Update job to FAILED
      await step.run("mark-failed", async () => {
        return db.crawlJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.FAILED,
            error:
              error instanceof Error ? error.message : "Unknown error occurred",
            completedAt: new Date(),
          },
        });
      });

      // Re-throw to mark function as failed (triggers retries)
      throw error;
    }
  }
);
