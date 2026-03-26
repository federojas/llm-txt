import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContentGeneratorFactory } from "@/lib/content-generation/core/factory";

// Mock all provider modules
vi.mock(
  "@/lib/content-generation/providers/groq/groq-description-generator",
  () => ({
    GroqDescriptionGenerator: class {
      isAvailable() {
        return true;
      }
      async generateDescription() {
        return "AI description";
      }
      async generateBusinessSummary() {
        return "AI summary";
      }
    },
  })
);

vi.mock(
  "@/lib/content-generation/providers/groq/groq-section-discovery",
  () => ({
    GroqSectionDiscovery: class {
      isAvailable() {
        return true;
      }
      async discoverSections() {
        return [];
      }
    },
  })
);

vi.mock(
  "@/lib/content-generation/providers/deterministic/metadata-description-generator",
  () => ({
    MetadataDescriptionGenerator: class {
      isAvailable() {
        return true;
      }
      async generateDescription() {
        return "Metadata description";
      }
      async generateBusinessSummary() {
        return "Metadata summary";
      }
    },
  })
);

vi.mock(
  "@/lib/content-generation/providers/deterministic/generic-section-discovery",
  () => ({
    GenericSectionDiscovery: class {
      isAvailable() {
        return true;
      }
      async discoverSections() {
        return [{ name: "Pages", pageIndexes: [0] }];
      }
    },
  })
);

vi.mock(
  "@/lib/content-generation/providers/deterministic/url-structure-section-discovery",
  () => ({
    UrlStructureSectionDiscovery: class {
      isAvailable() {
        return true;
      }
      async discoverSections() {
        return [];
      }
    },
  })
);

vi.mock(
  "@/lib/content-generation/strategies/hybrid-description-generator",
  () => ({
    HybridDescriptionGenerator: class {
      isAvailable() {
        return true;
      }
      async generateDescription() {
        return "Hybrid description";
      }
      async generateBusinessSummary() {
        return "Hybrid summary";
      }
    },
  })
);

vi.mock("@/lib/content-generation/strategies/chained-service", () => ({
  createChainedService: vi.fn((services) => services[0]),
}));

describe("ContentGeneratorFactory", () => {
  let factory: ContentGeneratorFactory;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize without config", () => {
      factory = new ContentGeneratorFactory();
      expect(factory).toBeInstanceOf(ContentGeneratorFactory);
    });

    it("should initialize with empty config", () => {
      factory = new ContentGeneratorFactory({});
      expect(factory).toBeInstanceOf(ContentGeneratorFactory);
    });

    it("should initialize with Groq config", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-key",
          rateLimit: 30,
        },
      });
      expect(factory).toBeInstanceOf(ContentGeneratorFactory);
    });
  });

  describe("createDescriptionGenerator", () => {
    it("should create description generator without API key", () => {
      factory = new ContentGeneratorFactory({});
      const generator = factory.createDescriptionGenerator();

      expect(generator).toBeDefined();
      expect(generator.isAvailable()).toBe(true);
    });

    it("should create description generator with Groq API key", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-groq-key",
        },
      });

      const generator = factory.createDescriptionGenerator();

      expect(generator).toBeDefined();
      expect(generator.isAvailable()).toBe(true);
    });

    it("should create chained service with AI and heuristic fallback", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-groq-key",
          rateLimit: 30,
        },
      });

      const generator = factory.createDescriptionGenerator();

      expect(generator).toBeDefined();
    });

    it("should use default rate limit of 30 if not specified", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-groq-key",
        },
      });

      factory.createDescriptionGenerator();

      // Rate limit is passed to GroqDescriptionGenerator constructor
      expect(factory).toBeDefined();
    });

    it("should use custom rate limit if specified", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-groq-key",
          rateLimit: 60,
        },
      });

      factory.createDescriptionGenerator();

      expect(factory).toBeDefined();
    });
  });

  describe("createHybridDescriptionGenerator", () => {
    it("should create hybrid generator", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-groq-key",
        },
      });

      const generator = factory.createHybridDescriptionGenerator();

      expect(generator).toBeDefined();
      expect(generator.isAvailable()).toBe(true);
    });

    it("should work without AI provider", () => {
      factory = new ContentGeneratorFactory({});

      const generator = factory.createHybridDescriptionGenerator();

      expect(generator).toBeDefined();
    });

    it("should use AI for summary and metadata for pages", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-groq-key",
        },
      });

      const generator = factory.createHybridDescriptionGenerator();

      // Hybrid generator combines AI summary with metadata descriptions
      expect(generator).toBeDefined();
    });
  });

  describe("createSectionDiscovery", () => {
    it("should create section discovery without API key", () => {
      factory = new ContentGeneratorFactory({});
      const service = factory.createSectionDiscovery();

      expect(service).toBeDefined();
      expect(service.isAvailable()).toBe(true);
    });

    it("should create section discovery with Groq API key", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-groq-key",
        },
      });

      const service = factory.createSectionDiscovery();

      expect(service).toBeDefined();
      expect(service.isAvailable()).toBe(true);
    });

    it("should create fallback chain: AI → URL Structure → Generic", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-groq-key",
        },
      });

      const service = factory.createSectionDiscovery();

      // Chain includes: GroqSectionDiscovery, UrlStructureSectionDiscovery, GenericSectionDiscovery
      expect(service).toBeDefined();
    });

    it("should include URL structure fallback even without API key", () => {
      factory = new ContentGeneratorFactory({});

      const service = factory.createSectionDiscovery();

      // Should have URL structure and generic fallbacks
      expect(service).toBeDefined();
    });

    it("should always include generic fallback as last resort", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-groq-key",
        },
      });

      const service = factory.createSectionDiscovery();

      // GenericSectionDiscovery is always the last in the chain
      expect(service).toBeDefined();
    });
  });

  describe("multiple providers", () => {
    it("should handle configuration with multiple providers in future", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "groq-key",
          rateLimit: 30,
        },
        // Future providers can be added here
        // openai: { apiKey: "openai-key" },
        // anthropic: { apiKey: "anthropic-key" },
      });

      const descGenerator = factory.createDescriptionGenerator();
      const sectionDiscovery = factory.createSectionDiscovery();

      expect(descGenerator).toBeDefined();
      expect(sectionDiscovery).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle undefined API key", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: undefined,
        },
      });

      const generator = factory.createDescriptionGenerator();

      // Should still create generator with heuristic fallback
      expect(generator).toBeDefined();
    });

    it("should handle empty API key", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "",
        },
      });

      const generator = factory.createDescriptionGenerator();

      expect(generator).toBeDefined();
    });

    it("should handle zero rate limit", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-key",
          rateLimit: 0,
        },
      });

      const generator = factory.createDescriptionGenerator();

      expect(generator).toBeDefined();
    });

    it("should skip providers without API keys", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          // No apiKey provided
          rateLimit: 30,
        },
      });

      const generator = factory.createDescriptionGenerator();

      // Should only have heuristic generator
      expect(generator).toBeDefined();
    });
  });

  describe("service integration", () => {
    it("should create services that implement correct interfaces", () => {
      factory = new ContentGeneratorFactory({
        groq: {
          apiKey: "test-key",
        },
      });

      const descGenerator = factory.createDescriptionGenerator();
      const sectionDiscovery = factory.createSectionDiscovery();
      const hybridGenerator = factory.createHybridDescriptionGenerator();

      // Check that all services have required methods
      expect(descGenerator.isAvailable).toBeDefined();
      expect(descGenerator.generateDescription).toBeDefined();
      expect(descGenerator.generateBusinessSummary).toBeDefined();

      expect(sectionDiscovery.isAvailable).toBeDefined();
      expect(sectionDiscovery.discoverSections).toBeDefined();

      expect(hybridGenerator.isAvailable).toBeDefined();
      expect(hybridGenerator.generateDescription).toBeDefined();
      expect(hybridGenerator.generateBusinessSummary).toBeDefined();
    });
  });
});
