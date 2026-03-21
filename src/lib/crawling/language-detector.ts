/**
 * Language Detector
 * Lightweight language detection using multiple signals
 */

import { franc } from "franc-min";
import iso6393To1 from "iso-639-3-to-1";

/**
 * Language Detector Interface
 */
export interface ILanguageDetector {
  detectLanguage(
    url?: string,
    htmlLangAttribute?: string,
    contentLanguageHeader?: string,
    text?: string
  ): Promise<string>;
}

export class LanguageDetector implements ILanguageDetector {
  /**
   * Detect language using multiple signals in priority order
   */
  async detectLanguage(
    url?: string,
    htmlLangAttribute?: string,
    contentLanguageHeader?: string,
    text?: string
  ): Promise<string> {
    // Tier 1: URL heuristics (fastest, most reliable - explicit selection)
    if (url) {
      const urlLang = this.detectFromUrl(url);
      if (urlLang) {
        return urlLang;
      }
    }

    // Pre-compute text-based detection (call franc-min once)
    // Use this for sanity checks against metadata that claims "en"
    let textLang: string | null = null;
    if (text && text.length >= 50) {
      textLang = this.detectWithFranc(text);
    }

    // Tier 2: HTTP Content-Language response header (server's declaration)
    if (contentLanguageHeader) {
      const headerLang = contentLanguageHeader
        .toLowerCase()
        .split("-")[0]
        .split(",")[0]
        .trim();
      if (this.isValidISO6391Code(headerLang)) {
        // Sanity check: If header claims "en" but text is clearly non-English, trust text
        if (headerLang === "en" && textLang && textLang !== "en") {
          return textLang; // Catches geo-based serving (YouTube Spanish pages)
        }
        return headerLang;
      }
    }

    // Tier 3: HTML metadata (document language declaration)
    if (htmlLangAttribute) {
      const normalizedLang = htmlLangAttribute.toLowerCase().split("-")[0];
      if (this.isValidISO6391Code(normalizedLang)) {
        // Sanity check: If HTML claims "en" but text is clearly non-English, trust text
        if (normalizedLang === "en" && textLang && textLang !== "en") {
          return textLang; // Catches incorrect HTML metadata
        }
        return normalizedLang;
      }
    }

    // Tier 4: Text-based detection (franc-min) for pages with missing metadata
    if (textLang) {
      return textLang;
    }

    // Tier 5: Default to English
    // (Appropriate for prefer-english strategy with Accept-Language header)
    return "en";
  }

  /**
   * Detect language using franc-min library
   * Uses ML-based detection for edge cases where metadata is missing/incorrect
   *
   * @param text - Text to analyze (minimum 50 chars recommended)
   * @returns ISO 639-1 code (e.g., "es", "fr") or null
   */
  private detectWithFranc(text: string): string | null {
    try {
      // franc returns ISO 639-3 codes (3-letter: "spa", "fra", "deu")
      const iso639_3 = franc(text, { minLength: 50 });

      // "und" = undetermined (franc couldn't detect language)
      if (iso639_3 === "und") {
        return null;
      }

      // Convert ISO 639-3 to ISO 639-1 using standard library
      const iso639_1 = iso6393To1(iso639_3);
      return iso639_1 || null;
    } catch {
      return null;
    }
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
