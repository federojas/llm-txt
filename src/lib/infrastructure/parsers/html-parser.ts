import * as cheerio from "cheerio";
import { PageMetadata } from "@/lib/domain/models";
import { toAbsoluteUrl, normalizeUrl } from "../../shared/url-utils";
import {
  isInternalUrl,
  getUrlDepth,
} from "../../domain/logic/url-classification";

/**
 * Extract metadata from HTML page
 */
export function extractMetadata(
  html: string,
  url: string,
  baseUrl: string,
  depth: number
): PageMetadata {
  const $ = cheerio.load(html);

  // Extract title
  const title =
    $("title").text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    "Untitled";

  // Extract description
  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim();

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const ogDescription = $('meta[property="og:description"]')
    .attr("content")
    ?.trim();

  const h1 = $("h1").first().text().trim();

  // Extract language (for LLM content optimization)
  const lang =
    $("html").attr("lang")?.toLowerCase().split("-")[0] || // <html lang="en-US"> → "en"
    $('meta[http-equiv="content-language"]')
      .attr("content")
      ?.toLowerCase()
      .split("-")[0] || // <meta http-equiv="content-language" content="en"> → "en"
    $('meta[property="og:locale"]')
      .attr("content")
      ?.toLowerCase()
      .split("_")[0]; // og:locale="en_US" → "en"

  // Extract siteName (cleaner than title for brand names)
  const siteName = $('meta[property="og:site_name"]').attr("content")?.trim();

  // Extract internal links
  const internalLinks: string[] = [];
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    try {
      const absoluteUrl = toAbsoluteUrl(href, url);
      if (isInternalUrl(absoluteUrl, baseUrl)) {
        const normalized = normalizeUrl(absoluteUrl);
        const linkDepth = getUrlDepth(normalized, baseUrl);

        // Only include links that don't go too deep
        if (linkDepth <= depth + 1) {
          internalLinks.push(normalized);
        }
      }
    } catch {
      // Skip invalid URLs
    }
  });

  return {
    url: normalizeUrl(url),
    title,
    description,
    ogDescription,
    ogTitle,
    h1,
    siteName,
    lang,
    depth,
    internalLinks: [...new Set(internalLinks)], // Deduplicate
  };
}

/**
 * Check if robots meta tag allows indexing
 */
export function isIndexable(html: string): boolean {
  const $ = cheerio.load(html);
  const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase();

  if (!robotsMeta) return true;

  return !robotsMeta.includes("noindex");
}
