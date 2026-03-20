import Groq from "groq-sdk";
import { IDescriptionGenerator } from "@/lib/domain/interfaces/description-generator.interface";
import { PageMetadata } from "@/lib/domain/models";
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
      const { data, response } = await this.client.chat.completions
        .create({
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
        })
        .withResponse();

      // Update rate limit state from response headers (always present per Groq docs)
      this.updateRateLimitState(response);

      const text = data.choices[0]?.message?.content?.trim() || "";
      return text.replace(/^["']|["']$/g, "");
    });
  }

  async generateBusinessSummary(homepage: PageMetadata): Promise<string> {
    await this.rateLimiter.waitForToken();

    // Check if we should proactively switch models BEFORE making request
    this.checkProactiveSwitch();

    return this.callGroqWithFallback(async (model: string) => {
      const { data, response } = await this.client.chat.completions
        .create({
          model,
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `Analyze this website and create a technical summary for LLMs.

Site Name: ${homepage.siteName || homepage.title}
URL: ${homepage.url}
Description: ${homepage.ogDescription || homepage.description || "N/A"}
H1: ${homepage.h1 || "N/A"}
Body Text: ${homepage.bodyText || "N/A"}

Create TWO parts separated by "|||":

FIRST PART (one sentence, 40-60 words):
Write a technical summary mentioning specific technologies/frameworks from the body text above (e.g., "brings together Starlette, Uvicorn, HTMX"). If no tech details are in the body text, describe what the platform does generally.

SECOND PART:
If this is a technical tool/library/framework (not just informational), write "Things to remember when using ${homepage.siteName || homepage.title}:" followed by 3-5 bullet points extracted from the body text above. Use markdown bullets (- ).

If it's just an informational site or body text has no technical details, write only: NONE

IMPORTANT: Do NOT write "PART 1" or "PART 2" as headings. Just output the content directly.

Example output:
"FastHTML is a Python library combining Starlette, Uvicorn, and HTMX for server-rendered applications|||Things to remember when using FastHTML:\n\n- Not compatible with FastAPI syntax\n- Includes Pico CSS support (optional)"

Your output:`,
            },
          ],
        })
        .withResponse();

      // Update rate limit state from response headers (always present per Groq docs)
      this.updateRateLimitState(response);

      return data.choices[0]?.message?.content?.trim() || "";
    });
  }

  async discoverSections(
    pages: PageMetadata[]
  ): Promise<Array<{ name: string; pageIndexes: number[] }>> {
    await this.rateLimiter.waitForToken();

    // Check if we should proactively switch models BEFORE making request
    this.checkProactiveSwitch();

    // Prepare page list for LLM (title + URL for context)
    const pageList = pages
      .map((page, idx) => `${idx}. [${page.title}](${page.url})`)
      .join("\n");

    return this.callGroqWithFallback(async (model: string) => {
      const { data, response } = await this.client.chat.completions
        .create({
          model,
          max_tokens: 1500,
          temperature: 0.3, // Lower temperature for more consistent grouping
          messages: [
            {
              role: "user",
              content: `Analyze these webpage titles and URLs, then group them into logical sections for a table of contents.

Pages:
${pageList}

Create 3-7 sections that group related content together. Use clear, concise section names (2-4 words).

Common patterns to look for:
- Documentation/Guides/Tutorials (technical content)
- About/Company/Mission (informational)
- Legal/Privacy/Terms (policies)
- Creators/Advertisers/Partners (business)
- Blog/News/Press (updates)
- API/Reference (technical resources)

Output as JSON only (no markdown, no explanation):
{
  "sections": [
    {"name": "Section Name", "pageIndexes": [0, 3, 5]},
    {"name": "Another Section", "pageIndexes": [1, 2, 4]}
  ]
}

CRITICAL: Output ONLY valid JSON. Every page index (0-${pages.length - 1}) must appear in exactly one section.`,
            },
          ],
        })
        .withResponse();

      // Update rate limit state from response headers (always present per Groq docs)
      this.updateRateLimitState(response);

      const content = data.choices[0]?.message?.content?.trim() || "{}";

      // Parse JSON response
      try {
        // Strip markdown code blocks if present
        const jsonStr = content
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();

        const parsed = JSON.parse(jsonStr);
        return parsed.sections || [];
      } catch (error) {
        console.error("Failed to parse section grouping JSON:", error);
        console.error("Raw response:", content);
        // Return empty array as fallback
        return [];
      }
    });
  }

  /**
   * Clean page titles in batch to remove redundant suffixes and site names
   * Example: ["About Us - FastHTML - FastHTML", "Docs - Site"] → ["About Us", "Docs"]
   * Uses a single LLM call for all titles for efficiency
   */
  async cleanTitles(titles: string[]): Promise<string[]> {
    // Skip cleaning if no titles or only one title
    if (titles.length === 0) return titles;
    if (titles.length === 1) return titles; // Single title likely clean already

    await this.rateLimiter.waitForToken();
    this.checkProactiveSwitch();

    // Create numbered list of titles for LLM
    const titleList = titles.map((title, idx) => `${idx}. ${title}`).join("\n");

    return this.callGroqWithFallback(async (model: string) => {
      const { data, response } = await this.client.chat.completions
        .create({
          model,
          max_tokens: 800,
          temperature: 0.2, // Low temperature for consistent cleaning
          messages: [
            {
              role: "user",
              content: `Clean these page titles by removing redundant suffixes, site names, and separators.

Titles:
${titleList}

Rules:
1. Remove duplicate words/phrases (e.g., "About - FastHTML - FastHTML" → "About")
2. Remove site name suffixes (e.g., "Documentation - MySite" → "Documentation")
3. Keep the most meaningful part (usually the first segment)
4. If only site name remains, keep it (e.g., "YouTube - YouTube" → "YouTube")
5. Preserve special characters and capitalization

Output as JSON only (no markdown, no explanation):
{
  "titles": ["Cleaned Title 1", "Cleaned Title 2", ...]
}

CRITICAL: Return ${titles.length} cleaned titles in the same order. Output ONLY valid JSON.`,
            },
          ],
        })
        .withResponse();

      this.updateRateLimitState(response);

      const content = data.choices[0]?.message?.content?.trim() || "{}";

      try {
        // Strip markdown code blocks if present
        const jsonStr = content
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();

        const parsed = JSON.parse(jsonStr);
        const cleanedTitles = parsed.titles || [];

        // Validate: must return same number of titles
        if (cleanedTitles.length !== titles.length) {
          console.warn(
            `Title cleaning returned ${cleanedTitles.length} titles, expected ${titles.length}. Using originals.`
          );
          return titles;
        }

        return cleanedTitles;
      } catch (error) {
        console.error("Failed to parse title cleaning JSON:", error);
        console.error("Raw response:", content);
        // Return original titles as fallback
        return titles;
      }
    });
  }

  /**
   * Update rate limit state from Groq response headers
   * Per Groq docs: All headers (except retry-after) are ALWAYS present in responses
   * Uses .withResponse() to access raw HTTP Response object
   */
  private updateRateLimitState(response: Response): void {
    try {
      // Access headers using Response.headers.get() (standard Web API)
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
      const err = error as { response?: Response };

      // Check if error has a Response object with headers
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
