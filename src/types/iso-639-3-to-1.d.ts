/**
 * Type definitions for iso-639-3-to-1
 * Converts ISO 639-3 (3-letter) language codes to ISO 639-1 (2-letter) codes
 */

declare module "iso-639-3-to-1" {
  /**
   * Convert ISO 639-3 language code to ISO 639-1
   * @param iso639_3 - Three-letter ISO 639-3 language code (e.g., "spa", "fra")
   * @returns Two-letter ISO 639-1 code (e.g., "es", "fr"), or undefined if no mapping exists
   */
  function iso6393To1(iso639_3: string): string | undefined;
  export default iso6393To1;
}
