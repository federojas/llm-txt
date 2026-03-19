import { z } from "zod";

// SSRF Protection: Block dangerous URLs
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal", // GCP metadata
  "::1", // IPv6 localhost
];

const BLOCKED_NETWORKS = [
  "10.", // Private network
  "172.16.", // Private network
  "172.17.", // Private network
  "172.18.", // Private network
  "172.19.", // Private network
  "172.20.", // Private network
  "172.21.", // Private network
  "172.22.", // Private network
  "172.23.", // Private network
  "172.24.", // Private network
  "172.25.", // Private network
  "172.26.", // Private network
  "172.27.", // Private network
  "172.28.", // Private network
  "172.29.", // Private network
  "172.30.", // Private network
  "172.31.", // Private network
  "192.168.", // Private network
];

function isSSRFSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow http and https
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Check blocked hosts
    if (BLOCKED_HOSTS.includes(hostname)) {
      return false;
    }

    // Check blocked networks
    if (BLOCKED_NETWORKS.some((network) => hostname.startsWith(network))) {
      return false;
    }

    // Block .local domains
    if (hostname.endsWith(".local")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const urlSchema = z
  .string()
  .url("Must be a valid URL")
  .refine(
    (url) => url.startsWith("http://") || url.startsWith("https://"),
    "URL must start with http:// or https://"
  )
  .refine((url) => isSSRFSafe(url), "URL is not allowed (SSRF protection)");

export const crawlPresetSchema = z.enum(["quick", "thorough", "custom"]);

export const crawlConfigSchema = z.object({
  url: urlSchema,
  maxPages: z.number().int().min(1).max(200).default(50),
  maxDepth: z.number().int().min(1).max(5).default(3),
  timeout: z.number().int().min(5000).max(30000).default(10000),
  concurrency: z.number().int().min(1).max(10).default(5),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
});

export const crawlOptionsSchema = z.object({
  url: urlSchema,
  preset: crawlPresetSchema.optional(),
  maxPages: z.number().int().min(1).max(200).optional(),
  maxDepth: z.number().int().min(1).max(5).optional(),
  timeout: z.number().int().min(5000).max(30000).optional(),
  concurrency: z.number().int().min(1).max(10).optional(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
});

export type CrawlConfigInput = z.infer<typeof crawlConfigSchema>;
export type CrawlOptionsInput = z.infer<typeof crawlOptionsSchema>;
