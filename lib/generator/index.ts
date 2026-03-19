import { PageMetadata, LlmsTxtOutput, LlmsTxtSection } from "@/types";
import { classifyUrl } from "../utils/url";

/**
 * Generate llms.txt content from crawled pages
 */
export function generateLlmsTxt(
  pages: PageMetadata[],
  projectName?: string
): string {
  const output = buildLlmsTxtStructure(pages, projectName);
  return formatLlmsTxt(output);
}

/**
 * Build structured llms.txt data
 */
function buildLlmsTxtStructure(
  pages: PageMetadata[],
  projectName?: string
): LlmsTxtOutput {
  if (pages.length === 0) {
    throw new Error("No pages to generate llms.txt from");
  }

  // Find homepage
  const homepage = pages.find((p) => p.depth === 0) || pages[0];

  // Determine project name
  const name =
    projectName ||
    homepage.ogTitle ||
    homepage.h1 ||
    homepage.title ||
    new URL(homepage.url).hostname;

  // Use homepage description as summary
  const summary = homepage.ogDescription || homepage.description;

  // Classify and group pages
  const classified = classifyPages(pages);

  // Build sections
  const sections = buildSections(classified);

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
 * Classify pages by type
 */
function classifyPages(pages: PageMetadata[]): Map<string, PageMetadata[]> {
  const classified = new Map<string, PageMetadata[]>();

  for (const page of pages) {
    const type = classifyUrl(page.url);
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
  classified: Map<string, PageMetadata[]>
): LlmsTxtSection[] {
  const sections: LlmsTxtSection[] = [];

  // Priority order for sections
  const sectionOrder = [
    { key: "homepage", title: "Overview" },
    { key: "documentation", title: "Documentation" },
    { key: "guides", title: "Guides" },
    { key: "tutorials", title: "Tutorials" },
    { key: "api", title: "API Reference" },
    { key: "blog", title: "Blog" },
    { key: "about", title: "About" },
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
        description: page.description,
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
  const lowPrioritySections = ["Blog", "About", "Additional Resources"];

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
