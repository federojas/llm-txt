import { ITitleCleaningService } from "../types";
import { GroqClient } from "./groq-client";

/**
 * Groq Title Cleaner Service
 * Implements ONLY title cleaning (Single Responsibility Principle)
 * Uses shared GroqClient for API calls and rate limiting
 */
export class GroqTitleCleaner implements ITitleCleaningService {
  private groqClient: GroqClient;

  constructor(apiKey: string, requestsPerMinute: number = 30) {
    this.groqClient = new GroqClient(apiKey, requestsPerMinute);
  }

  isAvailable(): boolean {
    return this.groqClient.isAvailable();
  }

  async cleanTitles(titles: string[]): Promise<string[]> {
    // Skip cleaning if no titles or only one title
    if (titles.length === 0) return titles;
    if (titles.length === 1) return titles;

    // Create numbered list of titles for LLM
    const titleList = titles.map((title, idx) => `${idx}. ${title}`).join("\n");

    return this.groqClient.executeWithFallback(async (model, client) => {
      return await client.chat.completions
        .create({
          model,
          max_tokens: 800,
          temperature: 0.2, // Low temperature for consistent cleaning
          messages: [
            {
              role: "user",
              content: `Clean these page titles by removing redundant suffixes, site names, and separators.

Titles:
${titleList}

Rules:
1. Remove duplicate words/phrases (e.g., "About - FastHTML - FastHTML" → "About")
2. Remove site name suffixes (e.g., "Documentation - MySite" → "Documentation")
3. Keep the most meaningful part (usually the first segment)
4. If only site name remains, keep it (e.g., "YouTube - YouTube" → "YouTube")
5. Preserve special characters and capitalization

Output as JSON only (no markdown, no explanation):
{
  "titles": ["Cleaned Title 1", "Cleaned Title 2", ...]
}

CRITICAL: Return ${titles.length} cleaned titles in the same order. Output ONLY valid JSON.`,
            },
          ],
        })
        .withResponse()
        .then(({ data, response }) => {
          const content = data.choices[0]?.message?.content?.trim() || "{}";

          try {
            // Strip markdown code blocks if present
            const jsonStr = content
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .trim();

            const parsed = JSON.parse(jsonStr);
            const cleanedTitles = parsed.titles || [];

            // Validate: must return same number of titles
            if (cleanedTitles.length !== titles.length) {
              console.warn(
                `Title cleaning returned ${cleanedTitles.length} titles, expected ${titles.length}. Using originals.`
              );
              return { data: titles, response };
            }

            return { data: cleanedTitles, response };
          } catch (error) {
            console.error("Failed to parse title cleaning JSON:", error);
            console.error("Raw response:", content);
            return { data: titles, response };
          }
        });
    });
  }
}
