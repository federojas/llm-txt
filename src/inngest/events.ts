/**
 * Inngest Event Definitions
 * Central registry of all event constants and their type schemas
 */

import type { GenerateRequest } from "@/lib/api";

// Event name constants
export const CRAWL_REQUESTED = "crawl/requested";
export const CRAWL_COMPLETED = "crawl/completed";
export const CRAWL_FAILED = "crawl/failed";

/**
 * Type-safe event schemas for Inngest handlers
 * Defines the shape of event.data for each event type
 */
export interface InngestEvents {
  "crawl/requested": {
    data: GenerateRequest & {
      jobId: string;
      correlationId: string;
    };
  };
  "crawl/completed": {
    data: {
      jobId: string;
      url: string;
    };
  };
  "crawl/failed": {
    data: {
      jobId: string;
      url: string;
      error: string;
    };
  };
}
