/**
 * Normalize URL for deduplication
 */
export function normalizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);

    // Remove trailing slash
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

    // Remove hash
    parsedUrl.hash = "";

    // Sort query parameters
    parsedUrl.searchParams.sort();

    // Remove common tracking parameters
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "source",
    ];
    trackingParams.forEach((param) => parsedUrl.searchParams.delete(param));

    return parsedUrl.toString();
  } catch {
    return url;
  }
}

/**
 * Check if URL is internal (same domain)
 */
export function isInternalUrl(url: string, baseUrl: string): boolean {
  try {
    const urlObj = new URL(url, baseUrl);
    const baseObj = new URL(baseUrl);
    return urlObj.hostname === baseObj.hostname;
  } catch {
    return false;
  }
}

/**
 * Convert relative URL to absolute
 */
export function toAbsoluteUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

/**
 * Check if URL matches any pattern
 */
export function matchesPattern(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(pattern.replace("*", ".*"));
    return regex.test(url);
  });
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Get URL depth from base URL
 */
export function getUrlDepth(url: string, baseUrl: string): number {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseUrl);

    if (urlObj.hostname !== baseObj.hostname) {
      return Infinity;
    }

    const urlPath = urlObj.pathname.replace(/^\/|\/$/g, "");
    const basePath = baseObj.pathname.replace(/^\/|\/$/g, "");

    if (!urlPath) return 0;
    if (!basePath) {
      return urlPath.split("/").filter(Boolean).length;
    }

    const urlParts = urlPath.split("/").filter(Boolean);
    const baseParts = basePath.split("/").filter(Boolean);

    return Math.max(0, urlParts.length - baseParts.length);
  } catch {
    return Infinity;
  }
}

/**
 * Classify URL by type
 */
export function classifyUrl(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname.includes("/doc")) return "documentation";
  if (pathname.includes("/guide")) return "guides";
  if (pathname.includes("/tutorial")) return "tutorials";
  if (pathname.includes("/api")) return "api";
  if (pathname.includes("/blog")) return "blog";
  if (pathname.includes("/about")) return "about";
  if (pathname.includes("/pricing")) return "pricing";
  if (pathname === "/" || pathname === "") return "homepage";

  return "other";
}
