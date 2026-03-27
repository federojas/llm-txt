/**
 * Unit Tests: Ad Blocker
 * Tests Ghostery-based ad/tracker detection
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdBlocker } from "@/lib/crawling/ad-blocker";

// Mock @ghostery/adblocker
vi.mock("@ghostery/adblocker", () => ({
  makeRequest: vi.fn((options) => options),
  FiltersEngine: {
    fromPrebuiltAdsAndTracking: vi.fn(),
  },
}));

describe("AdBlocker", () => {
  let adBlocker: AdBlocker;

  beforeEach(() => {
    adBlocker = new AdBlocker();
    vi.clearAllMocks();
  });

  describe("isBlocked", () => {
    it("should return true for blocked URLs", async () => {
      const { FiltersEngine } = await import("@ghostery/adblocker");
      const mockEngine = {
        match: vi.fn().mockReturnValue({ match: true }),
      };
      vi.mocked(FiltersEngine.fromPrebuiltAdsAndTracking).mockResolvedValue(
        mockEngine as unknown as IRequestFilter
      );

      const result = await adBlocker.isBlocked(
        "https://ads.example.com/banner.js"
      );

      expect(result).toBe(true);
      expect(mockEngine.match).toHaveBeenCalledWith({
        url: "https://ads.example.com/banner.js",
        type: "document",
      });
    });

    it("should return false for allowed URLs", async () => {
      const { FiltersEngine } = await import("@ghostery/adblocker");
      const mockEngine = {
        match: vi.fn().mockReturnValue({ match: false }),
      };
      vi.mocked(FiltersEngine.fromPrebuiltAdsAndTracking).mockResolvedValue(
        mockEngine as unknown as IRequestFilter
      );

      const result = await adBlocker.isBlocked("https://example.com/page.html");

      expect(result).toBe(false);
      expect(mockEngine.match).toHaveBeenCalledWith({
        url: "https://example.com/page.html",
        type: "document",
      });
    });

    it("should reuse engine instance across multiple calls", async () => {
      const { FiltersEngine } = await import("@ghostery/adblocker");
      const mockEngine = {
        match: vi.fn().mockReturnValue({ match: false }),
      };
      vi.mocked(FiltersEngine.fromPrebuiltAdsAndTracking).mockResolvedValue(
        mockEngine as unknown as IRequestFilter
      );

      await adBlocker.isBlocked("https://example.com/page1.html");
      await adBlocker.isBlocked("https://example.com/page2.html");
      await adBlocker.isBlocked("https://example.com/page3.html");

      // Engine should only be loaded once
      expect(FiltersEngine.fromPrebuiltAdsAndTracking).toHaveBeenCalledTimes(1);
      // But match should be called three times
      expect(mockEngine.match).toHaveBeenCalledTimes(3);
    });

    it("should fail open (return false) on engine errors", async () => {
      const { FiltersEngine } = await import("@ghostery/adblocker");
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      vi.mocked(FiltersEngine.fromPrebuiltAdsAndTracking).mockRejectedValue(
        new Error("Engine initialization failed")
      );

      const result = await adBlocker.isBlocked("https://example.com/page.html");

      expect(result).toBe(false); // Fail open
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Ghostery FiltersEngine error:",
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it("should fail open on match errors", async () => {
      const { FiltersEngine } = await import("@ghostery/adblocker");
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const mockEngine = {
        match: vi.fn().mockImplementation(() => {
          throw new Error("Match failed");
        }),
      };
      vi.mocked(FiltersEngine.fromPrebuiltAdsAndTracking).mockResolvedValue(
        mockEngine as unknown as IRequestFilter
      );

      const result = await adBlocker.isBlocked("https://example.com/page.html");

      expect(result).toBe(false); // Fail open
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("should handle various URL formats", async () => {
      const { FiltersEngine } = await import("@ghostery/adblocker");
      const mockEngine = {
        match: vi.fn().mockReturnValue({ match: false }),
      };
      vi.mocked(FiltersEngine.fromPrebuiltAdsAndTracking).mockResolvedValue(
        mockEngine as unknown as IRequestFilter
      );

      const urls = [
        "https://example.com",
        "http://example.com/page",
        "https://subdomain.example.com/path/to/page",
        "https://example.com/page?query=param",
        "https://example.com/page#anchor",
      ];

      for (const url of urls) {
        await adBlocker.isBlocked(url);
      }

      expect(mockEngine.match).toHaveBeenCalledTimes(urls.length);
    });
  });

  describe("real-world scenarios", () => {
    it("should block common ad domains", async () => {
      const { FiltersEngine } = await import("@ghostery/adblocker");
      const mockEngine = {
        match: vi.fn((request) => {
          // Simulate blocking known ad domains
          const adDomains = [
            "doubleclick.net",
            "google-analytics.com",
            "facebook.com/tr",
            "ads.example.com",
          ];
          const isBlocked = adDomains.some((domain) =>
            request.url.includes(domain)
          );
          return { match: isBlocked };
        }),
      };
      vi.mocked(FiltersEngine.fromPrebuiltAdsAndTracking).mockResolvedValue(
        mockEngine as unknown as IRequestFilter
      );

      expect(await adBlocker.isBlocked("https://doubleclick.net/ad.js")).toBe(
        true
      );
      expect(
        await adBlocker.isBlocked("https://www.google-analytics.com/collect")
      ).toBe(true);
      expect(
        await adBlocker.isBlocked("https://www.facebook.com/tr?id=123")
      ).toBe(true);
      expect(await adBlocker.isBlocked("https://ads.example.com/banner")).toBe(
        true
      );
    });

    it("should allow legitimate content domains", async () => {
      const { FiltersEngine } = await import("@ghostery/adblocker");
      const mockEngine = {
        match: vi.fn(() => ({ match: false })),
      };
      vi.mocked(FiltersEngine.fromPrebuiltAdsAndTracking).mockResolvedValue(
        mockEngine as unknown as IRequestFilter
      );

      expect(await adBlocker.isBlocked("https://example.com/article")).toBe(
        false
      );
      expect(
        await adBlocker.isBlocked("https://cdn.example.com/script.js")
      ).toBe(false);
      expect(await adBlocker.isBlocked("https://api.example.com/data")).toBe(
        false
      );
    });
  });
});
