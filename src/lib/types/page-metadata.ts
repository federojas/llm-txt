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
  bodyText?: string; // Main content text (for AI summary generation)
  depth: number;
  internalLinks: string[];
  externalLinks?: ExternalLink[]; // Valuable external resources (repos, docs, APIs)
  sitemapPriority?: number; // From sitemap.xml (0.0-1.0) for better classification
}

/**
 * External link metadata
 * Represents valuable external resources (GitHub repos, docs, etc.)
 */
export interface ExternalLink {
  url: string;
  title?: string; // Link text or title attribute
  context?: "main" | "footer" | "nav" | "aside"; // HTML context
}
