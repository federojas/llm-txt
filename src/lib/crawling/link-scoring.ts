/**
 * Link Scoring System
 * Ranks pages by relevance/importance using multiple signals
 *
 * Data-driven approach: Uses sitemap priorities, depth, and robots.txt data
 * (not hardcoded URL patterns)
 */

import { PageMetadata } from "@/lib/types";
import type { SitemapUrl } from "@/lib/http/sitemap";
import type { RobotsDirectives } from "@/lib/http/robots";

export interface LinkScore {
  url: string;
  totalScore: number;
  signals: {
    sitemapPriority: number; // 0-40 points (site owner's signal)
    depth: number; // 0-30 points (shallower = more important)
    robotsAllowed: number; // 0-20 points (allowed = 20, disallowed = 0)
    semanticRelevance: number; // 0-10 points (optional AI enhancement)
  };
}

export interface LinkScorerConfig {
  sitemapData: Map<string, SitemapUrl>;
  robotsDirectives?: RobotsDirectives;
  minScoreThreshold?: number; // Default: 40
}

/**
 * Link Scorer
 * Calculates relevance scores for pages using multiple signals
 */
export class LinkScorer {
  private config: LinkScorerConfig;
  private minScoreThreshold: number;

  constructor(config: LinkScorerConfig) {
    this.config = config;
    this.minScoreThreshold = config.minScoreThreshold ?? 40;
  }

  /**
   * Score all pages and return Map of url -> LinkScore
   * Also filters out pages below minimum threshold
   */
  async scoreLinks(pages: PageMetadata[]): Promise<Map<string, LinkScore>> {
    const scores = new Map<string, LinkScore>();

    for (const page of pages) {
      const score = this.scorePage(page);

      // Only include pages above threshold
      if (score.totalScore >= this.minScoreThreshold) {
        scores.set(page.url, score);
      }
    }

    return scores;
  }

  /**
   * Score a single page using all signals
   */
  private scorePage(page: PageMetadata): LinkScore {
    const sitemapPriority = this.scoreSitemapPriority(
      page.url,
      this.config.sitemapData
    );
    const depth = this.scoreDepth(page.depth);
    const robotsAllowed = this.scoreRobotsAllowed(
      page.url,
      this.config.robotsDirectives
    );
    const semanticRelevance = 5; // Neutral default (Phase 3 enhancement)

    const totalScore =
      sitemapPriority + depth + robotsAllowed + semanticRelevance;

    return {
      url: page.url,
      totalScore,
      signals: {
        sitemapPriority,
        depth,
        robotsAllowed,
        semanticRelevance,
      },
    };
  }

  /**
   * Score based on sitemap priority (0-40 points)
   * Site owner's signal - MOST IMPORTANT
   *
   * Formula: (priority || 0.5) * 40
   * - Priority 1.0 (highest) → 40 points
   * - Priority 0.5 (default) → 20 points
   * - Not in sitemap → 0 points (likely user-generated content)
   *
   * Rationale: Pages not in sitemap are likely user-generated content (profiles, channels, etc.)
   * that the site owner doesn't want indexed. This is a generic heuristic that works across all sites.
   */
  private scoreSitemapPriority(
    url: string,
    sitemapData: Map<string, SitemapUrl>
  ): number {
    const sitemapEntry = sitemapData.get(url);

    // If not in sitemap, give 0 points - likely user-generated content
    if (!sitemapEntry) {
      return 0;
    }

    const priority = sitemapEntry.priority ?? 0.5; // Default to 0.5 if priority not specified
    return priority * 40;
  }

  /**
   * Score based on URL depth (0-30 points)
   * Shallower pages are more important
   *
   * Formula: max(0, 30 - depth * 7.5)
   * - Depth 0 (homepage) → 30 points
   * - Depth 1 → 22.5 points
   * - Depth 2 → 15 points
   * - Depth 3 → 7.5 points
   * - Depth 4+ → 0 points
   */
  private scoreDepth(depth: number): number {
    return Math.max(0, 30 - depth * 7.5);
  }

  /**
   * Score based on robots.txt rules (0-20 points)
   * Filters out admin panels, internal tools, etc.
   *
   * - Allowed → 20 points
   * - Disallowed → 0 points (should be filtered out)
   * - No robots.txt → 20 points (assume allowed)
   */
  private scoreRobotsAllowed(
    url: string,
    robotsDirectives?: RobotsDirectives
  ): number {
    if (!robotsDirectives) return 20; // No robots.txt = assume allowed

    const isAllowed = robotsDirectives.isAllowed(url);
    return isAllowed ? 20 : 0;
  }
}

/**
 * Convenience function to score and filter pages
 * Returns only pages above threshold, sorted by score (high to low)
 */
export async function scoreAndFilterPages(
  pages: PageMetadata[],
  config: LinkScorerConfig
): Promise<{ page: PageMetadata; score: LinkScore }[]> {
  const scorer = new LinkScorer(config);
  const scores = await scorer.scoreLinks(pages);

  // Combine pages with their scores
  const scoredPages = pages
    .map((page) => {
      const score = scores.get(page.url);
      return score ? { page, score } : null;
    })
    .filter(
      (item): item is { page: PageMetadata; score: LinkScore } => item !== null
    );

  // Sort by total score (high to low)
  scoredPages.sort((a, b) => b.score.totalScore - a.score.totalScore);

  return scoredPages;
}
