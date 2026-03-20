import { PageMetadata } from "@/lib/domain/models";

/**
 * Interface for crawler service
 * Orchestrates website crawling with BFS strategy
 */
export interface ICrawlerService {
  /**
   * Start crawling a website
   * @returns Array of crawled page metadata
   */
  crawl(): Promise<PageMetadata[]>;

  /**
   * Abort the crawling process
   */
  abort(): void;
}
