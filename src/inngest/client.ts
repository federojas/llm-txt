/**
 * Inngest Client
 * Handles background job processing
 */

import { Inngest } from "inngest";

const isDev = process.env.INNGEST_DEV === "true";
const baseUrl = process.env.INNGEST_BASE_URL;

// Determine Inngest environment
const getEnvironment = (): string | undefined => {
  // Local development - use dev mode (no environment)
  if (isDev) return undefined;

  // Vercel environments
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === "production") {
    return "production";
  }

  if (vercelEnv === "preview") {
    // Previews use production Inngest environment
    // Database is already isolated per preview branch
    // This avoids needing to sync each preview branch with Inngest
    return "production";
  }

  // Default to undefined for local dev
  return undefined;
};

export const inngest = new Inngest({
  id: "llm-txt",
  // Environment: production for prod/preview, undefined for local dev
  env: getEnvironment(),
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
