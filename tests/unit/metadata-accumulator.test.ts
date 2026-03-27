/**
 * Unit Tests: Metadata Accumulator
 * Tests API metadata collection and aggregation
 */

import { describe, it, expect } from "vitest";
import { MetadataAccumulator } from "@/lib/content-generation/metadata-accumulator";
import type { GroqApiMetadata } from "@/lib/content-generation/providers/groq/groq-client";

describe("MetadataAccumulator", () => {
  const createMockMetadata = (
    overrides: Partial<GroqApiMetadata> = {}
  ): GroqApiMetadata => ({
    modelUsed: "llama-3.3-70b-versatile",
    modelFallback: false,
    tokensUsed: 100,
    rateLimitInfo: {
      requestsLimit: 1000,
      requestsRemaining: 999,
      tokensLimit: 100000,
      tokensRemaining: 99900,
      requestsResetAt: new Date(),
      tokensResetAt: new Date(),
    },
    fallbackChain: [],
    ...overrides,
  });

  describe("constructor", () => {
    it("should initialize with empty state", () => {
      const accumulator = new MetadataAccumulator();
      expect(accumulator.hasData()).toBe(false);

      const aggregated = accumulator.getAggregated();
      expect(aggregated.totalApiCalls).toBe(0);
      expect(aggregated.totalTokensUsed).toBe(0);
      expect(aggregated.modelsUsed.size).toBe(0);
      expect(aggregated.primaryModel).toBeNull();
      expect(aggregated.hadFallback).toBe(false);
      expect(aggregated.apiCalls).toEqual([]);
    });
  });

  describe("addApiCall", () => {
    it("should add single API call", () => {
      const accumulator = new MetadataAccumulator();
      const metadata = createMockMetadata({
        modelUsed: "llama-3.3-70b-versatile",
        tokensUsed: 150,
      });

      accumulator.addApiCall("description-generator", metadata);

      expect(accumulator.hasData()).toBe(true);
      const aggregated = accumulator.getAggregated();
      expect(aggregated.totalApiCalls).toBe(1);
      expect(aggregated.totalTokensUsed).toBe(150);
      expect(aggregated.modelsUsed.has("llama-3.3-70b-versatile")).toBe(true);
    });

    it("should add multiple API calls", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall(
        "description-generator",
        createMockMetadata({ tokensUsed: 100 })
      );
      accumulator.addApiCall(
        "section-discovery",
        createMockMetadata({ tokensUsed: 200 })
      );
      accumulator.addApiCall(
        "title-cleaner",
        createMockMetadata({ tokensUsed: 50 })
      );

      const aggregated = accumulator.getAggregated();
      expect(aggregated.totalApiCalls).toBe(3);
      expect(aggregated.totalTokensUsed).toBe(350);
      expect(aggregated.apiCalls).toHaveLength(3);
    });

    it("should track different models used", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall(
        "service1",
        createMockMetadata({ modelUsed: "llama-3.3-70b-versatile" })
      );
      accumulator.addApiCall(
        "service2",
        createMockMetadata({ modelUsed: "llama-3.2-90b-text-preview" })
      );
      accumulator.addApiCall(
        "service3",
        createMockMetadata({ modelUsed: "llama-3.1-8b-instant" })
      );

      const aggregated = accumulator.getAggregated();
      expect(aggregated.modelsUsed.size).toBe(3);
      expect(aggregated.modelsUsed.has("llama-3.3-70b-versatile")).toBe(true);
      expect(aggregated.modelsUsed.has("llama-3.2-90b-text-preview")).toBe(
        true
      );
      expect(aggregated.modelsUsed.has("llama-3.1-8b-instant")).toBe(true);
    });

    it("should detect fallback", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall(
        "service1",
        createMockMetadata({ modelFallback: false })
      );
      expect(accumulator.getAggregated().hadFallback).toBe(false);

      accumulator.addApiCall(
        "service2",
        createMockMetadata({ modelFallback: true })
      );
      expect(accumulator.getAggregated().hadFallback).toBe(true);
    });

    it("should track fallback chains", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall(
        "service1",
        createMockMetadata({
          modelUsed: "llama-3.1-8b-instant",
          modelFallback: true,
          fallbackChain: [
            "llama-3.3-70b-versatile",
            "llama-3.2-90b-text-preview",
            "llama-3.1-8b-instant",
          ],
        })
      );

      const aggregated = accumulator.getAggregated();
      expect(aggregated.fallbackChain).toContain("llama-3.3-70b-versatile");
      expect(aggregated.fallbackChain).toContain("llama-3.2-90b-text-preview");
      expect(aggregated.fallbackChain).toContain("llama-3.1-8b-instant");
    });

    it("should handle undefined tokensUsed", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall(
        "service",
        createMockMetadata({ tokensUsed: undefined })
      );

      const aggregated = accumulator.getAggregated();
      expect(aggregated.totalTokensUsed).toBe(0);
    });

    it("should store per-call details", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall(
        "description-generator",
        createMockMetadata({
          modelUsed: "llama-3.3-70b-versatile",
          tokensUsed: 150,
          modelFallback: false,
        })
      );

      const aggregated = accumulator.getAggregated();
      expect(aggregated.apiCalls[0]).toEqual({
        service: "description-generator",
        model: "llama-3.3-70b-versatile",
        tokens: 150,
        hadFallback: false,
      });
    });
  });

  describe("getAggregated", () => {
    it("should calculate primary model", () => {
      const accumulator = new MetadataAccumulator();

      // Model A used 3 times
      accumulator.addApiCall(
        "s1",
        createMockMetadata({ modelUsed: "model-a" })
      );
      accumulator.addApiCall(
        "s2",
        createMockMetadata({ modelUsed: "model-a" })
      );
      accumulator.addApiCall(
        "s3",
        createMockMetadata({ modelUsed: "model-a" })
      );

      // Model B used 2 times
      accumulator.addApiCall(
        "s4",
        createMockMetadata({ modelUsed: "model-b" })
      );
      accumulator.addApiCall(
        "s5",
        createMockMetadata({ modelUsed: "model-b" })
      );

      const aggregated = accumulator.getAggregated();
      expect(aggregated.primaryModel).toBe("model-a");
    });

    it("should return null primary model when no calls", () => {
      const accumulator = new MetadataAccumulator();
      const aggregated = accumulator.getAggregated();
      expect(aggregated.primaryModel).toBeNull();
    });

    it("should handle tie in model usage", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall(
        "s1",
        createMockMetadata({ modelUsed: "model-a" })
      );
      accumulator.addApiCall(
        "s2",
        createMockMetadata({ modelUsed: "model-b" })
      );

      const aggregated = accumulator.getAggregated();
      // Should pick one of them (implementation picks last one with max count)
      expect(["model-a", "model-b"]).toContain(aggregated.primaryModel);
    });

    it("should aggregate tokens correctly", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall("s1", createMockMetadata({ tokensUsed: 100 }));
      accumulator.addApiCall("s2", createMockMetadata({ tokensUsed: 200 }));
      accumulator.addApiCall("s3", createMockMetadata({ tokensUsed: 150 }));

      const aggregated = accumulator.getAggregated();
      expect(aggregated.totalTokensUsed).toBe(450);
    });

    it("should flatten multiple fallback chains", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall(
        "s1",
        createMockMetadata({
          fallbackChain: ["model-a", "model-b"],
        })
      );
      accumulator.addApiCall(
        "s2",
        createMockMetadata({
          fallbackChain: ["model-c", "model-d"],
        })
      );

      const aggregated = accumulator.getAggregated();
      expect(aggregated.fallbackChain).toContain("model-a");
      expect(aggregated.fallbackChain).toContain("model-b");
      expect(aggregated.fallbackChain).toContain("model-c");
      expect(aggregated.fallbackChain).toContain("model-d");
    });

    it("should deduplicate models in fallback chain", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall(
        "s1",
        createMockMetadata({
          fallbackChain: ["model-a", "model-b"],
        })
      );
      accumulator.addApiCall(
        "s2",
        createMockMetadata({
          fallbackChain: ["model-a", "model-c"],
        })
      );

      const aggregated = accumulator.getAggregated();
      // model-a appears in both chains but should be in fallbackChain only once
      const modelACount = aggregated.fallbackChain.filter(
        (m) => m === "model-a"
      ).length;
      expect(modelACount).toBe(1);
    });

    it("should return prompt and completion tokens as 0", () => {
      const accumulator = new MetadataAccumulator();

      accumulator.addApiCall(
        "service",
        createMockMetadata({ tokensUsed: 100 })
      );

      const aggregated = accumulator.getAggregated();
      // These are not tracked yet (would need GroqClient enhancement)
      expect(aggregated.totalTokensPrompt).toBe(0);
      expect(aggregated.totalTokensCompletion).toBe(0);
    });
  });

  describe("hasData", () => {
    it("should return false when no calls added", () => {
      const accumulator = new MetadataAccumulator();
      expect(accumulator.hasData()).toBe(false);
    });

    it("should return true after adding call", () => {
      const accumulator = new MetadataAccumulator();
      accumulator.addApiCall("service", createMockMetadata());
      expect(accumulator.hasData()).toBe(true);
    });
  });

  describe("real-world scenarios", () => {
    it("should track typical job with multiple services", () => {
      const accumulator = new MetadataAccumulator();

      // Generate business summary
      accumulator.addApiCall(
        "business-summary",
        createMockMetadata({
          modelUsed: "llama-3.3-70b-versatile",
          tokensUsed: 250,
        })
      );

      // Generate 5 page descriptions
      for (let i = 0; i < 5; i++) {
        accumulator.addApiCall(
          "page-description",
          createMockMetadata({
            modelUsed: "llama-3.3-70b-versatile",
            tokensUsed: 100,
          })
        );
      }

      // Discover sections
      accumulator.addApiCall(
        "section-discovery",
        createMockMetadata({
          modelUsed: "llama-3.3-70b-versatile",
          tokensUsed: 300,
        })
      );

      const aggregated = accumulator.getAggregated();
      expect(aggregated.totalApiCalls).toBe(7);
      expect(aggregated.totalTokensUsed).toBe(250 + 500 + 300);
      expect(aggregated.primaryModel).toBe("llama-3.3-70b-versatile");
      expect(aggregated.hadFallback).toBe(false);
      expect(aggregated.modelsUsed.size).toBe(1);
    });

    it("should track job with model fallback", () => {
      const accumulator = new MetadataAccumulator();

      // First call succeeds with primary model
      accumulator.addApiCall(
        "service1",
        createMockMetadata({
          modelUsed: "llama-3.3-70b-versatile",
          modelFallback: false,
          tokensUsed: 100,
        })
      );

      // Second call hits rate limit, falls back
      accumulator.addApiCall(
        "service2",
        createMockMetadata({
          modelUsed: "llama-3.1-8b-instant",
          modelFallback: true,
          tokensUsed: 50,
          fallbackChain: [
            "llama-3.3-70b-versatile",
            "llama-3.2-90b-text-preview",
            "llama-3.1-8b-instant",
          ],
        })
      );

      const aggregated = accumulator.getAggregated();
      expect(aggregated.hadFallback).toBe(true);
      expect(aggregated.modelsUsed.size).toBe(2);
      expect(aggregated.fallbackChain.length).toBeGreaterThan(0);
      expect(aggregated.primaryModel).toBe("llama-3.3-70b-versatile"); // Used most frequently
    });
  });
});
