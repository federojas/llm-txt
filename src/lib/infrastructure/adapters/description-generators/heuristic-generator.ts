import { IDescriptionGenerator } from "@/lib/domain/interfaces/description-generator.interface";
import { PageMetadata } from "@/types";

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
    return (
      homepage.ogDescription ||
      homepage.description ||
      "A platform providing digital services and resources."
    );
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
}
