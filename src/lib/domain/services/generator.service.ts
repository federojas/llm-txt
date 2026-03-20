import {
  PageMetadata,
  LlmsTxtOutput,
  LlmsTxtSection,
  ExternalLink,
} from "@/lib/domain/models";
import { classifyUrl } from "../logic/url-classification";
import { normalizeUrlForOutput } from "../logic/url-normalization";
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
    const summaryResponse =
      await this.descriptionService.generateBusinessSummary(homepage);

    // Parse summary response (format: "summary|||details" or just "summary")
    const { summary, details } = this.parseSummaryResponse(summaryResponse);

    // Generate descriptions for all pages (rate limiting handled by generator)
    const aiDescriptions =
      await this.descriptionService.generateDescriptions(pages);

    // Classify and group pages
    const classified = this.classifyPages(pages);

    // Collect all external links from crawled pages
    const externalLinks = this.collectExternalLinks(pages);

    // Build sections with AI descriptions (includes both pages and external links)
    const sections = this.buildSections(
      classified,
      aiDescriptions,
      externalLinks
    );

    // Separate optional/secondary content
    const { mainSections, optionalSection } =
      this.separateOptionalContent(sections);

    return {
      projectName: name,
      summary,
      details,
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
   * Parse summary response from AI
   * Format: "summary|||details" or just "summary"
   * Details are optional (e.g., "Things to remember when using X:")
   */
  private parseSummaryResponse(response: string): {
    summary: string;
    details?: string;
  } {
    const parts = response.split("|||");

    if (parts.length === 1) {
      return { summary: parts[0].trim() };
    }

    const summary = parts[0].trim();
    const detailsPart = parts[1].trim();

    // If details section is "NONE", don't include it
    if (detailsPart === "NONE" || !detailsPart) {
      return { summary };
    }

    return {
      summary,
      details: detailsPart,
    };
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
   * Collect all external links from crawled pages
   * Aggregates valuable external resources (GitHub repos, docs, APIs)
   */
  private collectExternalLinks(pages: PageMetadata[]): ExternalLink[] {
    const allLinks: ExternalLink[] = [];
    const seen = new Set<string>();

    for (const page of pages) {
      if (!page.externalLinks) continue;

      for (const link of page.externalLinks) {
        if (!seen.has(link.url)) {
          seen.add(link.url);
          allLinks.push(link);
        }
      }
    }

    return allLinks;
  }

  /**
   * Build sections from classified pages and external links
   */
  private buildSections(
    classified: Map<string, PageMetadata[]>,
    aiDescriptions: Map<string, string>,
    externalLinks: ExternalLink[]
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

      // Deduplicate by normalized URL (strips all query params for output)
      // Note: All URLs are already https:// from crawling (forceHttps: true)
      const normalized = new Map<string, PageMetadata>();

      for (const page of pages) {
        const normalizedUrl = normalizeUrlForOutput(page.url);

        if (!normalized.has(normalizedUrl)) {
          normalized.set(normalizedUrl, page);
        }
      }

      const deduplicatedPages = Array.from(normalized.values());

      // Sort by depth (shallower = more important) and title
      const sortedPages = deduplicatedPages
        .sort((a, b) => {
          if (a.depth !== b.depth) return a.depth - b.depth;
          return a.title.localeCompare(b.title);
        })
        .slice(0, 10); // Limit to 10 for focused output

      if (sortedPages.length > 0) {
        sections.push({
          title,
          links: sortedPages.map((page) => ({
            title: page.title,
            url: normalizeUrlForOutput(page.url), // Use normalized URL in output
            description: aiDescriptions.get(page.url) || page.description,
          })),
        });
      }
    }

    // Add external links section if any valuable external resources found
    if (externalLinks.length > 0) {
      sections.push({
        title: "External Resources",
        links: externalLinks.slice(0, 10).map((link) => ({
          title: link.title || new URL(link.url).hostname,
          url: link.url,
          description: undefined, // External links don't have descriptions yet
        })),
      });
    }

    return sections;
  }

  /**
   * Separate optional content from main sections
   * Per llms.txt spec: Optional section contains secondary info that can be skipped
   *
   * Strategy: Keep main sections focused (Overview, core Docs, API, Examples)
   * Move everything else to Optional (tutorials, guides, FAQ, extra docs, blog)
   */
  private separateOptionalContent(sections: LlmsTxtSection[]): {
    mainSections: LlmsTxtSection[];
    optionalSection?: LlmsTxtSection;
  } {
    // Core sections that stay in main area (limit to 3-5 links each)
    const coreSections = ["Overview", "Documentation", "API Reference"];

    // Everything else goes to Optional
    const mainSections: LlmsTxtSection[] = [];
    const optionalLinks: Array<{
      title: string;
      url: string;
      description?: string;
    }> = [];

    for (const section of sections) {
      if (coreSections.includes(section.title)) {
        // Keep core sections but limit links (top 5 most important)
        mainSections.push({
          title: section.title,
          links: section.links.slice(0, 5),
        });

        // Overflow goes to Optional
        if (section.links.length > 5) {
          optionalLinks.push(...section.links.slice(5));
        }
      } else {
        // Everything else (About, Guides, Tutorials, Blog, External, etc.) goes to Optional
        optionalLinks.push(...section.links);
      }
    }

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

    // Details section (optional, e.g., "Things to remember...")
    if (output.details) {
      lines.push(output.details);
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
