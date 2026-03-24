import { CrawlConfig, PageMetadata, CrawlProgress } from "@/lib/types";
import { IHtmlParser, HtmlParser } from "./parser";
import { IAdBlocker } from "./ad-blocker";
import { getUrlDepth, isLanguageVariant } from "./boundaries";
import { normalizeUrl } from "@/lib/url/normalization";
import { httpClient } from "@/lib/http/client";
import { discoverSitemap, fetchAndParseSitemap } from "@/lib/http/sitemap";
import type { SitemapUrl } from "@/lib/http/sitemap";
import { fetchRobotsTxt, RobotsDirectives } from "@/lib/http/robots";
import { ILanguageDetector } from "./language-detector";
import { LanguageDetector } from "./language-detector";
import { createHash } from "crypto";
import picomatch from "picomatch";
import { createLogger, type Logger } from "@/lib/logger";

/**
 * Crawler Service (Application Layer)
 * Orchestrates website crawling with BFS strategy
 *
 * Note: This is an application service (not domain service) because it has
 * infrastructure dependencies (HTTP clients, adapters). It belongs in the
 * application layer as it orchestrates domain logic with infrastructure.
 */
export class Crawler {
  private config: CrawlConfig;
  private visited = new Set<string>();
  private contentHashes = new Set<string>(); // Track content hashes for duplicate detection
  private queue: Array<{ url: string; depth: number }> = [];
  private results: PageMetadata[] = [];
  private progressCallback?: (progress: CrawlProgress) => void;
  private abortController = new AbortController();
  private htmlParser: IHtmlParser;
  private languageDetector: ILanguageDetector;
  private englishPagesFound = 0; // Track English pages for graceful degradation
  private relaxedLanguageMode = false; // Enable fallback to other languages
  private robotsDirectives?: RobotsDirectives; // Robots.txt directives
  private crawlDelay?: number; // Delay between requests (milliseconds)
  private lastRequestTime = 0; // Track last request for crawl delay
  private sitemapData = new Map<string, SitemapUrl>(); // URL -> sitemap metadata
  private logger: Logger; // Structured logger

  // Pattern filtering (inspired by llmstxt tool)
  private isExcluded?: (path: string) => boolean; // Exclude pattern matcher
  private isIncluded?: (path: string) => boolean; // Include pattern matcher

  constructor(
    config: CrawlConfig,
    htmlParser?: IHtmlParser,
    progressCallback?: (progress: CrawlProgress) => void,
    languageDetector?: ILanguageDetector,
    adBlocker?: IAdBlocker
  ) {
    this.config = config;
    // If htmlParser not provided, create HtmlParser with adBlocker
    if (htmlParser) {
      this.htmlParser = htmlParser;
    } else if (adBlocker) {
      this.htmlParser = new HtmlParser(adBlocker);
    } else {
      throw new Error("Either htmlParser or adBlocker must be provided");
    }
    this.progressCallback = progressCallback;
    // Default to "prefer-english" strategy if not specified
    this.config.languageStrategy = config.languageStrategy || "prefer-english";
    this.languageDetector = languageDetector || new LanguageDetector();

    // Initialize structured logger
    this.logger = createLogger({
      url: config.url,
      maxPages: config.maxPages,
      maxDepth: config.maxDepth,
    });

    // Initialize pattern matchers (inspired by llmstxt tool)
    // Use picomatch for glob pattern matching: "**/blog/**", "**/docs/**"
    const excludePatterns = config.excludePatterns || [];
    const includePatterns = config.includePatterns || [];

    if (excludePatterns.length > 0) {
      this.isExcluded = picomatch(excludePatterns);
    }
    if (includePatterns.length > 0) {
      // Include patterns should also respect exclude patterns
      this.isIncluded = picomatch(includePatterns, {
        ignore: excludePatterns,
      });
    }
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

      // Fetch robots.txt directives at the start
      try {
        this.robotsDirectives = await fetchRobotsTxt(this.config.url);
        const crawlDelaySeconds = this.robotsDirectives.getCrawlDelay();
        if (crawlDelaySeconds) {
          this.crawlDelay = crawlDelaySeconds * 1000; // Convert to milliseconds
          this.logger.info({
            event: "crawler.robots_txt.crawl_delay",
            crawlDelaySeconds,
            message: `Respecting crawl-delay: ${crawlDelaySeconds}s`,
          });
        }
      } catch (error) {
        this.logger.warn({
          event: "crawler.robots_txt.fetch_failed",
          error: error instanceof Error ? error.message : String(error),
          message: "Failed to fetch robots.txt, continuing without it",
        });
        // Continue crawling even if robots.txt fails
      }

      // ALWAYS crawl homepage first (critical for proper llms.txt generation)
      const homepageUrl = normalizeUrl(this.config.url);
      await this.fetchAndParse(homepageUrl, 0);

      // Try sitemap first
      const usedSitemap = await this.crawlFromSitemap();

      // If sitemap didn't provide enough pages, crawl manually
      if (!usedSitemap || this.results.length < this.config.maxPages) {
        await this.crawlFromHomepage();
      }

      // No validation needed - both strategies handle empty results gracefully

      this.logger.info({
        event: "crawler.crawl.complete",
        pagesFound: this.results.length,
        sitemapEntries: this.sitemapData.size,
        usedSitemap,
        message: "Crawl complete",
      });

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
    const sitemapUrl = await discoverSitemap(this.config.url);
    if (!sitemapUrl) return false;

    this.updateProgress({
      status: "crawling",
      currentUrl: sitemapUrl,
      pagesFound: 0,
      pagesProcessed: 0,
      totalPages: this.config.maxPages,
    });

    const sitemapUrls = await fetchAndParseSitemap(
      sitemapUrl,
      this.config.maxPages
    );
    if (sitemapUrls.length === 0) return false;

    this.logger.info({
      event: "crawler.sitemap.found",
      urlCount: sitemapUrls.length,
      sitemapUrl,
      message: `Found ${sitemapUrls.length} URLs in sitemap`,
    });

    // Sort by priority (highest first) to crawl important pages before hitting limit
    // Priority is 0.0-1.0, with 1.0 being highest priority
    sitemapUrls.sort((a, b) => (b.priority || 0.5) - (a.priority || 0.5));

    // Store sitemap data for classification
    for (const sitemapUrl of sitemapUrls) {
      this.sitemapData.set(normalizeUrl(sitemapUrl.url), sitemapUrl);
    }

    this.logger.info({
      event: "crawler.sitemap.processing",
      urlCount: sitemapUrls.length,
      pagesBefore: this.results.length,
      message: "Processing sitemap URLs",
    });

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

    this.logger.info({
      event: "crawler.sitemap.complete",
      pagesAfter: this.results.length,
      message: "Sitemap processing complete",
    });

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
      // Sort queue by depth (shallow pages first) for better quality
      this.queue.sort((a, b) => a.depth - b.depth);

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
   * Check if URL should be filtered by include/exclude patterns
   * Inspired by llmstxt tool's pattern filtering
   */
  private shouldFilterUrl(url: string): boolean {
    // Path excluded by pattern
    if (this.isExcluded && this.isExcluded(url)) {
      return true;
    }

    // Path effectively excluded (not in include list when includes are specified)
    if (this.isIncluded && !this.isIncluded(url)) {
      return true;
    }

    return false;
  }

  /**
   * Fetch and parse a single page
   */
  private async fetchAndParse(
    url: string,
    depth: number
  ): Promise<PageMetadata | null> {
    // Skip language variant URLs (like /intl/ar/, /intl/ALL_bg/)
    if (isLanguageVariant(url)) {
      this.logger.debug({
        event: "crawler.fetch.skip.language_variant",
        url,
        reason: "Language variant URL",
      });
      return null;
    }

    this.logger.debug({
      event: "crawler.fetch.start",
      url,
      depth,
    });
    const normalized = normalizeUrl(url);

    // Skip if already visited
    if (this.visited.has(normalized)) return null;
    this.visited.add(normalized);

    // Check include/exclude patterns (skip homepage to ensure we always get at least one page)
    const isHomepage = normalizeUrl(url) === normalizeUrl(this.config.url);
    if (!isHomepage && this.shouldFilterUrl(url)) {
      this.logger.debug({
        event: "crawler.fetch.skip.pattern_filter",
        url,
        reason: "Excluded by include/exclude patterns",
      });
      return null;
    }

    // Check robots.txt (skip homepage to ensure we always get at least one page)
    if (!isHomepage && this.robotsDirectives) {
      if (!this.robotsDirectives.isAllowed(url)) {
        this.logger.debug({
          event: "crawler.fetch.skip.robots_txt",
          url,
          reason: "Disallowed by robots.txt",
        });
        return null;
      }
    }

    // Respect crawl-delay from robots.txt
    if (this.crawlDelay && this.lastRequestTime > 0) {
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.crawlDelay) {
        const waitTime = this.crawlDelay - timeSinceLastRequest;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
    this.lastRequestTime = Date.now();

    try {
      this.updateProgress({
        status: "crawling",
        currentUrl: url,
        pagesFound: this.results.length,
        pagesProcessed: this.visited.size,
        totalPages: this.config.maxPages,
      });

      // Conditionally add Accept-Language header for prefer-english strategy
      const headers: Record<string, string> = {};
      if (this.config.languageStrategy === "prefer-english") {
        headers["Accept-Language"] = "en-US,en;q=0.9";
      }

      const response = await httpClient.get(url, {
        timeout: this.config.timeout,
        responseType: "text",
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });

      // Enhanced error handling for bot protection and rate limiting
      if (response.status === 403) {
        this.logger.warn({
          event: "crawler.fetch.http_403",
          url,
          status: 403,
          message:
            "Site blocked access - may be bot protection, geographic restrictions, or rate limiting",
          suggestions: [
            "Check if site has sitemap.xml (automatically used)",
            "Contact site owner for API access",
            "Manual submission of llms.txt",
          ],
        });
        return null;
      }

      if (response.status === 429) {
        this.logger.warn({
          event: "crawler.fetch.http_429",
          url,
          status: 429,
          crawlDelaySeconds: this.crawlDelay
            ? this.crawlDelay / 1000
            : undefined,
          message:
            "Rate limited by site despite respecting 5 req/s max and robots.txt crawl-delay",
          suggestions: [
            "Using sitemap.xml instead (automatically attempted)",
            "Reducing maxPages in request",
            "Trying again later",
          ],
        });
        return null;
      }

      if (response.status < 200 || response.status >= 300) return null;

      const contentType = response.headers["content-type"];
      if (!contentType?.includes("text/html")) return null;

      const html = response.data as string;

      // Check if indexable
      if (!this.htmlParser.isIndexable(html)) return null;

      // Extract metadata (async due to external link filtering)
      const metadata = await this.htmlParser.extractMetadata(
        html,
        url,
        this.config.url,
        depth
      );

      // Duplicate content detection: hash page content (title + description + body text)
      // This catches different URLs serving identical content (e.g., /page vs /page?ref=twitter)
      const contentSignature = `${metadata.title}|${metadata.description || ""}|${metadata.bodyText || ""}`;
      const contentHash = createHash("sha256")
        .update(contentSignature)
        .digest("hex")
        .substring(0, 16); // Use first 16 chars for efficiency

      // Skip if we've seen this exact content before
      if (this.contentHashes.has(contentHash)) {
        this.logger.debug({
          event: "crawler.fetch.skip.duplicate_content",
          url,
          contentHash,
          reason: "Content matches existing page",
        });
        return null;
      }
      this.contentHashes.add(contentHash);

      // Extract Content-Language header from HTTP response
      const contentLanguageHeader = response.headers["content-language"];

      // Language filtering based on strategy
      const detectedLang = await this.languageDetector.detectLanguage(
        url,
        metadata.lang,
        contentLanguageHeader,
        `${metadata.title} ${metadata.description || ""}` // Text for franc-min fallback
      );

      // Track English pages for graceful degradation
      if (detectedLang === "en") {
        this.englishPagesFound++;
      }

      // Apply language filtering based on strategy (except for homepage)
      // Homepage was already checked at the top of this method
      if (!isHomepage) {
        const shouldSkip = this.shouldSkipPage(detectedLang, url);
        if (shouldSkip) {
          this.logger.debug({
            event: "crawler.fetch.skip.language_filter",
            url,
            detectedLanguage: detectedLang,
            strategy: this.config.languageStrategy,
            reason: "Language filter",
          });
          return null;
        }
      }

      // Add sitemap priority if available (for better classification)
      const sitemapInfo = this.sitemapData.get(normalized);
      if (sitemapInfo?.priority !== undefined) {
        metadata.sitemapPriority = sitemapInfo.priority;
      }

      this.logger.debug({
        event: "crawler.fetch.success",
        url,
        depth,
        totalPages: this.results.length + 1,
        title: metadata.title,
        sitemapPriority: metadata.sitemapPriority,
      });
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
      this.logger.error({
        event: "crawler.fetch.error",
        url,
        depth,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Get sitemap data collected during crawl
   * Returns Map of URL -> sitemap metadata (priority, lastmod)
   */
  getSitemapData(): Map<string, SitemapUrl> {
    return this.sitemapData;
  }

  /**
   * Get robots.txt directives fetched during crawl
   * Returns directives or undefined if robots.txt not available
   */
  getRobotsDirectives(): RobotsDirectives | undefined {
    return this.robotsDirectives;
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
   * Determine if page should be skipped based on language strategy
   */
  private shouldSkipPage(detectedLang: string, url: string): boolean {
    const strategy = this.config.languageStrategy || "prefer-english";

    // Strategy 1: "page-language" - Accept whatever language the page serves
    // No filtering - accepts all languages (may result in mixed-language output for geo-aware sites)
    if (strategy === "page-language") {
      return false;
    }

    // Strategy 2: "prefer-english" - Prefer English, graceful degradation to primary language
    if (strategy === "prefer-english") {
      // If page is English, always accept
      if (detectedLang === "en") {
        return false;
      }

      const totalProcessed = this.visited.size;

      // Graceful degradation: If no English found after 2+ pages, accept primary language
      // Low threshold ensures we quickly adapt to non-English-only sites
      if (totalProcessed >= 2 && this.englishPagesFound === 0) {
        if (!this.relaxedLanguageMode) {
          this.relaxedLanguageMode = true;
          this.logger.warn({
            event: "crawler.language.relaxed_mode",
            totalProcessed,
            detectedLanguage: detectedLang,
            message: `No English content found after ${totalProcessed} pages. Accepting primary site language (${detectedLang}).`,
          });
        }
        return false; // Accept non-English page
      }

      // Otherwise, skip non-English pages (prefer English)
      this.logger.debug({
        event: "crawler.language.skip_non_english",
        url,
        detectedLanguage: detectedLang,
        strategy: "prefer-english",
      });
      return true;
    }

    // Default: skip non-English
    return true;
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
