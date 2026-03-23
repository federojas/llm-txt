import { IChainable } from "../strategies/chained-service";
import { IDescriptionGenerator, ISectionDiscoveryService } from "./types";
import { GroqDescriptionGenerator } from "../providers/groq/groq-description-generator";
import { GroqSectionDiscovery } from "../providers/groq/groq-section-discovery";
import { MetadataDescriptionGenerator } from "../providers/deterministic/metadata-description-generator";
import { GenericSectionDiscovery } from "../providers/deterministic/generic-section-discovery";
import { UrlStructureSectionDiscovery } from "../providers/deterministic/url-structure-section-discovery";
import { HybridDescriptionGenerator } from "../strategies/hybrid-description-generator";
import { createChainedService } from "../strategies/chained-service";

/**
 * LLM Provider Configuration
 */
interface ProviderConfig {
  apiKey?: string;
  rateLimit?: number;
}

/**
 * Content Generator Factory Configuration
 * Add new providers here (OpenAI, Anthropic, etc.)
 */
export interface ContentGeneratorConfig {
  groq?: ProviderConfig;
  // Future providers:
  // openai?: ProviderConfig;
  // anthropic?: ProviderConfig;
}

/**
 * Content Generator Factory
 * Creates chained content generation services with fallback handling
 */
export class ContentGeneratorFactory {
  private config: ContentGeneratorConfig;

  constructor(config: ContentGeneratorConfig = {}) {
    this.config = config;
  }

  /**
   * Create Description Generator with fallback chain
   * Chain order: Configured LLMs → Heuristics
   */
  createDescriptionGenerator(): IDescriptionGenerator {
    return this.createChainedService<IDescriptionGenerator>(
      (provider, apiKey, rateLimit) => {
        switch (provider) {
          case "groq":
            return new GroqDescriptionGenerator(apiKey, rateLimit);
          // Future providers:
          // case "openai":
          //   return new OpenAIDescriptionGenerator(apiKey, rateLimit);
          default:
            return null;
        }
      },
      () => new MetadataDescriptionGenerator(),
      "DescriptionGenerator"
    );
  }

  /**
   * Create Hybrid Description Generator
   * Uses AI for site summary (1 call), metadata for page descriptions (0 calls)
   * Optimized for metadata mode: high-quality summary + fast execution
   */
  createHybridDescriptionGenerator(): IDescriptionGenerator {
    // AI generator for site summary (with fallback chain)
    const summaryGenerator = this.createDescriptionGenerator();

    // Metadata generator for page descriptions (no API calls)
    const pageGenerator = new MetadataDescriptionGenerator();

    return new HybridDescriptionGenerator(summaryGenerator, pageGenerator);
  }

  /**
   * Create Section Discovery Service with fallback chain
   * Chain order: AI → URL Structure → Generic
   *
   * 1. AI (Groq): Best quality, semantic understanding (rate limited)
   * 2. URL Structure: Parses URL paths, groups by prefix (no API)
   * 3. Generic: Last resort, single "Pages" section (always succeeds)
   */
  createSectionDiscovery(): ISectionDiscoveryService {
    const services: ISectionDiscoveryService[] = [];

    // Add all configured LLM providers
    for (const [provider, config] of Object.entries(this.config)) {
      if (config?.apiKey) {
        const rateLimit = config.rateLimit || 30;
        if (provider === "groq") {
          services.push(new GroqSectionDiscovery(config.apiKey, rateLimit));
        }
        // Future providers:
        // else if (provider === "openai") {
        //   services.push(new OpenAISectionDiscovery(config.apiKey, rateLimit));
        // }
      }
    }

    // Add URL structure fallback (parses URL paths, no API)
    services.push(new UrlStructureSectionDiscovery());

    // Add generic fallback (last resort - single "Pages" section)
    services.push(new GenericSectionDiscovery());

    return createChainedService<ISectionDiscoveryService>(services, {
      serviceName: "SectionDiscovery",
    });
  }

  /**
   * Generic method to create chained services
   * Reduces duplication across all service types
   */
  private createChainedService<T extends IChainable>(
    providerFactory: (
      provider: string,
      apiKey: string,
      rateLimit: number
    ) => T | null,
    fallbackFactory: () => T,
    serviceName: string
  ): T {
    const services: T[] = [];

    // Add all configured LLM providers
    for (const [provider, config] of Object.entries(this.config)) {
      if (config?.apiKey) {
        const rateLimit = config.rateLimit || 30; // Default rate limit
        const service = providerFactory(provider, config.apiKey, rateLimit);
        if (service) {
          services.push(service);
        }
      }
    }

    // Always add heuristic fallback
    services.push(fallbackFactory());

    return createChainedService<T>(services, { serviceName });
  }
}
