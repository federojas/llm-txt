/**
 * Crawl Result Model
 */

export interface CrawlResult {
  url: string;
  title: string;
  description?: string;
  depth: number;
  statusCode?: number;
}
