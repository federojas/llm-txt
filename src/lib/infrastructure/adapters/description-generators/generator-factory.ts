import { IDescriptionGenerator } from "@/lib/domain/interfaces/description-generator.interface";
import { GroqDescriptionGenerator } from "./groq-generator";
import { HeuristicDescriptionGenerator } from "./heuristic-generator";

/**
 * Factory for creating description generators based on configuration
 */
export class DescriptionGeneratorFactory {
  /**
   * Create primary description generator based on available API keys
   */
  static createPrimaryGenerator(): IDescriptionGenerator | null {
    const groqApiKey = process.env.GROQ_API_KEY;

    if (groqApiKey) {
      return new GroqDescriptionGenerator(groqApiKey, 30); // 30 RPM for free tier
    }

    return null;
  }

  /**
   * Create fallback generator (always available)
   */
  static createFallbackGenerator(): IDescriptionGenerator {
    return new HeuristicDescriptionGenerator();
  }

  /**
   * Create the best available generator
   * Returns primary if available, otherwise fallback
   */
  static createGenerator(): IDescriptionGenerator {
    const primary = this.createPrimaryGenerator();
    return primary || this.createFallbackGenerator();
  }
}
