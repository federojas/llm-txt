/**
 * Token Bucket Rate Limiter
 * Ensures requests stay within a specified rate limit
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per millisecond

  /**
   * @param requestsPerMinute - Maximum requests allowed per minute
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
