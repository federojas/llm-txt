import {
  PageMetadata,
  LlmsTxtOutput,
  LlmsTxtSection,
} from "@/lib/domain/models";
import { classifyUrl } from "../logic/url-classification";
import { IDescriptionService } from "../interfaces";

/**
 * Generator Service
 * Transforms crawled pages into structured llms.txt format
 */
export class GeneratorService {
  constructor(private descriptionService: IDescriptionService) {}

  /**
   * Generate llms.txt content from crawled pages
   */
  async generate(pages: PageMetadata[], projectName?: string): Promise<string> {
    const output = await this.buildStructure(pages, projectName);
    return this.format(output);
  }

  /**
   * Build structured llms.txt data
   */
  private async buildStructure(
    pages: PageMetadata[],
    projectName?: string
  ): Promise<LlmsTxtOutput> {
    if (pages.length === 0) {
      throw new Error("No pages to generate llms.txt from");
    }

    // Find homepage
    const homepage = this.findHomepage(pages);

    // Determine project name
    const name = this.determineProjectName(homepage, projectName);

    // Generate business summary for homepage
    const summary =
      await this.descriptionService.generateBusinessSummary(homepage);

    // Generate descriptions for all pages (rate limiting handled by generator)
    const aiDescriptions =
      await this.descriptionService.generateDescriptions(pages);

    // Classify and group pages
    const classified = this.classifyPages(pages);

    // Build sections with AI descriptions
    const sections = this.buildSections(classified, aiDescriptions);

    // Separate optional/secondary content
    const { mainSections, optionalSection } =
      this.separateOptionalContent(sections);

    return {
      projectName: name,
      summary,
      sections: mainSections,
      optionalSection,
    };
  }

  /**
   * Find homepage from crawled pages
   * Priority: root URL → depth 0 → first page
   */
  private findHomepage(pages: PageMetadata[]): PageMetadata {
    return (
      pages.find((p) => {
        try {
          const url = new URL(p.url);
          return url.pathname === "/" || url.pathname === "";
        } catch {
          return false;
        }
      }) ||
      pages.find((p) => p.depth === 0) ||
      pages[0]
    );
  }

  /**
   * Determine project name from homepage metadata
   * Priority: custom name → siteName → ogTitle → h1 → title → hostname
   */
  private determineProjectName(
    homepage: PageMetadata,
    projectName?: string
  ): string {
    return (
      projectName ||
      homepage.siteName ||
      homepage.ogTitle ||
      homepage.h1 ||
      homepage.title.split("|")[0].split("-")[0].trim() || // Extract before " | " or " - "
      new URL(homepage.url).hostname.replace(/^www\./, "")
    );
  }

  /**
   * Classify pages by type using hybrid classification
   * Passes metadata and sitemap data for best accuracy
   */
  private classifyPages(pages: PageMetadata[]): Map<string, PageMetadata[]> {
    const classified = new Map<string, PageMetadata[]>();

    for (const page of pages) {
      // Use hybrid classification: sitemap priority → metadata → URL patterns
      const sitemapData =
        page.sitemapPriority !== undefined
          ? { url: page.url, priority: page.sitemapPriority }
          : undefined;

      const type = classifyUrl(page.url, page, sitemapData);
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
  private buildSections(
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
        .slice(0, 10); // Reduced from 20 to 10 for more focused output

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
  private separateOptionalContent(sections: LlmsTxtSection[]): {
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
  private format(output: LlmsTxtOutput): string {
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
