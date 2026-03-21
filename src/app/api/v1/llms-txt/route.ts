import { NextRequest, NextResponse } from "next/server";
import { validateRequest, withErrorHandler, successResponse } from "@/lib/api";
import { crawlOptionsSchema } from "@/lib/api";
import type { GenerateRequest } from "@/lib/api";
import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { JobStatus } from "@prisma/client";
import { CRAWL_REQUESTED } from "@/inngest/events";

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
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Validate request (schema conforms to GenerateRequest DTO)
  const requestData: GenerateRequest = await validateRequest(
    request,
    crawlOptionsSchema
  );

  // Create job in database
  const job = await db.crawlJob.create({
    data: {
      url: requestData.url,
      preset: requestData.preset || "quick",
      status: JobStatus.PENDING,
    },
  });

  // Trigger Inngest background job
  await inngest.send({
    name: CRAWL_REQUESTED,
    data: {
      jobId: job.id,
      ...requestData,
    },
  });

  // Return job ID immediately (async pattern)
  return NextResponse.json(
    successResponse({
      jobId: job.id,
      status: "pending",
      statusUrl: `/api/v1/jobs/${job.id}`,
    }),
    { status: 202 } // 202 Accepted
  );
});
