import { PageMetadata, SectionGroup } from "@/lib/types";
import { MetadataAccumulator } from "../metadata-accumulator";

/**
 * Description Generator Interface
 * Generates concise descriptions of web pages
 */
export interface IDescriptionGenerator {
  generateDescription(
    page: PageMetadata,
    metadataAccumulator?: MetadataAccumulator
  ): Promise<string>;
  generateBusinessSummary(
    homepage: PageMetadata,
    metadataAccumulator?: MetadataAccumulator
  ): Promise<string>;
  isAvailable(): boolean;
}

/**
 * Section Discovery Interface
 * Analyzes pages and groups them into logical sections
 */
export interface ISectionDiscoveryService {
  discoverSections(
    pages: PageMetadata[],
    metadataAccumulator?: MetadataAccumulator
  ): Promise<SectionGroup[]>;
  isAvailable(): boolean;
}

/**
 * Title Cleaning Interface
 * Removes redundant suffixes and site names from page titles
 * Handles duplicate titles by extracting from URLs
 */
export interface ITitleCleaningService {
  cleanTitles(titles: string[], urls?: string[]): Promise<string[]>;
  isAvailable(): boolean;
}
