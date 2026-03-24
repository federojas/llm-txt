import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { USER_AGENT } from "@/lib/config/constants";
import { isSSRFSafe, getSSRFBlockReason } from "@/lib/api/ssrf";
import { getLogger } from "@/lib/logger";

/**
 * HTTP Client Interface
 */
export interface IHttpClient {
  get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>>;
  head(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>>;
}

/**
 * Default timeout for HTTP requests (milliseconds)
 * Industry standard for web crawlers: 10-15s
 * - Google bot: 10-15s
 * - Most web scrapers: 10s
 * - Balance between: site responsiveness vs not waiting too long for slow/dead sites
 */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Retry configuration constants
 */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000; // Initial delay for exponential backoff
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504] as const;

/**
 * Error codes that warrant HTTPS→HTTP fallback
 */
const CONNECTION_ERROR_CODES = [
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNABORTED",
  "CERT_HAS_EXPIRED",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
] as const;

/**
 * Custom headers for internal tracking
 */
const INTERNAL_HEADERS = {
  REQUEST_ID: "X-Request-ID",
  RETRY_WITH_HTTP: "X-Retry-With-HTTP",
  REQUEST_START_TIME: "X-Request-Start-Time",
  RETRY_COUNT: "X-Retry-Count",
  REDIRECT_COUNT: "X-Redirect-Count",
  REDIRECT_CHAIN: "X-Redirect-Chain",
} as const;

/**
 * Maximum redirects before considering it a redirect loop
 */
const MAX_REDIRECTS = 10;

/**
 * Maximum response size to prevent memory exhaustion attacks
 * 10MB is sufficient for HTML pages (most are < 1MB)
 */
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

/**
 * Default structured logger implementation using Pino
 */
const defaultLogger: Logger = (() => {
  const structuredLogger = getLogger();
  return {
    log: (msg: string) => structuredLogger.debug(msg),
    error: (msg: string) => structuredLogger.error(msg),
    warn: (msg: string) => structuredLogger.warn(msg),
  };
})();

/**
 * Rate limiter for controlling request frequency using token bucket algorithm
 * Implements proper cleanup to prevent memory leaks
 */
class RateLimiter {
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
    settled: boolean; // Track if promise was already settled
  }> = [];
  private tokens: number;
  private lastRefill: number;
  private refillTimerId?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
    private queueTimeout: number = 30000, // max wait time for queued requests
    private maxQueueSize: number = 1000 // max queued requests to prevent memory growth
  ) {
    // Validate inputs
    if (maxTokens <= 0) {
      throw new Error(`maxTokens must be positive, got ${maxTokens}`);
    }
    if (refillRate <= 0) {
      throw new Error(`refillRate must be positive, got ${refillRate}`);
    }
    if (queueTimeout <= 0) {
      throw new Error(`queueTimeout must be positive, got ${queueTimeout}`);
    }
    if (maxQueueSize <= 0) {
      throw new Error(`maxQueueSize must be positive, got ${maxQueueSize}`);
    }
    if (
      !Number.isFinite(maxTokens) ||
      !Number.isFinite(refillRate) ||
      !Number.isFinite(queueTimeout) ||
      !Number.isFinite(maxQueueSize)
    ) {
      throw new Error("Rate limiter parameters must be finite numbers");
    }

    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token, waiting if necessary
   * @throws {Error} If rate limiter is destroyed, queue is full, or queue times out
   */
  async acquire(): Promise<void> {
    if (this.destroyed) {
      throw new Error("RateLimiter has been destroyed");
    }

    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return Promise.resolve();
    }

    // Check if queue is full
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(
        `Rate limiter queue is full (max ${this.maxQueueSize} requests)`
      );
    }

    // Wait for next available token with timeout protection
    return new Promise<void>((resolve, reject) => {
      const item: {
        resolve: () => void;
        reject: (error: Error) => void;
        timeoutId: ReturnType<typeof setTimeout>;
        settled: boolean;
      } = {
        resolve,
        reject,
        timeoutId: undefined as unknown as ReturnType<typeof setTimeout>,
        settled: false,
      };

      item.timeoutId = setTimeout(() => {
        if (item.settled) return; // Already settled by refill

        // Mark as settled and remove from queue
        item.settled = true;
        const index = this.queue.indexOf(item);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        reject(
          new Error(`Rate limiter queue timeout after ${this.queueTimeout}ms`)
        );
      }, this.queueTimeout);

      this.queue.push(item);
      this.scheduleRefill();
    });
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    if (this.destroyed) return;

    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = Math.floor(elapsed * this.refillRate);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;

      // Process queued requests
      while (this.queue.length > 0 && this.tokens > 0) {
        this.tokens--;
        const item = this.queue.shift();
        if (item && !item.settled) {
          item.settled = true;
          clearTimeout(item.timeoutId);
          item.resolve();
        }
      }
    }

    // If queue still has items, schedule next refill to process them
    if (this.queue.length > 0 && !this.destroyed) {
      this.scheduleRefill();
    }
  }

  /**
   * Schedule next refill check
   */
  private scheduleRefill(): void {
    if (this.destroyed || this.refillTimerId) return;

    const delay = 1000 / this.refillRate; // ms until next token
    this.refillTimerId = setTimeout(() => {
      this.refillTimerId = undefined;
      this.refill();
    }, delay);
  }

  /**
   * Destroy rate limiter and clean up resources
   * Resolves all queued requests (they will fail on next acquire() call)
   */
  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;

    // Clear refill timer
    if (this.refillTimerId) {
      clearTimeout(this.refillTimerId);
      this.refillTimerId = undefined;
    }

    // Resolve all queued requests to avoid hanging promises
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item && !item.settled) {
        item.settled = true;
        clearTimeout(item.timeoutId);
        item.resolve(); // Let them proceed - they'll fail on next acquire() check
      }
    }
  }
}

/**
 * Configuration options for HTTP client
 */
export interface HttpClientConfig {
  timeout?: number;
  userAgent?: string;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  rateLimit?: {
    maxRequestsPerSecond: number;
    burst?: number; // Max burst size (default: maxRequestsPerSecond)
  };
  logger?: Logger;
  onRequestStart?: (config: InternalAxiosRequestConfig) => void;
  onRequestEnd?: (
    config: InternalAxiosRequestConfig,
    response: AxiosResponse,
    durationMs: number
  ) => void;
  onRequestError?: (
    config: InternalAxiosRequestConfig | undefined,
    error: AxiosError,
    durationMs?: number
  ) => void;
}

/**
 * Production-grade HTTP client with enterprise features
 *
 * Features:
 * - HTTPS→HTTP fallback on connection errors
 * - Exponential backoff retry with jitter
 * - Rate limiting (token bucket algorithm)
 * - Request correlation IDs for debugging
 * - Request/response logging with injectable logger
 * - Performance metrics tracking
 * - Generic typing for type safety
 * - Configurable timeouts and headers
 * - Extensible via interceptors
 */
class HttpClient {
  private instance: AxiosInstance;
  private config: Required<Omit<HttpClientConfig, "rateLimit">> & {
    rateLimit?: HttpClientConfig["rateLimit"];
  };
  private logger: Logger;
  private rateLimiter?: RateLimiter;

  constructor(config: HttpClientConfig = {}) {
    this.logger = config.logger ?? defaultLogger;

    // Validate numeric config values
    const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    const retryDelay = config.retryDelay ?? DEFAULT_RETRY_DELAY_MS;

    if (timeout <= 0 || !Number.isFinite(timeout)) {
      throw new Error(
        `timeout must be a positive finite number, got ${timeout}`
      );
    }
    if (maxRetries < 0 || !Number.isFinite(maxRetries)) {
      throw new Error(
        `maxRetries must be a non-negative finite number, got ${maxRetries}`
      );
    }
    if (retryDelay <= 0 || !Number.isFinite(retryDelay)) {
      throw new Error(
        `retryDelay must be a positive finite number, got ${retryDelay}`
      );
    }

    this.config = {
      timeout,
      userAgent: config.userAgent ?? USER_AGENT,
      enableLogging: config.enableLogging ?? true,
      enableMetrics: config.enableMetrics ?? false,
      maxRetries,
      retryDelay,
      rateLimit: config.rateLimit,
      logger: this.logger,
      onRequestStart: config.onRequestStart ?? (() => {}),
      onRequestEnd: config.onRequestEnd ?? (() => {}),
      onRequestError: config.onRequestError ?? (() => {}),
    };

    // Initialize rate limiter if configured
    if (this.config.rateLimit) {
      const { maxRequestsPerSecond, burst } = this.config.rateLimit;

      // Validate rate limit config
      if (maxRequestsPerSecond <= 0 || !Number.isFinite(maxRequestsPerSecond)) {
        throw new Error(
          `rateLimit.maxRequestsPerSecond must be a positive finite number, got ${maxRequestsPerSecond}`
        );
      }
      if (burst !== undefined && (burst <= 0 || !Number.isFinite(burst))) {
        throw new Error(
          `rateLimit.burst must be a positive finite number, got ${burst}`
        );
      }

      this.rateLimiter = new RateLimiter(
        burst ?? maxRequestsPerSecond,
        maxRequestsPerSecond,
        30000, // queueTimeout: 30s max wait
        1000 // maxQueueSize: prevent memory growth
      );
    }

    this.instance = axios.create({
      timeout: this.config.timeout,
      maxRedirects: 0, // Disable automatic redirects - we'll handle them manually with SSRF validation
      maxContentLength: MAX_RESPONSE_SIZE, // Prevent memory exhaustion from huge responses
      maxBodyLength: MAX_RESPONSE_SIZE, // Prevent memory exhaustion from huge request bodies
      validateStatus: () => true, // Handle all status codes manually
      headers: {
        "User-Agent": this.config.userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br", // Enable compression (60-80% bandwidth reduction)
        DNT: "1", // Do Not Track
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    this.setupInterceptors();
  }

  /**
   * Generate a universally unique request ID (works in Node.js and browsers)
   */
  private generateRequestId(): string {
    // Use crypto.randomUUID if available (Node 14.17+, modern browsers)
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback: generate UUID v4
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  /**
   * Safely set header value with type checking
   */
  private setHeader(
    config: InternalAxiosRequestConfig,
    key: string,
    value: string
  ): void {
    if (!config.headers) {
      config.headers = {} as InternalAxiosRequestConfig["headers"];
    }
    // Safe cast after null check
    (config.headers as Record<string, string>)[key] = value;
  }

  /**
   * Safely get header value with type checking
   */
  private getHeader(
    config: InternalAxiosRequestConfig,
    key: string
  ): string | undefined {
    if (!config.headers) return undefined;
    const headers = config.headers as Record<string, string | undefined>;
    return headers[key];
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor: Rate limiting, correlation ID, and start time
    this.instance.interceptors.request.use(
      async (config) => {
        // Apply rate limiting (capture reference to avoid race with destroy())
        const rateLimiter = this.rateLimiter;
        if (rateLimiter) {
          try {
            await rateLimiter.acquire();
          } catch (error) {
            // Rate limiter destroyed or timeout
            this.logger.warn(
              `[HTTP] Rate limiter error: ${error instanceof Error ? error.message : "Unknown error"}`
            );
            throw error;
          }
        }

        const requestId = this.generateRequestId();
        const startTime = Date.now();

        // Use safe header setter
        this.setHeader(config, INTERNAL_HEADERS.REQUEST_ID, requestId);
        this.setHeader(
          config,
          INTERNAL_HEADERS.REQUEST_START_TIME,
          startTime.toString()
        );

        if (this.config.enableLogging) {
          this.logger.log(
            `[HTTP] → ${config.method?.toUpperCase()} ${config.url} [${requestId}]`
          );
        }

        this.config.onRequestStart(config);

        return config;
      },
      (error) => {
        this.config.onRequestError(undefined, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor: Logging, metrics, retries, redirect validation, and HTTPS→HTTP fallback
    this.instance.interceptors.response.use(
      async (response) => {
        const duration = this.calculateDuration(response.config);
        const requestId = this.getHeader(
          response.config,
          INTERNAL_HEADERS.REQUEST_ID
        );

        if (this.config.enableLogging) {
          this.logger.log(
            `[HTTP] ← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} [${requestId}] (${duration}ms)`
          );
        }

        if (this.config.enableMetrics) {
          this.config.onRequestEnd(response.config, response, duration);
        }

        // Handle redirects manually with SSRF validation
        const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
        if (isRedirect && response.headers.location) {
          const redirectUrl = response.headers.location;
          const redirectCountStr = this.getHeader(
            response.config,
            INTERNAL_HEADERS.REDIRECT_COUNT
          );
          const redirectCount = parseInt(redirectCountStr || "0", 10);

          // Check redirect limit
          if (redirectCount >= MAX_REDIRECTS) {
            const error = new Error(
              `Too many redirects (max ${MAX_REDIRECTS})`
            ) as AxiosError;
            error.config = response.config;
            error.response = response;
            return Promise.reject(error);
          }

          // Resolve relative URLs
          const absoluteRedirectUrl = new URL(redirectUrl, response.config.url)
            .href;

          // Validate redirect URL against SSRF rules
          if (!isSSRFSafe(absoluteRedirectUrl)) {
            const reason = getSSRFBlockReason(absoluteRedirectUrl);
            const error = new Error(
              `Redirect blocked by SSRF protection: ${reason}`
            ) as AxiosError;
            error.config = response.config;
            error.response = response;

            if (this.config.enableLogging) {
              this.logger.warn(
                `[HTTP] ⚠ Blocked redirect to ${absoluteRedirectUrl}: ${reason} [${requestId}]`
              );
            }

            return Promise.reject(error);
          }

          if (this.config.enableLogging) {
            this.logger.log(
              `[HTTP] ↪ Redirect ${redirectCount + 1}/${MAX_REDIRECTS}: ${absoluteRedirectUrl} [${requestId}]`
            );
          }

          // Follow redirect with updated config
          const redirectConfig: InternalAxiosRequestConfig = {
            ...response.config,
            url: absoluteRedirectUrl,
          };
          // Clone headers to prevent pollution
          if (response.config.headers) {
            redirectConfig.headers = Object.assign({}, response.config.headers);
          }
          this.setHeader(
            redirectConfig,
            INTERNAL_HEADERS.REDIRECT_COUNT,
            (redirectCount + 1).toString()
          );

          // Update redirect chain for debugging
          // Sanitize URLs to only allow valid HTTP header characters (ASCII printable only)
          const sanitizedUrl = absoluteRedirectUrl.replace(/[^\x20-\x7E]/g, "");
          const existingChain = this.getHeader(
            response.config,
            INTERNAL_HEADERS.REDIRECT_CHAIN
          );
          const sanitizedChain = existingChain?.replace(/[^\x20-\x7E]/g, "");
          this.setHeader(
            redirectConfig,
            INTERNAL_HEADERS.REDIRECT_CHAIN,
            sanitizedChain
              ? `${sanitizedChain} -> ${sanitizedUrl}`
              : sanitizedUrl
          );

          // For 303, change method to GET (HTTP spec)
          if (response.status === 303) {
            redirectConfig.method = "GET";
            delete redirectConfig.data;
          }

          return this.instance.request(redirectConfig);
        }

        return response;
      },
      async (error: AxiosError) => {
        const config = error.config;
        const duration = config ? this.calculateDuration(config) : undefined;
        const requestId = config
          ? this.getHeader(config, INTERNAL_HEADERS.REQUEST_ID)
          : undefined;
        const url = config?.url;

        // Log error
        if (this.config.enableLogging) {
          this.logger.error(
            `[HTTP] ✗ ${config?.method?.toUpperCase()} ${url} [${requestId}] - ${error.code} (${duration ?? 0}ms)`
          );
        }

        // Metrics callback
        if (this.config.enableMetrics && config) {
          this.config.onRequestError(config, error, duration);
        }

        // Attempt HTTPS→HTTP fallback on first connection error (before wasting retries)
        if (
          url &&
          url.startsWith("https://") &&
          this.isConnectionError(error) &&
          config &&
          !this.getHeader(config, INTERNAL_HEADERS.RETRY_WITH_HTTP)
        ) {
          const httpUrl = url.replace("https://", "http://");

          if (this.config.enableLogging) {
            this.logger.log(
              `[HTTP] ↻ Retrying with HTTP: ${httpUrl} [${requestId}]`
            );
          }

          // Create new config to avoid header pollution
          const retryConfig: InternalAxiosRequestConfig = {
            ...config,
            url: httpUrl,
          };
          // Clone headers to prevent pollution
          if (config.headers) {
            retryConfig.headers = Object.assign({}, config.headers);
          }
          this.setHeader(retryConfig, INTERNAL_HEADERS.RETRY_WITH_HTTP, "true");
          // Reset retry count so HTTP gets full retry attempts
          this.setHeader(retryConfig, INTERNAL_HEADERS.RETRY_COUNT, "0");
          return this.instance.request(retryConfig);
        }

        // Attempt retry with exponential backoff (pass error for Retry-After parsing)
        if (config && this.shouldRetry(error, config)) {
          return this.retryRequest(config, error);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if request should be retried
   */
  private shouldRetry(
    error: AxiosError,
    config: InternalAxiosRequestConfig
  ): boolean {
    const retryCountStr = this.getHeader(config, INTERNAL_HEADERS.RETRY_COUNT);
    const retryCount = parseInt(retryCountStr || "0", 10);

    if (retryCount >= this.config.maxRetries) {
      return false;
    }

    // Retry on network errors
    if (!error.response && this.isConnectionError(error)) {
      return true;
    }

    // Retry on specific HTTP status codes
    if (
      error.response &&
      RETRYABLE_STATUS_CODES.includes(
        error.response.status as (typeof RETRYABLE_STATUS_CODES)[number]
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Parse Retry-After header value (RFC 7231)
   * Supports both delay-seconds (integer) and HTTP-date formats
   * @returns delay in milliseconds, or null if invalid
   */
  private parseRetryAfter(retryAfter: string | undefined): number | null {
    if (!retryAfter) return null;

    // Try parsing as delay-seconds (integer)
    const delaySeconds = parseInt(retryAfter, 10);
    if (!isNaN(delaySeconds) && delaySeconds > 0) {
      return delaySeconds * 1000; // Convert to milliseconds
    }

    // Try parsing as HTTP-date
    try {
      const retryDate = new Date(retryAfter);
      if (!isNaN(retryDate.getTime())) {
        const delay = retryDate.getTime() - Date.now();
        return delay > 0 ? delay : null;
      }
    } catch {
      // Invalid date format
    }

    return null;
  }

  /**
   * Get retry delay, respecting Retry-After header if present
   * @param error - Axios error object
   * @param retryCount - Current retry attempt number
   * @returns delay in milliseconds
   */
  private getRetryDelay(error: AxiosError, retryCount: number): number {
    // Check for Retry-After header (429 Rate Limit, 503 Service Unavailable)
    const retryAfterHeader = error.response?.headers["retry-after"];
    const retryAfterDelay = this.parseRetryAfter(retryAfterHeader);

    if (retryAfterDelay !== null) {
      // Respect server's Retry-After directive
      // Cap at 60 seconds to prevent excessive waiting
      return Math.min(retryAfterDelay, 60000);
    }

    // Default exponential backoff: delay = baseDelay * 2^retryCount + jitter
    const exponentialDelay = this.config.retryDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000; // Add up to 1s jitter
    return exponentialDelay + jitter;
  }

  /**
   * Retry request with exponential backoff and jitter
   * Respects Retry-After header for 429/503 responses
   */
  private async retryRequest(
    config: InternalAxiosRequestConfig,
    error?: AxiosError
  ): Promise<AxiosResponse> {
    const retryCountStr = this.getHeader(config, INTERNAL_HEADERS.RETRY_COUNT);
    const retryCount = parseInt(retryCountStr || "0", 10);
    const nextRetryCount = retryCount + 1;

    // Calculate delay (respects Retry-After if present)
    const delay = error
      ? this.getRetryDelay(error, retryCount)
      : this.config.retryDelay * Math.pow(2, retryCount) + Math.random() * 1000;

    const requestId = this.getHeader(config, INTERNAL_HEADERS.REQUEST_ID);
    const retryAfterUsed = error?.response?.headers["retry-after"]
      ? " (Retry-After)"
      : "";

    if (this.config.enableLogging) {
      this.logger.warn(
        `[HTTP] ⟳ Retry ${nextRetryCount}/${this.config.maxRetries} after ${Math.round(delay)}ms${retryAfterUsed}: ${config.url} [${requestId}]`
      );
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Update retry count - clone config to avoid header pollution
    const retryConfig: InternalAxiosRequestConfig = { ...config };
    // Clone headers to prevent pollution
    if (config.headers) {
      retryConfig.headers = Object.assign({}, config.headers);
    }
    this.setHeader(
      retryConfig,
      INTERNAL_HEADERS.RETRY_COUNT,
      nextRetryCount.toString()
    );
    return this.instance.request(retryConfig);
  }

  /**
   * Calculate request duration from config metadata
   */
  private calculateDuration(config: InternalAxiosRequestConfig): number {
    const startTime = this.getHeader(
      config,
      INTERNAL_HEADERS.REQUEST_START_TIME
    );
    if (!startTime) return 0;

    return Date.now() - parseInt(startTime, 10);
  }

  /**
   * Check if error is a connection-related error
   */
  private isConnectionError(error: AxiosError): boolean {
    return !!(
      error.code &&
      CONNECTION_ERROR_CODES.includes(
        error.code as (typeof CONNECTION_ERROR_CODES)[number]
      )
    );
  }

  /**
   * HTTP GET request with generic typing
   */
  get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.instance.get<T>(url, config);
  }

  /**
   * HTTP HEAD request with generic typing
   */
  head<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.instance.head<T>(url, config);
  }

  /**
   * HTTP POST request with generic typing
   */
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.instance.post<T>(url, data, config);
  }

  /**
   * HTTP PUT request with generic typing
   */
  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.instance.put<T>(url, data, config);
  }

  /**
   * HTTP DELETE request with generic typing
   */
  delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.instance.delete<T>(url, config);
  }

  /**
   * HTTP PATCH request with generic typing
   */
  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.instance.patch<T>(url, data, config);
  }

  /**
   * Access to raw axios instance for advanced use cases
   */
  getAxiosInstance(): AxiosInstance {
    return this.instance;
  }

  /**
   * Destroy HTTP client and clean up resources
   * Cleans up rate limiter and prevents further requests
   */
  destroy(): void {
    if (this.rateLimiter) {
      this.rateLimiter.destroy();
      this.rateLimiter = undefined;
    }
  }
}

/**
 * Default singleton instance with standard configuration
 * Suitable for most web crawling use cases
 */
export const httpClient = new HttpClient({
  enableLogging: process.env.NODE_ENV === "development",
  enableMetrics: false, // Enable for production monitoring
  maxRetries: 3,
  rateLimit: {
    maxRequestsPerSecond: 5, // Polite crawling: 5 req/s
    burst: 10, // Allow bursts up to 10 requests
  },
});

/**
 * Factory function to create custom HTTP client instances
 * Useful for testing or specialized configurations
 *
 * @example
 * ```typescript
 * const aggressiveClient = createHttpClient({
 *   maxRetries: 5,
 *   rateLimit: { maxRequestsPerSecond: 20 }
 * });
 * ```
 */
export function createHttpClient(config?: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}
