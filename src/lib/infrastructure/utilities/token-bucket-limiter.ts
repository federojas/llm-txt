/**
 * Token Bucket Rate Limiter
 *
 * PURPOSE: Client-side throttling to prevent exceeding API rate limits (RPM)
 *
 * USE CASE: AI provider adapters (Groq, OpenAI, Anthropic, etc.) that have
 * requests-per-minute (RPM) limits. This prevents hitting 429 errors by
 * throttling requests BEFORE they're sent.
 *
 * EXAMPLE:
 * ```typescript
 * // Groq free tier: 30 RPM
 * private limiter = new TokenBucketLimiter(30);
 *
 * async generateDescription(page: PageMetadata) {
 *   await this.limiter.waitForToken(); // Throttles to 30 RPM
 *   return await this.client.chat.completions.create({...});
 * }
 * ```
 *
 * NOTE: This handles RPM throttling. For handling actual 429 errors (TPD/RPD limits),
 * implement retry logic with exponential backoff in your adapter.
 *
 * @see GroqDescriptionGenerator for complete implementation example
 */
export class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per millisecond

  /**
   * @param requestsPerMinute - Maximum requests allowed per minute (e.g., 30 for Groq free tier)
   * @param burstCapacity - Optional burst capacity (defaults to requestsPerMinute)
   */
  constructor(
    requestsPerMinute: number,
    burstCapacity: number = requestsPerMinute
  ) {
    this.capacity = burstCapacity;
    this.tokens = burstCapacity;
    this.refillRate = requestsPerMinute / 60000; // convert to per-millisecond
    this.lastRefill = Date.now();
  }

  /**
   * Wait until a token is available, then consume it
   */
  async waitForToken(): Promise<void> {
    while (true) {
      this.refillTokens();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      // Calculate wait time until next token is available
      const tokensNeeded = 1 - this.tokens;
      const waitTime = Math.ceil(tokensNeeded / this.refillRate);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }
}
