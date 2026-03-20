/**
 * Ad Blocker Interface (Domain Layer)
 * Abstraction for ad/tracker detection
 *
 * Allows domain logic to check if URLs are ads/trackers without depending
 * on specific ad blocking implementations (Ghostery, uBlock, custom rules)
 */

export interface IAdBlocker {
  /**
   * Check if URL should be blocked as ad/tracker
   *
   * @param url - URL to check
   * @returns true if URL is ad/tracker, false otherwise
   */
  isBlocked(url: string): Promise<boolean>;
}
