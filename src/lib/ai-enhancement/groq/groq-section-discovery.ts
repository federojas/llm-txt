import { ISectionDiscoveryService } from "../types";
import { PageMetadata, SectionGroup } from "@/lib/types";
import { GroqClient } from "./groq-client";

/**
 * Groq Section Discovery Service
 * Implements ONLY section clustering (Single Responsibility Principle)
 * Uses shared GroqClient for API calls and rate limiting
 */
export class GroqSectionDiscovery implements ISectionDiscoveryService {
  private groqClient: GroqClient;

  constructor(apiKey: string, requestsPerMinute: number = 30) {
    this.groqClient = new GroqClient(apiKey, requestsPerMinute);
  }

  isAvailable(): boolean {
    return this.groqClient.isAvailable();
  }

  async discoverSections(pages: PageMetadata[]): Promise<SectionGroup[]> {
    // Prepare page list for LLM (title + URL for context)
    const pageList = pages
      .map((page, idx) => `${idx}. [${page.title}](${page.url})`)
      .join("\n");

    return this.groqClient.executeWithFallback(async (model, client) => {
      return await client.chat.completions
        .create({
          model,
          max_tokens: 1500,
          temperature: 0.3, // Lower temperature for consistent grouping
          messages: [
            {
              role: "user",
              content: `Analyze these webpage titles and URLs, then group them into logical sections for a table of contents.

Pages:
${pageList}

Create 3-7 sections that group related content together. Use clear, concise section names (2-4 words).

Common patterns to look for:
- Documentation/Guides/Tutorials (technical content)
- About/Company/Mission (informational)
- Legal/Privacy/Terms (policies)
- Creators/Advertisers/Partners (business)
- Blog/News/Press (updates)
- API/Reference (technical resources)

Output as JSON only (no markdown, no explanation):
{
  "sections": [
    {"name": "Section Name", "pageIndexes": [0, 3, 5]},
    {"name": "Another Section", "pageIndexes": [1, 2, 4]}
  ]
}

CRITICAL: Output ONLY valid JSON. Every page index (0-${pages.length - 1}) must appear in exactly one section.`,
            },
          ],
        })
        .withResponse()
        .then(({ data, response }) => {
          const content = data.choices[0]?.message?.content?.trim() || "{}";

          // Parse JSON response
          try {
            // Strip markdown code blocks if present
            const jsonStr = content
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .trim();

            const parsed = JSON.parse(jsonStr);
            return { data: parsed.sections || [], response };
          } catch (error) {
            console.error("Failed to parse section grouping JSON:", error);
            console.error("Raw response:", content);
            // Return empty array as fallback
            return { data: [], response };
          }
        });
    });
  }
}
