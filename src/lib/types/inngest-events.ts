/**
 * Inngest Event Type Definitions
 * Type-safe event schemas for background job processing
 */

import type { GenerateRequest } from "@/lib/api";

/**
 * Typed event schemas for type-safe Inngest handlers
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
