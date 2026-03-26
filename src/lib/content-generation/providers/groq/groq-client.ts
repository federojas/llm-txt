import Groq from "groq-sdk";
import { TokenBucketLimiter } from "../../shared/rate-limiter";
import { getLogger } from "@/lib/logger";

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

export interface GroqApiMetadata {
  modelUsed: string;
  modelFallback: boolean;
  fallbackChain: string[];
  tokensUsed: number | null;
  tokensPrompt: number | null;
  tokensCompletion: number | null;
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
  private logger = getLogger();

  private readonly models: ModelConfig[] = [
    {
      name: "llama-3.3-70b-versatile",
      rpm: 30,
      tpm: 12000,
      rpd: 1000,
      tpd: 100000,
    },
    {
      name: "meta-llama/llama-4-scout-17b-16e-instruct",
      rpm: 30,
      tpm: 30000, // 2.5x more tokens/min than llama-3.3-70b
      rpd: 1000,
      tpd: 500000, // 5x more tokens/day than llama-3.3-70b
    },
    {
      name: "llama-3.1-8b-instant",
      rpm: 30,
      tpm: 6000,
      rpd: 14400, // Highest daily request limit - safety net
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
   * Returns both the data and metadata about the API call (model used, tokens, etc.)
   */
  async executeWithFallback<T>(
    apiCall: (
      model: string,
      client: Groq
    ) => Promise<{ data: T; response: Response }>
  ): Promise<{ data: T; metadata: GroqApiMetadata }> {
    const startTime = Date.now();
    await this.rateLimiter.waitForToken();
    this.checkProactiveSwitch();

    let lastError: Error | null = null;
    const fallbackChain: string[] = [];
    const originalModelIndex = this.currentModelIndex; // Store original to detect fallback

    for (let i = this.currentModelIndex; i < this.models.length; i++) {
      const model = this.models[i];
      fallbackChain.push(model.name);

      try {
        this.logger.debug("Groq API request", {
          event: "groq.api.request",
          model: model.name,
          rpm: model.rpm,
          tpm: model.tpm,
        });

        const { data, response } = await apiCall(model.name, this.client);

        const duration = Date.now() - startTime;

        // Extract token usage from response headers
        const tokenUsage = this.extractTokenUsage(response);

        // Update rate limit state from response headers
        this.updateRateLimitState(response);

        this.logger.info("Groq API success", {
          event: "groq.api.success",
          model: model.name,
          duration,
          tokensUsed: tokenUsage.tokensUsed,
          remainingRequests: this.rateLimitState.remainingRequests,
          remainingTokens: this.rateLimitState.remainingTokens,
        });

        // Success! Check if we used a fallback model
        const modelFallback = i !== originalModelIndex;
        if (modelFallback) {
          this.logger.info(`Successfully switched to model: ${model.name}`, {
            event: "groq.model.switch",
            from: this.models[originalModelIndex].name,
            to: model.name,
            rpd: model.rpd,
            tpd: model.tpd,
          });
          this.currentModelIndex = i;
        }

        return {
          data,
          metadata: {
            modelUsed: model.name,
            modelFallback,
            fallbackChain,
            ...tokenUsage,
          },
        };
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
          const duration = Date.now() - startTime;

          if (i < this.models.length - 1) {
            const nextModel = this.models[i + 1];
            this.logger.warn(
              `Rate limit hit for ${model.name}, switching to ${nextModel.name}`,
              {
                event: "groq.rate_limit.switch",
                model: model.name,
                nextModel: nextModel.name,
                retryAfter,
                duration,
              }
            );
            this.currentModelIndex = i + 1;
            continue;
          } else {
            const waitTime = retryAfter
              ? `${retryAfter}s`
              : this.rateLimitState.resetRequests || "a few minutes";
            this.logger.error(
              `All Groq models exhausted. Try again in: ${waitTime}`,
              {
                event: "groq.rate_limit.exhausted",
                model: model.name,
                retryAfter,
                resetTime: this.rateLimitState.resetRequests,
                duration,
              }
            );
            throw new Error(
              `All Groq models exhausted. Rate limits exceeded. Try again in: ${waitTime}`
            );
          }
        }

        // Non-rate-limit error: log and don't retry
        this.logger.error("Groq API error", {
          event: "groq.api.error",
          model: model.name,
          error: lastError?.message,
          duration: Date.now() - startTime,
        });

        // Non-rate-limit error: don't retry
        break;
      }
    }

    throw new Error(`Groq API error: ${lastError?.message || "Unknown error"}`);
  }

  private extractTokenUsage(response: Response): {
    tokensUsed: number | null;
    tokensPrompt: number | null;
    tokensCompletion: number | null;
  } {
    try {
      // Groq returns token usage in x-groq header (JSON encoded)
      const groqHeader = response.headers.get("x-groq");
      if (groqHeader) {
        const groqData = JSON.parse(groqHeader) as {
          usage?: {
            total_tokens?: number;
            prompt_tokens?: number;
            completion_tokens?: number;
          };
        };
        if (groqData.usage) {
          return {
            tokensUsed: groqData.usage.total_tokens ?? null,
            tokensPrompt: groqData.usage.prompt_tokens ?? null,
            tokensCompletion: groqData.usage.completion_tokens ?? null,
          };
        }
      }
    } catch (error) {
      this.logger.debug("Error parsing token usage from headers", {
        event: "groq.token_usage.parse_error",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      tokensUsed: null,
      tokensPrompt: null,
      tokensCompletion: null,
    };
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
          this.logger.debug(
            `Low rate limit: ${this.rateLimitState.remainingRequests} requests remaining`,
            {
              event: "groq.rate_limit.low",
              model: this.models[this.currentModelIndex].name,
              remainingRequests: this.rateLimitState.remainingRequests,
              remainingTokens: this.rateLimitState.remainingTokens,
              resetRequests: this.rateLimitState.resetRequests,
            }
          );
        }
      }
    } catch (error) {
      this.logger.debug("Error parsing rate limit headers", {
        event: "groq.rate_limit.parse_error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private checkProactiveSwitch(): void {
    const currentModel = this.models[this.currentModelIndex];

    if (
      this.rateLimitState.remainingRequests < 50 &&
      this.currentModelIndex < this.models.length - 1
    ) {
      const nextModel = this.models[this.currentModelIndex + 1];
      this.logger.warn(
        `Proactively switching from ${currentModel.name} to ${nextModel.name}`,
        {
          event: "groq.proactive_switch",
          from: currentModel.name,
          to: nextModel.name,
          remainingRequests: this.rateLimitState.remainingRequests,
        }
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
