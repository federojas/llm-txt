import { IDescriptionGenerator } from "../types";
import { PageMetadata } from "@/lib/types";
import { GroqClient } from "./groq-client";
import {
  getDescriptionPrompt,
  getBusinessSummaryPrompt,
} from "../llms-txt-context";

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

  async generateDescription(page: PageMetadata): Promise<string> {
    return this.groqClient.executeWithFallback(async (model, client) => {
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
    });
  }

  async generateBusinessSummary(homepage: PageMetadata): Promise<string> {
    return this.groqClient.executeWithFallback(async (model, client) => {
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
              content: `Analyze this website homepage and create a technical summary.

Site Name: ${homepage.siteName || homepage.title}
URL: ${homepage.url}
Description: ${homepage.ogDescription || homepage.description || "N/A"}
H1: ${homepage.h1 || "N/A"}
Body Text: ${homepage.bodyText || "N/A"}

Create TWO parts separated by "|||":

FIRST PART (1-3 sentences, 40-60 words):
Write a technical summary mentioning specific technologies/frameworks if present in the body text.

SECOND PART:
If this is a technical tool/library/framework, write "Things to remember when using ${homepage.siteName || homepage.title}:" followed by 3-5 bullet points from the body text.
If it's just informational or no technical details, write: NONE

Do NOT write "PART 1" or "PART 2" as headings.

Example output:
"FastHTML is a Python library combining Starlette, Uvicorn, and HTMX for server-rendered applications|||Things to remember when using FastHTML:\n\n- Not compatible with FastAPI syntax\n- Includes Pico CSS support (optional)"

Your output:`,
            },
          ],
        })
        .withResponse()
        .then(({ data, response }) => {
          const text = data.choices[0]?.message?.content?.trim() || "";
          return { data: text, response };
        });
    });
  }
}
