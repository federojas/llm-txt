import Groq from "groq-sdk";
import { IDescriptionGenerator } from "@/lib/domain/interfaces/description-generator.interface";
import { PageMetadata } from "@/types";
import { RateLimiter } from "../../utilities/rate-limiter";

/**
 * Groq description generator
 * Adapts Groq API (Llama 3.3 70B) to IDescriptionGenerator interface
 */
export class GroqDescriptionGenerator implements IDescriptionGenerator {
  private client: Groq;
  private rateLimiter: RateLimiter;
  private readonly model = "llama-3.3-70b-versatile";

  constructor(apiKey: string, requestsPerMinute: number = 30) {
    this.client = new Groq({ apiKey });
    this.rateLimiter = new RateLimiter(requestsPerMinute);
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async generateDescription(page: PageMetadata): Promise<string> {
    await this.rateLimiter.waitForToken();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `Summarize what users can do or learn on this webpage in ONE concise sentence (max 15 words).

Title: ${page.title}
URL: ${page.url}
Meta Description: ${page.description || page.ogDescription || "N/A"}

Output only the summary sentence, no preamble.`,
          },
        ],
      });

      const text = response.choices[0]?.message?.content?.trim() || "";
      // Remove quotes if AI added them
      return text.replace(/^["']|["']$/g, "");
    } catch (error) {
      console.error("Groq API error:", error);
      throw new Error(`Failed to generate description: ${error}`);
    }
  }

  async generateBusinessSummary(homepage: PageMetadata): Promise<string> {
    await this.rateLimiter.waitForToken();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: `Write a 2-3 sentence business summary explaining what this website does, who it serves, and its primary purpose.

Site Name: ${homepage.siteName || homepage.title}
URL: ${homepage.url}
Description: ${homepage.ogDescription || homepage.description || "N/A"}
H1: ${homepage.h1 || "N/A"}

Focus on:
- What the service/platform does
- Who the primary users/audience are
- Key value proposition

Output only the summary, no preamble.`,
          },
        ],
      });

      return response.choices[0]?.message?.content?.trim() || "";
    } catch (error) {
      console.error("Groq API error:", error);
      throw new Error(`Failed to generate business summary: ${error}`);
    }
  }
}
