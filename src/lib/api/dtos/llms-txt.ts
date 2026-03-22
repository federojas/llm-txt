/**
 * DTOs for the Generate LLMs.txt Endpoint
 * Defines request and response types for type-safe API communication
 *
 * These are pure TypeScript interfaces - no coupling to validation frameworks.
 * Validation schemas in the validation layer must conform to these types.
 */

import { LanguageStrategy } from "@/lib/types";

/**
 * Content generation mode
 * - "ai": Use LLM for descriptions and summaries (default, ~51 API calls)
 * - "metadata": Use HTML meta tags only (faster, no API cost)
 *
 * Note: Title cleaning always uses heuristics (language-agnostic, free)
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
  maxPages?: number;
  maxDepth?: number;
  timeout?: number;
  concurrency?: number;
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
  };
}

export interface GenerateResponse {
  success: true;
  data: GenerateResponseData;
}
