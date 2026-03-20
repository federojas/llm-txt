import { NextRequest, NextResponse } from "next/server";
import { generateLlmsTxtUseCase } from "@/lib/use-cases";
import { validateRequest, withErrorHandler, successResponse } from "@/lib/api";
import { crawlOptionsSchema } from "@/lib/api/validation";
import type { GenerateRequest } from "@/lib/api/dtos";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds max

/**
 * POST /api/v1/llms-txt
 * Generate llms.txt for a given URL
 *
 * RESTful API Design:
 * - Resource-based endpoint (llms-txt is the resource)
 * - Path-based versioning (v1)
 * - Follows Clean Architecture layers:
 *   → API Layer: HTTP concerns (validation, serialization)
 *   → Application Layer: Use case orchestration
 *   → Domain Layer: Business logic (crawler, generator)
 *   → Infrastructure Layer: External services (AI, HTTP)
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Validate request (schema conforms to GenerateRequest DTO)
  const requestData: GenerateRequest = await validateRequest(
    request,
    crawlOptionsSchema
  );

  // Execute use case
  const result = await generateLlmsTxtUseCase.execute(requestData);

  // Return success response
  return NextResponse.json(successResponse(result));
});
