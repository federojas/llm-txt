import { describe, it, expect, beforeEach, vi } from "vitest";
import { GroqClient } from "@/lib/content-generation/providers/groq/groq-client";

// Mock the Groq SDK
vi.mock("groq-sdk", () => {
  return {
    default: class {
      chat = {
        completions: {
          create: vi.fn(),
        },
      };
    },
  };
});

// Mock the logger
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("GroqClient", () => {
  let client: GroqClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new GroqClient("test-api-key");
  });

  describe("constructor", () => {
    it("should initialize with API key", () => {
      expect(client).toBeInstanceOf(GroqClient);
    });

    it("should accept custom rate limit", () => {
      const customClient = new GroqClient("test-api-key", 60);
      expect(customClient).toBeInstanceOf(GroqClient);
    });
  });

  describe("isAvailable", () => {
    it("should return true when client is initialized", () => {
      expect(client.isAvailable()).toBe(true);
    });
  });

  describe("executeWithFallback", () => {
    it("should successfully execute API call with first model", async () => {
      const mockResponse = new Response(JSON.stringify({}), {
        headers: {
          "x-ratelimit-remaining-requests": "500",
          "x-ratelimit-remaining-tokens": "10000",
        },
      });

      const mockData = { result: "test-result" };
      const apiCall = vi
        .fn()
        .mockResolvedValue({ data: mockData, response: mockResponse });

      const result = await client.executeWithFallback(apiCall);

      expect(result).toEqual(mockData);
      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith(
        "llama-3.3-70b-versatile",
        expect.any(Object)
      );
    });

    it("should fallback to second model on 429 rate limit error", async () => {
      const rateLimitError = Object.assign(new Error("Rate limit exceeded"), {
        status: 429,
      });

      const mockResponse = new Response(JSON.stringify({}), {
        headers: {
          "x-ratelimit-remaining-requests": "500",
          "x-ratelimit-remaining-tokens": "10000",
        },
      });

      const mockData = { result: "test-result-from-fallback" };

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError) // First model fails
        .mockResolvedValueOnce({ data: mockData, response: mockResponse }); // Second model succeeds

      const result = await client.executeWithFallback(apiCall);

      expect(result).toEqual(mockData);
      expect(apiCall).toHaveBeenCalledTimes(2);
      expect(apiCall).toHaveBeenNthCalledWith(
        1,
        "llama-3.3-70b-versatile",
        expect.any(Object)
      );
      expect(apiCall).toHaveBeenNthCalledWith(
        2,
        "meta-llama/llama-4-scout-17b-16e-instruct",
        expect.any(Object)
      );
    });

    it("should fallback through all 3 models on rate limit", async () => {
      const rateLimitError = Object.assign(new Error("Rate limit exceeded"), {
        status: 429,
      });

      const mockResponse = new Response(JSON.stringify({}), {
        headers: {
          "x-ratelimit-remaining-requests": "500",
          "x-ratelimit-remaining-tokens": "10000",
        },
      });

      const mockData = { result: "test-result-from-third-model" };

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError) // First model fails
        .mockRejectedValueOnce(rateLimitError) // Second model fails
        .mockResolvedValueOnce({ data: mockData, response: mockResponse }); // Third model succeeds

      const result = await client.executeWithFallback(apiCall);

      expect(result).toEqual(mockData);
      expect(apiCall).toHaveBeenCalledTimes(3);
      expect(apiCall).toHaveBeenNthCalledWith(
        3,
        "llama-3.1-8b-instant",
        expect.any(Object)
      );
    });

    it("should throw error when all models are rate limited", async () => {
      const rateLimitError = Object.assign(new Error("Rate limit exceeded"), {
        status: 429,
      });

      const apiCall = vi.fn().mockRejectedValue(rateLimitError);

      await expect(client.executeWithFallback(apiCall)).rejects.toThrow(
        /All Groq models exhausted/
      );

      expect(apiCall).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-rate-limit errors", async () => {
      const apiError = new Error("Invalid API request");

      const apiCall = vi.fn().mockRejectedValue(apiError);

      await expect(client.executeWithFallback(apiCall)).rejects.toThrow(
        /Groq API error/
      );

      // Should only try first model, not fallback
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it("should detect rate limit from error message", async () => {
      const rateLimitError = new Error("rate_limit exceeded");

      const mockResponse = new Response(JSON.stringify({}), {
        headers: {
          "x-ratelimit-remaining-requests": "500",
        },
      });

      const mockData = { result: "success" };

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: mockData, response: mockResponse });

      const result = await client.executeWithFallback(apiCall);

      expect(result).toEqual(mockData);
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    it("should update rate limit state from response headers", async () => {
      const mockResponse = new Response(JSON.stringify({}), {
        headers: {
          "x-ratelimit-remaining-requests": "50",
          "x-ratelimit-remaining-tokens": "5000",
          "x-ratelimit-reset-requests": "2024-01-01T00:00:00Z",
          "x-ratelimit-reset-tokens": "2024-01-01T00:00:00Z",
        },
      });

      const mockData = { result: "test" };
      const apiCall = vi
        .fn()
        .mockResolvedValue({ data: mockData, response: mockResponse });

      await client.executeWithFallback(apiCall);

      // Rate limit state should be updated (tested via proactive switching)
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it("should proactively switch models when requests drop below 50", async () => {
      // First call with low remaining requests
      const lowLimitResponse = new Response(JSON.stringify({}), {
        headers: {
          "x-ratelimit-remaining-requests": "45",
          "x-ratelimit-remaining-tokens": "5000",
        },
      });

      const mockData1 = { result: "first" };
      const apiCall1 = vi
        .fn()
        .mockResolvedValue({ data: mockData1, response: lowLimitResponse });

      await client.executeWithFallback(apiCall1);

      // Second call should use second model (proactive switch)
      const mockResponse2 = new Response(JSON.stringify({}), {
        headers: {
          "x-ratelimit-remaining-requests": "500",
        },
      });

      const mockData2 = { result: "second" };
      const apiCall2 = vi
        .fn()
        .mockResolvedValue({ data: mockData2, response: mockResponse2 });

      await client.executeWithFallback(apiCall2);

      // Should have switched to second model
      expect(apiCall2).toHaveBeenCalledWith(
        "meta-llama/llama-4-scout-17b-16e-instruct",
        expect.any(Object)
      );
    });

    it("should extract retry-after header from 429 response", async () => {
      const rateLimitError = Object.assign(new Error("Rate limit exceeded"), {
        status: 429,
        response: new Response(JSON.stringify({}), {
          headers: {
            "retry-after": "60",
          },
        }),
      });

      const apiCall = vi.fn().mockRejectedValue(rateLimitError);

      await expect(client.executeWithFallback(apiCall)).rejects.toThrow(
        /Try again in: 60s/
      );
    });

    it("should handle missing rate limit headers gracefully", async () => {
      const mockResponse = new Response(JSON.stringify({}), {
        headers: {}, // No rate limit headers
      });

      const mockData = { result: "test" };
      const apiCall = vi
        .fn()
        .mockResolvedValue({ data: mockData, response: mockResponse });

      const result = await client.executeWithFallback(apiCall);

      expect(result).toEqual(mockData);
    });

    it("should throttle requests according to rate limiter", async () => {
      const mockResponse = new Response(JSON.stringify({}), {
        headers: {
          "x-ratelimit-remaining-requests": "500",
        },
      });

      const mockData = { result: "test" };
      const apiCall = vi
        .fn()
        .mockResolvedValue({ data: mockData, response: mockResponse });

      // First request should be immediate
      const promise1 = client.executeWithFallback(apiCall);
      await vi.advanceTimersByTimeAsync(0);
      await promise1;

      // Second request should wait for rate limiter
      const promise2 = client.executeWithFallback(apiCall);

      // Advance time to allow rate limiter to grant token
      await vi.advanceTimersByTimeAsync(2000);
      await promise2;

      expect(apiCall).toHaveBeenCalledTimes(2);
    });
  });

  describe("model configuration", () => {
    it("should use correct model order: llama-3.3-70b → llama-4-scout → llama-3.1-8b", async () => {
      const rateLimitError = Object.assign(new Error("Rate limit exceeded"), {
        status: 429,
      });

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValue(rateLimitError);

      await expect(client.executeWithFallback(apiCall)).rejects.toThrow();

      expect(apiCall).toHaveBeenNthCalledWith(
        1,
        "llama-3.3-70b-versatile",
        expect.any(Object)
      );
      expect(apiCall).toHaveBeenNthCalledWith(
        2,
        "meta-llama/llama-4-scout-17b-16e-instruct",
        expect.any(Object)
      );
      expect(apiCall).toHaveBeenNthCalledWith(
        3,
        "llama-3.1-8b-instant",
        expect.any(Object)
      );
    });
  });
});
