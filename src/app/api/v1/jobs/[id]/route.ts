/**
 * Job Status API Endpoint
 * GET /api/v1/jobs/:id - Returns job status and result
 */

import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getPollJobLimiter } from "@/lib/api/rate-limit";
import { withRateLimit } from "@/lib/api/middleware/rate-limit";
import { withErrorHandler } from "@/lib/api/middleware/error-handler";
import { createRequestLogger } from "@/lib/api/middleware/logger";
import { successResponse, NotFoundError } from "@/lib/api";

export const GET = withRateLimit(
  getPollJobLimiter,
  withErrorHandler(
    async (
      request: NextRequest,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      const { logger } = createRequestLogger(request);

      const { id } = await params;

      logger.debug("Querying job status", {
        event: "api.job.status.query",
        jobId: id,
      });

      const job = await db.crawlJob.findUnique({
        where: { id },
      });

      if (!job) {
        logger.warn("Job not found", {
          event: "api.job.status.not_found",
          jobId: id,
        });
        await logger.flush();
        throw new NotFoundError("Job not found");
      }

      logger.info("Job status retrieved successfully", {
        event: "api.job.status.success",
        jobId: id,
        status: job.status,
      });

      await logger.flush();

      // Extract result data with proper typing
      const result = job.result as {
        content?: string;
        stats?: { pagesFound?: number };
      } | null;

      return NextResponse.json(
        successResponse({
          id: job.id,
          url: job.url,
          status: job.status.toLowerCase(),
          // Result data (only if completed)
          content: result?.content ?? null,
          pagesFound: result?.stats?.pagesFound ?? null,
          // Error (only if failed)
          error: job.error,
          // Timestamps
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        })
      );
    }
  )
);
