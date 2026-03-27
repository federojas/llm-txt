/**
 * Unit Tests: Language Detector
 * Tests multi-signal language detection (URL, headers, HTML, text)
 */

import { describe, it, expect } from "vitest";
import { LanguageDetector } from "@/lib/crawling/language-detector";

describe("LanguageDetector", () => {
  const detector = new LanguageDetector();

  describe("detectLanguage", () => {
    describe("Tier 1: URL-based detection (highest priority)", () => {
      it("should detect language from path segment", async () => {
        const result = await detector.detectLanguage(
          "https://example.com/es/about",
          "en",
          "en",
          "English text here"
        );
        expect(result).toBe("es");
      });

      it("should detect language from path with region code", async () => {
        const result = await detector.detectLanguage(
          "https://example.com/es-mx/help/"
        );
        expect(result).toBe("es");
      });

      it("should detect language from query parameter (lang)", async () => {
        const result = await detector.detectLanguage(
          "https://example.com?lang=fr",
          "en",
          "en"
        );
        expect(result).toBe("fr");
      });

      it("should detect language from query parameter (hl)", async () => {
        const result = await detector.detectLanguage(
          "https://example.com?hl=de",
          "en",
          "en"
        );
        expect(result).toBe("de");
      });

      it("should detect language from query parameter (language)", async () => {
        const result = await detector.detectLanguage(
          "https://example.com?language=it",
          "en",
          "en"
        );
        expect(result).toBe("it");
      });

      it("should detect language from subdomain", async () => {
        const result = await detector.detectLanguage(
          "https://fr.example.com/page",
          "en",
          "en"
        );
        expect(result).toBe("fr");
      });

      it("should prioritize URL over all other signals", async () => {
        const result = await detector.detectLanguage(
          "https://example.com/es/page",
          "en", // HTML says English
          "en", // Header says English
          "This is English text" // Text is English
        );
        expect(result).toBe("es"); // URL wins
      });
    });

    describe("Tier 2: Content-Language header", () => {
      it("should use Content-Language header when no URL signal", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          "en",
          "es"
        );
        expect(result).toBe("es");
      });

      it("should handle Content-Language with region", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          "en",
          "es-MX"
        );
        expect(result).toBe("es");
      });

      it("should handle Content-Language with multiple languages", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          "en",
          "fr, en, de"
        );
        expect(result).toBe("fr"); // First one wins
      });

      it("should override header='en' when text is clearly non-English", async () => {
        const spanishText =
          "Este es un texto en español con muchas palabras para detectar el idioma correctamente.";
        const result = await detector.detectLanguage(
          "https://example.com",
          "en",
          "en", // Header claims English
          spanishText // But text is Spanish
        );
        // Should detect Spanish from text and override header
        expect(result).not.toBe("en");
      });
    });

    describe("Tier 3: HTML lang attribute", () => {
      it("should use HTML lang when no URL or header", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          "de",
          undefined
        );
        expect(result).toBe("de");
      });

      it("should handle HTML lang with region", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          "pt-BR",
          undefined
        );
        expect(result).toBe("pt");
      });

      it("should override HTML='en' when text is clearly non-English", async () => {
        const frenchText =
          "Ceci est un texte en français avec beaucoup de mots pour détecter la langue correctement.";
        const result = await detector.detectLanguage(
          "https://example.com",
          "en", // HTML claims English
          undefined,
          frenchText // But text is French
        );
        expect(result).not.toBe("en");
      });

      it("should normalize HTML lang to lowercase", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          "FR-CA",
          undefined
        );
        expect(result).toBe("fr");
      });
    });

    describe("Tier 4: Text-based detection (franc-min)", () => {
      it("should detect Spanish from text when no metadata", async () => {
        const spanishText =
          "Este es un texto largo en español con muchas palabras para que la detección funcione correctamente.";
        const result = await detector.detectLanguage(
          "https://example.com",
          undefined,
          undefined,
          spanishText
        );
        expect(result).toBe("es");
      });

      it("should detect French from text", async () => {
        const frenchText =
          "Ceci est un texte assez long en français pour permettre une détection correcte de la langue.";
        const result = await detector.detectLanguage(
          "https://example.com",
          undefined,
          undefined,
          frenchText
        );
        expect(result).toBe("fr");
      });

      it("should detect German from text", async () => {
        const germanText =
          "Dies ist ein ausreichend langer deutscher Text, um eine korrekte Spracherkennung zu ermöglichen.";
        const result = await detector.detectLanguage(
          "https://example.com",
          undefined,
          undefined,
          germanText
        );
        expect(result).toBe("de");
      });

      it("should skip text detection for very short text", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          undefined,
          undefined,
          "Short text" // Less than 50 chars
        );
        expect(result).toBe("en"); // Falls back to default
      });

      it("should handle undetermined language from franc", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          undefined,
          undefined,
          "123 456 789 000" // Numbers only - undetermined
        );
        expect(result).toBe("en"); // Falls back to default
      });
    });

    describe("Tier 5: Default fallback", () => {
      it("should default to English when no signals", async () => {
        const result = await detector.detectLanguage();
        expect(result).toBe("en");
      });

      it("should default to English with empty inputs", async () => {
        const result = await detector.detectLanguage("", "", "", "");
        expect(result).toBe("en");
      });
    });

    describe("Priority order verification", () => {
      it("should prioritize: URL > Header > HTML > Text", async () => {
        const germanText =
          "Dies ist deutscher Text mit genügend Wörtern für die Erkennung.";

        // URL=es, Header=fr, HTML=de, Text=de
        const result = await detector.detectLanguage(
          "https://example.com/es/page",
          "de",
          "fr",
          germanText
        );
        expect(result).toBe("es"); // URL wins
      });

      it("should use header when URL has no language signal", async () => {
        const result = await detector.detectLanguage(
          "https://example.com/about",
          "de",
          "fr"
        );
        expect(result).toBe("fr"); // Header wins
      });

      it("should use HTML when URL and header have no signal", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          "it",
          undefined
        );
        expect(result).toBe("it"); // HTML wins
      });
    });

    describe("Invalid language codes", () => {
      it("should reject invalid URL language code", async () => {
        const result = await detector.detectLanguage(
          "https://example.com/xx/page", // Invalid code
          "de",
          "de"
        );
        expect(result).toBe("de"); // Falls back to header
      });

      it("should reject invalid header language code", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          "fr",
          "invalid"
        );
        expect(result).toBe("fr"); // Falls back to HTML
      });

      it("should reject invalid HTML language code", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          "zz", // Invalid
          undefined
        );
        expect(result).toBe("en"); // Falls back to default
      });
    });

    describe("Supported languages", () => {
      const supportedCodes = [
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

      supportedCodes.forEach((code) => {
        it(`should accept valid ISO 639-1 code: ${code}`, async () => {
          const result = await detector.detectLanguage(
            `https://example.com/${code}/page`
          );
          expect(result).toBe(code);
        });
      });
    });

    describe("Real-world scenarios", () => {
      it("should handle YouTube Spanish page with incorrect metadata", async () => {
        const result = await detector.detectLanguage(
          "https://www.youtube.com/howyoutubeworks",
          "en", // HTML claims English
          "en", // Header claims English
          "YouTube funciona conectando a creadores con audiencias en todo el mundo mediante contenido de video único."
        );
        // Should detect Spanish from text
        expect(result).not.toBe("en");
      });

      it("should handle Wikipedia with language subdomain", async () => {
        const result = await detector.detectLanguage(
          "https://es.wikipedia.org/wiki/Historia"
        );
        expect(result).toBe("es");
      });

      it("should handle GitHub with lang query param", async () => {
        const result = await detector.detectLanguage(
          "https://github.com/trending?lang=javascript"
        );
        // Regex matches first 2 chars "ja" which is valid (Japanese)
        expect(result).toBe("ja");
      });

      it("should handle multilingual site with path segment", async () => {
        const result = await detector.detectLanguage(
          "https://example.com/fr-CA/products"
        );
        expect(result).toBe("fr");
      });
    });

    describe("Edge cases", () => {
      it("should handle case-insensitive matching", async () => {
        const result = await detector.detectLanguage(
          "https://example.com/FR/page"
        );
        expect(result).toBe("fr");
      });

      it("should handle whitespace in header", async () => {
        const result = await detector.detectLanguage(
          "https://example.com",
          undefined,
          " es "
        );
        expect(result).toBe("es");
      });

      it("should handle URL with multiple path segments", async () => {
        const result = await detector.detectLanguage(
          "https://example.com/products/de/electronics"
        );
        expect(result).toBe("de");
      });

      it("should handle query param with ampersand", async () => {
        const result = await detector.detectLanguage(
          "https://example.com?foo=bar&hl=ja&baz=qux"
        );
        expect(result).toBe("ja");
      });

      it("should handle subdomain with www", async () => {
        const result = await detector.detectLanguage(
          "https://www.example.com/page"
        );
        expect(result).toBe("en"); // No language subdomain
      });

      it("should handle text with error in franc", async () => {
        // Test graceful handling of franc errors with empty text
        const result = await detector.detectLanguage(
          "https://example.com",
          undefined,
          undefined,
          "" // Empty text - falls back to default
        );
        expect(result).toBe("en");
      });
    });
  });
});
