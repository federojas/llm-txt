/**
 * Unit Tests: Error Handler Middleware
 * Tests API error handling and standardized error responses
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleApiError,
  withErrorHandler,
} from "@/lib/api/middleware/error-handler";
import {
  ValidationError,
  NotFoundError,
  InternalServerError,
  BadRequestError,
  RateLimitError,
  ServiceUnavailableError,
} from "@/lib/api";
import { ZodError, ZodIssue } from "zod";
import { NextResponse } from "next/server";

describe("Error Handler Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("handleApiError", () => {
    describe("RateLimitError", () => {
      it("should handle RateLimitError with rate limit headers", () => {
        const resetMs = Date.now() + 60000; // 60 seconds in future
        const error = new RateLimitError("Rate limit exceeded", resetMs);

        const response = handleApiError(error);

        expect(response.status).toBe(429);
        expect(response.headers.get("Retry-After")).toBeTruthy();
        expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy();
      });

      it("should calculate Retry-After header correctly", () => {
        const resetMs = Date.now() + 60000; // 60 seconds in future
        const error = new RateLimitError("Rate limit exceeded", resetMs);

        const response = handleApiError(error);

        const retryAfter = parseInt(response.headers.get("Retry-After") || "0");
        expect(retryAfter).toBeGreaterThan(0);
        expect(retryAfter).toBeLessThanOrEqual(60);
      });

      it("should include reset date in ISO format", () => {
        const resetMs = Date.now() + 60000;
        const error = new RateLimitError("Rate limit exceeded", resetMs);

        const response = handleApiError(error);

        const resetHeader = response.headers.get("X-RateLimit-Reset");
        expect(resetHeader).toBeTruthy();
        expect(() => new Date(resetHeader!).toISOString()).not.toThrow();
      });

      it("should include error code and message in response body", async () => {
        const resetMs = Date.now() + 60000;
        const error = new RateLimitError("Custom rate limit message", resetMs);

        const response = handleApiError(error);
        const body = await response.json();

        expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
        expect(body.error.message).toBe("Custom rate limit message");
      });

      it("should include details if provided", async () => {
        const resetMs = Date.now() + 60000;
        const details = { limit: 100, remaining: 0 };
        const error = new RateLimitError(
          "Rate limit exceeded",
          resetMs,
          details
        );

        const response = handleApiError(error);
        const body = await response.json();

        expect(body.error.details).toEqual(details);
      });
    });

    describe("ValidationError", () => {
      it("should handle ValidationError with 400 status", async () => {
        const error = new ValidationError("Invalid input");

        const response = handleApiError(error);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toBe("Invalid input");
      });

      it("should include validation details", async () => {
        const details = [{ field: "email", message: "Invalid email" }];
        const error = new ValidationError("Invalid input", details);

        const response = handleApiError(error);
        const body = await response.json();

        expect(body.error.details).toEqual(details);
      });

      it("should use default message if not provided", async () => {
        const error = new ValidationError();

        const response = handleApiError(error);
        const body = await response.json();

        expect(body.error.message).toBe("Invalid input");
      });
    });

    describe("NotFoundError", () => {
      it("should handle NotFoundError with 404 status", async () => {
        const error = new NotFoundError("Resource not found");

        const response = handleApiError(error);

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe("NOT_FOUND");
        expect(body.error.message).toBe("Resource not found");
      });

      it("should use default message if not provided", async () => {
        const error = new NotFoundError();

        const response = handleApiError(error);
        const body = await response.json();

        expect(body.error.message).toBe("Resource not found");
      });
    });

    describe("InternalServerError", () => {
      it("should handle InternalServerError with 500 status", async () => {
        const error = new InternalServerError("Server error");

        const response = handleApiError(error);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
        expect(body.error.message).toBe("Server error");
      });

      it("should use default message if not provided", async () => {
        const error = new InternalServerError();

        const response = handleApiError(error);
        const body = await response.json();

        expect(body.error.message).toBe("Internal server error");
      });
    });

    describe("BadRequestError", () => {
      it("should handle BadRequestError with 400 status", async () => {
        const error = new BadRequestError("Bad request");

        const response = handleApiError(error);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe("BAD_REQUEST");
        expect(body.error.message).toBe("Bad request");
      });
    });

    describe("ServiceUnavailableError", () => {
      it("should handle ServiceUnavailableError with 503 status", async () => {
        const error = new ServiceUnavailableError("Service unavailable");

        const response = handleApiError(error);

        expect(response.status).toBe(503);
        const body = await response.json();
        expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
        expect(body.error.message).toBe("Service unavailable");
      });
    });

    describe("ZodError", () => {
      it("should handle ZodError with 400 status", async () => {
        const issues: ZodIssue[] = [
          {
            code: "invalid_type",
            expected: "string",
            received: "number",
            path: ["email"],
            message: "Expected string, received number",
          },
        ];
        const error = new ZodError(issues);

        const response = handleApiError(error);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toBe("Invalid input");
      });

      it("should include Zod issues in details", async () => {
        const issues: ZodIssue[] = [
          {
            code: "invalid_type",
            expected: "string",
            received: "number",
            path: ["email"],
            message: "Expected string, received number",
          },
          {
            code: "too_small",
            minimum: 1,
            type: "string",
            inclusive: true,
            exact: false,
            path: ["password"],
            message: "String must contain at least 1 character(s)",
          },
        ];
        const error = new ZodError(issues);

        const response = handleApiError(error);
        const body = await response.json();

        expect(body.error.details).toEqual(issues);
      });

      it("should handle empty Zod issues array", async () => {
        const error = new ZodError([]);

        const response = handleApiError(error);
        const body = await response.json();

        expect(body.error.details).toEqual([]);
      });
    });

    describe("Generic Error", () => {
      it("should handle generic Error with 500 status", async () => {
        const error = new Error("Something went wrong");

        const response = handleApiError(error);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
        expect(body.error.message).toBe("Something went wrong");
      });

      it("should handle Error with empty message", async () => {
        const error = new Error("");

        const response = handleApiError(error);
        const body = await response.json();

        expect(body.error.message).toBe("An unexpected error occurred");
      });

      it("should use fallback message for Error without message", async () => {
        const error = new Error();
        error.message = "";

        const response = handleApiError(error);
        const body = await response.json();

        expect(body.error.message).toBe("An unexpected error occurred");
      });
    });

    describe("Unknown errors", () => {
      it("should handle string error", async () => {
        const error = "String error message";

        const response = handleApiError(error);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error.code).toBe("UNKNOWN_ERROR");
        expect(body.error.message).toBe("An unknown error occurred");
      });

      it("should handle number error", async () => {
        const error = 404;

        const response = handleApiError(error);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error.code).toBe("UNKNOWN_ERROR");
      });

      it("should handle null error", async () => {
        const error = null;

        const response = handleApiError(error);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error.code).toBe("UNKNOWN_ERROR");
      });

      it("should handle undefined error", async () => {
        const error = undefined;

        const response = handleApiError(error);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error.code).toBe("UNKNOWN_ERROR");
      });

      it("should handle object error", async () => {
        const error = { custom: "error object" };

        const response = handleApiError(error);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error.code).toBe("UNKNOWN_ERROR");
      });

      it("should handle array error", async () => {
        const error = ["error", "array"];

        const response = handleApiError(error);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error.code).toBe("UNKNOWN_ERROR");
      });
    });

    describe("logging", () => {
      it("should log error to console", () => {
        const error = new Error("Test error");
        const consoleErrorSpy = vi.spyOn(console, "error");

        handleApiError(error);

        expect(consoleErrorSpy).toHaveBeenCalledWith("[API Error]", error);
      });

      it("should log all error types", () => {
        const consoleErrorSpy = vi.spyOn(console, "error");
        const errors = [
          new ValidationError("Validation failed"),
          new NotFoundError("Not found"),
          new RateLimitError("Rate limited", Date.now() + 60000),
          new Error("Generic error"),
          "String error",
        ];

        errors.forEach((error) => {
          handleApiError(error);
        });

        expect(consoleErrorSpy).toHaveBeenCalledTimes(errors.length);
      });
    });
  });

  describe("withErrorHandler", () => {
    it("should return response from successful handler", async () => {
      const mockResponse = NextResponse.json({ success: true });
      const handler = vi.fn().mockResolvedValue(mockResponse);

      const wrappedHandler = withErrorHandler(handler);
      const response = await wrappedHandler("arg1", "arg2");

      expect(response).toBe(mockResponse);
      expect(handler).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("should catch and handle errors from handler", async () => {
      const error = new ValidationError("Invalid data");
      const handler = vi.fn().mockRejectedValue(error);

      const wrappedHandler = withErrorHandler(handler);
      const response = await wrappedHandler();

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should pass all arguments to handler", async () => {
      const handler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ ok: true }));

      const wrappedHandler = withErrorHandler(handler);
      await wrappedHandler("arg1", 123, { key: "value" });

      expect(handler).toHaveBeenCalledWith("arg1", 123, { key: "value" });
    });

    it("should handle synchronous throws", async () => {
      const error = new Error("Sync error");
      const handler = vi.fn().mockImplementation(() => {
        throw error;
      });

      const wrappedHandler = withErrorHandler(handler);
      const response = await wrappedHandler();

      expect(response.status).toBe(500);
    });

    it("should handle handler returning rejected promise", async () => {
      const error = new NotFoundError("Resource not found");
      const handler = vi.fn().mockReturnValue(Promise.reject(error));

      const wrappedHandler = withErrorHandler(handler);
      const response = await wrappedHandler();

      expect(response.status).toBe(404);
    });

    it("should preserve handler context", async () => {
      const handler = vi.fn(async function (this: unknown) {
        return NextResponse.json({ context: this });
      });

      const wrappedHandler = withErrorHandler(handler);
      const context = { value: "test" };
      const response = await wrappedHandler.call(context);

      expect(response.status).toBe(200);
    });

    it("should handle multiple sequential calls", async () => {
      let callCount = 0;
      const handler = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new ValidationError("First call fails");
        }
        return NextResponse.json({ success: true });
      });

      const wrappedHandler = withErrorHandler(handler);

      const response1 = await wrappedHandler();
      expect(response1.status).toBe(400);

      const response2 = await wrappedHandler();
      expect(response2.status).toBe(200);
    });

    it("should handle different error types in sequence", async () => {
      const errors = [
        new ValidationError("Validation"),
        new NotFoundError("Not found"),
        new RateLimitError("Rate limit", Date.now() + 60000),
      ];
      let errorIndex = 0;

      const handler = vi.fn().mockImplementation(async () => {
        throw errors[errorIndex++];
      });

      const wrappedHandler = withErrorHandler(handler);

      const response1 = await wrappedHandler();
      expect(response1.status).toBe(400);

      const response2 = await wrappedHandler();
      expect(response2.status).toBe(404);

      const response3 = await wrappedHandler();
      expect(response3.status).toBe(429);
    });

    it("should not catch errors outside try-catch", async () => {
      const mockResponse = NextResponse.json({ success: true });
      const handler = vi.fn().mockResolvedValue(mockResponse);

      const wrappedHandler = withErrorHandler(handler);
      const response = await wrappedHandler();

      // Response should be returned normally, no error handling
      expect(response).toBe(mockResponse);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("response format", () => {
    it("should have consistent error response structure", async () => {
      const error = new ValidationError("Test error");
      const response = handleApiError(error);
      const body = await response.json();

      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
    });

    it("should include details when provided", async () => {
      const details = { field: "email", issue: "invalid format" };
      const error = new ValidationError("Invalid input", details);
      const response = handleApiError(error);
      const body = await response.json();

      expect(body.error).toHaveProperty("details");
      expect(body.error.details).toEqual(details);
    });

    it("should not include details when not provided", async () => {
      const error = new ValidationError("Invalid input");
      const response = handleApiError(error);
      const body = await response.json();

      // Details should be undefined, not included in response
      expect(body.error.details).toBeUndefined();
    });
  });
});
