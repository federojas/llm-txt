import Groq from "groq-sdk";
import { TokenBucketLimiter } from "../rate-limiter";

interface ModelConfig {
  name: string;
  rpm: number;
  tpm: number;
  rpd: number;
  tpd: number;
}

interface RateLimitState {
  remainingRequests: number;
  remainingTokens: number;
  resetRequests: string;
  resetTokens: string;
  lastUpdated: Date;
}

/**
 * Shared Groq API Client
 * Handles rate limiting, model fallback, and 429 error handling
 * Used by all Groq-based AI services to avoid duplication
 *
 * @see https://console.groq.com/docs/rate-limits
 */
export class GroqClient {
  private client: Groq;
  private rateLimiter: TokenBucketLimiter;

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

  /**
   * Check if Groq is available (has API key)
   */
  isAvailable(): boolean {
    return !!this.client;
  }

  /**
   * Execute a Groq API call with rate limiting and fallback handling
   */
  async executeWithFallback<T>(
    apiCall: (
      model: string,
      client: Groq
    ) => Promise<{ data: T; response: Response }>
  ): Promise<T> {
    await this.rateLimiter.waitForToken();
    this.checkProactiveSwitch();

    let lastError: Error | null = null;

    for (let i = this.currentModelIndex; i < this.models.length; i++) {
      const model = this.models[i];

      try {
        const { data, response } = await apiCall(model.name, this.client);

        // Update rate limit state from response headers
        this.updateRateLimitState(response);

        // Success! Update current model if we switched
        if (i !== this.currentModelIndex) {
          console.log(
            `[GroqClient] Successfully switched to model: ${model.name} (${model.rpd} RPD, ${model.tpd} TPD)`
          );
          this.currentModelIndex = i;
        }

        return data;
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
          const retryAfter = this.extractRetryAfter(error);

          if (i < this.models.length - 1) {
            const nextModel = this.models[i + 1];
            console.warn(
              `[GroqClient] Rate limit hit for ${model.name}${retryAfter ? ` (retry after ${retryAfter}s)` : ""}`,
              `→ Switching to ${nextModel.name}`
            );
            this.currentModelIndex = i + 1;
            continue;
          } else {
            const waitTime = retryAfter
              ? `${retryAfter}s`
              : this.rateLimitState.resetRequests || "a few minutes";
            throw new Error(
              `All Groq models exhausted. Rate limits exceeded. Try again in: ${waitTime}`
            );
          }
        }

        // Non-rate-limit error: don't retry
        break;
      }
    }

    throw new Error(`Groq API error: ${lastError?.message || "Unknown error"}`);
  }

  private updateRateLimitState(response: Response): void {
    try {
      const remainingRequests = response.headers.get(
        "x-ratelimit-remaining-requests"
      );
      const remainingTokens = response.headers.get(
        "x-ratelimit-remaining-tokens"
      );
      const resetRequests = response.headers.get("x-ratelimit-reset-requests");
      const resetTokens = response.headers.get("x-ratelimit-reset-tokens");

      if (remainingRequests !== null) {
        this.rateLimitState = {
          remainingRequests: parseInt(remainingRequests) || Infinity,
          remainingTokens: parseInt(remainingTokens || "0") || Infinity,
          resetRequests: resetRequests || "",
          resetTokens: resetTokens || "",
          lastUpdated: new Date(),
        };

        if (this.rateLimitState.remainingRequests < 100) {
          console.log(
            `[GroqClient] Rate limits for ${this.models[this.currentModelIndex].name}:`,
            `Requests: ${this.rateLimitState.remainingRequests} remaining,`,
            `Tokens: ${this.rateLimitState.remainingTokens} remaining`
          );
        }
      }
    } catch (error) {
      console.debug("[GroqClient] Error parsing rate limit headers:", error);
    }
  }

  private checkProactiveSwitch(): void {
    const currentModel = this.models[this.currentModelIndex];

    if (
      this.rateLimitState.remainingRequests < 50 &&
      this.currentModelIndex < this.models.length - 1
    ) {
      const nextModel = this.models[this.currentModelIndex + 1];
      console.warn(
        `[GroqClient] Proactively switching from ${currentModel.name} to ${nextModel.name}:`,
        `Only ${this.rateLimitState.remainingRequests} requests remaining`
      );
      this.currentModelIndex++;
      this.rateLimitState.remainingRequests = Infinity;
      this.rateLimitState.remainingTokens = Infinity;
    }
  }

  private extractRetryAfter(error: unknown): number | null {
    try {
      const err = error as { response?: Response };
      if (err.response?.headers?.get) {
        const retryAfter = err.response.headers.get("retry-after");
        return retryAfter ? parseInt(retryAfter, 10) : null;
      }
      return null;
    } catch {
      return null;
    }
  }
}
