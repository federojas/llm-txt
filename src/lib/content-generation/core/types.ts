import { PageMetadata, SectionGroup } from "@/lib/types";

/**
 * Description Generator Interface
 * Generates concise descriptions of web pages
 */
export interface IDescriptionGenerator {
  generateDescription(page: PageMetadata): Promise<string>;
  generateBusinessSummary(homepage: PageMetadata): Promise<string>;
  isAvailable(): boolean;
}

/**
 * Section Discovery Interface
 * Analyzes pages and groups them into logical sections
 */
export interface ISectionDiscoveryService {
  discoverSections(pages: PageMetadata[]): Promise<SectionGroup[]>;
  isAvailable(): boolean;
}

/**
 * Title Cleaning Interface
 * Removes redundant suffixes and site names from page titles
 */
export interface ITitleCleaningService {
  cleanTitles(titles: string[]): Promise<string[]>;
  isAvailable(): boolean;
}
