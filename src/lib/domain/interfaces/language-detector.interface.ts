/**
 * Language Detector Interface (Domain Layer)
 * Defines contract for detecting page language
 */

export interface ILanguageDetector {
  /**
   * Detect language using multiple signals
   * @param url - Page URL for heuristic detection (if available)
   * @param htmlLangAttribute - Language from HTML metadata (if available)
   * @param contentLanguageHeader - HTTP Content-Language response header (if available)
   * @param text - Text to analyze (title + description) for franc-min detection (if available)
   * @returns ISO 639-1 language code (e.g., "en", "es", "fr")
   */
  detectLanguage(
    url?: string,
    htmlLangAttribute?: string,
    contentLanguageHeader?: string,
    text?: string
  ): Promise<string>;
}
