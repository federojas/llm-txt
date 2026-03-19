import { describe, it, expect } from "vitest";
import {
  getPresetMaxPages,
  getPresetMaxDepth,
  getPresetConfig,
  CRAWL_PRESETS,
} from "@/lib/config";

describe("Preset Configuration", () => {
  describe("getPresetMaxPages", () => {
    it("should return correct maxPages for quick preset", () => {
      expect(getPresetMaxPages("quick")).toBe(25);
    });

    it("should return correct maxPages for thorough preset", () => {
      expect(getPresetMaxPages("thorough")).toBe(100);
    });

    it("should return default maxPages for custom preset", () => {
      expect(getPresetMaxPages("custom")).toBe(50);
    });

    it("should return default maxPages for undefined preset", () => {
      expect(getPresetMaxPages()).toBe(50);
    });
  });

  describe("getPresetMaxDepth", () => {
    it("should return correct maxDepth for quick preset", () => {
      expect(getPresetMaxDepth("quick")).toBe(2);
    });

    it("should return correct maxDepth for thorough preset", () => {
      expect(getPresetMaxDepth("thorough")).toBe(3);
    });

    it("should return default maxDepth for custom preset", () => {
      expect(getPresetMaxDepth("custom")).toBe(3);
    });

    it("should return default maxDepth for undefined preset", () => {
      expect(getPresetMaxDepth()).toBe(3);
    });
  });

  describe("getPresetConfig", () => {
    it("should return full config for quick preset", () => {
      const config = getPresetConfig("quick");
      expect(config.maxPages).toBe(25);
      expect(config.maxDepth).toBe(2);
      expect(config.description).toBeTruthy();
    });

    it("should return full config for thorough preset", () => {
      const config = getPresetConfig("thorough");
      expect(config.maxPages).toBe(100);
      expect(config.maxDepth).toBe(3);
      expect(config.description).toBeTruthy();
    });

    it("should return full config for custom preset", () => {
      const config = getPresetConfig("custom");
      expect(config.maxPages).toBe(50);
      expect(config.maxDepth).toBe(3);
      expect(config.description).toBeTruthy();
    });
  });

  describe("CRAWL_PRESETS", () => {
    it("should have all required presets", () => {
      expect(CRAWL_PRESETS).toHaveProperty("quick");
      expect(CRAWL_PRESETS).toHaveProperty("thorough");
      expect(CRAWL_PRESETS).toHaveProperty("custom");
    });

    it("should have valid configurations", () => {
      Object.values(CRAWL_PRESETS).forEach((preset) => {
        expect(preset.maxPages).toBeGreaterThan(0);
        expect(preset.maxDepth).toBeGreaterThan(0);
        expect(preset.description).toBeTruthy();
      });
    });
  });
});
