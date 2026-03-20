/**
 * Language Detector Service (Domain Layer)
 * Lightweight language detection using multiple signals
 *
 * Detection hierarchy (traditional crawler approach):
 * 1. URL heuristics (/es/, ?lang=es) - explicit, never wrong
 * 2. HTTP Content-Language response header - server's declaration
 * 3. HTML metadata (<html lang="">) - document language
 * 4. Default to English (for prefer-english strategy)
 */

import { ILanguageDetector } from "../interfaces/language-detector.interface";

export class LanguageDetectorService implements ILanguageDetector {
  /**
   * Detect language using multiple signals in priority order
   */
  async detectLanguage(
    text: string,
    htmlLangAttribute?: string,
    url?: string,
    contentLanguageHeader?: string
  ): Promise<string> {
    // Tier 1: URL heuristics (fastest, most reliable - explicit selection)
    if (url) {
      const urlLang = this.detectFromUrl(url);
      if (urlLang) {
        return urlLang;
      }
    }

    // Tier 2: HTTP Content-Language response header (server's declaration)
    if (contentLanguageHeader) {
      const headerLang = contentLanguageHeader
        .toLowerCase()
        .split("-")[0]
        .split(",")[0]
        .trim();
      if (this.isValidISO6391Code(headerLang)) {
        return headerLang;
      }
    }

    // Tier 3: HTML metadata (document language declaration)
    if (htmlLangAttribute) {
      const normalizedLang = htmlLangAttribute.toLowerCase().split("-")[0];
      if (this.isValidISO6391Code(normalizedLang)) {
        return normalizedLang;
      }
    }

    // Tier 4: Default to English
    // (Appropriate for prefer-english strategy with Accept-Language header)
    return "en";
  }

  /**
   * Detect language from URL patterns
   * Handles: /es/, /fr/, ?lang=es, ?hl=es, /es-419/, etc.
   */
  private detectFromUrl(url: string): string | null {
    const lowerUrl = url.toLowerCase();

    // Pattern 1: Path segments (/es/, /fr/)
    const pathMatch = lowerUrl.match(/\/([a-z]{2})(?:[-_][a-z]{2,4})?\//);
    if (pathMatch) {
      const code = pathMatch[1];
      if (this.isValidISO6391Code(code)) {
        return code;
      }
    }

    // Pattern 2: Query parameters (?lang=es, ?hl=fr)
    const queryMatch = lowerUrl.match(/[?&](?:lang|hl|language)=([a-z]{2})/);
    if (queryMatch) {
      const code = queryMatch[1];
      if (this.isValidISO6391Code(code)) {
        return code;
      }
    }

    // Pattern 3: Subdomain (es.example.com, fr.example.com)
    const subdomainMatch = lowerUrl.match(/^https?:\/\/([a-z]{2})\./);
    if (subdomainMatch) {
      const code = subdomainMatch[1];
      if (this.isValidISO6391Code(code)) {
        return code;
      }
    }

    return null;
  }

  /**
   * Validate ISO 639-1 language code
   */
  private isValidISO6391Code(code: string): boolean {
    const validCodes = [
      "en",
      "es",
      "fr",
      "de",
      "it",
      "pt",
      "zh",
      "ja",
      "ko",
      "ar",
      "ru",
      "nl",
      "pl",
      "tr",
      "vi",
      "th",
      "id",
      "hi",
      "sv",
      "da",
      "fi",
      "no",
    ];
    return validCodes.includes(code.toLowerCase());
  }
}
