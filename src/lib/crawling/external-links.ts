/**
 * External Links
 * Quality filtering for external links in llms.txt
 *
 * Uses industry-standard practices:
 * - Ghostery ad blocker (EasyList + EasyPrivacy) - blocks ads, trackers, social media
 * - HTML rel attributes (nofollow, sponsored, ugc) - web standards
 * - HTML context analysis (main content vs footer/nav) - content quality signals
 *
 * No hardcoded domain lists - delegates to battle-tested external tools
 */

import { IAdBlocker } from "./ad-blocker";

/**
 * Check if external link should be included
 *
 * Filtering strategy:
 * 1. rel attributes - Sites mark low-quality links with rel="nofollow" or rel="sponsored"
 * 2. Ad blocker - EasyList/EasyPrivacy blocks ads, trackers, social media embeds
 * 3. HTML context - Links in <main>/<article> are higher quality than <footer>/<nav>
 */
export async function isValuableExternalLink(
  url: string,
  adBlocker: IAdBlocker,
  relAttribute?: string,
  isInMainContent?: boolean
): Promise<boolean> {
  try {
    // Signal 1: Check rel attribute (HTML standard)
    if (relAttribute) {
      const rel = relAttribute.toLowerCase();
      if (
        rel.includes("nofollow") ||
        rel.includes("sponsored") ||
        rel.includes("ugc")
      ) {
        return false;
      }
    }

    // Signal 2: Use ad blocker (industry standard)
    // EasyList/EasyPrivacy blocks ads, trackers, and social media
    if (await adBlocker.isBlocked(url)) {
      return false;
    }

    // Signal 3: Prioritize main content links
    // Links in <footer>, <nav>, <aside> are usually boilerplate
    if (isInMainContent === false) {
      return false;
    }

    // Passed all filters - include the link
    return true;
  } catch {
    return false;
  }
}
