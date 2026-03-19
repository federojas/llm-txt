import { NextRequest, NextResponse } from "next/server";
import { llmsGeneratorService } from "@/lib/services";
import { validateRequest, withErrorHandler, successResponse } from "@/lib/api";
import { generateRequestSchema } from "@/lib/api/dtos";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds max

/**
 * POST /api/generate
 * Generate llms.txt for a given URL
 *
 * This endpoint follows a layered architecture:
 * - Route handler: HTTP concerns only (validation, serialization)
 * - Service layer: Business logic orchestration
 * - Core layer: Domain logic (crawler, generator)
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Validate request
  const requestData = await validateRequest(request, generateRequestSchema);

  // Execute business logic
  const result = await llmsGeneratorService.generate(requestData);

  // Return success response
  return NextResponse.json(successResponse(result));
});
