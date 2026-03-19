import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";

/**
 * HTTP client with HTTPS-first strategy and automatic fallback to HTTP on connection errors
 * Singleton instance configured with interceptors for production-grade extensibility
 */
class HttpClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      timeout: 30000,
      validateStatus: () => true, // Don't throw on non-2xx status codes
      headers: {
        "User-Agent": "LLMsTxtGenerator/1.0",
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup response interceptor for HTTPS→HTTP fallback on connection errors
   */
  private setupInterceptors(): void {
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config;
        const url = config?.url;

        // Check if we should retry with HTTP
        if (
          url &&
          url.startsWith("https://") &&
          this.isConnectionError(error) &&
          !config?.headers?.["X-Retry-With-HTTP"] // Prevent infinite retry loop
        ) {
          console.log(
            `HTTPS connection failed for ${url} (${error.code}), retrying with HTTP...`
          );

          const httpUrl = url.replace("https://", "http://");
          return this.instance.request({
            ...config,
            url: httpUrl,
            headers: {
              ...config.headers,
              "X-Retry-With-HTTP": "true", // Mark as retry to prevent loop
            },
          });
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if error is a connection-related error that warrants HTTP fallback
   */
  private isConnectionError(error: AxiosError): boolean {
    return !!(
      error.code &&
      [
        "ECONNREFUSED",
        "ENOTFOUND",
        "ETIMEDOUT",
        "ECONNRESET",
        "CERT_HAS_EXPIRED",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        "ERR_TLS_CERT_ALTNAME_INVALID",
      ].includes(error.code)
    );
  }

  /**
   * HTTP methods - delegates to configured axios instance
   */
  get(url: string, config?: AxiosRequestConfig) {
    return this.instance.get(url, config);
  }

  head(url: string, config?: AxiosRequestConfig) {
    return this.instance.head(url, config);
  }

  post(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.post(url, data, config);
  }

  put(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.put(url, data, config);
  }

  delete(url: string, config?: AxiosRequestConfig) {
    return this.instance.delete(url, config);
  }

  patch(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.patch(url, data, config);
  }

  /**
   * Access to raw axios instance for advanced use cases
   */
  getAxiosInstance(): AxiosInstance {
    return this.instance;
  }
}

// Export singleton instance
export const httpClient = new HttpClient();
