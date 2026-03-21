/**
 * HTML Parser
 * Cheerio implementation for extracting structured metadata from HTML
 */

import * as cheerio from "cheerio";
import { PageMetadata, ExternalLink } from "@/lib/types";

type CheerioAPI = ReturnType<typeof cheerio.load>;

/**
 * HTML Parser Interface
 * Abstraction for HTML parsing operations
 */
export interface IHtmlParser {
  extractMetadata(
    html: string,
    url: string,
    baseUrl: string,
    depth: number
  ): Promise<PageMetadata>;
  isIndexable(html: string): boolean;
}

import { IAdBlocker } from "./ad-blocker";
import { toAbsoluteUrl } from "@/lib/url/helpers";
import { normalizeUrl } from "@/lib/url/normalization";
import { isInternalUrl, getUrlDepth } from "./boundaries";
import { isValuableExternalLink } from "./external-links";

export class HtmlParser implements IHtmlParser {
  constructor(private adBlocker: IAdBlocker) {}
  /**
   * Extract structured metadata from HTML using Cheerio
   * Note: Async to support external link filtering with ad blocker engine
   */
  async extractMetadata(
    html: string,
    url: string,
    baseUrl: string,
    depth: number
  ): Promise<PageMetadata> {
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
      bodyText: this.extractBodyText($),
      depth,
      internalLinks: this.extractInternalLinks($, url, baseUrl, depth),
      externalLinks: await this.extractExternalLinks($, url, baseUrl),
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
   * Extract main body text for AI context
   * Priority: <main> → <article> → <body>
   * Limits to ~1500 chars to fit in AI prompts
   */
  private extractBodyText($: CheerioAPI): string | undefined {
    // Try to find main content area
    let text = "";

    // Priority 1: <main> tag
    const main = $("main").first();
    if (main.length > 0) {
      text = main.text();
    } else {
      // Priority 2: <article> tag
      const article = $("article").first();
      if (article.length > 0) {
        text = article.text();
      } else {
        // Priority 3: <body> (remove scripts, styles, nav, footer)
        const body = $("body").clone();
        body.find("script, style, nav, footer, header, aside").remove();
        text = body.text();
      }
    }

    // Clean up: normalize whitespace, limit length
    text = text
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .trim()
      .slice(0, 1500); // Limit to 1500 chars

    return text || undefined;
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

    $("a[href]").each((_: number, element) => {
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

  /**
   * Extract valuable external links (repos, docs, APIs)
   * Filters out ads, tracking, social media using industry-standard practices
   */
  private async extractExternalLinks(
    $: CheerioAPI,
    currentUrl: string,
    baseUrl: string
  ): Promise<ExternalLink[]> {
    const links: ExternalLink[] = [];
    const seen = new Set<string>();
    const candidates: Array<{
      url: string;
      rel?: string;
      title?: string;
      context?: "main" | "footer" | "nav" | "aside";
    }> = [];

    // First pass: collect all external link candidates
    $("a[href]").each((_: number, element) => {
      const href = $(element).attr("href");
      if (!href) return;

      try {
        const absoluteUrl = toAbsoluteUrl(href, currentUrl);

        // Skip internal links
        if (isInternalUrl(absoluteUrl, baseUrl)) {
          return;
        }

        // Get link metadata
        const rel = $(element).attr("rel");
        const title = $(element).attr("title") || $(element).text().trim();

        // Determine HTML context
        const $closest = $(element).closest(
          "main, article, footer, nav, aside"
        );
        let context: "main" | "footer" | "nav" | "aside" | undefined;
        if ($closest.length > 0) {
          const tagName = $closest.prop("tagName")?.toLowerCase();
          if (tagName === "main" || tagName === "article") {
            context = "main";
          } else if (tagName === "footer") {
            context = "footer";
          } else if (tagName === "nav") {
            context = "nav";
          } else if (tagName === "aside") {
            context = "aside";
          }
        }

        candidates.push({
          url: absoluteUrl,
          rel,
          title: title || undefined,
          context,
        });
      } catch {
        // Skip invalid URLs
      }
    });

    // Second pass: filter asynchronously using industry-standard practices
    for (const candidate of candidates) {
      if (seen.has(candidate.url)) {
        continue;
      }

      const isInMainContent = candidate.context === "main";
      const isValuable = await isValuableExternalLink(
        candidate.url,
        this.adBlocker,
        candidate.rel,
        isInMainContent
      );

      if (isValuable) {
        seen.add(candidate.url);
        links.push({
          url: candidate.url,
          title: candidate.title,
          context: candidate.context,
        });
      }
    }

    return links;
  }
}
