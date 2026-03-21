import { IDescriptionGenerator } from "../types";
import { PageMetadata } from "@/lib/types";
import { GroqClient } from "./groq-client";

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
              role: "user",
              content: `Create a clear, actionable description for this webpage (max 20 words).

Title: ${page.title}
URL: ${page.url}
Meta Description: ${page.description || page.ogDescription || "N/A"}

Guidelines:
- Focus on what users can DO, LEARN, or FIND on this page
- Use active verbs: "Learn", "Explore", "Discover", "Find", "Access"
- Be specific and informative
- Start with the action verb

Good examples:
- "Learn about YouTube's brand resources and guidelines."
- "Explore copyright tools and protections for creators."
- "Find resources for advertisers and business partners."
- "Access YouTube's privacy settings and data controls."

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
              role: "user",
              content: `Analyze this website and create a technical summary for LLMs.

Site Name: ${homepage.siteName || homepage.title}
URL: ${homepage.url}
Description: ${homepage.ogDescription || homepage.description || "N/A"}
H1: ${homepage.h1 || "N/A"}
Body Text: ${homepage.bodyText || "N/A"}

Create TWO parts separated by "|||":

FIRST PART (one sentence, 40-60 words):
Write a technical summary mentioning specific technologies/frameworks from the body text above (e.g., "brings together Starlette, Uvicorn, HTMX"). If no tech details are in the body text, describe what the platform does generally.

SECOND PART:
If this is a technical tool/library/framework (not just informational), write "Things to remember when using ${homepage.siteName || homepage.title}:" followed by 3-5 bullet points extracted from the body text above. Use markdown bullets (- ).

If it's just an informational site or body text has no technical details, write only: NONE

IMPORTANT: Do NOT write "PART 1" or "PART 2" as headings. Just output the content directly.

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
