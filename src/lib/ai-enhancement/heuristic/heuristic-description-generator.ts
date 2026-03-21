import { IDescriptionGenerator } from "../types";
import { PageMetadata } from "@/lib/types";

/**
 * Heuristic Description Generator
 * Implements ONLY description generation (Single Responsibility Principle)
 * Uses rule-based pattern matching - no AI/API required
 * Always available as fallback
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
}
