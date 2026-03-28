import { IDescriptionGenerator } from "../../core/types";
import { PageMetadata } from "@/lib/types";
import { GroqClient } from "./groq-client";
import {
  getDescriptionPrompt,
  getDescriptionUserPrompt,
  getBusinessSummaryPrompt,
  getBusinessSummaryUserPrompt,
} from "../../shared/llms-txt-context";
import { MetadataAccumulator } from "../../metadata-accumulator";

/**
 * Groq Description Generator
 * Implements ONLY description generation (Single Responsibility Principle)
 * Uses shared GroqClient for API calls and rate limiting
 */
export class GroqDescriptionGenerator implements IDescriptionGenerator {
  private groqClient: GroqClient;

  constructor(apiKey: string, requestsPerMinute: number = 30) {
    this.groqClient = new GroqClient(apiKey, requestsPerMinute);
  }

  isAvailable(): boolean {
    return this.groqClient.isAvailable();
  }

  async generateDescription(
    page: PageMetadata,
    metadataAccumulator?: MetadataAccumulator
  ): Promise<string> {
    const { data, metadata } = await this.groqClient.executeWithFallback(
      async (model, client) => {
        return await client.chat.completions
          .create({
            model,
            max_tokens: 120,
            messages: [
              {
                role: "system",
                content: getDescriptionPrompt(),
              },
              {
                role: "user",
                content: getDescriptionUserPrompt(page),
              },
            ],
          })
          .withResponse()
          .then(({ data, response }) => {
            const text = data.choices[0]?.message?.content?.trim() || "";
            return {
              data: text.replace(/^["']|["']$/g, ""),
              response,
            };
          });
      }
    );

    // Collect metadata if accumulator provided
    if (metadataAccumulator) {
      metadataAccumulator.addApiCall("description-generator", metadata);
    }

    return data;
  }

  async generateBusinessSummary(
    homepage: PageMetadata,
    metadataAccumulator?: MetadataAccumulator
  ): Promise<string> {
    const { data, metadata } = await this.groqClient.executeWithFallback(
      async (model, client) => {
        return await client.chat.completions
          .create({
            model,
            max_tokens: 500,
            messages: [
              {
                role: "system",
                content: getBusinessSummaryPrompt(),
              },
              {
                role: "user",
                content: getBusinessSummaryUserPrompt(homepage),
              },
            ],
          })
          .withResponse()
          .then(({ data, response }) => {
            const text = data.choices[0]?.message?.content?.trim() || "";
            return { data: text, response };
          });
      }
    );

    // Collect metadata if accumulator provided
    if (metadataAccumulator) {
      metadataAccumulator.addApiCall("business-summary", metadata);
    }

    return data;
  }
}
