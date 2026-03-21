/**
 * Job Status API Endpoint
 * GET /api/v1/jobs/:id - Returns job status and result
 */

import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await db.crawlJob.findUnique({
      where: { id },
    });

    if (!job) {
      return Response.json(
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

    return Response.json({
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
    console.error("[Jobs API] Error:", error);
    return Response.json(
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
