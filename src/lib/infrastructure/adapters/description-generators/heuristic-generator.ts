import { IDescriptionGenerator } from "@/lib/domain/interfaces/description-generator.interface";
import { PageMetadata, SectionGroup } from "@/lib/domain/models";
import { classifyUrl } from "@/lib/domain/logic/url-classification";

/**
 * Heuristic description generator
 * Adapts heuristic pattern matching to IDescriptionGenerator interface (no AI required)
 */
export class HeuristicDescriptionGenerator implements IDescriptionGenerator {
  isAvailable(): boolean {
    return true; // Always available as fallback
  }

  async generateDescription(page: PageMetadata): Promise<string> {
    // Prefer og:description over regular description
    if (page.ogDescription) {
      return this.cleanDescription(page.ogDescription);
    }

    if (page.description) {
      return this.cleanDescription(page.description);
    }

    // Generate from URL patterns
    const url = page.url.toLowerCase();
    const title = page.title;

    if (url.includes("/docs/") || url.includes("/documentation/")) {
      return `Documentation for ${this.extractTopic(title)}`;
    }

    if (url.includes("/blog/") || url.includes("/news/")) {
      return `Blog post: ${title}`;
    }

    if (url.includes("/api/") || url.includes("/reference/")) {
      return `API reference for ${this.extractTopic(title)}`;
    }

    if (url.includes("/guide/") || url.includes("/tutorial/")) {
      return `Guide on ${this.extractTopic(title)}`;
    }

    if (url.includes("/about")) {
      return "Information about the company and team";
    }

    if (url.includes("/pricing")) {
      return "Pricing plans and subscription options";
    }

    if (url.includes("/contact")) {
      return "Contact information and support resources";
    }

    if (url.includes("/careers") || url.includes("/jobs")) {
      return "Career opportunities and open positions";
    }

    // Default: use title
    return title;
  }

  async generateBusinessSummary(homepage: PageMetadata): Promise<string> {
    // Prefer og:description as it's usually the best summary
    if (homepage.ogDescription) {
      return this.cleanDescription(homepage.ogDescription);
    }

    if (homepage.description) {
      return this.cleanDescription(homepage.description);
    }

    // Build a basic summary from available metadata
    const siteName =
      homepage.siteName || homepage.ogTitle || homepage.title || "This site";
    const domain = new URL(homepage.url).hostname.replace(/^www\./, "");

    // Try to infer site type from domain or title
    if (domain.includes("github") || homepage.url.includes("github.com")) {
      return `${siteName} - Software development platform and code hosting service.`;
    }

    if (domain.includes("youtube")) {
      return `${siteName} - Video sharing and streaming platform.`;
    }

    if (domain.includes("google")) {
      return `${siteName} - Search engine and technology platform providing web services, cloud computing, and digital tools.`;
    }

    // Generic but informative fallback
    return `${siteName} - Visit ${domain} to learn more about their services and offerings.`;
  }

  /**
   * Clean up description text
   */
  private cleanDescription(desc: string): string {
    // Remove excessive whitespace
    let cleaned = desc.replace(/\s+/g, " ").trim();

    // Truncate if too long (keep it concise)
    if (cleaned.length > 150) {
      cleaned = cleaned.substring(0, 147) + "...";
    }

    return cleaned;
  }

  /**
   * Extract topic from title (remove site name suffixes)
   */
  private extractTopic(title: string): string {
    // Remove common suffixes like " | Site Name", " - Site Name"
    const topic = title
      .split("|")[0]
      .split("-")[0]
      .split("—")[0]
      .split("–")[0]
      .trim();

    return topic || title;
  }

  /**
   * Heuristic section discovery (fallback when AI is unavailable)
   * Groups pages by URL pattern classification
   */
  async discoverSections(pages: PageMetadata[]): Promise<SectionGroup[]> {
    // Group pages by category using URL classification
    const groups = new Map<string, number[]>();

    pages.forEach((page, idx) => {
      const category = classifyUrl(page.url, page);
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(idx);
    });

    // Map categories to section names
    const categoryToSectionName: Record<string, string> = {
      documentation: "Documentation",
      guides: "Guides",
      tutorials: "Tutorials",
      api: "API Reference",
      about: "About",
      creators: "Creators & Advertisers",
      legal: "Legal & Policies",
      blog: "Blog",
      pricing: "Pricing",
      other: "Additional Resources",
    };

    // Convert to SectionGroup format
    const sections: SectionGroup[] = [];
    const sectionOrder = [
      "documentation",
      "guides",
      "tutorials",
      "api",
      "about",
      "creators",
      "legal",
      "blog",
      "pricing",
      "other",
    ];

    for (const category of sectionOrder) {
      const pageIndexes = groups.get(category);
      if (pageIndexes && pageIndexes.length > 0) {
        sections.push({
          name: categoryToSectionName[category] || category,
          pageIndexes,
        });
      }
    }

    return sections;
  }

  /**
   * Clean page titles using regex patterns
   * Removes redundant suffixes, site names, and separators
   */
  async cleanTitles(titles: string[]): Promise<string[]> {
    return titles.map((title) => this.cleanTitle(title));
  }

  /**
   * Clean a single title using heuristic patterns
   */
  private cleanTitle(title: string): string {
    let cleaned = title;

    // Remove duplicate segments (e.g., "About - FastHTML - FastHTML" → "About - FastHTML")
    const parts = cleaned.split(/\s*[-|—–]\s*/);
    const uniqueParts: string[] = [];
    const seen = new Set<string>();

    for (const part of parts) {
      const normalized = part.trim().toLowerCase();
      if (!seen.has(normalized) && part.trim().length > 0) {
        seen.add(normalized);
        uniqueParts.push(part.trim());
      }
    }

    // If we removed duplicates, reassemble
    if (uniqueParts.length < parts.length) {
      cleaned = uniqueParts.join(" - ");
    }

    // If only one part remains, use it directly (no separator)
    if (uniqueParts.length === 1) {
      cleaned = uniqueParts[0];
    }
    // If two parts and second is very short (likely site acronym), keep both
    else if (uniqueParts.length === 2 && uniqueParts[1].length <= 10) {
      cleaned = uniqueParts[0]; // Remove site name suffix
    }
    // If multiple parts, keep first meaningful one (usually the page title)
    else if (uniqueParts.length > 2) {
      cleaned = uniqueParts[0];
    }

    return cleaned.trim();
  }
}
