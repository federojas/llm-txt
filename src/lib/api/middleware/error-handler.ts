/**
 * Global Error Handler Middleware
 * Converts errors into standardized API responses
 */

import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api";
import { errorResponse } from "@/lib/api";
import { ZodError } from "zod";

/**
 * Converts any error into a standardized API error response
 */
export function handleApiError(error: unknown): NextResponse {
  // Log error for debugging
  console.error("[API Error]", error);

  // Handle ApiError instances
  if (error instanceof ApiError) {
    return NextResponse.json(
      errorResponse(error.code, error.message, error.details),
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      errorResponse("VALIDATION_ERROR", "Invalid input", error.issues),
      { status: 400 }
    );
  }

  // Handle generic errors
  if (error instanceof Error) {
    return NextResponse.json(
      errorResponse(
        "INTERNAL_SERVER_ERROR",
        error.message || "An unexpected error occurred"
      ),
      { status: 500 }
    );
  }

  // Handle unknown errors
  return NextResponse.json(
    errorResponse("UNKNOWN_ERROR", "An unknown error occurred"),
    { status: 500 }
  );
}

/**
 * Wraps an async route handler with error handling
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
