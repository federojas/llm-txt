/**
 * Inngest Client
 * Handles background job processing
 */

import { Inngest } from "inngest";

const isDev = process.env.INNGEST_DEV === "true";
const baseUrl = process.env.INNGEST_BASE_URL;

// Determine environment for branch-based isolation
const getEnvironment = (): string | undefined => {
  // Local development
  if (isDev) return undefined;

  // Vercel environments
  const vercelEnv = process.env.VERCEL_ENV;
  const vercelBranch = process.env.VERCEL_GIT_COMMIT_REF;

  if (vercelEnv === "production") {
    return "production";
  }

  if (vercelEnv === "preview" && vercelBranch) {
    // Use branch name as environment (e.g., "preview-feature-branch")
    return `preview-${vercelBranch}`;
  }

  // Default to undefined for local dev
  return undefined;
};

export const inngest = new Inngest({
  id: "llm-txt",
  // Branch-based environments for isolation
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
