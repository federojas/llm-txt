/**
 * SSRF (Server-Side Request Forgery) Protection
 * Prevents the API from accessing internal/private networks
 */

/**
 * Blocked hostnames that should never be accessed
 */
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS metadata endpoint
  "metadata.google.internal", // GCP metadata endpoint
  "::1", // IPv6 localhost
  "[::1]", // IPv6 localhost with brackets
];

/**
 * Blocked network prefixes (private IP ranges)
 */
const BLOCKED_NETWORKS = [
  "10.", // Class A private network
  "172.16.", // Class B private network (172.16.0.0 - 172.31.255.255)
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.", // Class C private network
];

/**
 * Check if a URL is safe from SSRF attacks
 * @param urlString - The URL to validate
 * @returns true if URL is safe, false otherwise
 */
export function isSSRFSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Check against blocked hosts
    if (BLOCKED_HOSTS.includes(hostname)) {
      return false;
    }

    // Check against blocked network prefixes
    if (BLOCKED_NETWORKS.some((network) => hostname.startsWith(network))) {
      return false;
    }

    // Block .local domains (mDNS)
    if (hostname.endsWith(".local")) {
      return false;
    }

    return true;
  } catch {
    // Invalid URL
    return false;
  }
}

/**
 * Get a human-readable reason why a URL was blocked
 * @param urlString - The URL that was blocked
 * @returns Reason string or null if URL is safe
 */
export function getSSRFBlockReason(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    if (!["http:", "https:"].includes(url.protocol)) {
      return `Protocol '${url.protocol}' is not allowed`;
    }

    if (BLOCKED_HOSTS.includes(hostname)) {
      return `Host '${hostname}' is blocked`;
    }

    if (BLOCKED_NETWORKS.some((network) => hostname.startsWith(network))) {
      return `Private network access is not allowed`;
    }

    if (hostname.endsWith(".local")) {
      return "Local domain access is not allowed";
    }

    return null;
  } catch {
    return "Invalid URL format";
  }
}
