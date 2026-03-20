/**
 * Infrastructure Layer
 * External system integrations organized by concern
 *
 * Structure:
 * - clients/: External system communication (HTTP, APIs)
 * - adapters/: Domain interface implementations (Hexagonal Architecture)
 * - parsers/: External format parsing (HTML, XML, etc.)
 * - utilities/: Shared infrastructure helpers
 */

export * from "./clients";
export * from "./adapters";
export * from "./parsers";
export * from "./utilities";
