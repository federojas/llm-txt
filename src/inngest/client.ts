/**
 * Inngest Client
 * Handles background job processing
 */

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "llm-txt",
  // In development with INNGEST_DEV=true, SDK will skip cloud API
  isDev: process.env.INNGEST_DEV === "true",
});
