/**
 * Ad Blocker
 * Ghostery implementation using EasyList + EasyPrivacy filters
 */

import { FiltersEngine, makeRequest } from "@ghostery/adblocker";

/**
 * Ad Blocker Interface
 * Abstraction for ad/tracker detection
 */
export interface IAdBlocker {
  isBlocked(url: string): Promise<boolean>;
}

export class AdBlocker implements IAdBlocker {
  // Singleton engine instance (loaded once, reused across all calls)
  private enginePromise: Promise<FiltersEngine> | null = null;

  /**
   * Check if URL is blocked by EasyList/EasyPrivacy filters
   */
  async isBlocked(url: string): Promise<boolean> {
    try {
      const engine = await this.getEngine();
      const request = makeRequest({
        url,
        type: "document",
      });
      const { match } = engine.match(request);
      return match;
    } catch (error) {
      // If engine fails, don't block (fail open)
      console.warn("Ghostery FiltersEngine error:", error);
      return false;
    }
  }

  /**
   * Get or initialize FiltersEngine
   * Loads pre-built engine from Ghostery's CDN for performance
   */
  private async getEngine(): Promise<FiltersEngine> {
    if (this.enginePromise === null) {
      this.enginePromise = FiltersEngine.fromPrebuiltAdsAndTracking(fetch);
    }
    return this.enginePromise;
  }
}
