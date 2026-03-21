/**
 * Crawl Configuration Models
 */

/**
 * Language strategy for filtering crawled content
 */
export type LanguageStrategy =
  | "prefer-english" // Try English first (Accept-Language header), fallback to primary language if no English found
  | "page-language"; // Use whatever language the page serves (maintains single language consistency)

export interface CrawlConfig {
  url: string;
  maxPages: number;
  maxDepth: number;
  timeout: number;
  concurrency: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  languageStrategy?: LanguageStrategy;
}

export interface CrawlOptions extends Partial<CrawlConfig> {
  url: string;
}
