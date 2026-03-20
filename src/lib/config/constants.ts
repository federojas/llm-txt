/**
 * Application Constants
 * Global configuration values used across the application
 */

/**
 * HTTP User-Agent string for web crawler
 * Transparent identification for site owners
 *
 * Format: name/version (+url; description)
 * - name: Project identifier
 * - version: Current version
 * - url: Contact/project URL
 * - description: What the crawler does
 */
export const USER_AGENT =
  "llms-txt-generator/1.0 (+https://github.com/federojas/llm-txt; Federico Rojas - crawler for llms.txt generation)";

/**
 * Project metadata
 */
export const PROJECT_INFO = {
  name: "llms-txt-generator",
  version: "1.0",
  author: "Federico Rojas",
  github: "https://github.com/federojas/llm-txt",
  description: "Automated llms.txt generator for websites",
} as const;

/**
 * Crawler identification for robots.txt
 */
export const CRAWLER_USER_AGENT = "llms-txt-generator";
