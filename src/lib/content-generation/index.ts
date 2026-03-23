/**
 * Content Generation - Public API
 *
 * Provides AI-powered and deterministic content generation services
 * for llms.txt creation including descriptions, sections, and title cleaning.
 */

// Core types and factory
export * from "./core/types";
export * from "./core/factory";

// Provider exports (commonly used)
export * from "./providers/groq";
export * from "./providers/deterministic";

// Shared utilities
export * from "./shared/rate-limiter";

// Note: For direct provider access, import from specific submodules:
// - import { GroqClient } from "@/lib/content-generation/providers/groq"
// - import { MetadataDescriptionGenerator } from "@/lib/content-generation/providers/deterministic"
