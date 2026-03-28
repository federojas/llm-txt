import { CrawlConfig, PageMetadata, CrawlProgress } from "@/lib/types";
import { IHtmlParser, HtmlParser } from "./parser";
import { IAdBlocker } from "./ad-blocker";
import {
  getUrlDepth,
  isLanguageVariant,
  extractBrandIdentifier,
} from "./boundaries";
import { normalizeUrl } from "@/lib/url/normalization";
import {
  httpClient,
  createHttpClient,
  type IHttpClient,
} from "@/lib/http/client";
import { discoverSitemap, fetchAndParseSitemap } from "@/lib/http/sitemap";
import type { SitemapUrl } from "@/lib/http/sitemap";
import { fetchRobotsTxt, RobotsDirectives } from "@/lib/http/robots";
import { ILanguageDetector } from "./language-detector";
import { LanguageDetector } from "./language-detector";
import { createHash } from "crypto";
import picomatch from "picomatch";
import { createLogger, type Logger } from "@/lib/logger";
import { LinkScorer } from "./link-scoring";

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
  private nonEnglishSkipped = 0; // Track consecutive non-English pages skipped
  private skippedUrls: Array<{ url: string; depth: number }> = []; // URLs skipped due to language
  private relaxedLanguageMode = false; // Enable fallback to other languages
  private robotsDirectives?: RobotsDirectives; // Robots.txt directives
  private crawlDelay?: number; // Delay between requests (milliseconds)
  private lastRequestTime = 0; // Track last request for crawl delay
  private sitemapData = new Map<string, SitemapUrl>(); // URL -> sitemap metadata
  private logger: Logger; // Structured logger
  private httpClient: IHttpClient; // HTTP client (may be customized for crawl-delay)

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

    // Initialize with default HTTP client (may be replaced after robots.txt check)
    this.httpClient = httpClient;

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
          this.logger.info(`Respecting crawl-delay: ${crawlDelaySeconds}s`, {
            event: "crawler.robots_txt.crawl_delay",
            crawlDelaySeconds,
          });

          // Create custom HTTP client with rate limit matching robots.txt
          // crawl-delay: X seconds = 1/X requests per second
          const requestsPerSecond = 1 / crawlDelaySeconds;
          this.httpClient = createHttpClient({
            enableLogging: process.env.NODE_ENV === "development",
            maxRetries: 3,
            rateLimit: {
              maxRequestsPerSecond: requestsPerSecond,
              burst: Math.max(1, Math.ceil(requestsPerSecond * 2)), // Allow small burst
            },
          });

          // Reduce concurrency for sites with explicit crawl-delay (they want slow crawling)
          // Balance between respecting delay and reasonable performance
          if (crawlDelaySeconds >= 1) {
            const originalConcurrency = this.config.concurrency;
            this.config.concurrency = Math.min(this.config.concurrency, 5);
            this.logger.info(
              `Configured HTTP client rate limiting for crawl-delay`,
              {
                event: "crawler.rate_limit.configured",
                crawlDelaySeconds,
                requestsPerSecond,
                originalConcurrency,
                newConcurrency: this.config.concurrency,
              }
            );
          }
        }
      } catch (error) {
        this.logger.warn("Failed to fetch robots.txt, continuing without it", {
          event: "crawler.robots_txt.fetch_failed",
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue crawling even if robots.txt fails
      }

      // ALWAYS crawl homepage first (critical for proper llms.txt generation)
      const homepageUrl = normalizeUrl(this.config.url);
      await this.fetchAndParse(homepageUrl, 0);

      // Try sitemap first
      const sitemapStart = Date.now();
      const { usedSitemap, providedEnoughUrls, isComprehensive } =
        await this.crawlFromSitemap();
      const sitemapDuration = Date.now() - sitemapStart;

      if (usedSitemap) {
        this.logger.info("Sitemap crawl completed", {
          event: "crawler.sitemap.timing",
          duration: sitemapDuration,
          pagesFound: this.results.length,
          providedEnoughUrls,
          isComprehensive,
        });
      }

      // Skip BFS for comprehensive sitemaps (>100 URLs) - they provide good coverage
      // Only run BFS if:
      // 1. No sitemap found, OR
      // 2. Sitemap is not comprehensive (< 100 URLs), OR
      // 3. Sitemap provided URLs but many failed during fetch (results < maxPages)
      const shouldRunBFS =
        !usedSitemap ||
        (!isComprehensive &&
          (!providedEnoughUrls || this.results.length < this.config.maxPages));

      if (shouldRunBFS) {
        const reason = !usedSitemap
          ? "no sitemap found"
          : !isComprehensive
            ? "sitemap not comprehensive (< 100 URLs)"
            : !providedEnoughUrls
              ? "sitemap provided insufficient URLs"
              : "many sitemap URLs failed to fetch";

        this.logger.info(`Running BFS crawl: ${reason}`, {
          event: "crawler.bfs.trigger",
          usedSitemap,
          isComprehensive,
          providedEnoughUrls,
          resultsSoFar: this.results.length,
          maxPages: this.config.maxPages,
        });

        const bfsStart = Date.now();
        await this.crawlFromHomepage();
        const bfsDuration = Date.now() - bfsStart;

        this.logger.info("BFS crawl completed", {
          event: "crawler.bfs.timing",
          duration: bfsDuration,
          pagesFound: this.results.length,
        });
      } else {
        this.logger.info(
          isComprehensive
            ? "Skipping BFS crawl: comprehensive sitemap provides good coverage"
            : "Skipping BFS crawl: sitemap provided sufficient URLs",
          {
            event: "crawler.bfs.skipped",
            isComprehensive,
            providedUrls: this.sitemapData.size,
            successfullyFetched: this.results.length,
            maxPages: this.config.maxPages,
          }
        );
      }

      // No validation needed - both strategies handle empty results gracefully

      this.logger.info("Crawl complete", {
        event: "crawler.crawl.complete",
        pagesFound: this.results.length,
        sitemapEntries: this.sitemapData.size,
        usedSitemap,
        ranBFS: shouldRunBFS,
      });

      // Console log for easy visibility in Docker logs
      console.log(
        `[Crawler Summary] Pages: ${this.results.length}, Sitemap: ${usedSitemap ? "yes" : "no"}, BFS: ${shouldRunBFS ? "yes" : "no"}, Concurrency: ${this.config.concurrency}`
      );

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
   * Returns: { usedSitemap: boolean, providedEnoughUrls: boolean, isComprehensive: boolean }
   * - usedSitemap: whether a sitemap was found and used
   * - providedEnoughUrls: whether sitemap provided >= maxPages URLs
   * - isComprehensive: whether sitemap has >100 URLs (good coverage)
   */
  private async crawlFromSitemap(): Promise<{
    usedSitemap: boolean;
    providedEnoughUrls: boolean;
    isComprehensive: boolean;
  }> {
    const sitemapUrl = await discoverSitemap(this.config.url);
    if (!sitemapUrl)
      return {
        usedSitemap: false,
        providedEnoughUrls: false,
        isComprehensive: false,
      };

    this.updateProgress({
      status: "crawling",
      currentUrl: sitemapUrl,
      pagesFound: 0,
      pagesProcessed: 0,
      totalPages: this.config.maxPages,
    });

    // Fetch ALL sitemap URLs (no limit - returns all non-variant URLs)
    // Language filtering happens during sitemap collection
    // Pass baseUrl for brand-aware filtering in sitemap indexes
    const sitemapUrls = await fetchAndParseSitemap(
      sitemapUrl,
      100000,
      this.config.url
    );
    if (sitemapUrls.length === 0)
      return {
        usedSitemap: false,
        providedEnoughUrls: false,
        isComprehensive: false,
      };

    // Comprehensive sitemap: >100 URLs means site has good sitemap coverage
    const isComprehensiveSitemap = sitemapUrls.length >= 100;
    const providedEnoughUrls = sitemapUrls.length >= this.config.maxPages;

    this.logger.info(
      `Found ${sitemapUrls.length} URLs in sitemap (comprehensive: ${isComprehensiveSitemap})`,
      {
        event: "crawler.sitemap.found",
        urlCount: sitemapUrls.length,
        sitemapUrl,
        providedEnoughUrls,
        isComprehensiveSitemap,
      }
    );

    // Store ALL sitemap data for:
    // 1. Link scoring (uses sitemap priorities)
    // 2. Whitelist filtering (BFS skip URLs not in sitemap)
    for (const sitemapUrl of sitemapUrls) {
      this.sitemapData.set(normalizeUrl(sitemapUrl.url), sitemapUrl);
    }

    // Create minimal PageMetadata objects for scoring (before fetching)
    const pagesForScoring: PageMetadata[] = sitemapUrls.map((sitemapUrl) => ({
      url: sitemapUrl.url,
      title: "", // Not yet fetched
      depth: getUrlDepth(sitemapUrl.url, this.config.url),
      internalLinks: [],
      sitemapPriority: sitemapUrl.priority,
    }));

    // Score all sitemap URLs using LinkScorer (reuses existing scoring logic)
    const linkScorer = new LinkScorer({
      sitemapData: this.sitemapData,
      robotsDirectives: this.robotsDirectives,
      minScoreThreshold: 0, // Don't filter yet, we want all URLs sorted
    });

    const scores = await linkScorer.scoreLinks(pagesForScoring);

    // Convert to sorted array - PRIORITIZE BY BRAND, THEN HOSTNAME, THEN DEPTH
    // Sort by: 1) brand match, 2) hostname match, 3) depth, 4) score
    const baseHostname = new URL(this.config.url).hostname;
    const baseBrand = extractBrandIdentifier(baseHostname);
    const scoredUrls = Array.from(scores.entries())
      .map(([url, score]) => {
        const hostname = new URL(url).hostname;
        return {
          url,
          depth: pagesForScoring.find((p) => p.url === url)?.depth ?? 0,
          priority: this.sitemapData.get(normalizeUrl(url))?.priority,
          totalScore: score.totalScore,
          signals: score.signals,
          hostname,
          brand: extractBrandIdentifier(hostname),
        };
      })
      .sort((a, b) => {
        // Primary: same brand as base (youtube.com, artists.youtube, health.youtube all match)
        const aMatchesBrand = a.brand === baseBrand && a.brand !== null;
        const bMatchesBrand = b.brand === baseBrand && b.brand !== null;
        if (aMatchesBrand !== bMatchesBrand) {
          return aMatchesBrand ? -1 : 1;
        }

        // Secondary: within same brand, prioritize exact hostname (www.youtube.com over artists.youtube)
        const aMatchesHostname = a.hostname === baseHostname;
        const bMatchesHostname = b.hostname === baseHostname;
        if (aMatchesHostname !== bMatchesHostname) {
          return aMatchesHostname ? -1 : 1;
        }

        // Tertiary: sort by depth (shallower first)
        if (a.depth !== b.depth) {
          return a.depth - b.depth;
        }

        // Quaternary: sort by total score (higher first)
        return b.totalScore - a.totalScore;
      });

    this.logger.info("Sitemap URLs scored and sorted", {
      event: "crawler.sitemap.scoring",
      totalUrls: scoredUrls.length,
      baseBrand,
      baseHostname,
      topScores: scoredUrls.slice(0, 10).map((u) => ({
        url: u.url,
        brand: u.brand,
        hostname: u.hostname,
        depth: u.depth,
        priority: u.priority,
        totalScore: u.totalScore.toFixed(1),
        signals: u.signals,
      })),
    });

    this.logger.info("Processing sitemap URLs", {
      event: "crawler.sitemap.processing",
      urlCount: Math.min(scoredUrls.length, this.config.maxPages),
      totalAvailable: scoredUrls.length,
      pagesBefore: this.results.length,
    });

    // Fetch top N URLs by total score (not just priority)
    let fetchedCount = 0;
    for (const scored of scoredUrls) {
      if (this.results.length >= this.config.maxPages) break;
      await this.fetchAndParse(scored.url, scored.depth);
      fetchedCount++;
    }

    this.logger.info("Sitemap processing complete", {
      event: "crawler.sitemap.complete",
      pagesAfter: this.results.length,
      urlsProcessed: fetchedCount,
      providedEnoughUrls,
      isComprehensiveSitemap,
    });

    return {
      usedSitemap: true,
      providedEnoughUrls,
      isComprehensive: isComprehensiveSitemap,
    };
  }

  /**
   * Crawl from homepage using BFS
   */
  private async crawlFromHomepage(): Promise<void> {
    const startUrl = normalizeUrl(this.config.url);
    this.queue.push({ url: startUrl, depth: 0 });

    let batchCount = 0;
    let totalBatchTime = 0;
    let totalHttpTime = 0;

    while (
      this.queue.length > 0 &&
      this.results.length < this.config.maxPages
    ) {
      batchCount++;
      const batchStart = Date.now();

      // Sort queue by depth (shallow pages first) for better quality
      this.queue.sort((a, b) => a.depth - b.depth);

      // Process in batches for concurrency
      // Limit batch size to prevent exceeding maxPages
      const remainingSlots = this.config.maxPages - this.results.length;
      const batchSize = Math.min(this.config.concurrency, remainingSlots);
      const batch = this.queue
        .splice(0, batchSize)
        .filter((item) => item.depth <= this.config.maxDepth);

      this.logger.debug(`Processing batch ${batchCount}`, {
        event: "crawler.bfs.batch.start",
        batchSize: batch.length,
        queueRemaining: this.queue.length,
        pagesFound: this.results.length,
      });

      const batchResults = await Promise.all(
        batch.map(async ({ url, depth }) => {
          if (this.results.length >= this.config.maxPages) return null;

          const requestStart = Date.now();
          const result = await this.fetchAndParse(url, depth);
          const requestDuration = Date.now() - requestStart;

          return { result, requestDuration };
        })
      );

      // Aggregate timing stats from batch
      const batchHttpTime = batchResults
        .filter((r) => r !== null)
        .reduce((sum, r) => sum + (r?.requestDuration || 0), 0);
      totalHttpTime += batchHttpTime;

      const batchDuration = Date.now() - batchStart;
      totalBatchTime += batchDuration;

      this.logger.debug(`Batch ${batchCount} completed`, {
        event: "crawler.bfs.batch.complete",
        batchDuration,
        batchSize: batch.length,
        avgRequestTime: Math.round(batchHttpTime / batch.length),
        pagesFound: this.results.length,
      });
    }

    // Log final BFS statistics
    this.logger.info("BFS crawl statistics", {
      event: "crawler.bfs.stats",
      totalBatches: batchCount,
      totalBatchTime,
      avgBatchTime: Math.round(totalBatchTime / batchCount),
      totalHttpTime,
      avgHttpTime: Math.round(totalHttpTime / this.results.length),
      concurrency: this.config.concurrency,
    });
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
      this.logger.debug("Skipping language variant URL", {
        event: "crawler.fetch.skip.language_variant",
        url,
        reason: "Language variant URL",
      });
      return null;
    }

    // Generic sitemap-based filtering: Skip URLs that are NOT in sitemap when:
    // 1. We have sitemap data (site provides a sitemap)
    // 2. We're beyond depth 1 (give homepage + immediate children a chance)
    // Rationale: Sitemaps contain pages the site owner wants crawled.
    // Links beyond sitemap are often examples/testimonials/user-generated content.
    if (this.sitemapData.size > 0 && depth > 1) {
      const isInSitemap = this.sitemapData.has(normalizeUrl(url));
      if (!isInSitemap) {
        this.logger.debug("Skipping URL not in sitemap", {
          event: "crawler.fetch.skip.not_in_sitemap",
          url,
          depth,
          reason: "URL not in sitemap (likely example/testimonial content)",
        });
        return null;
      }
    }

    this.logger.debug("Fetching page", {
      event: "crawler.fetch.start",
      url,
      depth,
    });
    const normalized = normalizeUrl(url);

    // Skip if already visited
    if (this.visited.has(normalized)) {
      return null;
    }
    this.visited.add(normalized);

    // Check include/exclude patterns (skip homepage to ensure we always get at least one page)
    const isHomepage = normalizeUrl(url) === normalizeUrl(this.config.url);
    if (!isHomepage && this.shouldFilterUrl(url)) {
      this.logger.debug("Skipping URL excluded by pattern filter", {
        event: "crawler.fetch.skip.pattern_filter",
        url,
        reason: "Excluded by include/exclude patterns",
      });
      return null;
    }

    // Check robots.txt (skip homepage to ensure we always get at least one page)
    if (!isHomepage && this.robotsDirectives) {
      if (!this.robotsDirectives.isAllowed(url)) {
        this.logger.debug("Skipping URL disallowed by robots.txt", {
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

      const httpStart = Date.now();
      const response = await this.httpClient.get(url, {
        timeout: this.config.timeout,
        responseType: "text",
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      const httpDuration = Date.now() - httpStart;

      // Enhanced error handling for bot protection and rate limiting
      if (response.status === 403) {
        this.logger.warn(
          "Site blocked access - may be bot protection, geographic restrictions, or rate limiting",
          {
            event: "crawler.fetch.http_403",
            url,
            status: 403,
            suggestions: [
              "Check if site has sitemap.xml (automatically used)",
              "Contact site owner for API access",
              "Manual submission of llms.txt",
            ],
          }
        );
        return null;
      }

      if (response.status === 429) {
        this.logger.warn(
          "Rate limited by site despite respecting 5 req/s max and robots.txt crawl-delay",
          {
            event: "crawler.fetch.http_429",
            url,
            status: 429,
            crawlDelaySeconds: this.crawlDelay
              ? this.crawlDelay / 1000
              : undefined,
            suggestions: [
              "Using sitemap.xml instead (automatically attempted)",
              "Reducing maxPages in request",
              "Trying again later",
            ],
          }
        );
        return null;
      }

      if (response.status < 200 || response.status >= 300) {
        return null;
      }

      const contentType = response.headers["content-type"];
      if (!contentType?.includes("text/html")) return null;

      const html = response.data as string;

      // Check if indexable
      if (!this.htmlParser.isIndexable(html)) return null;

      // Extract metadata (async due to external link filtering)
      const parseStart = Date.now();
      const metadata = await this.htmlParser.extractMetadata(
        html,
        url,
        this.config.url,
        depth
      );
      const parseDuration = Date.now() - parseStart;

      // Log discovered links for debugging
      this.logger.debug("Page parsed with links", {
        event: "crawler.parse.links",
        url,
        depth,
        internalLinksCount: metadata.internalLinks.length,
        internalLinks: metadata.internalLinks.slice(0, 5), // First 5 for debugging
      });

      // Duplicate content detection: hash page content (title + description + body text)
      // This catches different URLs serving identical content (e.g., /page vs /page?ref=twitter)
      const contentSignature = `${metadata.title}|${metadata.description || ""}|${metadata.bodyText || ""}`;
      const contentHash = createHash("sha256")
        .update(contentSignature)
        .digest("hex")
        .substring(0, 16); // Use first 16 chars for efficiency

      // Skip if we've seen this exact content before
      if (this.contentHashes.has(contentHash)) {
        this.logger.debug("Skipping duplicate content", {
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
          // Track skipped URL for potential re-processing if fallback triggers
          this.skippedUrls.push({ url, depth });
          this.logger.debug("Skipping page by language filter", {
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

      const totalFetchTime = httpDuration + parseDuration;

      this.logger.debug("Page fetched successfully", {
        event: "crawler.fetch.success",
        url,
        depth,
        totalPages: this.results.length + 1,
        title: metadata.title,
        sitemapPriority: metadata.sitemapPriority,
        timing: {
          http: httpDuration,
          parse: parseDuration,
          total: totalFetchTime,
          httpPercent: ((httpDuration / totalFetchTime) * 100).toFixed(1),
          parsePercent: ((parseDuration / totalFetchTime) * 100).toFixed(1),
        },
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
      this.logger.error("Failed to fetch page", {
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
        this.nonEnglishSkipped = 0; // Reset counter on English content
        return false;
      }

      // Graceful degradation: If 3+ consecutive non-English pages skipped, accept primary language
      // Triggers after homepage + 3 skipped links = fallback on 4th non-English page
      if (this.nonEnglishSkipped >= 3 && this.englishPagesFound === 0) {
        if (!this.relaxedLanguageMode) {
          this.relaxedLanguageMode = true;

          // Re-queue all previously skipped URLs for re-processing
          const requeued = this.skippedUrls.length;
          for (const skipped of this.skippedUrls) {
            this.queue.push(skipped);
          }
          this.skippedUrls = []; // Clear the list

          this.logger.warn(
            `Skipped ${this.nonEnglishSkipped} consecutive non-English pages. Accepting site's primary language (${detectedLang}). Re-queued ${requeued} skipped URLs.`,
            {
              event: "crawler.language.relaxed_mode",
              consecutiveSkips: this.nonEnglishSkipped,
              detectedLanguage: detectedLang,
              requeuedUrls: requeued,
            }
          );
        }
        return false; // Accept non-English page
      }

      // Skip this non-English page and increment counter
      this.nonEnglishSkipped++;
      this.logger.debug("Skipping non-English page", {
        event: "crawler.language.skip_non_english",
        url,
        detectedLanguage: detectedLang,
        strategy: "prefer-english",
        consecutiveSkips: this.nonEnglishSkipped,
      });
      return true;
    }

    // Default: skip non-English
    return true;
  }

  /**
   * Abort crawling
   */
  abort(): void {
    this.abortController.abort();
  }
}
