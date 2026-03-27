/**
 * Unit Tests: LLMS.txt Context
 * Tests shared context and prompt generation for AI providers
 */

import { describe, it, expect } from "vitest";
import {
  LLMS_TXT_PURPOSE,
  CONTENT_PRIORITIES,
  SECTION_GUIDELINES,
  DESCRIPTION_GUIDELINES,
  getSectionDiscoveryPrompt,
  getDescriptionPrompt,
  getBusinessSummaryPrompt,
} from "@/lib/content-generation/shared/llms-txt-context";

describe("LLMS.txt Context", () => {
  describe("Constants", () => {
    describe("LLMS_TXT_PURPOSE", () => {
      it("should define llms.txt purpose", () => {
        expect(LLMS_TXT_PURPOSE).toBeTruthy();
        expect(LLMS_TXT_PURPOSE).toContain("llms.txt");
        expect(LLMS_TXT_PURPOSE).toContain("standard");
      });

      it("should explain format structure", () => {
        expect(LLMS_TXT_PURPOSE).toContain("Markdown");
        expect(LLMS_TXT_PURPOSE).toContain("H1");
        expect(LLMS_TXT_PURPOSE).toContain("H2");
        expect(LLMS_TXT_PURPOSE).toContain("Optional");
      });

      it("should mention context window limitation", () => {
        expect(LLMS_TXT_PURPOSE).toContain("context window");
      });
    });

    describe("CONTENT_PRIORITIES", () => {
      it("should define priority levels", () => {
        expect(CONTENT_PRIORITIES).toBeTruthy();
        expect(CONTENT_PRIORITIES).toContain("CRITICAL");
        expect(CONTENT_PRIORITIES).toContain("HIGH PRIORITY");
        expect(CONTENT_PRIORITIES).toContain("LOW PRIORITY");
      });

      it("should provide domain-specific examples", () => {
        expect(CONTENT_PRIORITIES).toContain("Software");
        expect(CONTENT_PRIORITIES).toContain("E-commerce");
        expect(CONTENT_PRIORITIES).toContain("Education");
        expect(CONTENT_PRIORITIES).toContain("Government");
      });

      it("should explain main vs Optional distinction", () => {
        expect(CONTENT_PRIORITIES).toContain("Main sections");
        expect(CONTENT_PRIORITIES).toContain("Optional section");
      });

      it("should provide decision framework", () => {
        expect(CONTENT_PRIORITIES).toContain("Decision framework");
        expect(CONTENT_PRIORITIES).toContain("accomplish core tasks");
      });
    });

    describe("SECTION_GUIDELINES", () => {
      it("should define section organization principles", () => {
        expect(SECTION_GUIDELINES).toBeTruthy();
        expect(SECTION_GUIDELINES).toContain("Section Organization");
      });

      it("should provide naming principles", () => {
        expect(SECTION_GUIDELINES).toContain("naming principles");
        expect(SECTION_GUIDELINES).toContain("specific and descriptive");
      });

      it("should give domain-specific section examples", () => {
        expect(SECTION_GUIDELINES).toContain("Software:");
        expect(SECTION_GUIDELINES).toContain("E-commerce:");
        expect(SECTION_GUIDELINES).toContain("Education:");
        expect(SECTION_GUIDELINES).toContain("Government:");
      });

      it("should explain Optional section usage", () => {
        expect(SECTION_GUIDELINES).toContain('The "Optional" section');
        expect(SECTION_GUIDELINES).toContain("can skip for shorter context");
      });

      it("should provide test criteria", () => {
        expect(SECTION_GUIDELINES).toContain("Test:");
        expect(SECTION_GUIDELINES).toContain("Optional");
        expect(SECTION_GUIDELINES).toContain("Main section");
      });
    });

    describe("DESCRIPTION_GUIDELINES", () => {
      it("should define description writing rules", () => {
        expect(DESCRIPTION_GUIDELINES).toBeTruthy();
        expect(DESCRIPTION_GUIDELINES).toContain("Link descriptions should");
      });

      it("should provide good examples", () => {
        expect(DESCRIPTION_GUIDELINES).toContain("Good examples");
        expect(DESCRIPTION_GUIDELINES).toContain("API reference");
        expect(DESCRIPTION_GUIDELINES).toContain("Product catalog");
      });

      it("should provide bad examples", () => {
        expect(DESCRIPTION_GUIDELINES).toContain("Bad examples");
        expect(DESCRIPTION_GUIDELINES).toContain("Learn more here");
        expect(DESCRIPTION_GUIDELINES).toContain("Amazing resources");
      });

      it("should provide writing formula", () => {
        expect(DESCRIPTION_GUIDELINES).toContain("Writing formula");
        expect(DESCRIPTION_GUIDELINES).toContain("[Content type]");
        expect(DESCRIPTION_GUIDELINES).toContain("[specific topic/purpose]");
      });
    });
  });

  describe("Prompt Generation Functions", () => {
    describe("getSectionDiscoveryPrompt", () => {
      it("should return complete prompt", () => {
        const prompt = getSectionDiscoveryPrompt();
        expect(prompt).toBeTruthy();
        expect(typeof prompt).toBe("string");
      });

      it("should include llms.txt purpose", () => {
        const prompt = getSectionDiscoveryPrompt();
        expect(prompt).toContain("llms.txt");
        expect(prompt).toContain("standard");
      });

      it("should include content priorities", () => {
        const prompt = getSectionDiscoveryPrompt();
        expect(prompt).toContain("CRITICAL");
        expect(prompt).toContain("Optional section");
      });

      it("should include section guidelines", () => {
        const prompt = getSectionDiscoveryPrompt();
        expect(prompt).toContain("Section Organization");
        expect(prompt).toContain("naming principles");
      });

      it("should include task instruction", () => {
        const prompt = getSectionDiscoveryPrompt();
        expect(prompt).toContain("Your task:");
        expect(prompt).toContain("Group pages into logical sections");
      });

      it("should emphasize technical documentation priority", () => {
        const prompt = getSectionDiscoveryPrompt();
        expect(prompt).toContain("technical documentation");
        expect(prompt).toContain("API references");
      });

      it("should mention moving blog/marketing to Optional", () => {
        const prompt = getSectionDiscoveryPrompt();
        expect(prompt).toContain("blog posts");
        expect(prompt).toContain("marketing content");
        expect(prompt).toContain("Optional section");
      });
    });

    describe("getDescriptionPrompt", () => {
      it("should return complete prompt", () => {
        const prompt = getDescriptionPrompt();
        expect(prompt).toBeTruthy();
        expect(typeof prompt).toBe("string");
      });

      it("should include llms.txt purpose", () => {
        const prompt = getDescriptionPrompt();
        expect(prompt).toContain("llms.txt");
        expect(prompt).toContain("standard");
      });

      it("should include description guidelines", () => {
        const prompt = getDescriptionPrompt();
        expect(prompt).toContain("Link descriptions should");
        expect(prompt).toContain("concise");
      });

      it("should include task instruction", () => {
        const prompt = getDescriptionPrompt();
        expect(prompt).toContain("Your task:");
        expect(prompt).toContain("Write concise, technical descriptions");
      });

      it("should emphasize helping LLMs decide relevance", () => {
        const prompt = getDescriptionPrompt();
        expect(prompt).toContain("help LLMs decide");
        expect(prompt).toContain("relevant to their current task");
      });
    });

    describe("getBusinessSummaryPrompt", () => {
      it("should return complete prompt", () => {
        const prompt = getBusinessSummaryPrompt();
        expect(prompt).toBeTruthy();
        expect(typeof prompt).toBe("string");
      });

      it("should include llms.txt purpose", () => {
        const prompt = getBusinessSummaryPrompt();
        expect(prompt).toContain("llms.txt");
        expect(prompt).toContain("standard");
      });

      it("should explain context (blockquote at top)", () => {
        const prompt = getBusinessSummaryPrompt();
        expect(prompt).toContain("Context:");
        expect(prompt).toContain("blockquote");
      });

      it("should define summary requirements", () => {
        const prompt = getBusinessSummaryPrompt();
        expect(prompt).toContain("1-3 sentences");
        expect(prompt).toContain("technical terms");
        expect(prompt).toContain("not marketing-focused");
      });

      it("should provide good examples", () => {
        const prompt = getBusinessSummaryPrompt();
        expect(prompt).toContain("Good examples:");
        expect(prompt).toContain("FastHTML");
        expect(prompt).toContain("Stripe");
      });

      it("should provide bad examples", () => {
        const prompt = getBusinessSummaryPrompt();
        expect(prompt).toContain("Bad examples:");
        expect(prompt).toContain("best way");
        expect(prompt).toContain("amazing tool");
      });

      it("should emphasize avoiding marketing language", () => {
        const prompt = getBusinessSummaryPrompt();
        expect(prompt).toContain("marketing");
        expect(prompt).toContain("hyperbolic");
      });
    });
  });

  describe("Prompt Consistency", () => {
    it("all prompts should include llms.txt purpose", () => {
      expect(getSectionDiscoveryPrompt()).toContain("llms.txt");
      expect(getDescriptionPrompt()).toContain("llms.txt");
      expect(getBusinessSummaryPrompt()).toContain("llms.txt");
    });

    it("all prompts should be non-empty strings", () => {
      expect(getSectionDiscoveryPrompt().length).toBeGreaterThan(100);
      expect(getDescriptionPrompt().length).toBeGreaterThan(100);
      expect(getBusinessSummaryPrompt().length).toBeGreaterThan(100);
    });

    it("prompts should be deterministic", () => {
      // Calling multiple times should return identical results
      expect(getSectionDiscoveryPrompt()).toBe(getSectionDiscoveryPrompt());
      expect(getDescriptionPrompt()).toBe(getDescriptionPrompt());
      expect(getBusinessSummaryPrompt()).toBe(getBusinessSummaryPrompt());
    });
  });

  describe("Domain Agnosticism", () => {
    it("should mention multiple domain types", () => {
      const allContent =
        CONTENT_PRIORITIES + SECTION_GUIDELINES + DESCRIPTION_GUIDELINES;

      expect(allContent).toContain("Software");
      expect(allContent).toContain("E-commerce");
      expect(allContent).toContain("Education");
      expect(allContent).toContain("Government");
      expect(allContent).toContain("News");
      expect(allContent).toContain("Healthcare");
    });

    it("should avoid favoring one domain over others", () => {
      // Each domain should have examples in multiple contexts
      const priorities = CONTENT_PRIORITIES;
      const guidelines = SECTION_GUIDELINES;

      // Check that multiple domains appear in different contexts
      expect(priorities).toContain("Software/Dev tools");
      expect(priorities).toContain("E-commerce:");
      expect(guidelines).toContain("Software:");
      expect(guidelines).toContain("E-commerce:");
    });
  });
});
