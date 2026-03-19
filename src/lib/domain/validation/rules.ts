/**
 * Domain Validation Rules
 * Pure business logic validation - framework-agnostic
 * Can be used by API, CLI, workers, or any other consumer
 */

import { CrawlPreset } from "@/types";

/**
 * Crawl configuration limits (business rules)
 */
export const CRAWL_LIMITS = {
  MIN_PAGES: 1,
  MAX_PAGES: 200,
  MIN_DEPTH: 1,
  MAX_DEPTH: 5,
  MIN_TIMEOUT: 5000,
  MAX_TIMEOUT: 30000,
  MIN_CONCURRENCY: 1,
  MAX_CONCURRENCY: 10,
} as const;

/**
 * Default values for crawl configuration
 */
export const CRAWL_DEFAULTS = {
  MAX_PAGES: 50,
  MAX_DEPTH: 3,
  TIMEOUT: 10000,
  CONCURRENCY: 5,
} as const;

/**
 * Validate maximum pages value
 */
export function validateMaxPages(pages: number): boolean {
  return (
    Number.isInteger(pages) &&
    pages >= CRAWL_LIMITS.MIN_PAGES &&
    pages <= CRAWL_LIMITS.MAX_PAGES
  );
}

/**
 * Validate maximum depth value
 */
export function validateMaxDepth(depth: number): boolean {
  return (
    Number.isInteger(depth) &&
    depth >= CRAWL_LIMITS.MIN_DEPTH &&
    depth <= CRAWL_LIMITS.MAX_DEPTH
  );
}

/**
 * Validate timeout value
 */
export function validateTimeout(timeout: number): boolean {
  return (
    Number.isInteger(timeout) &&
    timeout >= CRAWL_LIMITS.MIN_TIMEOUT &&
    timeout <= CRAWL_LIMITS.MAX_TIMEOUT
  );
}

/**
 * Validate concurrency value
 */
export function validateConcurrency(concurrency: number): boolean {
  return (
    Number.isInteger(concurrency) &&
    concurrency >= CRAWL_LIMITS.MIN_CONCURRENCY &&
    concurrency <= CRAWL_LIMITS.MAX_CONCURRENCY
  );
}

/**
 * Validate URL format (basic check)
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate crawl preset
 */
export function isValidPreset(preset: string): preset is CrawlPreset {
  return ["quick", "thorough", "custom"].includes(preset);
}
