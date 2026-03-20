/**
 * Cheerio HTML Parser Adapter (Infrastructure Layer)
 * Implementation of IHtmlParser using Cheerio library
 *
 * This adapter translates between the Cheerio library (infrastructure)
 * and the domain's HTML parsing interface.
 */

import * as cheerio from "cheerio";

type CheerioAPI = ReturnType<typeof cheerio.load>;
import { IHtmlParser } from "@/lib/domain/interfaces/html-parser.interface";
import { PageMetadata } from "@/lib/domain/models";
import { toAbsoluteUrl } from "../utilities/url-helpers";
import { normalizeUrl } from "../../domain/logic/url-normalization";
import {
  isInternalUrl,
  getUrlDepth,
} from "../../domain/logic/url-classification";

export class CheerioHtmlParser implements IHtmlParser {
  /**
   * Extract structured metadata from HTML using Cheerio
   */
  extractMetadata(
    html: string,
    url: string,
    baseUrl: string,
    depth: number
  ): PageMetadata {
    const $ = cheerio.load(html);

    return {
      url: normalizeUrl(url),
      title: this.extractTitle($),
      description: this.extractDescription($),
      ogDescription: this.extractOgDescription($),
      ogTitle: this.extractOgTitle($),
      ogType: this.extractOgType($),
      h1: this.extractH1($),
      siteName: this.extractSiteName($),
      lang: this.extractLanguage($),
      depth,
      internalLinks: this.extractInternalLinks($, url, baseUrl, depth),
    };
  }

  /**
   * Check if page should be indexed (respects robots meta tag)
   */
  isIndexable(html: string): boolean {
    const $ = cheerio.load(html);
    const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase();

    if (!robotsMeta) return true;
    return !robotsMeta.includes("noindex");
  }

  /**
   * Extract title with fallback chain
   * Priority: <title> → og:title → h1 → "Untitled"
   */
  private extractTitle($: CheerioAPI): string {
    return (
      $("title").text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      "Untitled"
    );
  }

  /**
   * Extract meta description
   */
  private extractDescription($: CheerioAPI): string | undefined {
    return (
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim()
    );
  }

  /**
   * Extract OpenGraph description
   */
  private extractOgDescription($: CheerioAPI): string | undefined {
    return $('meta[property="og:description"]').attr("content")?.trim();
  }

  /**
   * Extract OpenGraph title
   */
  private extractOgTitle($: CheerioAPI): string | undefined {
    return $('meta[property="og:title"]').attr("content")?.trim();
  }

  /**
   * Extract OpenGraph type (article, website, etc.)
   */
  private extractOgType($: CheerioAPI): string | undefined {
    return $('meta[property="og:type"]').attr("content")?.trim();
  }

  /**
   * Extract first h1 heading
   */
  private extractH1($: CheerioAPI): string | undefined {
    const h1 = $("h1").first().text().trim();
    return h1 || undefined;
  }

  /**
   * Extract site name (cleaner than title for brand names)
   */
  private extractSiteName($: CheerioAPI): string | undefined {
    return $('meta[property="og:site_name"]').attr("content")?.trim();
  }

  /**
   * Extract language code
   * Priority: html lang → http-equiv content-language → og:locale
   */
  private extractLanguage($: CheerioAPI): string | undefined {
    const htmlLang = $("html").attr("lang")?.toLowerCase().split("-")[0];
    if (htmlLang) return htmlLang;

    const contentLang = $('meta[http-equiv="content-language"]')
      .attr("content")
      ?.toLowerCase()
      .split("-")[0];
    if (contentLang) return contentLang;

    const ogLocale = $('meta[property="og:locale"]')
      .attr("content")
      ?.toLowerCase()
      .split("_")[0];
    return ogLocale;
  }

  /**
   * Extract internal links with depth filtering
   * Business rule: Only include links that don't exceed depth limit
   */
  private extractInternalLinks(
    $: CheerioAPI,
    currentUrl: string,
    baseUrl: string,
    currentDepth: number
  ): string[] {
    const links: string[] = [];

    $("a[href]").each((_: number, element: cheerio.Element) => {
      const href = $(element).attr("href");
      if (!href) return;

      try {
        const absoluteUrl = toAbsoluteUrl(href, currentUrl);
        if (isInternalUrl(absoluteUrl, baseUrl)) {
          const normalized = normalizeUrl(absoluteUrl);
          const linkDepth = getUrlDepth(normalized, baseUrl);

          // Domain rule: Only include links within depth bounds
          if (linkDepth <= currentDepth + 1) {
            links.push(normalized);
          }
        }
      } catch {
        // Skip invalid URLs
      }
    });

    // Deduplicate
    return [...new Set(links)];
  }
}
