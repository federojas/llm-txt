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
    maxPages: 25,
    maxDepth: 2,
    description: "Fast crawl with limited depth for quick results",
  },
  thorough: {
    maxPages: 100,
    maxDepth: 3,
    description: "Comprehensive crawl for detailed documentation",
  },
  custom: {
    maxPages: 50,
    maxDepth: 3,
    description: "Custom configuration with default values",
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
