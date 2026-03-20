/**
 * Language Detector Interface (Domain Layer)
 * Defines contract for detecting page language
 */

export interface ILanguageDetector {
  /**
   * Detect language using multiple signals
   * @param text - Text to analyze (title + description)
   * @param htmlLangAttribute - Language from HTML metadata (if available)
   * @param url - Page URL for heuristic detection (if available)
   * @param contentLanguageHeader - HTTP Content-Language response header (if available)
   * @returns ISO 639-1 language code (e.g., "en", "es", "fr")
   */
  detectLanguage(
    text: string,
    htmlLangAttribute?: string,
    url?: string,
    contentLanguageHeader?: string
  ): Promise<string>;
}
