/**
 * Job Status API Endpoint
 * GET /api/v1/jobs/:id - Returns job status and result
 */

import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getPollJobLimiter } from "@/lib/api/rate-limit";
import { withRateLimit } from "@/lib/api/middleware/rate-limit";
import { createRequestLogger } from "@/lib/api/middleware/logger";

export const GET = withRateLimit(
  getPollJobLimiter,
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { logger } = createRequestLogger(request);

    try {
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
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Job not found",
            },
          },
          { status: 404 }
        );
      }

      logger.info("Job status retrieved successfully", {
        event: "api.job.status.success",
        jobId: id,
        status: job.status,
      });

      await logger.flush();
      return NextResponse.json({
        success: true,
        data: {
          id: job.id,
          status: job.status.toLowerCase(),
          result: job.result,
          error: job.error,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
        },
      });
    } catch (error) {
      logger.error("Failed to fetch job status", {
        event: "api.job.status.error",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      await logger.flush();
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch job status",
          },
        },
        { status: 500 }
      );
    }
  }
);
