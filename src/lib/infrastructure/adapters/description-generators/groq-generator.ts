import Groq from "groq-sdk";
import { IDescriptionGenerator } from "@/lib/domain/interfaces/description-generator.interface";
import { PageMetadata } from "@/types";
import { TokenBucketLimiter } from "../../utilities/token-bucket-limiter";

interface ModelConfig {
  name: string;
  rpm: number; // Requests per minute
  tpm: number; // Tokens per minute
  rpd: number; // Requests per day
  tpd: number; // Tokens per day
}

interface RateLimitState {
  remainingRequests: number; // x-ratelimit-remaining-requests (RPD)
  remainingTokens: number; // x-ratelimit-remaining-tokens (TPM)
  resetRequests: string; // x-ratelimit-reset-requests
  resetTokens: string; // x-ratelimit-reset-tokens
  lastUpdated: Date;
}

/**
 * Groq description generator with production-grade rate limiting
 * Implements Groq best practices per official documentation:
 * https://console.groq.com/docs/rate-limits
 *
 * RATE LIMITING ARCHITECTURE:
 * 1. TokenBucketLimiter (proactive) - Prevents RPM violations BEFORE sending requests
 * 2. 429 Error Handling (reactive) - Handles TPD/RPD/TPM limit exhaustion
 * 3. Multi-Model Fallback - Switches to higher-limit models when needed
 *
 * PATTERN FOR NEW ADAPTERS:
 * All AI provider adapters should follow this two-layer rate limiting pattern:
 * ```typescript
 * private rateLimiter = new TokenBucketLimiter(providerRPM); // Layer 1: Throttle RPM
 *
 * async generate() {
 *   await this.rateLimiter.waitForToken(); // Wait for rate limit
 *   try {
 *     return await this.callAPI(); // Make request
 *   } catch (error) {
 *     if (error.status === 429) {
 *       // Layer 2: Handle exhaustion (switch models, retry with backoff, etc.)
 *     }
 *   }
 * }
 * ```
 *
 * @see TokenBucketLimiter for RPM throttling details
 * @see callGroqWithFallback for 429 error handling implementation
 */
export class GroqDescriptionGenerator implements IDescriptionGenerator {
  private client: Groq;
  private rateLimiter: TokenBucketLimiter; // Proactive RPM throttling

  // Model priority: Best quality first for our use case (rich descriptions)
  // Typical usage: 50-200 requests/session = well within 1K RPD limit
  private readonly models: ModelConfig[] = [
    {
      name: "llama-3.3-70b-versatile",
      rpm: 30,
      tpm: 12000,
      rpd: 1000,
      tpd: 100000,
    },
    {
      name: "llama-3.1-8b-instant",
      rpm: 30,
      tpm: 6000,
      rpd: 14400,
      tpd: 500000,
    },
  ];

  private currentModelIndex = 0;

  // Track rate limits proactively (updated from response headers)
  private rateLimitState: RateLimitState = {
    remainingRequests: Infinity,
    remainingTokens: Infinity,
    resetRequests: "",
    resetTokens: "",
    lastUpdated: new Date(),
  };

  constructor(apiKey: string, requestsPerMinute: number = 30) {
    this.client = new Groq({ apiKey });
    this.rateLimiter = new TokenBucketLimiter(requestsPerMinute);
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async generateDescription(page: PageMetadata): Promise<string> {
    await this.rateLimiter.waitForToken();

    // Check if we should proactively switch models BEFORE making request
    this.checkProactiveSwitch();

    return this.callGroqWithFallback(async (model: string) => {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: 120,
        messages: [
          {
            role: "user",
            content: `Create a clear, actionable description for this webpage (max 20 words).

Title: ${page.title}
URL: ${page.url}
Meta Description: ${page.description || page.ogDescription || "N/A"}

Guidelines:
- Focus on what users can DO, LEARN, or FIND on this page
- Use active verbs: "Learn", "Explore", "Discover", "Find", "Access"
- Be specific and informative
- Start with the action verb

Good examples:
- "Learn about YouTube's brand resources and guidelines."
- "Explore copyright tools and protections for creators."
- "Find resources for advertisers and business partners."
- "Access YouTube's privacy settings and data controls."

Output only the description, no quotes, no preamble.`,
          },
        ],
      });

      // Update rate limit state from response headers (always present per Groq docs)
      this.updateRateLimitState(response);

      const text = response.choices[0]?.message?.content?.trim() || "";
      return text.replace(/^["']|["']$/g, "");
    });
  }

  async generateBusinessSummary(homepage: PageMetadata): Promise<string> {
    await this.rateLimiter.waitForToken();

    // Check if we should proactively switch models BEFORE making request
    this.checkProactiveSwitch();

    return this.callGroqWithFallback(async (model: string) => {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Write a comprehensive summary for this website that will be consumed by LLMs.

Site Name: ${homepage.siteName || homepage.title}
URL: ${homepage.url}
Description: ${homepage.ogDescription || homepage.description || "N/A"}
H1: ${homepage.h1 || "N/A"}

Structure your response as TWO paragraphs:

PARAGRAPH 1 (2-3 sentences):
- What the platform/service does
- Who the primary users/audience are
- Key value proposition or purpose

PARAGRAPH 2 (2-3 sentences starting with "For LLMs assisting users,"):
- How LLMs should understand and explain this platform
- Key use cases where LLM assistance would be valuable
- Important context, capabilities, or caveats LLMs should know

Output the two paragraphs separated by a blank line. No preamble, no labels.`,
          },
        ],
      });

      // Update rate limit state from response headers (always present per Groq docs)
      this.updateRateLimitState(response);

      return response.choices[0]?.message?.content?.trim() || "";
    });
  }

  /**
   * Update rate limit state from Groq response headers
   * Per Groq docs: All headers (except retry-after) are ALWAYS present in responses
   */
  private updateRateLimitState(response: unknown): void {
    try {
      // Groq SDK may expose headers in different ways depending on version
      // Try multiple access patterns to ensure compatibility
      const res = response as Record<string, unknown>;
      const _request = res?._request as Record<string, unknown> | undefined;
      const _response = res?.response as Record<string, unknown> | undefined;
      const headers =
        (_request?.response as Record<string, unknown> | undefined)?.headers ||
        _response?.headers ||
        res?.headers ||
        null;

      if (!headers) {
        // Log once for debugging, but don't spam
        if (Math.random() < 0.1) {
          console.debug(
            "[Groq] Could not access response headers. Available keys:",
            Object.keys(response || {})
          );
        }
        return;
      }

      // Helper to get header value (handles both Map and object-like headers)
      const getHeader = (name: string): string | null => {
        if (!headers) return null;

        // Type guard for Map-like object with get method
        if (typeof (headers as Record<string, unknown>).get === "function") {
          const mapHeaders = headers as { get: (key: string) => string | null };
          return mapHeaders.get(name);
        }

        // Type guard for object-like headers
        const objHeaders = headers as Record<string, string>;
        return objHeaders[name] || objHeaders[name.toLowerCase()] || null;
      };

      // Extract rate limit info (headers are always present per Groq docs)
      const remainingRequests = getHeader("x-ratelimit-remaining-requests");
      const remainingTokens = getHeader("x-ratelimit-remaining-tokens");
      const resetRequests = getHeader("x-ratelimit-reset-requests");
      const resetTokens = getHeader("x-ratelimit-reset-tokens");

      if (remainingRequests !== null) {
        this.rateLimitState = {
          remainingRequests: parseInt(remainingRequests) || Infinity,
          remainingTokens: parseInt(remainingTokens || "0") || Infinity,
          resetRequests: resetRequests || "",
          resetTokens: resetTokens || "",
          lastUpdated: new Date(),
        };

        // Log rate limit state periodically for monitoring
        if (this.rateLimitState.remainingRequests < 100) {
          console.log(
            `[Groq] Rate limits for ${this.models[this.currentModelIndex].name}:`,
            `Requests: ${this.rateLimitState.remainingRequests} remaining (resets in ${this.rateLimitState.resetRequests}),`,
            `Tokens: ${this.rateLimitState.remainingTokens} remaining (resets in ${this.rateLimitState.resetTokens})`
          );
        }
      }
    } catch (error) {
      // Non-critical: rate limit tracking is a best-effort optimization
      // System will still work via 429 error handling
      console.debug("[Groq] Error parsing rate limit headers:", error);
    }
  }

  /**
   * Proactively check if we should switch models BEFORE hitting rate limits
   * Per Groq best practices: monitor headers to avoid 429 errors
   */
  private checkProactiveSwitch(): void {
    const currentModel = this.models[this.currentModelIndex];

    // If close to exhausting requests (< 50 remaining), switch proactively
    if (
      this.rateLimitState.remainingRequests < 50 &&
      this.currentModelIndex < this.models.length - 1
    ) {
      const nextModel = this.models[this.currentModelIndex + 1];
      console.warn(
        `[Groq] Proactively switching from ${currentModel.name} to ${nextModel.name}:`,
        `Only ${this.rateLimitState.remainingRequests} requests remaining`,
        `(resets in ${this.rateLimitState.resetRequests})`
      );
      this.currentModelIndex++;

      // Reset rate limit state for new model
      this.rateLimitState.remainingRequests = Infinity;
      this.rateLimitState.remainingTokens = Infinity;
    }
  }

  /**
   * Call Groq API with automatic model fallback and retry-after handling
   * Implements Groq best practices from official documentation
   */
  private async callGroqWithFallback<T>(
    apiCall: (model: string) => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = this.currentModelIndex; i < this.models.length; i++) {
      const model = this.models[i];

      try {
        const result = await apiCall(model.name);

        // Success! Update current model if we switched
        if (i !== this.currentModelIndex) {
          console.log(
            `[Groq] Successfully switched to model: ${model.name} (${model.rpd} RPD, ${model.tpd} TPD)`
          );
          this.currentModelIndex = i;
        }

        return result;
      } catch (error: unknown) {
        lastError = error as Error;

        // Check if it's a rate limit error (429)
        const err = error as Record<string, unknown> & {
          message?: string;
          status?: number;
        };
        const isRateLimit =
          err?.status === 429 ||
          err?.message?.includes("rate_limit") ||
          err?.message?.includes("429");

        if (isRateLimit) {
          // Extract retry-after header if present (only on 429 per Groq docs)
          const retryAfter = this.extractRetryAfter(error);

          if (i < this.models.length - 1) {
            // Try next model instead of waiting
            const nextModel = this.models[i + 1];
            console.warn(
              `[Groq] Rate limit hit for ${model.name}${retryAfter ? ` (retry after ${retryAfter}s)` : ""}`,
              `→ Switching to ${nextModel.name} (${nextModel.rpd} RPD, ${nextModel.tpd} TPD)`
            );
            this.currentModelIndex = i + 1;
            continue;
          } else {
            // Last model exhausted - provide helpful error with wait time
            const waitTime = retryAfter
              ? `${retryAfter}s`
              : this.rateLimitState.resetRequests || "a few minutes";
            throw new Error(
              `All Groq models exhausted. Rate limits exceeded. Try again in: ${waitTime}`
            );
          }
        }

        // Non-rate-limit error: don't retry, just throw
        break;
      }
    }

    // All models failed for non-rate-limit reasons
    throw new Error(`Groq API error: ${lastError?.message || "Unknown error"}`);
  }

  /**
   * Extract retry-after value from 429 error response
   * Per Groq docs: retry-after header ONLY present on 429 errors
   */
  private extractRetryAfter(error: unknown): number | null {
    try {
      const err = error as Record<string, unknown>;
      const response = err?.response as Record<string, unknown> | undefined;
      const responseHeaders = response?.headers as
        | Record<string, unknown>
        | undefined;
      const errorHeaders = err?.headers as Record<string, unknown> | undefined;

      // Try multiple access patterns for header extraction
      const retryAfter =
        (typeof responseHeaders?.get === "function"
          ? (responseHeaders as { get: (key: string) => string | null }).get(
              "retry-after"
            )
          : (responseHeaders as Record<string, string> | undefined)?.[
              "retry-after"
            ]) ||
        (typeof errorHeaders?.get === "function"
          ? (errorHeaders as { get: (key: string) => string | null }).get(
              "retry-after"
            )
          : (errorHeaders as Record<string, string> | undefined)?.[
              "retry-after"
            ]) ||
        null;

      return retryAfter ? parseInt(retryAfter, 10) : null;
    } catch {
      return null;
    }
  }
}
