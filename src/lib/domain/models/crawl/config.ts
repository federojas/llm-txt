/**
 * Crawl Configuration Models
 */

export interface CrawlConfig {
  url: string;
  maxPages: number;
  maxDepth: number;
  timeout: number;
  concurrency: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface CrawlOptions extends Partial<CrawlConfig> {
  preset?: CrawlPreset;
}

export type CrawlPreset = "quick" | "thorough" | "custom";
