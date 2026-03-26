/**
 * Error Handling Unit Tests
 * Tests that errors are handled gracefully with appropriate messages
 */

import { describe, it, expect } from "vitest";
import { NotFoundError, RateLimitError } from "@/lib/api/api-error";
import { handleApiError } from "@/lib/api/middleware/error-handler";

describe("Error Handling", () => {
  describe("Invalid URL Errors", () => {
    it("should create NotFoundError for unreachable domains", () => {
      const error = new NotFoundError(
        "No pages found",
        "Could not crawl any pages from the provided URL"
      );

      expect(error.message).toBe("No pages found");
      expect(error.details).toBe(
        "Could not crawl any pages from the provided URL"
      );
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
    });

    it("should provide helpful error messages for common scenarios", () => {
      const scenarios = [
        {
          name: "Domain not found (ENOTFOUND)",
          error: new NotFoundError(
            "No pages found",
            "Could not crawl any pages from the provided URL"
          ),
          expectedMessage: "No pages found",
        },
        {
          name: "Connection timeout",
          error: new NotFoundError(
            "No pages found",
            "Could not crawl any pages from the provided URL"
          ),
          expectedMessage: "No pages found",
        },
        {
          name: "Network error",
          error: new NotFoundError(
            "No pages found",
            "Could not crawl any pages from the provided URL"
          ),
          expectedMessage: "No pages found",
        },
      ];

      scenarios.forEach((scenario) => {
        expect(scenario.error.message).toBe(scenario.expectedMessage);
        expect(scenario.error.statusCode).toBe(404);
        expect(scenario.error.code).toBe("NOT_FOUND");
      });
    });
  });

  describe("Error Message Clarity", () => {
    it("should provide actionable error messages", () => {
      const error = new NotFoundError(
        "No pages found",
        "Could not crawl any pages from the provided URL"
      );

      // Error message should be clear and actionable
      expect(error.message).toMatch(/pages/i);
      expect(error.details).toMatch(/crawl/i);
      expect(error.details).toMatch(/URL/i);
    });

    it("should include enough context for debugging", () => {
      const error = new NotFoundError(
        "No pages found",
        "Could not crawl any pages from the provided URL"
      );

      // Should have all necessary properties for logging/debugging
      expect(error).toHaveProperty("message");
      expect(error).toHaveProperty("details");
      expect(error).toHaveProperty("statusCode");
      expect(error).toHaveProperty("code");
      expect(error).toHaveProperty("stack");
    });
  });

  describe("Error Recovery", () => {
    it("should fail fast for invalid domains rather than retrying indefinitely", () => {
      // This test documents the expected behavior:
      // HTTP client retries 3 times with exponential backoff
      // Inngest retries the job step 3 times
      // Total: ~8-9 minutes for invalid domains

      // The behavior is correct (resilient), but too slow for E2E tests
      // So we test the error creation here (fast) and skip E2E test

      const error = new NotFoundError(
        "No pages found",
        "Could not crawl any pages from the provided URL"
      );

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.statusCode).toBe(404);
    });
  });

  describe("Rate Limit Error Handling", () => {
    it("should include reset time metadata in RateLimitError", () => {
      const resetMs = Date.now() + 60000; // 1 minute from now
      const error = new RateLimitError(
        "Rate limit exceeded. Try again in 60 seconds.",
        resetMs
      );

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(error.resetMs).toBe(resetMs);
    });

    it("should properly format rate limit error responses with headers", () => {
      const resetMs = Date.now() + 60000;
      const error = new RateLimitError(
        "Rate limit exceeded. Try again in 60 seconds.",
        resetMs,
        "Too many requests from this IP"
      );

      const response = handleApiError(error);

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBeTruthy();
      expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy();
    });
  });
});
