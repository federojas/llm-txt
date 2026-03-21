/**
 * DTOs for the Generate LLMs.txt Endpoint
 * Defines request and response types for type-safe API communication
 *
 * These are pure TypeScript interfaces - no coupling to validation frameworks.
 * Validation schemas in the validation layer must conform to these types.
 */

import { LanguageStrategy } from "@/lib/types";

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
