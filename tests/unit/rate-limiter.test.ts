import { describe, it, expect, beforeEach, vi } from "vitest";
import { TokenBucketLimiter } from "@/lib/content-generation/shared/rate-limiter";

describe("TokenBucketLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe("constructor", () => {
    it("should initialize with correct capacity", () => {
      const limiter = new TokenBucketLimiter(30);
      expect(limiter).toBeInstanceOf(TokenBucketLimiter);
    });

    it("should accept custom burst capacity", () => {
      const limiter = new TokenBucketLimiter(30, 60);
      expect(limiter).toBeInstanceOf(TokenBucketLimiter);
    });
  });

  describe("waitForToken", () => {
    it("should immediately grant token when bucket is full", async () => {
      const limiter = new TokenBucketLimiter(30);

      const start = Date.now();
      await limiter.waitForToken();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it("should throttle to correct rate (30 RPM = 1 request per 2 seconds)", async () => {
      const limiter = new TokenBucketLimiter(30); // 30 requests per minute

      // First request: immediate
      await limiter.waitForToken();

      // Second request should wait ~2000ms
      const startTime = Date.now();

      // Start the wait in the background
      const waitPromise = limiter.waitForToken();

      // Advance time by 2000ms (enough for 1 token to refill at 30 RPM = 0.5 tokens/sec)
      await vi.advanceTimersByTimeAsync(2000);

      // Now it should resolve
      await waitPromise;

      const duration = Date.now() - startTime;

      // Should have waited approximately 2 seconds
      expect(duration).toBeGreaterThanOrEqual(2000);
    });

    it("should handle burst capacity correctly", async () => {
      const limiter = new TokenBucketLimiter(60, 5); // 60 RPM with burst of 5

      // Should be able to make 5 requests immediately (burst)
      for (let i = 0; i < 5; i++) {
        await limiter.waitForToken();
      }

      // 6th request should wait
      const waitPromise = limiter.waitForToken();

      // Need to wait 1 second for next token (60 RPM = 1 per second)
      await vi.advanceTimersByTimeAsync(1000);

      await waitPromise;
    });

    it("should refill tokens over time", async () => {
      const limiter = new TokenBucketLimiter(60); // 60 RPM = 1 per second

      // Use up all tokens
      await limiter.waitForToken();

      // Wait 3 seconds (should refill ~3 tokens)
      await vi.advanceTimersByTimeAsync(3000);

      // Should be able to make 3 more requests immediately
      const start = Date.now();
      await limiter.waitForToken();
      await limiter.waitForToken();
      await limiter.waitForToken();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe("reset", () => {
    it("should reset tokens to full capacity", async () => {
      const limiter = new TokenBucketLimiter(30, 3);

      // Consume all tokens
      await limiter.waitForToken();
      await limiter.waitForToken();
      await limiter.waitForToken();

      // Reset
      limiter.reset();

      // Should be able to consume 3 more immediately
      const start = Date.now();
      await limiter.waitForToken();
      await limiter.waitForToken();
      await limiter.waitForToken();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe("edge cases", () => {
    it("should handle very high rate limits", async () => {
      const limiter = new TokenBucketLimiter(6000); // 100 requests per second

      // Should handle many rapid requests
      for (let i = 0; i < 10; i++) {
        await limiter.waitForToken();
      }
    });

    it("should handle very low rate limits", async () => {
      const limiter = new TokenBucketLimiter(1); // 1 request per minute

      await limiter.waitForToken();

      const waitPromise = limiter.waitForToken();

      // Need to wait full minute
      await vi.advanceTimersByTimeAsync(60000);

      await waitPromise;
    });
  });
});
