import {
  PageMetadata,
  LlmsTxtOutput,
  LlmsTxtSection,
  ExternalLink,
  SectionGroup,
} from "@/lib/types";
import { normalizeUrl } from "@/lib/url/normalization";
import {
  IDescriptionGenerator,
  ISectionDiscoveryService,
  ITitleCleaningService,
} from "@/lib/content-generation/core/types";
import type { SitemapUrl } from "@/lib/http/sitemap";
import type { RobotsDirectives } from "@/lib/http/robots";
import { scoreAndFilterPages } from "@/lib/crawling/link-scoring";
import { createQualityGateFilter } from "./quality-gates";
import type { TitleCleanup } from "@/lib/api/dtos/llms-txt";
import { validateLlmsTxtFormat } from "./spec";
import { getLogger } from "@/lib/logger";
import { MetadataAccumulator } from "@/lib/content-generation/metadata-accumulator";

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
   * @param pages - Crawled page metadata
   * @param projectName - Optional project name override
   * @param sitemapData - Optional sitemap metadata for link scoring
   * @param robotsDirectives - Optional robots.txt directives for filtering
   * @param projectDescription - Optional project description override
   * @param titleCleanup - Optional title cleanup rules (removePatterns, replacements)
   */
  async generate(
    pages: PageMetadata[],
    projectName?: string,
    sitemapData?: Map<string, SitemapUrl>,
    robotsDirectives?: RobotsDirectives,
    projectDescription?: string,
    titleCleanup?: TitleCleanup,
    generationMode: "ai" | "metadata" = "metadata",
    metadataAccumulator?: MetadataAccumulator
  ): Promise<{
    content: string;
    validation: {
      valid: boolean;
      errors: string[];
      warnings: string[];
      sectionsCount: number;
      linkCount: number;
      lineCount: number;
    };
  }> {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`[Output Generation] Starting with ${pages.length} pages`);
    console.log(`${"=".repeat(70)}`);

    const structureStart = Date.now();
    const output = await this.buildStructure(
      pages,
      projectName,
      sitemapData,
      robotsDirectives,
      projectDescription,
      titleCleanup,
      generationMode,
      metadataAccumulator
    );
    const structureDuration = Date.now() - structureStart;
    console.log(`[Timing] Structure building: ${structureDuration}ms`);

    const formatStart = Date.now();
    const result = this.format(output);
    const formatDuration = Date.now() - formatStart;
    console.log(
      `[Timing] Final formatting: ${formatDuration}ms (${result.validation.lineCount} lines, ${result.content.length} chars)`
    );

    console.log(`\n${"=".repeat(70)}`);
    console.log(`[Output Generation] Complete`);
    console.log(`  Sections: ${result.validation.sectionsCount}`);
    console.log(`  Links: ${result.validation.linkCount}`);
    console.log(`  Content length: ${result.content.length} chars`);
    console.log(`${"=".repeat(70)}\n`);

    return result;
  }

  /**
   * Build structured llms.txt data
   */
  private async buildStructure(
    pages: PageMetadata[],
    projectName?: string,
    sitemapData?: Map<string, SitemapUrl>,
    robotsDirectives?: RobotsDirectives,
    projectDescription?: string,
    titleCleanup?: TitleCleanup,
    generationMode: "ai" | "metadata" = "metadata",
    metadataAccumulator?: MetadataAccumulator
  ): Promise<LlmsTxtOutput> {
    if (pages.length === 0) {
      throw new Error("No pages to generate llms.txt from");
    }

    // Find homepage
    const homepage = this.findHomepage(pages);

    // Determine project name
    const name = this.determineProjectName(homepage, projectName);

    // Score and filter pages by relevance (if sitemap data available)
    const scoringStart = Date.now();
    let filteredPages = pages;
    if (sitemapData) {
      const scoredPages = await scoreAndFilterPages(pages, {
        sitemapData,
        robotsDirectives,
        minScoreThreshold: 30, // Allow pages passing robots.txt even if not in sitemap
      });

      // Extract pages and update their relevanceScore field
      filteredPages = scoredPages.map(({ page, score }) => ({
        ...page,
        relevanceScore: score.totalScore,
      }));

      const scoringDuration = Date.now() - scoringStart;
      console.log(
        `[Link Scoring] Filtered ${pages.length} pages → ${filteredPages.length} (threshold: 30) in ${scoringDuration}ms`
      );

      // Log filtered OUT pages for debugging
      const filtered = pages.filter(
        (p) => !filteredPages.find((fp) => fp.url === p.url)
      );
      if (filtered.length > 0) {
        console.log(
          `[Link Scoring] Removed ${filtered.length} low-score pages:`
        );
        filtered.slice(0, 10).forEach((p) => {
          console.log(`  - ${p.title} (${p.url})`);
        });
      }

      // Log what we're KEEPING for debugging
      console.log(`[Link Scoring] Keeping ${filteredPages.length} pages:`);
      filteredPages.slice(0, 20).forEach((p) => {
        console.log(
          `  - [depth=${p.depth}, score=${p.relevanceScore}] ${p.title} (${p.url})`
        );
      });
    } else {
      console.log(
        `[Link Scoring] Skipped - no sitemap data (using all ${pages.length} pages)`
      );
    }

    // Generate business summary for homepage (or use provided override)
    let summary: string;
    let details: string | undefined;

    if (projectDescription) {
      // Use provided description (skip AI call)
      summary = projectDescription;
      details = undefined;
      console.log("[Manual Override] Using provided project description");
    } else {
      // Generate via AI
      const summaryStart = Date.now();
      const summaryResponse =
        await this.descriptionGenerator.generateBusinessSummary(
          homepage,
          metadataAccumulator
        );
      const summaryDuration = Date.now() - summaryStart;
      console.log(`[Timing] Business summary generation: ${summaryDuration}ms`);

      const parsed = this.parseSummaryResponse(summaryResponse);
      summary = parsed.summary;
      details = parsed.details;
    }

    // Generate descriptions for filtered pages only (saves API calls)
    const descriptionsStart = Date.now();
    const aiDescriptions = await this.generateDescriptions(
      filteredPages,
      metadataAccumulator
    );
    const descriptionsDuration = Date.now() - descriptionsStart;
    console.log(
      `[Timing] Page descriptions generation: ${descriptionsDuration}ms (${filteredPages.length} pages, ${(descriptionsDuration / filteredPages.length).toFixed(0)}ms/page avg)`
    );

    // Apply manual title cleanup first (inspired by llmstxt --replace-title)
    const titleCleanupStart = Date.now();
    let allTitles = filteredPages.map((p) => p.title);
    if (titleCleanup) {
      allTitles = this.applyTitleCleanup(allTitles, titleCleanup);
    }

    // Then clean with pattern-based cleaning (removes redundant suffixes, extracts from URLs for duplicates)
    const allUrls = filteredPages.map((p) => p.url);
    const cleanedTitles = await this.titleCleaning.cleanTitles(
      allTitles,
      allUrls
    );
    const cleanedTitleMap = new Map<string, string>();
    filteredPages.forEach((page, idx) => {
      cleanedTitleMap.set(page.url, cleanedTitles[idx]);
    });
    const titleCleanupDuration = Date.now() - titleCleanupStart;
    console.log(
      `[Timing] Title cleanup: ${titleCleanupDuration}ms (${filteredPages.length} titles)`
    );

    // Separate homepage from other pages
    const nonHomepagePages = filteredPages.filter((p) => p !== homepage);

    // Collect all external links from crawled pages
    const externalLinks = this.collectExternalLinks(filteredPages);

    // Section discovery: Always use AI semantic clustering
    // BOTH modes use AI for section organization (1 API call, high quality)
    // The difference between modes is ONLY in page descriptions:
    // - Metadata mode: HTML meta tags for descriptions (0 API calls per page)
    // - AI mode: AI for descriptions (~50 API calls)
    console.log(
      `[Section Discovery] Using AI-powered semantic clustering (${generationMode} mode)`
    );
    const sectionStart = Date.now();
    const sectionGroups = await this.sectionDiscovery.discoverSections(
      nonHomepagePages,
      metadataAccumulator
    );
    const sectionDuration = Date.now() - sectionStart;
    console.log(
      `[Timing] Section discovery: ${sectionDuration}ms (${nonHomepagePages.length} pages)`
    );
    console.log(
      `[Section Discovery] Found ${sectionGroups.length} groups:`,
      sectionGroups
        .map((g) => `"${g.name}" (${g.pageIndexes.length} pages)`)
        .join(", ")
    );

    const buildSectionsStart = Date.now();
    const sections = this.buildSectionsFromAI(
      nonHomepagePages,
      sectionGroups,
      homepage,
      aiDescriptions,
      cleanedTitleMap,
      externalLinks
    );
    const buildSectionsDuration = Date.now() - buildSectionsStart;
    console.log(
      `[Timing] Section building: ${buildSectionsDuration}ms (${sections.length} sections created)`
    );

    // Log detailed section breakdown
    console.log(`\n[Section Breakdown] ${sections.length} sections created:`);
    sections.forEach((section) => {
      console.log(`\n  ## ${section.title} (${section.links.length} links)`);
      section.links.slice(0, 10).forEach((link) => {
        console.log(`    - ${link.title}`);
        console.log(`      ${link.url}`);
      });
      if (section.links.length > 10) {
        console.log(`    ... and ${section.links.length - 10} more links`);
      }
    });

    // Separate optional/secondary content
    const qualityGatesStart = Date.now();
    const { mainSections, optionalSection } =
      this.separateOptionalContent(sections);
    const qualityGatesDuration = Date.now() - qualityGatesStart;
    console.log(
      `[Timing] Quality gates: ${qualityGatesDuration}ms (${mainSections.length} main, ${optionalSection?.links.length ?? 0} optional)`
    );

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
    pages: PageMetadata[],
    metadataAccumulator?: MetadataAccumulator
  ): Promise<Map<string, string>> {
    const descriptions = new Map<string, string>();

    for (const page of pages) {
      const description = await this.descriptionGenerator.generateDescription(
        page,
        metadataAccumulator
      );
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
   * Priority: custom name → ogTitle → siteName → h1 → title → hostname
   *
   * ogTitle is prioritized because it's specifically set for social sharing
   * and typically contains the clean brand name (e.g., "FastHTML" not "fastht.ml")
   */
  private determineProjectName(
    homepage: PageMetadata,
    projectName?: string
  ): string {
    return (
      projectName ||
      homepage.ogTitle || // Prioritize og:title (clean brand name)
      homepage.siteName ||
      homepage.h1 ||
      homepage.title.split("|")[0].split("-")[0].trim() || // Extract before " | " or " - "
      new URL(homepage.url).hostname.replace(/^www\./, "")
    );
  }

  /**
   * Apply manual title cleanup patterns
   * Inspired by llmstxt's --replace-title flag
   *
   * @param titles - Array of titles to clean
   * @param cleanup - Cleanup rules (removePatterns, replacements)
   * @returns Cleaned titles
   *
   * Example:
   * removePatterns: ["\\| SiteName$", "- SiteName$"]
   * "About | SiteName" → "About"
   */
  private applyTitleCleanup(titles: string[], cleanup: TitleCleanup): string[] {
    return titles.map((title) => {
      let cleaned = title;

      // Apply removal patterns (e.g., remove "| SiteName" suffix)
      if (cleanup.removePatterns) {
        for (const pattern of cleanup.removePatterns) {
          try {
            const regex = new RegExp(pattern, "g");
            cleaned = cleaned.replace(regex, "");
          } catch (error) {
            console.warn(
              `[Title Cleanup] Invalid regex pattern: ${pattern}`,
              error
            );
          }
        }
      }

      // Apply replacements (e.g., "Docs" → "Documentation")
      if (cleanup.replacements) {
        for (const { pattern, replacement } of cleanup.replacements) {
          try {
            const regex = new RegExp(pattern, "g");
            cleaned = cleaned.replace(regex, replacement);
          } catch (error) {
            console.warn(
              `[Title Cleanup] Invalid regex pattern: ${pattern}`,
              error
            );
          }
        }
      }

      return cleaned.trim();
    });
  }

  /**
   * Parse summary response from AI
   * Format: "summary|||details" or just "summary"
   * Details are optional (e.g., "Things to remember when using X:")
   *
   * AI sometimes includes labels like "FIRST PART:" or "SECOND PART:" which we strip.
   */
  private parseSummaryResponse(response: string): {
    summary: string;
    details?: string;
  } {
    const parts = response.split("|||");

    // Clean first part (summary)
    let summary = parts[0].trim();
    // Strip "FIRST PART:" or "PART 1" labels if present
    summary = summary.replace(/^(FIRST )?PART ?\d?:\s*/i, "");
    // Strip leading blockquote marker if AI included it
    summary = summary.replace(/^>\s*/, "");

    if (parts.length === 1) {
      return { summary };
    }

    // Clean second part (details)
    let detailsPart = parts[1].trim();
    // Strip "SECOND PART:" or "PART 2" labels if present
    detailsPart = detailsPart.replace(/^(SECOND )?PART ?\d?:?\s*/i, "");

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
          url: normalizeUrl(homepage.url),
          description: aiDescriptions.get(homepage.url) || homepage.description,
        },
      ],
    });

    // Add AI-discovered sections
    for (const group of sectionGroups) {
      // Filter out invalid page indexes (defensive against AI errors)
      const validIndexes = group.pageIndexes.filter(
        (idx: number) => idx >= 0 && idx < pages.length
      );

      if (validIndexes.length === 0) {
        console.warn(
          `[Section Discovery] Skipping section "${group.name}" - no valid page indexes`
        );
        continue;
      }

      const groupPages = validIndexes.map((idx: number) => pages[idx]);

      // Deduplicate and sort
      const normalized = new Map<string, PageMetadata>();
      for (const page of groupPages) {
        if (!page) continue; // Extra safety check
        const normalizedUrl = normalizeUrl(page.url);
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
            url: normalizeUrl(page.url),
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
   * Separate optional content from main sections
   * Per llms.txt spec: Optional section contains secondary info that can be skipped
   *
   * Strategy: Trust AI semantic clustering
   * - AI already determines what's most relevant when creating sections
   * - Keep all AI-discovered sections as main sections
   * - Only limit links per section (overflow goes to Optional)
   * - Apply quality gates to remove duplicates and merge similar sections
   */
  private separateOptionalContent(sections: LlmsTxtSection[]): {
    mainSections: LlmsTxtSection[];
    optionalSection?: LlmsTxtSection;
  } {
    console.log(
      `[Main/Optional Split] Input sections: ${sections.map((s) => `"${s.title}" (${s.links.length} links)`).join(", ")}`
    );

    // Keep all sections as main sections
    // Trust AI to decide what's important - only limit to prevent extremely long sections
    const maxLinksPerSection = 50;

    const mainSections: LlmsTxtSection[] = [];
    const optionalLinks: Array<{
      title: string;
      url: string;
      description?: string;
    }> = [];

    for (const section of sections) {
      // Keep all sections, but limit links per section
      mainSections.push({
        title: section.title,
        links: section.links.slice(0, maxLinksPerSection),
      });

      // Overflow goes to Optional
      if (section.links.length > maxLinksPerSection) {
        optionalLinks.push(...section.links.slice(maxLinksPerSection));
      }
    }

    const optionalSection =
      optionalLinks.length > 0
        ? {
            title: "Optional",
            links: optionalLinks,
          }
        : undefined;

    // Apply quality gates to remove duplicates and limit sizes
    const qualityGate = createQualityGateFilter({
      maxOptionalItems: 20, // Real-world sites (e.g., FastHTML) have 15+ optional items
      allowDuplicatesInOptional: false,
      mergeSimilarSections: true, // Merge related sections (e.g., /about + /howyoutubeworks)
      maxLinksPerSection: 10, // Limit links per section after merging
    });

    const filtered = qualityGate.apply(mainSections, optionalSection);

    console.log(
      `[Quality Gates] Main sections: ${filtered.mainSections.length}, ` +
        `Optional items: ${filtered.optionalSection?.links.length ?? 0}`
    );

    return filtered;
  }

  /**
   * Format llms.txt output and return with validation data
   */
  private format(output: LlmsTxtOutput): {
    content: string;
    validation: {
      valid: boolean;
      errors: string[];
      warnings: string[];
      sectionsCount: number;
      linkCount: number;
      lineCount: number;
    };
  } {
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

    const content = lines.join("\n").trim() + "\n";

    // Validate output against canonical spec and return validation data
    const validation = this.validateOutput(content);

    return {
      content,
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        sectionsCount: validation.stats.sectionCount,
        linkCount: validation.stats.linkCount,
        lineCount: validation.stats.lineCount,
      },
    };
  }

  /**
   * Validate generated output against canonical spec
   * Non-blocking: logs warnings but doesn't throw
   * Provides observability for format regressions
   * Returns validation results for storage in database
   */
  private validateOutput(content: string) {
    const logger = getLogger();
    const validation = validateLlmsTxtFormat(content);

    if (!validation.valid) {
      // Log errors for monitoring, but don't block generation
      logger.warn("Generated llms.txt has format issues", {
        event: "llms_txt.validation.failed",
        errors: validation.errors,
        warnings: validation.warnings,
        stats: validation.stats,
      });
      console.warn("[Format Validation] Issues detected:", validation.errors);
    } else if (validation.warnings.length > 0) {
      // Log quality warnings (not fatal, just informational)
      logger.info("Generated llms.txt has quality warnings", {
        event: "llms_txt.validation.warnings",
        warnings: validation.warnings,
        stats: validation.stats,
      });
      console.log("[Format Validation] Warnings:", validation.warnings);
    } else {
      // Success: log stats for monitoring
      logger.info("Generated llms.txt passed validation", {
        event: "llms_txt.validation.success",
        stats: validation.stats,
      });
    }

    return validation;
  }
}

/**
 * Validate llms.txt format
 * @deprecated Use validateLlmsTxtFormat from @/lib/llms-txt/spec instead
 * This is kept for backwards compatibility
 */
export function validateLlmsTxt(content: string): {
  valid: boolean;
  errors: string[];
} {
  const result = validateLlmsTxtFormat(content);
  return {
    valid: result.valid,
    errors: result.errors,
  };
}
