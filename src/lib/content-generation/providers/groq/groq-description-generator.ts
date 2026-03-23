import { IDescriptionGenerator } from "../../core/types";
import { PageMetadata } from "@/lib/types";
import { GroqClient } from "./groq-client";
import {
  getDescriptionPrompt,
  getBusinessSummaryPrompt,
} from "../../shared/llms-txt-context";

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
              content: `Analyze this website homepage and create a SPECIFIC summary explaining what this site is.

Site Name: ${homepage.siteName || homepage.title}
URL: ${homepage.url}
Description: ${homepage.ogDescription || homepage.description || "N/A"}
H1: ${homepage.h1 || "N/A"}
Body Text: ${homepage.bodyText?.slice(0, 1500) || "N/A"}

CRITICAL: Be SPECIFIC about what this site/service is and does. Extract concrete details from body text:
- Core function/purpose (what does it do?)
- Platform type or category
- Key features, services, or offerings mentioned
- For technical sites: specific technologies/frameworks
- For services: main capabilities or products

Create TWO parts separated by "|||":

FIRST PART (1-2 sentences, 30-50 words):
Explain SPECIFICALLY what this site is and does. Extract concrete details from body text.

Good examples by domain:
- Developer tool: "A Python library combining Starlette, Uvicorn, and HTMX for server-rendered hypermedia applications"
- Video platform: "A video-sharing platform where users upload, view, rate, share, and comment on videos globally"
- Banking: "An online banking platform offering checking accounts, savings, loans, and mobile payment services"
- E-commerce: "An online marketplace for buying and selling handmade crafts, vintage items, and craft supplies"
- News: "A news website covering technology, business, and innovation with analysis and opinion pieces"

Bad examples: "A great platform", "Modern web applications", "The best service"

SECOND PART (choose format based on site type):

FOR TOOLS/APIS/LIBRARIES (technical products you USE):
Write "Things to remember when using ${homepage.siteName || homepage.title}:" followed by 3-5 bullet points from body text.

FOR PLATFORMS/SERVICES (websites users VISIT):
Write 2-3 paragraphs explaining:
1. What the platform does in detail (expand on the summary)
2. Key features or use cases
3. Context for LLMs: "For LLMs assisting users, [site name] represents..." - explain how LLMs should help users interact with this platform

FOR CONTENT SITES (news, blogs, info):
Write 1-2 paragraphs about the content focus, topics covered, and target audience.

IF no useful information in body text:
Write: NONE

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
