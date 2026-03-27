/**
 * Unit Tests: External Links
 * Tests quality filtering for external links in llms.txt
 */

import { describe, it, expect, vi } from "vitest";
import { isValuableExternalLink } from "@/lib/crawling/external-links";
import type { IAdBlocker } from "@/lib/crawling/ad-blocker";

describe("External Links", () => {
  // Mock ad blocker that allows everything by default
  const createMockAdBlocker = (blockedUrls: string[] = []): IAdBlocker => ({
    isBlocked: vi.fn(async (url: string) => blockedUrls.includes(url)),
  });

  describe("isValuableExternalLink", () => {
    describe("Signal 1: Domain blocklist", () => {
      it("should block Twitter links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://twitter.com/username",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block X.com links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://x.com/username",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block Facebook links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://facebook.com/page",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block LinkedIn links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://linkedin.com/in/profile",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block Instagram links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://instagram.com/user",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block YouTube links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://youtube.com/watch?v=123",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block youtu.be short links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://youtu.be/abc123",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block TikTok links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://tiktok.com/@user",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block Reddit links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://reddit.com/r/subreddit",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block Discord links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://discord.com/invite/abc",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block Discord invite links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://discord.gg/abc123",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block Telegram links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://t.me/channel",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block help subdomain", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://help.example.com/article",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block support subdomain", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://support.example.com/ticket",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block community subdomain", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://community.example.com/forum",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block forum subdomain", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://forum.example.com/topic",
          adBlocker
        );
        expect(result).toBe(false);
      });

      it("should block social media subdomains", async () => {
        const adBlocker = createMockAdBlocker();
        expect(
          await isValuableExternalLink(
            "https://studio.youtube.com/channel",
            adBlocker
          )
        ).toBe(false);
        expect(
          await isValuableExternalLink(
            "https://www.facebook.com/page",
            adBlocker
          )
        ).toBe(false);
      });

      it("should allow GitHub links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://github.com/user/repo",
          adBlocker,
          undefined,
          true
        );
        expect(result).toBe(true);
      });

      it("should allow GitLab links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://gitlab.com/project",
          adBlocker,
          undefined,
          true
        );
        expect(result).toBe(true);
      });

      it("should allow Stack Overflow links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://stackoverflow.com/questions/123",
          adBlocker,
          undefined,
          true
        );
        expect(result).toBe(true);
      });

      it("should allow npm package links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://npmjs.com/package/example",
          adBlocker,
          undefined,
          true
        );
        expect(result).toBe(true);
      });

      it("should log blocked domains", async () => {
        const consoleLogSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});
        const adBlocker = createMockAdBlocker();

        await isValuableExternalLink("https://twitter.com/user", adBlocker);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          "[External Links] Blocked by domain: https://twitter.com/user"
        );
        consoleLogSpy.mockRestore();
      });
    });

    describe("Signal 2: rel attribute", () => {
      it("should block nofollow links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/link",
          adBlocker,
          "nofollow"
        );
        expect(result).toBe(false);
      });

      it("should block sponsored links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/ad",
          adBlocker,
          "sponsored"
        );
        expect(result).toBe(false);
      });

      it("should block ugc (user-generated content) links", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/ugc",
          adBlocker,
          "ugc"
        );
        expect(result).toBe(false);
      });

      it("should handle multiple rel values", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/link",
          adBlocker,
          "nofollow sponsored"
        );
        expect(result).toBe(false);
      });

      it("should be case-insensitive", async () => {
        const adBlocker = createMockAdBlocker();
        expect(
          await isValuableExternalLink(
            "https://example.com/link",
            adBlocker,
            "NOFOLLOW"
          )
        ).toBe(false);
        expect(
          await isValuableExternalLink(
            "https://example.com/link",
            adBlocker,
            "NoFollow"
          )
        ).toBe(false);
      });

      it("should allow links without rel attribute", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/link",
          adBlocker,
          undefined,
          true
        );
        expect(result).toBe(true);
      });

      it("should allow links with other rel values", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/link",
          adBlocker,
          "external",
          true
        );
        expect(result).toBe(true);
      });
    });

    describe("Signal 3: Ad blocker", () => {
      it("should block URLs marked by ad blocker", async () => {
        const adBlocker = createMockAdBlocker([
          "https://ads.example.com/banner.js",
        ]);
        const result = await isValuableExternalLink(
          "https://ads.example.com/banner.js",
          adBlocker,
          undefined,
          true
        );
        expect(result).toBe(false);
      });

      it("should allow URLs not blocked by ad blocker", async () => {
        const adBlocker = createMockAdBlocker([]);
        const result = await isValuableExternalLink(
          "https://example.com/article",
          adBlocker,
          undefined,
          true
        );
        expect(result).toBe(true);
      });

      it("should call ad blocker for each URL", async () => {
        const adBlocker = createMockAdBlocker();
        await isValuableExternalLink(
          "https://example.com/link",
          adBlocker,
          undefined,
          true
        );
        expect(adBlocker.isBlocked).toHaveBeenCalledWith(
          "https://example.com/link"
        );
      });
    });

    describe("Signal 4: HTML context", () => {
      it("should block links not in main content", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/link",
          adBlocker,
          undefined,
          false // Not in main content
        );
        expect(result).toBe(false);
      });

      it("should allow links in main content", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/link",
          adBlocker,
          undefined,
          true // In main content
        );
        expect(result).toBe(true);
      });

      it("should allow links when context is undefined", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/link",
          adBlocker,
          undefined,
          undefined // Context unknown
        );
        expect(result).toBe(true);
      });
    });

    describe("Combined filters", () => {
      it("should block if any filter triggers", async () => {
        const adBlocker = createMockAdBlocker();

        // Domain block takes precedence
        expect(
          await isValuableExternalLink(
            "https://twitter.com/user",
            adBlocker,
            undefined,
            true
          )
        ).toBe(false);

        // rel attribute takes precedence
        expect(
          await isValuableExternalLink(
            "https://example.com/link",
            adBlocker,
            "nofollow",
            true
          )
        ).toBe(false);

        // Ad blocker takes precedence
        const blockingAdBlocker = createMockAdBlocker([
          "https://example.com/ad",
        ]);
        expect(
          await isValuableExternalLink(
            "https://example.com/ad",
            blockingAdBlocker,
            undefined,
            true
          )
        ).toBe(false);

        // Context takes precedence
        expect(
          await isValuableExternalLink(
            "https://example.com/link",
            adBlocker,
            undefined,
            false
          )
        ).toBe(false);
      });

      it("should allow only if all filters pass", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/article",
          adBlocker,
          undefined, // No rel attribute
          true // In main content
        );
        expect(result).toBe(true);
      });
    });

    describe("Edge cases", () => {
      it("should handle invalid URLs gracefully", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "not-a-valid-url",
          adBlocker
        );
        // Invalid URL doesn't match exclusion patterns, so passes through
        // (domain check catches exception and returns false = "not excluded")
        expect(result).toBe(true);
      });

      it("should handle URLs with special characters", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://example.com/path?param=value&foo=bar#anchor",
          adBlocker,
          undefined,
          true
        );
        expect(result).toBe(true);
      });

      it("should handle URLs with uppercase domains", async () => {
        const adBlocker = createMockAdBlocker();
        const result = await isValuableExternalLink(
          "https://TWITTER.COM/user",
          adBlocker
        );
        expect(result).toBe(false); // Still blocked (case-insensitive)
      });

      it("should handle ad blocker errors gracefully", async () => {
        const adBlocker: IAdBlocker = {
          isBlocked: vi.fn().mockRejectedValue(new Error("Ad blocker failed")),
        };
        const result = await isValuableExternalLink(
          "https://example.com/link",
          adBlocker
        );
        expect(result).toBe(false); // Fail closed on errors
      });

      it("should handle errors in any signal gracefully", async () => {
        const adBlocker = createMockAdBlocker();
        // This should not throw
        const result = await isValuableExternalLink(
          "https://example.com",
          adBlocker
        );
        expect(result).toBeDefined();
      });
    });

    describe("Real-world scenarios", () => {
      it("should filter typical website footer links", async () => {
        const adBlocker = createMockAdBlocker();

        // Footer social links (domain + context)
        expect(
          await isValuableExternalLink(
            "https://twitter.com/company",
            adBlocker,
            undefined,
            false
          )
        ).toBe(false);
        expect(
          await isValuableExternalLink(
            "https://facebook.com/company",
            adBlocker,
            undefined,
            false
          )
        ).toBe(false);
      });

      it("should allow technical resource links in main content", async () => {
        const adBlocker = createMockAdBlocker();

        expect(
          await isValuableExternalLink(
            "https://developer.mozilla.org/docs",
            adBlocker,
            undefined,
            true
          )
        ).toBe(true);
        expect(
          await isValuableExternalLink(
            "https://github.com/org/repo",
            adBlocker,
            undefined,
            true
          )
        ).toBe(true);
        expect(
          await isValuableExternalLink(
            "https://stackoverflow.com/q/123",
            adBlocker,
            undefined,
            true
          )
        ).toBe(true);
      });

      it("should filter affiliate and sponsored links", async () => {
        const adBlocker = createMockAdBlocker();

        expect(
          await isValuableExternalLink(
            "https://example.com/product?ref=affiliate",
            adBlocker,
            "sponsored nofollow"
          )
        ).toBe(false);
      });

      it("should filter help/support pages even in main content", async () => {
        const adBlocker = createMockAdBlocker();

        // Domain filter takes precedence over context
        expect(
          await isValuableExternalLink(
            "https://help.company.com/article",
            adBlocker,
            undefined,
            true
          )
        ).toBe(false);
        expect(
          await isValuableExternalLink(
            "https://support.service.com/faq",
            adBlocker,
            undefined,
            true
          )
        ).toBe(false);
      });
    });
  });
});
