/**
 * DTOs for the Generate LLMs.txt Endpoint
 * Defines request and response types for type-safe API communication
 */

import { z } from "zod";
import { crawlOptionsSchema } from "@/lib/api/validation";

// Request DTO
export const generateRequestSchema = crawlOptionsSchema;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

// Response DTOs
export interface GenerateResponseData {
  content: string;
  stats: {
    pagesFound: number;
    url: string;
  };
}

export interface GenerateResponse {
  success: true;
  data: GenerateResponseData;
}
