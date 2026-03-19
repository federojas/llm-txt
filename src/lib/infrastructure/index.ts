/**
 * Infrastructure Layer
 * External system integrations organized by concern
 *
 * Structure:
 * - clients/: External system communication (HTTP, APIs)
 * - adapters/: Domain interface implementations (Hexagonal Architecture)
 * - utilities/: Shared infrastructure helpers
 */

export * from "./clients";
export * from "./adapters";
export * from "./utilities";
