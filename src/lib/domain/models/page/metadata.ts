/**
 * Page Metadata Model
 * Represents crawled page data with metadata extracted from HTML
 */

export interface PageMetadata {
  url: string;
  title: string;
  description?: string;
  ogDescription?: string;
  ogTitle?: string;
  ogType?: string; // OpenGraph type (article, website, etc.) for classification
  h1?: string;
  siteName?: string; // For proper homepage title extraction
  lang?: string; // For filtering non-English pages
  depth: number;
  internalLinks: string[];
  sitemapPriority?: number; // From sitemap.xml (0.0-1.0) for better classification
}
