/**
 * Application Constants
 * Global configuration values used across the application
 */

/**
 * HTTP User-Agent string for web crawler
 * Browser-like string with transparent bot identification
 *
 * Format: bot-identifier (+url) browser-string
 * - Starts with bot identifier for transparency
 * - Includes contact URL for site owners
 * - Includes browser string to reduce false positive blocks
 *
 * This is an ethical approach: transparent about being a bot while
 * appearing more legitimate to reduce overly aggressive blocking.
 */
export const USER_AGENT =
  "llms-txt-bot/1.0 (+https://github.com/federojas/llms-txt) Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Project metadata
 */
export const PROJECT_INFO = {
  name: "llms-txt-generator",
  version: "1.0",
  author: "Federico Rojas",
  github: "https://github.com/federojas/llms-txt",
  description: "Automated llms.txt generator for websites",
} as const;

/**
 * Crawler identification for robots.txt
 */
export const CRAWLER_USER_AGENT = "llms-txt-generator";
