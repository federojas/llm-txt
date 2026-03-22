import { IChainable } from "./chained-service";
import { IDescriptionGenerator, ISectionDiscoveryService } from "./types";
import { GroqDescriptionGenerator } from "./groq/groq-description-generator";
import { GroqSectionDiscovery } from "./groq/groq-section-discovery";
import { HeuristicDescriptionGenerator } from "./heuristic/heuristic-description-generator";
import { HeuristicSectionDiscovery } from "./heuristic/heuristic-section-discovery";
import { createChainedService } from "@/lib/ai-enhancement/chained-service";

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
      () => new HeuristicDescriptionGenerator(),
      "DescriptionGenerator"
    );
  }

  /**
   * Create Section Discovery Service with fallback chain
   * Chain order: Configured LLMs → Heuristics
   */
  createSectionDiscovery(): ISectionDiscoveryService {
    return this.createChainedService<ISectionDiscoveryService>(
      (provider, apiKey, rateLimit) => {
        switch (provider) {
          case "groq":
            return new GroqSectionDiscovery(apiKey, rateLimit);
          // Future providers:
          // case "openai":
          //   return new OpenAISectionDiscovery(apiKey, rateLimit);
          default:
            return null;
        }
      },
      () => new HeuristicSectionDiscovery(),
      "SectionDiscovery"
    );
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
