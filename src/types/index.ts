// Core types for the llms.txt generator

export interface CrawlConfig {
  url: string;
  maxPages: number;
  maxDepth: number;
  timeout: number;
  concurrency: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface CrawlResult {
  url: string;
  title: string;
  description?: string;
  depth: number;
  statusCode?: number;
}

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
  // Future: Add sitemapPriority?: number for even better classification
}

export interface LlmsTxtSection {
  title: string;
  links: LinkItem[];
}

export interface LinkItem {
  title: string;
  url: string;
  description?: string;
}

export interface LlmsTxtOutput {
  projectName: string;
  summary?: string;
  details?: string;
  sections: LlmsTxtSection[];
  optionalSection?: LlmsTxtSection;
}

export interface CrawlProgress {
  status: "idle" | "crawling" | "processing" | "complete" | "error";
  currentUrl?: string;
  pagesFound: number;
  pagesProcessed: number;
  totalPages: number;
  error?: string;
}

export type CrawlPreset = "quick" | "thorough" | "custom";

export interface CrawlOptions extends Partial<CrawlConfig> {
  preset?: CrawlPreset;
}
