import { ISectionDiscoveryService } from "../../core/types";
import { PageMetadata, SectionGroup } from "@/lib/types";
import { GroqClient } from "./groq-client";
import { getSectionDiscoveryPrompt } from "../../shared/llms-txt-context";
import { MetadataAccumulator } from "../../metadata-accumulator";

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

  async discoverSections(
    pages: PageMetadata[],
    metadataAccumulator?: MetadataAccumulator
  ): Promise<SectionGroup[]> {
    // Prepare page list for LLM (title + URL + description for better semantic grouping)
    const pageList = pages
      .map((page, idx) => {
        const desc = page.description ? ` - ${page.description}` : "";
        return `${idx}. [${page.title}](${page.url})${desc}`;
      })
      .join("\n");

    // Log what we're sending to AI
    console.log(`\n[AI Section Discovery] Analyzing ${pages.length} pages:`);
    pages.slice(0, 30).forEach((page, idx) => {
      console.log(`  ${idx}. ${page.title}`);
      console.log(`     ${page.url}`);
    });
    if (pages.length > 30) {
      console.log(`  ... and ${pages.length - 30} more pages`);
    }

    const { data, metadata } = await this.groqClient.executeWithFallback(
      async (model, client) => {
        return await client.chat.completions
          .create({
            model,
            max_tokens: 1500,
            temperature: 0.3, // Lower temperature for consistent grouping
            messages: [
              {
                role: "system",
                content: getSectionDiscoveryPrompt(),
              },
              {
                role: "user",
                content: `Analyze these pages and group them into logical sections.

Pages:
${pageList}

Create 3-7 sections with clear, technical names (2-4 words each).

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
      }
    );

    // Collect metadata if accumulator provided
    if (metadataAccumulator) {
      metadataAccumulator.addApiCall("section-discovery", metadata);
    }

    // Log what AI returned
    console.log(`\n[AI Section Discovery] AI created ${data.length} sections:`);
    data.forEach((section: SectionGroup) => {
      console.log(
        `  - "${section.name}" (${section.pageIndexes.length} pages): indexes ${section.pageIndexes.slice(0, 10).join(", ")}${section.pageIndexes.length > 10 ? "..." : ""}`
      );
      // Show which actual pages are in this section
      section.pageIndexes.slice(0, 5).forEach((idx: number) => {
        if (idx >= 0 && idx < pages.length) {
          const page = pages[idx];
          console.log(`      ${idx}. ${page.title}`);
        }
      });
      if (section.pageIndexes.length > 5) {
        console.log(
          `      ... and ${section.pageIndexes.length - 5} more pages`
        );
      }
    });

    return data;
  }
}
