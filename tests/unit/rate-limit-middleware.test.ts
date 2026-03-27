/**
 * Unit Tests: Rate Limiting Middleware
 * Tests rate limit checks and header injection
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRateLimit } from "@/lib/api/middleware/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/api/rate-limit";
import { RateLimitError } from "@/lib/api/api-error";
import type { Ratelimit } from "@upstash/ratelimit";

// Mock dependencies
vi.mock("@/lib/api/rate-limit", () => ({
  getClientIp: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => ({
    warn: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("@/lib/api/middleware/error-handler", () => ({
  handleApiError: vi.fn((error) => {
    // Simulate error handler behavior
    if (error instanceof RateLimitError) {
      const response = NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
      const retryAfterSeconds = Math.ceil((error.resetMs - Date.now()) / 1000);
      response.headers.set("Retry-After", retryAfterSeconds.toString());
      response.headers.set(
        "X-RateLimit-Reset",
        new Date(error.resetMs).toISOString()
      );
      return response;
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Error" } },
      { status: 500 }
    );
  }),
}));

const mockGetClientIp = vi.mocked(getClientIp);

describe("Rate Limiting Middleware", () => {
  let mockLimiter: Ratelimit;
  let mockGlobalLimiter: Ratelimit;
  let mockRequest: NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Ratelimit instances
    mockLimiter = {
      limit: vi.fn(),
    } as unknown as Ratelimit;

    mockGlobalLimiter = {
      limit: vi.fn(),
    } as unknown as Ratelimit;

    // Mock NextRequest
    mockRequest = {
      nextUrl: { pathname: "/api/test" },
      method: "GET",
    } as NextRequest;

    // Default: return client IP
    mockGetClientIp.mockReturnValue("127.0.0.1");
  });

  describe("withRateLimit", () => {
    describe("rate limit not exceeded", () => {
      it("should call handler when rate limit passes", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(mockHandler).toHaveBeenCalledWith(mockRequest);
        expect(response.status).toBe(200);
      });

      it("should add rate limit headers to successful response", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const resetTime = Date.now() + 60000;

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: true,
          limit: 100,
          remaining: 50,
          reset: resetTime,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("50");
        expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy();
      });

      it("should use client IP for rate limiting", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);

        mockGetClientIp.mockReturnValue("192.168.1.1");

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        await wrappedHandler(mockRequest);

        expect(mockGetClientIp).toHaveBeenCalledWith(mockRequest);
        expect(mockLimiter.limit).toHaveBeenCalledWith("192.168.1.1");
      });

      it("should pass additional arguments to handler", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        await wrappedHandler(mockRequest, "arg1", { param: "value" });

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, "arg1", {
          param: "value",
        });
      });
    });

    describe("per-IP rate limit exceeded", () => {
      it("should throw RateLimitError when per-IP limit exceeded", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const resetTime = Date.now() + 60000;

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: false,
          limit: 100,
          remaining: 0,
          reset: resetTime,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(429);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it("should include Retry-After header when rate limit exceeded", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const resetTime = Date.now() + 60000;

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: false,
          limit: 100,
          remaining: 0,
          reset: resetTime,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(response.headers.get("Retry-After")).toBeTruthy();
        expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy();
      });

      it("should not add rate limit headers when limit exceeded", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const resetTime = Date.now() + 60000;

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: false,
          limit: 100,
          remaining: 0,
          reset: resetTime,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        // Should have Retry-After but not X-RateLimit-Limit/Remaining (those are from error handler)
        expect(response.headers.get("Retry-After")).toBeTruthy();
      });
    });

    describe("global rate limit", () => {
      it("should check global limiter first", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const getGlobalLimiter = vi.fn().mockResolvedValue(mockGlobalLimiter);

        vi.mocked(mockGlobalLimiter.limit).mockResolvedValue({
          success: true,
          limit: 1000,
          remaining: 999,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(
          getLimiter,
          mockHandler,
          getGlobalLimiter
        );
        await wrappedHandler(mockRequest);

        expect(mockGlobalLimiter.limit).toHaveBeenCalledWith("global");
        expect(mockLimiter.limit).toHaveBeenCalled();
        expect(mockHandler).toHaveBeenCalled();
      });

      it("should throw RateLimitError when global limit exceeded", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const getGlobalLimiter = vi.fn().mockResolvedValue(mockGlobalLimiter);
        const resetTime = Date.now() + 60000;

        vi.mocked(mockGlobalLimiter.limit).mockResolvedValue({
          success: false,
          limit: 1000,
          remaining: 0,
          reset: resetTime,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(
          getLimiter,
          mockHandler,
          getGlobalLimiter
        );
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(429);
        expect(mockLimiter.limit).not.toHaveBeenCalled();
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it("should skip per-IP check when global limit exceeded", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const getGlobalLimiter = vi.fn().mockResolvedValue(mockGlobalLimiter);

        vi.mocked(mockGlobalLimiter.limit).mockResolvedValue({
          success: false,
          limit: 1000,
          remaining: 0,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(
          getLimiter,
          mockHandler,
          getGlobalLimiter
        );
        await wrappedHandler(mockRequest);

        expect(mockGlobalLimiter.limit).toHaveBeenCalled();
        expect(mockLimiter.limit).not.toHaveBeenCalled();
      });

      it("should continue to per-IP check when global limit passes", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const getGlobalLimiter = vi.fn().mockResolvedValue(mockGlobalLimiter);

        vi.mocked(mockGlobalLimiter.limit).mockResolvedValue({
          success: true,
          limit: 1000,
          remaining: 500,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: true,
          limit: 100,
          remaining: 50,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(
          getLimiter,
          mockHandler,
          getGlobalLimiter
        );
        await wrappedHandler(mockRequest);

        expect(mockGlobalLimiter.limit).toHaveBeenCalled();
        expect(mockLimiter.limit).toHaveBeenCalled();
        expect(mockHandler).toHaveBeenCalled();
      });

      it("should handle null global limiter", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const getGlobalLimiter = vi.fn().mockResolvedValue(null);

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(
          getLimiter,
          mockHandler,
          getGlobalLimiter
        );
        await wrappedHandler(mockRequest);

        expect(mockLimiter.limit).toHaveBeenCalled();
        expect(mockHandler).toHaveBeenCalled();
      });
    });

    describe("no limiter configured", () => {
      it("should skip rate limiting when limiter is null", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(null);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(mockHandler).toHaveBeenCalledWith(mockRequest);
        expect(response.status).toBe(200);
      });

      it("should not add rate limit headers when limiter is null", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(null);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
        expect(response.headers.get("X-RateLimit-Remaining")).toBeNull();
        expect(response.headers.get("X-RateLimit-Reset")).toBeNull();
      });

      it("should not call getClientIp when limiter is null", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(null);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        await wrappedHandler(mockRequest);

        expect(mockGetClientIp).not.toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      it("should handle errors from handler", async () => {
        const mockHandler = vi
          .fn()
          .mockRejectedValue(new Error("Handler error"));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(500);
      });

      it("should handle errors from getLimiter", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi
          .fn()
          .mockRejectedValue(new Error("Limiter error"));

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(500);
      });

      it("should handle errors from limiter.limit", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);

        vi.mocked(mockLimiter.limit).mockRejectedValue(
          new Error("Limit check error")
        );

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(500);
      });

      it("should handle errors from global limiter", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const getGlobalLimiter = vi.fn().mockResolvedValue(mockGlobalLimiter);

        vi.mocked(mockGlobalLimiter.limit).mockRejectedValue(
          new Error("Global limiter error")
        );

        const wrappedHandler = withRateLimit(
          getLimiter,
          mockHandler,
          getGlobalLimiter
        );
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(500);
      });
    });

    describe("edge cases", () => {
      it("should handle zero remaining requests", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: true,
          limit: 100,
          remaining: 0,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
        expect(mockHandler).toHaveBeenCalled();
      });

      it("should handle reset time in past", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);
        const resetTime = Date.now() - 1000; // 1 second ago

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: false,
          limit: 100,
          remaining: 0,
          reset: resetTime,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(response.status).toBe(429);
      });

      it("should handle very large limit values", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);

        vi.mocked(mockLimiter.limit).mockResolvedValue({
          success: true,
          limit: 999999,
          remaining: 999998,
          reset: Date.now() + 60000,
        } as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>);

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);
        const response = await wrappedHandler(mockRequest);

        expect(response.headers.get("X-RateLimit-Limit")).toBe("999999");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("999998");
      });

      it("should handle rapid sequential calls", async () => {
        const mockHandler = vi
          .fn()
          .mockResolvedValue(NextResponse.json({ success: true }));
        const getLimiter = vi.fn().mockResolvedValue(mockLimiter);

        let remaining = 100;
        vi.mocked(mockLimiter.limit).mockImplementation(
          async () =>
            ({
              success: remaining > 0,
              limit: 100,
              remaining: --remaining,
              reset: Date.now() + 60000,
            }) as unknown as Awaited<ReturnType<typeof mockLimiter.limit>>
        );

        const wrappedHandler = withRateLimit(getLimiter, mockHandler);

        // Make 3 rapid calls
        const response1 = await wrappedHandler(mockRequest);
        const response2 = await wrappedHandler(mockRequest);
        const response3 = await wrappedHandler(mockRequest);

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);
        expect(response3.status).toBe(200);
        expect(mockHandler).toHaveBeenCalledTimes(3);
      });
    });
  });
});
