import {
  PageMetadata,
  LlmsTxtOutput,
  LlmsTxtSection,
  ExternalLink,
  SectionGroup,
} from "@/lib/types";
import { normalizeUrlForOutput } from "@/lib/url/normalization";
import {
  IDescriptionGenerator,
  ISectionDiscoveryService,
  ITitleCleaningService,
} from "@/lib/ai-enhancement/types";

/**
 * Formatter Service
 * Transforms crawled pages into structured llms.txt format
 */
export class Formatter {
  constructor(
    private descriptionGenerator: IDescriptionGenerator,
    private sectionDiscovery: ISectionDiscoveryService,
    private titleCleaning: ITitleCleaningService
  ) {}

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
      await this.descriptionGenerator.generateBusinessSummary(homepage);

    // Parse summary response (format: "summary|||details" or just "summary")
    const { summary, details } = this.parseSummaryResponse(summaryResponse);

    // Generate descriptions for all pages (rate limiting handled by generator)
    const aiDescriptions = await this.generateDescriptions(pages);

    // Clean all page titles (removes redundant suffixes like "About - Site - Site")
    const allTitles = pages.map((p) => p.title);
    const cleanedTitles = await this.titleCleaning.cleanTitles(allTitles);
    const cleanedTitleMap = new Map<string, string>();
    pages.forEach((page, idx) => {
      cleanedTitleMap.set(page.url, cleanedTitles[idx]);
    });

    // Separate homepage from other pages
    const nonHomepagePages = pages.filter((p) => p !== homepage);

    // AI-powered section discovery: Let AI analyze titles/URLs to create logical groupings
    const sectionGroups =
      await this.sectionDiscovery.discoverSections(nonHomepagePages);

    // Collect all external links from crawled pages
    const externalLinks = this.collectExternalLinks(pages);

    // Build sections using AI-discovered groupings
    const sections = this.buildSectionsFromAI(
      nonHomepagePages,
      sectionGroups,
      homepage,
      aiDescriptions,
      cleanedTitleMap,
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
   * Generate descriptions for multiple pages
   * Processes sequentially to respect rate limits in the generator
   */
  private async generateDescriptions(
    pages: PageMetadata[]
  ): Promise<Map<string, string>> {
    const descriptions = new Map<string, string>();

    for (const page of pages) {
      const description =
        await this.descriptionGenerator.generateDescription(page);
      descriptions.set(page.url, description);
    }

    return descriptions;
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
   * Build sections using AI-discovered groupings
   */
  private buildSectionsFromAI(
    pages: PageMetadata[],
    sectionGroups: SectionGroup[],
    homepage: PageMetadata,
    aiDescriptions: Map<string, string>,
    cleanedTitleMap: Map<string, string>,
    externalLinks: ExternalLink[]
  ): LlmsTxtSection[] {
    const sections: LlmsTxtSection[] = [];

    // Add Overview section with homepage
    sections.push({
      title: "Overview",
      links: [
        {
          title: cleanedTitleMap.get(homepage.url) || homepage.title,
          url: normalizeUrlForOutput(homepage.url),
          description: aiDescriptions.get(homepage.url) || homepage.description,
        },
      ],
    });

    // Add AI-discovered sections
    for (const group of sectionGroups) {
      const groupPages = group.pageIndexes.map((idx: number) => pages[idx]);

      // Deduplicate and sort
      const normalized = new Map<string, PageMetadata>();
      for (const page of groupPages) {
        const normalizedUrl = normalizeUrlForOutput(page.url);
        if (!normalized.has(normalizedUrl)) {
          normalized.set(normalizedUrl, page);
        }
      }

      const deduplicatedPages = Array.from(normalized.values());
      const sortedPages = deduplicatedPages.sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.title.localeCompare(b.title);
      });

      if (sortedPages.length > 0) {
        sections.push({
          title: group.name,
          links: sortedPages.map((page) => ({
            title: cleanedTitleMap.get(page.url) || page.title,
            url: normalizeUrlForOutput(page.url),
            description: aiDescriptions.get(page.url) || page.description,
          })),
        });
      }
    }

    // Add external links section if any
    if (externalLinks.length > 0) {
      sections.push({
        title: "External Resources",
        links: externalLinks.slice(0, 10).map((link) => ({
          title: link.title || new URL(link.url).hostname,
          url: link.url,
          description: undefined,
        })),
      });
    }

    return sections;
  }

  /**
   * Build sections from classified pages and external links (legacy method)
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
        .slice(0, 15); // Increased limit for better coverage

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
   * Adaptive strategy:
   * - For technical sites (docs/API): Keep Overview, Documentation, API as main, rest as optional
   * - For general sites (YouTube): Keep top sections as main (About, Creators, Legal), rest as optional
   * - Always limit main sections to avoid overwhelming output
   */
  private separateOptionalContent(sections: LlmsTxtSection[]): {
    mainSections: LlmsTxtSection[];
    optionalSection?: LlmsTxtSection;
  } {
    // Detect site type by what sections exist
    const sectionTitles = sections.map((s) => s.title);
    const hasDocs = sectionTitles.includes("Documentation");
    const hasAPI = sectionTitles.includes("API Reference");
    const isTechnicalSite = hasDocs || hasAPI;

    // Define core sections based on site type
    let coreSections: string[];
    let maxLinksPerSection: number;

    if (isTechnicalSite) {
      // Technical site: prioritize docs/API
      coreSections = ["Overview", "Documentation", "API Reference", "Guides"];
      maxLinksPerSection = 5;
    } else {
      // General site: keep first few sections as main, rest as optional
      // This adapts to the site's actual structure (About, Creators, Legal, etc.)
      coreSections = sectionTitles.slice(0, 4); // Keep first 4 sections as main
      maxLinksPerSection = 10;
    }

    const mainSections: LlmsTxtSection[] = [];
    const optionalLinks: Array<{
      title: string;
      url: string;
      description?: string;
    }> = [];

    for (const section of sections) {
      if (coreSections.includes(section.title)) {
        // Keep as main section but limit links
        mainSections.push({
          title: section.title,
          links: section.links.slice(0, maxLinksPerSection),
        });

        // Overflow goes to Optional
        if (section.links.length > maxLinksPerSection) {
          optionalLinks.push(...section.links.slice(maxLinksPerSection));
        }
      } else {
        // Secondary sections go to Optional
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
