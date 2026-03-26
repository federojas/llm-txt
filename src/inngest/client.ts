/**
 * Inngest Client
 * Handles background job processing
 */

import { Inngest } from "inngest";

const isDev = process.env.INNGEST_DEV === "true";
const baseUrl = process.env.INNGEST_BASE_URL;

export const inngest = new Inngest({
  id: "llm-txt", // Must match Inngest dashboard app ID
  // In production, use INNGEST_EVENT_KEY
  eventKey: isDev ? undefined : process.env.INNGEST_EVENT_KEY,
  // For local Docker dev: point to dev server
  ...(isDev && baseUrl
    ? {
        eventApiOrigin: baseUrl,
        inngestApiOrigin: baseUrl,
      }
    : {}),
});
