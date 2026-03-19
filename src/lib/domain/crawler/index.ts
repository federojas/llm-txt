import { CrawlConfig, PageMetadata, CrawlProgress } from "@/types";
import { extractMetadata, isIndexable } from "../parser/html";
import { findSitemap, parseSitemap } from "../parser/sitemap";
import { normalizeUrl, getUrlDepth } from "../../utils/url";
import { httpClient } from "../../utils/http-client";

export class Crawler {
  private config: CrawlConfig;
  private visited = new Set<string>();
  private queue: Array<{ url: string; depth: number }> = [];
  private results: PageMetadata[] = [];
  private progressCallback?: (progress: CrawlProgress) => void;
  private abortController = new AbortController();

  constructor(
    config: CrawlConfig,
    progressCallback?: (progress: CrawlProgress) => void
  ) {
    this.config = config;
    this.progressCallback = progressCallback;
  }

  /**
   * Start crawling
   */
  async crawl(): Promise<PageMetadata[]> {
    try {
      this.updateProgress({
        status: "crawling",
        pagesFound: 0,
        pagesProcessed: 0,
        totalPages: this.config.maxPages,
      });

      // Try sitemap first
      const usedSitemap = await this.crawlFromSitemap();

      // If sitemap didn't provide enough pages, crawl manually
      if (!usedSitemap || this.results.length < this.config.maxPages) {
        await this.crawlFromHomepage();
      }

      this.updateProgress({
        status: "complete",
        pagesFound: this.results.length,
        pagesProcessed: this.results.length,
        totalPages: this.results.length,
      });

      return this.results;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.updateProgress({
        status: "error",
        error: errorMessage,
        pagesFound: this.results.length,
        pagesProcessed: this.results.length,
        totalPages: this.config.maxPages,
      });
      throw error;
    }
  }

  /**
   * Try to crawl from sitemap
   */
  private async crawlFromSitemap(): Promise<boolean> {
    const sitemapUrl = await findSitemap(this.config.url);
    if (!sitemapUrl) return false;

    this.updateProgress({
      status: "crawling",
      currentUrl: sitemapUrl,
      pagesFound: 0,
      pagesProcessed: 0,
      totalPages: this.config.maxPages,
    });

    const sitemapUrls = await parseSitemap(sitemapUrl, this.config.maxPages);
    if (sitemapUrls.length === 0) return false;

    // Process URLs from sitemap in batches
    const batches = this.chunkArray(sitemapUrls, this.config.concurrency);

    for (const batch of batches) {
      if (this.results.length >= this.config.maxPages) break;

      await Promise.all(
        batch.map(async ({ url }) => {
          if (this.results.length >= this.config.maxPages) return;
          await this.fetchAndParse(url, 0);
        })
      );
    }

    return true;
  }

  /**
   * Crawl from homepage using BFS
   */
  private async crawlFromHomepage(): Promise<void> {
    const startUrl = normalizeUrl(this.config.url);
    this.queue.push({ url: startUrl, depth: 0 });

    while (
      this.queue.length > 0 &&
      this.results.length < this.config.maxPages
    ) {
      // Process in batches for concurrency
      const batch = this.queue
        .splice(0, this.config.concurrency)
        .filter((item) => item.depth <= this.config.maxDepth);

      await Promise.all(
        batch.map(async ({ url, depth }) => {
          if (this.results.length >= this.config.maxPages) return;
          await this.fetchAndParse(url, depth);
        })
      );
    }
  }

  /**
   * Fetch and parse a single page
   */
  private async fetchAndParse(
    url: string,
    depth: number
  ): Promise<PageMetadata | null> {
    const normalized = normalizeUrl(url);

    // Skip if already visited
    if (this.visited.has(normalized)) return null;
    this.visited.add(normalized);

    try {
      this.updateProgress({
        status: "crawling",
        currentUrl: url,
        pagesFound: this.results.length,
        pagesProcessed: this.visited.size,
        totalPages: this.config.maxPages,
      });

      const response = await httpClient.get(url, {
        timeout: this.config.timeout,
        responseType: "text",
      });

      if (response.status < 200 || response.status >= 300) return null;

      const contentType = response.headers["content-type"];
      if (!contentType?.includes("text/html")) return null;

      const html = response.data as string;

      // Check if indexable
      if (!isIndexable(html)) return null;

      // Extract metadata
      const metadata = extractMetadata(html, url, this.config.url, depth);
      this.results.push(metadata);

      // Add internal links to queue if within depth limit
      if (depth < this.config.maxDepth) {
        for (const link of metadata.internalLinks) {
          const linkDepth = getUrlDepth(link, this.config.url);
          if (linkDepth <= this.config.maxDepth && !this.visited.has(link)) {
            this.queue.push({ url: link, depth: linkDepth });
          }
        }
      }

      return metadata;
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      return null;
    }
  }

  /**
   * Update progress
   */
  private updateProgress(progress: Partial<CrawlProgress>): void {
    if (this.progressCallback) {
      this.progressCallback({
        status: "crawling",
        pagesFound: 0,
        pagesProcessed: 0,
        totalPages: this.config.maxPages,
        ...progress,
      });
    }
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Abort crawling
   */
  abort(): void {
    this.abortController.abort();
  }
}
