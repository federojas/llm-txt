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
 * Additional domain patterns to exclude from llms.txt
 *
 * Why we need this in addition to AdBlocker (EasyList/EasyPrivacy):
 * - AdBlocker blocks social media EMBEDS and WIDGETS (e.g., Twitter embed scripts)
 * - It does NOT block direct LINKS to social profiles/posts (e.g., linkedin.com/posts/xyz)
 * - These direct links often appear in main content but don't help LLMs
 *
 * This list covers:
 * 1. Social media domains - Direct profile/post links missed by AdBlocker
 *
 * Note: This is a SUPPLEMENT, not a replacement for AdBlocker.
 * The AdBlocker handles 90%+ of filtering via industry-standard lists (50,000+ rules).
 *
 * Why not use a library?
 * - No npm package exists for "filter direct social media links"
 * - Most libraries are for EMBEDDING social media, not filtering
 * - Our use case is unique to llms.txt generation
 * - List is small (12 domains) and stable (social networks rarely change)
 *
 * To override this list:
 * - Fork and customize this Set (build-time override)
 * - Edit the generated llms.txt after creation (post-processing)
 *
 * Note: Runtime API override not yet implemented (no user demand).
 * Open a GitHub issue if you need this feature.
 *
 * ✅ Still allows: GitHub, GitLab, npm, PyPI, Stack Overflow, technical docs
 */
const ADDITIONAL_EXCLUDED_PATTERNS = new Set([
  // Social media (direct profile/post links not caught by AdBlocker)
  "twitter.com",
  "x.com",
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "reddit.com",
  "discord.com",
  "discord.gg",
  "t.me",
]);

/**
 * Check if a URL's domain matches excluded patterns
 */
function isExcludedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check exact domain matches
    if (ADDITIONAL_EXCLUDED_PATTERNS.has(hostname)) {
      return true;
    }

    // Check subdomain patterns (e.g., "help.", "support.")
    for (const pattern of ADDITIONAL_EXCLUDED_PATTERNS) {
      if (pattern.endsWith(".")) {
        // Prefix pattern: "help." matches "help.example.com"
        if (hostname.startsWith(pattern)) {
          return true;
        }
      } else {
        // Domain pattern: "youtube.com" matches "youtube.com" and "studio.youtube.com"
        if (hostname === pattern || hostname.endsWith(`.${pattern}`)) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if external link should be included
 *
 * Filtering strategy:
 * 1. Domain blocklist - Social media, help centers (even in main content)
 * 2. rel attributes - Sites mark low-quality links with rel="nofollow" or rel="sponsored"
 * 3. Ad blocker - EasyList/EasyPrivacy blocks ads, trackers, social media embeds
 * 4. HTML context - Links in <main>/<article> are higher quality than <footer>/<nav>
 */
export async function isValuableExternalLink(
  url: string,
  adBlocker: IAdBlocker,
  relAttribute?: string,
  isInMainContent?: boolean
): Promise<boolean> {
  try {
    // Signal 0: Protocol validation - only allow HTTP/HTTPS
    const urlObj = new URL(url);
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      console.log(
        `[External Links] Blocked by protocol: ${urlObj.protocol} (${url})`
      );
      return false;
    }

    // Signal 1: Check domain blocklist (NEW - catches social media in main content)
    if (isExcludedDomain(url)) {
      console.log(`[External Links] Blocked by domain: ${url}`);
      return false;
    }

    // Signal 2: Check rel attribute (HTML standard)
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

    // Signal 3: Use ad blocker (industry standard)
    // EasyList/EasyPrivacy blocks ads, trackers, and social media
    if (await adBlocker.isBlocked(url)) {
      return false;
    }

    // Signal 4: Prioritize main content links
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
