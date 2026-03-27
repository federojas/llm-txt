import { IDescriptionGenerator } from "../../core/types";
import { PageMetadata } from "@/lib/types";
import { GroqClient } from "./groq-client";
import {
  getDescriptionPrompt,
  getBusinessSummaryPrompt,
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
                content: `Create a concise description for this page (max 20 words).

Title: ${page.title}
URL: ${page.url}
Meta Description: ${page.description || page.ogDescription || "N/A"}

Output only the description, no quotes, no preamble.`,
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
                content: `Analyze this website homepage and create content for an llms.txt file.

Site Name: ${homepage.siteName || homepage.title}
URL: ${homepage.url}
Description: ${homepage.ogDescription || homepage.description || "N/A"}
H1: ${homepage.h1 || "N/A"}
Body Text: ${homepage.bodyText?.slice(0, 1500) || "N/A"}

Create TWO parts separated by "|||":

PART 1 - Brief Summary (1-3 sentences):
Explain what this product/service is in technical terms. Be specific about core function, technologies, or key capabilities.

Examples:
- "FastHTML is a Python library combining Starlette, Uvicorn, and HTMX for server-rendered hypermedia applications"
- "YouTube is a video-sharing platform where users upload, view, rate, share, and comment on videos globally"
- "Stripe provides payment processing APIs for internet businesses with SDKs for multiple languages"

PART 2 - Additional Context (optional, 2-4 paragraphs):
If the body text contains substantial information, provide additional context that helps LLMs understand and assist users:
- What users can do with this site/product
- Key features or capabilities mentioned in the body text
- Important technical details or use cases
- How LLMs can help users interact with this site

Keep it concise and informative. If body text lacks substance, write: NONE

Output the two parts separated by "|||" with no format labels or instructions:`,
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
