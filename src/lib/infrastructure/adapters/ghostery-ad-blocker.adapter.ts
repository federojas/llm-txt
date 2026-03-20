/**
 * Ghostery Ad Blocker Adapter (Infrastructure Layer)
 * Implementation of IAdBlocker using Ghostery FiltersEngine
 *
 * Uses industry-standard EasyList + EasyPrivacy filters from Ghostery's CDN
 * for comprehensive ad and tracker detection
 */

import { FiltersEngine, makeRequest } from "@ghostery/adblocker";
import { IAdBlocker } from "@/lib/domain/interfaces/ad-blocker.interface";

export class GhosteryAdBlockerAdapter implements IAdBlocker {
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
