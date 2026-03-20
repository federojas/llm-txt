import { PageMetadata, LlmsTxtOutput, LlmsTxtSection } from "@/types";
import { classifyUrl } from "../logic/url-classification";
import { IDescriptionService } from "../interfaces";
import { DescriptionService } from "../services/description.service";
import { DescriptionGeneratorFactory } from "@/lib/infrastructure/adapters/description-generators";

/**
 * Generate llms.txt content from crawled pages
 */
export async function generateLlmsTxt(
  pages: PageMetadata[],
  projectName?: string,
  descriptionService?: IDescriptionService
): Promise<string> {
  const output = await buildLlmsTxtStructure(
    pages,
    projectName,
    descriptionService
  );
  return formatLlmsTxt(output);
}

/**
 * Build structured llms.txt data
 */
async function buildLlmsTxtStructure(
  pages: PageMetadata[],
  projectName?: string,
  descriptionService?: IDescriptionService
): Promise<LlmsTxtOutput> {
  if (pages.length === 0) {
    throw new Error("No pages to generate llms.txt from");
  }

  // Find homepage (must be the root URL, not just depth 0)
  const homepage =
    pages.find((p) => {
      try {
        const url = new URL(p.url);
        return url.pathname === "/" || url.pathname === "";
      } catch {
        return false;
      }
    }) ||
    pages.find((p) => p.depth === 0) ||
    pages[0];

  // Determine project name (prefer siteName for clean titles like "YouTube" not "YouTube Masthead Preview")
  const name =
    projectName ||
    homepage.siteName ||
    homepage.ogTitle ||
    homepage.h1 ||
    homepage.title.split("|")[0].split("-")[0].trim() || // Extract before " | " or " - "
    new URL(homepage.url).hostname.replace(/^www\./, "");

  // Initialize description service if not provided (dependency injection with default)
  const service =
    descriptionService ||
    (() => {
      const primaryGenerator =
        DescriptionGeneratorFactory.createPrimaryGenerator();
      const fallbackGenerator =
        DescriptionGeneratorFactory.createFallbackGenerator();
      return new DescriptionService(
        primaryGenerator || fallbackGenerator,
        fallbackGenerator
      );
    })();

  // Generate business summary for homepage
  const summary = await service.generateBusinessSummary(homepage);

  // Generate descriptions for all pages (rate limiting handled by generator)
  const aiDescriptions = await service.generateDescriptions(pages);

  // Classify and group pages
  const classified = classifyPages(pages);

  // Build sections with AI descriptions
  const sections = buildSections(classified, aiDescriptions);

  // Separate optional/secondary content
  const { mainSections, optionalSection } = separateOptionalContent(sections);

  return {
    projectName: name,
    summary,
    sections: mainSections,
    optionalSection,
  };
}

/**
 * Classify pages by type using hybrid classification
 * Passes metadata to enable content-based classification
 */
function classifyPages(pages: PageMetadata[]): Map<string, PageMetadata[]> {
  const classified = new Map<string, PageMetadata[]>();

  for (const page of pages) {
    // Use hybrid classification: metadata + URL patterns
    // TODO: Pass sitemap data when available for even better classification
    const type = classifyUrl(page.url, page);
    if (!classified.has(type)) {
      classified.set(type, []);
    }
    classified.get(type)!.push(page);
  }

  return classified;
}

/**
 * Build sections from classified pages
 */
function buildSections(
  classified: Map<string, PageMetadata[]>,
  aiDescriptions: Map<string, string>
): LlmsTxtSection[] {
  const sections: LlmsTxtSection[] = [];

  // Priority order for sections
  const sectionOrder = [
    { key: "homepage", title: "Overview" },
    { key: "documentation", title: "Documentation" },
    { key: "guides", title: "Guides" },
    { key: "tutorials", title: "Tutorials" },
    { key: "api", title: "API Reference" },
    { key: "about", title: "About" },
    { key: "creators", title: "Creators & Advertisers" },
    { key: "legal", title: "Legal & Policies" },
    { key: "blog", title: "Blog" },
    { key: "other", title: "Additional Resources" },
  ];

  for (const { key, title } of sectionOrder) {
    const pages = classified.get(key);
    if (!pages || pages.length === 0) continue;

    // Sort by depth (shallower = more important) and title
    const sortedPages = pages
      .sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 20); // Limit per section

    sections.push({
      title,
      links: sortedPages.map((page) => ({
        title: page.title,
        url: page.url,
        description: aiDescriptions.get(page.url) || page.description,
      })),
    });
  }

  return sections;
}

/**
 * Separate optional content from main sections
 */
function separateOptionalContent(sections: LlmsTxtSection[]): {
  mainSections: LlmsTxtSection[];
  optionalSection?: LlmsTxtSection;
} {
  const lowPrioritySections = ["Blog", "Additional Resources"];

  const mainSections = sections.filter(
    (s) => !lowPrioritySections.includes(s.title)
  );

  const optionalLinks = sections
    .filter((s) => lowPrioritySections.includes(s.title))
    .flatMap((s) => s.links);

  const optionalSection =
    optionalLinks.length > 0
      ? {
          title: "Optional",
          links: optionalLinks,
        }
      : undefined;

  return { mainSections, optionalSection };
}

/**
 * Format llms.txt output
 */
function formatLlmsTxt(output: LlmsTxtOutput): string {
  const lines: string[] = [];

  // H1 - Project name (required)
  lines.push(`# ${output.projectName}`);
  lines.push("");

  // Blockquote - Summary (optional)
  if (output.summary) {
    lines.push(`> ${output.summary}`);
    lines.push("");
  }

  // Main sections
  for (const section of output.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");

    for (const link of section.links) {
      if (link.description) {
        lines.push(`- [${link.title}](${link.url}): ${link.description}`);
      } else {
        lines.push(`- [${link.title}](${link.url})`);
      }
    }

    lines.push("");
  }

  // Optional section
  if (output.optionalSection) {
    lines.push("## Optional");
    lines.push("");

    for (const link of output.optionalSection.links) {
      if (link.description) {
        lines.push(`- [${link.title}](${link.url}): ${link.description}`);
      } else {
        lines.push(`- [${link.title}](${link.url})`);
      }
    }

    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

/**
 * Validate llms.txt format
 */
export function validateLlmsTxt(content: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const lines = content.split("\n");

  // Check for H1 (required)
  if (!lines.some((line) => line.startsWith("# "))) {
    errors.push("Missing required H1 heading (project name)");
  }

  // Check for multiple H1s
  const h1Count = lines.filter((line) => line.startsWith("# ")).length;
  if (h1Count > 1) {
    errors.push("Multiple H1 headings found (only one allowed)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
