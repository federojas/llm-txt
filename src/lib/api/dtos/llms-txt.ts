/**
 * DTOs for the Generate LLMs.txt Endpoint
 * Defines request and response types for type-safe API communication
 *
 * These are pure TypeScript interfaces - no coupling to validation frameworks.
 * Validation schemas in the validation layer must conform to these types.
 */

import { LanguageStrategy } from "@/lib/types";

/**
 * Page description generation mode
 * - "ai": Use AI for page descriptions (best for sites with poor metadata, ~50 API calls)
 * - "metadata": Use HTML meta tags for page descriptions (faster, free, good for most sites)
 *
 * Note: Site summary and section clustering always use AI (with fallback to heuristics)
 */
export type GenerationMode = "ai" | "metadata";

/**
 * Title cleanup configuration
 */
export interface TitleCleanup {
  removePatterns?: string[]; // Regex patterns to remove from titles
  replacements?: Array<{
    pattern: string;
    replacement: string;
  }>;
}

// Request DTO
export interface GenerateRequest {
  url: string;
  maxPages?: number; // Default: 50 (user-configurable crawl scope)
  maxDepth?: number; // Default: 3 (user-configurable crawl depth)
  includePatterns?: string[];
  excludePatterns?: string[];
  languageStrategy?: LanguageStrategy;

  // Manual overrides (Phase 1: User control)
  projectName?: string; // Override auto-detected project name
  projectDescription?: string; // Override AI-generated summary

  // Generation mode (Phase 1: Performance/cost optimization)
  generationMode?: GenerationMode;

  // Title cleanup (Phase 1: Output quality)
  titleCleanup?: TitleCleanup;
}

// Response DTOs
export interface GenerateResponseData {
  content: string;
  stats: {
    pagesFound: number;
    url: string;
    // Performance metrics for cost tracking and analytics
    apiCallsCount?: number; // Total API calls made
    tokensUsed?: number; // Actual tokens consumed (from API response)
    tokensPrompt?: number; // Prompt tokens used
    tokensCompletion?: number; // Completion tokens used
    // AI model tracking
    modelUsed?: string; // Primary model used (e.g., "llama-3.3-70b-versatile")
    modelFallback?: boolean; // Whether we switched models due to rate limits
    fallbackChain?: string[]; // All models tried (for debugging)
    // Quality metrics
    validation?: {
      valid: boolean;
      errors: string[];
      warnings: string[];
      sectionsCount: number;
      linkCount: number;
      lineCount: number;
    };
    // Crawl statistics
    crawlStats?: {
      linksDiscovered: number; // Total links found
      linksFiltered: number; // Filtered by relevance scoring
      linksCrawled: number; // Actually crawled (< maxPages)
      robotsTxtBlocked?: number; // Blocked by robots.txt
      sitemapUrls?: number; // URLs found in sitemap
      avgRelevanceScore?: number; // Average link score
    };
  };
}

export interface GenerateResponse {
  success: true;
  data: GenerateResponseData;
}
