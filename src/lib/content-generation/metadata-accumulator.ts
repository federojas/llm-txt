/**
 * Metadata Accumulator
 * Collects API call metadata across the entire job lifecycle
 *
 * Purpose: Track which AI models were used, token consumption, and API call counts
 * Used by: Content generation services to aggregate metadata for database storage
 */

import { GroqApiMetadata } from "./providers/groq/groq-client";

export interface AggregatedMetadata {
  // API usage
  totalApiCalls: number;
  totalTokensUsed: number;
  totalTokensPrompt: number;
  totalTokensCompletion: number;

  // Model tracking
  modelsUsed: Set<string>; // All models that were used
  primaryModel: string | null; // Most frequently used model
  hadFallback: boolean; // Whether any fallback occurred
  fallbackChain: string[]; // All models attempted (for debugging)

  // Per-call details (for debugging)
  apiCalls: Array<{
    service: string; // e.g., "description-generator", "section-discovery"
    model: string;
    tokens: number;
    hadFallback: boolean;
  }>;
}

export class MetadataAccumulator {
  private apiCalls: Array<{
    service: string;
    model: string;
    tokens: number;
    hadFallback: boolean;
  }> = [];

  private modelsUsed = new Set<string>();
  private hadAnyFallback = false;
  private allFallbackChains: string[][] = [];

  /**
   * Add metadata from a single API call
   */
  addApiCall(service: string, metadata: GroqApiMetadata): void {
    this.apiCalls.push({
      service,
      model: metadata.modelUsed,
      tokens: metadata.tokensUsed ?? 0,
      hadFallback: metadata.modelFallback,
    });

    this.modelsUsed.add(metadata.modelUsed);

    if (metadata.modelFallback) {
      this.hadAnyFallback = true;
    }

    if (metadata.fallbackChain.length > 0) {
      this.allFallbackChains.push(metadata.fallbackChain);
    }
  }

  /**
   * Get aggregated metadata for database storage
   */
  getAggregated(): AggregatedMetadata {
    // Aggregate all metrics
    let totalTokensUsed = 0;
    const totalTokensPrompt = 0;
    const totalTokensCompletion = 0;

    for (const call of this.apiCalls) {
      totalTokensUsed += call.tokens;
      // Note: prompt/completion breakdown not stored per call
      // Would need to enhance apiCalls structure if needed
    }

    // Find most frequently used model
    const modelCounts = new Map<string, number>();
    for (const call of this.apiCalls) {
      modelCounts.set(call.model, (modelCounts.get(call.model) ?? 0) + 1);
    }

    let primaryModel: string | null = null;
    let maxCount = 0;
    for (const [model, count] of modelCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        primaryModel = model;
      }
    }

    // Flatten all fallback chains (for debugging)
    const allModelsAttempted = new Set<string>();
    for (const chain of this.allFallbackChains) {
      for (const model of chain) {
        allModelsAttempted.add(model);
      }
    }

    return {
      totalApiCalls: this.apiCalls.length,
      totalTokensUsed,
      totalTokensPrompt, // Currently 0 - would need GroqClient enhancement
      totalTokensCompletion, // Currently 0 - would need GroqClient enhancement
      modelsUsed: this.modelsUsed,
      primaryModel,
      hadFallback: this.hadAnyFallback,
      fallbackChain: Array.from(allModelsAttempted),
      apiCalls: this.apiCalls,
    };
  }

  /**
   * Check if any API calls were made
   */
  hasData(): boolean {
    return this.apiCalls.length > 0;
  }
}
