/**
 * Crawl Progress Tracking
 */

export interface CrawlProgress {
  status: "idle" | "crawling" | "processing" | "complete" | "error";
  currentUrl?: string;
  pagesFound: number;
  pagesProcessed: number;
  totalPages: number;
  error?: string;
}
