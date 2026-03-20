/**
 * Crawl Configuration Presets
 * Provides predefined configurations for different use cases
 */

import { CrawlPreset } from "@/types";

export interface PresetConfig {
  maxPages: number;
  maxDepth: number;
  description: string;
}

export const CRAWL_PRESETS: Record<CrawlPreset, PresetConfig> = {
  quick: {
    maxPages: 50, // Increased from 25 for better coverage
    maxDepth: 3, // Increased from 2 to capture more sections
    description: "Fast crawl with moderate depth for comprehensive results",
  },
  thorough: {
    maxPages: 150, // Increased from 100 for richer documentation
    maxDepth: 4, // Increased from 3 for deeper exploration
    description:
      "Comprehensive crawl for detailed, production-ready documentation",
  },
  custom: {
    maxPages: 75, // Increased from 50
    maxDepth: 3,
    description: "Custom configuration with balanced defaults",
  },
};

/**
 * Gets the maxPages value for a given preset
 */
export function getPresetMaxPages(preset?: CrawlPreset): number {
  if (!preset || preset === "custom") {
    return CRAWL_PRESETS.custom.maxPages;
  }
  return CRAWL_PRESETS[preset].maxPages;
}

/**
 * Gets the maxDepth value for a given preset
 */
export function getPresetMaxDepth(preset?: CrawlPreset): number {
  if (!preset || preset === "custom") {
    return CRAWL_PRESETS.custom.maxDepth;
  }
  return CRAWL_PRESETS[preset].maxDepth;
}

/**
 * Gets the full preset configuration
 */
export function getPresetConfig(preset?: CrawlPreset): PresetConfig {
  if (!preset || preset === "custom") {
    return CRAWL_PRESETS.custom;
  }
  return CRAWL_PRESETS[preset];
}
