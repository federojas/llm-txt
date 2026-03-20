/**
 * HTML Parser Interface (Domain Layer)
 * Abstraction for HTML parsing operations
 *
 * This interface defines the contract for extracting structured metadata from HTML,
 * independent of the parsing implementation (Cheerio, jsdom, parse5, etc.)
 */

import { PageMetadata } from "../models";

export interface IHtmlParser {
  /**
   * Extract structured metadata from HTML content
   *
   * @param html - Raw HTML string
   * @param url - Page URL (for context and link resolution)
   * @param baseUrl - Base URL for crawl (for determining internal links)
   * @param depth - Current depth in crawl tree
   * @returns Structured page metadata
   */
  extractMetadata(
    html: string,
    url: string,
    baseUrl: string,
    depth: number
  ): PageMetadata;

  /**
   * Check if page should be indexed
   * Respects robots meta tags (noindex)
   *
   * @param html - Raw HTML string
   * @returns true if page is indexable, false otherwise
   */
  isIndexable(html: string): boolean;
}
