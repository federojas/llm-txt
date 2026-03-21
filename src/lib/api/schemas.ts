/**
 * API Validation Schemas
 * Zod schemas for HTTP request validation
 * Combines domain business rules with API security concerns
 *
 * Schemas use `satisfies z.ZodType<DTO>` to ensure they conform to DTO interfaces.
 * This decouples DTOs from validation framework while maintaining type safety.
 */

import { z } from "zod";
import { CRAWL_LIMITS, CRAWL_DEFAULTS } from "@/lib/crawling/validation";
import { isSSRFSafe } from "@/lib/api";
import type { GenerateRequest } from "@/lib/api";

/**
 * URL validation schema with SSRF protection
 */
export const urlSchema = z
  .string()
  .url("Must be a valid URL")
  .refine(
    (url) => url.startsWith("http://") || url.startsWith("https://"),
    "URL must start with http:// or https://"
  )
  .refine((url) => isSSRFSafe(url), "URL is not allowed (SSRF protection)");

/**
 * Crawl preset schema
 */
export const crawlPresetSchema = z.enum(["quick", "thorough", "custom"]);

/**
 * Language strategy schema
 */
export const languageStrategySchema = z.enum([
  "prefer-english",
  "page-language",
]);

/**
 * Full crawl configuration schema (with defaults)
 */
export const crawlConfigSchema = z.object({
  url: urlSchema,
  maxPages: z
    .number()
    .int()
    .min(CRAWL_LIMITS.MIN_PAGES)
    .max(CRAWL_LIMITS.MAX_PAGES)
    .default(CRAWL_DEFAULTS.MAX_PAGES),
  maxDepth: z
    .number()
    .int()
    .min(CRAWL_LIMITS.MIN_DEPTH)
    .max(CRAWL_LIMITS.MAX_DEPTH)
    .default(CRAWL_DEFAULTS.MAX_DEPTH),
  timeout: z
    .number()
    .int()
    .min(CRAWL_LIMITS.MIN_TIMEOUT)
    .max(CRAWL_LIMITS.MAX_TIMEOUT)
    .default(CRAWL_DEFAULTS.TIMEOUT),
  concurrency: z
    .number()
    .int()
    .min(CRAWL_LIMITS.MIN_CONCURRENCY)
    .max(CRAWL_LIMITS.MAX_CONCURRENCY)
    .default(CRAWL_DEFAULTS.CONCURRENCY),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
  languageStrategy: languageStrategySchema.optional(),
});

/**
 * Crawl options schema (all fields optional except URL)
 * Used for API requests where presets can override values
 *
 * Uses `satisfies` to ensure schema matches GenerateRequest DTO type
 */
export const crawlOptionsSchema = z.object({
  url: urlSchema,
  preset: crawlPresetSchema.optional(),
  maxPages: z
    .number()
    .int()
    .min(CRAWL_LIMITS.MIN_PAGES)
    .max(CRAWL_LIMITS.MAX_PAGES)
    .optional(),
  maxDepth: z
    .number()
    .int()
    .min(CRAWL_LIMITS.MIN_DEPTH)
    .max(CRAWL_LIMITS.MAX_DEPTH)
    .optional(),
  timeout: z
    .number()
    .int()
    .min(CRAWL_LIMITS.MIN_TIMEOUT)
    .max(CRAWL_LIMITS.MAX_TIMEOUT)
    .optional(),
  concurrency: z
    .number()
    .int()
    .min(CRAWL_LIMITS.MIN_CONCURRENCY)
    .max(CRAWL_LIMITS.MAX_CONCURRENCY)
    .optional(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
  languageStrategy: languageStrategySchema.optional(),
}) satisfies z.ZodType<GenerateRequest>;

/**
 * Inferred types from schemas
 */
export type CrawlConfigInput = z.infer<typeof crawlConfigSchema>;
export type CrawlOptionsInput = z.infer<typeof crawlOptionsSchema>;
