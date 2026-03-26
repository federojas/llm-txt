import { NextRequest, NextResponse } from "next/server";
import { validateRequest, withErrorHandler, successResponse } from "@/lib/api";
import { crawlOptionsSchema } from "@/lib/api";
import type { GenerateRequest } from "@/lib/api";
import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { JobStatus } from "@prisma/client";
import { CRAWL_REQUESTED } from "@/inngest/events";
import { getCreateJobLimiter, getGlobalJobLimiter } from "@/lib/api/rate-limit";
import { withRateLimit } from "@/lib/api/middleware/rate-limit";
import {
  createRequestLogger,
  CORRELATION_ID_HEADER,
} from "@/lib/api/middleware/logger";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for job creation and Inngest trigger

/**
 * POST /api/v1/llms-txt
 * Create async job for llms.txt generation
 *
 * Returns immediately with job ID, client polls /api/v1/jobs/:id for status
 *
 * Architecture:
 * - API Layer: HTTP concerns (validation, job creation)
 * - Inngest: Background job processing
 * - Database: Job status persistence
 */
export const POST = withRateLimit(
  getCreateJobLimiter,
  withErrorHandler(async (request: NextRequest) => {
    // Create logger with correlation ID for request tracing
    const { logger, correlationId } = createRequestLogger(request);

    // Validate request (schema conforms to GenerateRequest DTO)
    const requestData: GenerateRequest = await validateRequest(
      request,
      crawlOptionsSchema
    );

    logger.info("Creating crawl job", {
      event: "api.job.create",
      url: requestData.url,
      maxPages: requestData.maxPages,
      maxDepth: requestData.maxDepth,
      generationMode: requestData.generationMode,
    });

    // Create job in database with correlation ID and request metadata
    const job = await db.crawlJob.create({
      data: {
        url: requestData.url,
        status: JobStatus.PENDING,
        correlationId,
        // Store request metadata as JSON for analytics and debugging
        requestMetadata: JSON.parse(
          JSON.stringify({
            maxPages: requestData.maxPages,
            maxDepth: requestData.maxDepth,
            generationMode: requestData.generationMode,
            languageStrategy: requestData.languageStrategy,
            includePatterns: requestData.includePatterns,
            excludePatterns: requestData.excludePatterns,
            projectName: requestData.projectName,
            projectDescription: requestData.projectDescription,
            titleCleanup: requestData.titleCleanup,
          })
        ),
      },
    });

    logger.info("Job created successfully", {
      event: "api.job.created",
      jobId: job.id,
      url: requestData.url,
      status: "pending",
    });

    // Skip Inngest in preview environments (preview DB != production Inngest DB)
    const isPreview = process.env.VERCEL_ENV === "preview";

    if (!isPreview) {
      // Trigger Inngest background job (production only)
      await inngest.send({
        name: CRAWL_REQUESTED,
        data: {
          jobId: job.id,
          correlationId, // Pass correlation ID to Inngest for distributed tracing
          ...requestData,
        },
      });

      logger.info("Inngest job triggered", {
        event: "api.job.triggered",
        jobId: job.id,
        inngestEvent: CRAWL_REQUESTED,
      });
    } else {
      logger.info("Preview environment - Inngest skipped", {
        event: "api.job.preview_skip",
        jobId: job.id,
        reason: "Preview deployments do not process jobs",
      });
    }

    // Return job ID immediately (async pattern)
    const response = NextResponse.json(
      successResponse({
        jobId: job.id,
        status: "pending",
        statusUrl: `/api/v1/jobs/${job.id}`,
        ...(isPreview && {
          message:
            "Preview environment: Job created but will not be processed. Use production for actual crawling.",
        }),
      }),
      { status: 202 } // 202 Accepted
    );

    // Add correlation ID to response headers for client-side tracing
    response.headers.set(CORRELATION_ID_HEADER, correlationId);

    // Flush logs to Axiom (important for serverless)
    await logger.flush();

    return response;
  }),
  getGlobalJobLimiter // Check org-level quota to prevent API exhaustion
);
