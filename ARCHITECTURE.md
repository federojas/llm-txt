# Next.js Standard Architecture

## Overview

This codebase follows **Next.js standard patterns** with feature-based organization and shared service layers. It emphasizes simplicity, flat structure, and practical organization over abstract layering.

## Core Principles

1. **Feature-based organization** - Features live in their own folders with related code
2. **Shared services** - Common functionality (crawling, HTTP, AI) in dedicated folders
3. **Simple naming** - No redundant suffixes (Service, Adapter, Client)
4. **Flat structure** - Avoid deep nesting, keep files discoverable
5. **AI-first** - AI enhancement with automatic fallback chains

---

## Project Structure

```
src/lib/
├── llms-txt/            # Main feature: llms.txt generation
├── ai-enhancement/      # AI + fallback strategies for content enhancement
├── crawling/            # Web crawling services
├── http/                # HTTP communication layer
├── url/                 # URL utilities
├── api/                 # API layer (errors, DTOs, validation, security)
├── types/               # Shared TypeScript types
└── config/              # Configuration and presets
```

---

## Detailed Structure

### llms-txt/ (Main Feature)

```
llms-txt/
├── generate.ts          # Main orchestrator (crawl → generate → format)
├── formatter.ts         # Transforms pages into llms.txt format
├── validator.ts         # Validates llms.txt spec compliance
└── index.ts            # Public exports
```

**Purpose:** Single feature folder containing all llms.txt generation logic.

**Key class:** `GenerateLlmsTxt`

- Orchestrates crawler, formatter, and AI services
- Handles configuration building
- Returns structured response with content and stats

---

### ai-enhancement/ (AI + Fallbacks)

```
ai-enhancement/
├── groq/                           # Groq AI provider
│   ├── groq-client.ts             # Groq API client with rate limiting
│   ├── groq-description-generator.ts
│   ├── groq-section-discovery.ts
│   ├── groq-title-cleaner.ts
│   └── index.ts
├── heuristic/                      # Non-AI fallback strategies
│   ├── heuristic-description-generator.ts
│   ├── heuristic-section-discovery.ts
│   ├── heuristic-title-cleaner.ts
│   └── index.ts
├── content-generator-factory.ts    # Creates AI → Heuristic chains
├── chained-service.ts             # Chain of Responsibility pattern
├── rate-limiter.ts                # Token bucket rate limiter
├── types.ts                       # AI service interfaces
└── index.ts
```

**Purpose:** AI-powered content enhancement with automatic fallback to heuristics.

**Key pattern:** Chain of Responsibility

```typescript
createDescriptionGenerator() {
  return chain([
    GroqDescriptionGenerator,      // Try AI first
    HeuristicDescriptionGenerator  // Fall back to simple rules
  ]);
}
```

**Key classes:**

- `ContentGeneratorFactory` - Creates chained services
- `GroqClient` - Handles Groq API with rate limiting
- Simple class names: `GroqDescriptionGenerator`, not `GroqDescriptionGeneratorAdapter`

---

### crawling/ (Web Crawling)

```
crawling/
├── crawler.ts              # Main crawler orchestrator
├── parser.ts              # HTML parsing with Cheerio
├── language-detector.ts   # Detects page language
├── ad-blocker.ts          # Blocks ads/trackers (Ghostery)
├── boundaries.ts          # Crawl boundary rules (depth, internal/external)
├── external-links.ts      # Quality filtering for external links
└── index.ts
```

**Purpose:** Everything related to crawling websites and extracting data.

**Key classes:**

- `Crawler` - Orchestrates crawl with concurrency, depth limits
- `HtmlParser` - Extracts metadata, links from HTML
- `LanguageDetector` - URL patterns + HTML lang + content analysis
- `AdBlocker` - Ghostery-based ad/tracker blocking

**Note:** `boundaries.ts` contains pure functions (not classes) for crawl boundary logic.

---

### http/ (HTTP Layer)

```
http/
├── client.ts     # HTTP client with retries and timeouts
├── sitemap.ts    # Sitemap fetcher/parser
├── robots.ts     # Robots.txt fetcher/parser
└── index.ts
```

**Purpose:** All HTTP communication with external services.

**Key features:**

- Automatic retries with exponential backoff
- Configurable timeouts
- User-agent handling
- Error handling

---

### url/ (URL Utilities)

```
url/
├── normalization.ts    # URL normalization (trailing slashes, fragments)
├── helpers.ts         # URL manipulation utilities
└── index.ts
```

**Purpose:** Pure utility functions for URL handling.

---

### api/ (API Layer)

```
api/
├── dtos/
│   ├── llms-txt.ts        # Request/Response DTOs for llms-txt endpoint
│   └── index.ts
├── middleware/
│   ├── error-handler.ts   # Global error handler
│   ├── validation.ts      # Zod validation middleware
│   └── index.ts
├── api-error.ts           # Custom error classes
├── api-response.ts        # Standardized API responses
├── schemas.ts             # Zod validation schemas
├── ssrf.ts               # SSRF protection
└── index.ts
```

**Purpose:** API layer concerns (validation, errors, DTOs, security).

**Key features:**

- Standardized error responses
- Zod schema validation
- SSRF protection (blocks private IPs, localhost)
- Type-safe DTOs

---

### types/ (Shared Types)

```
types/
├── crawl.ts      # CrawlConfig, CrawlProgress
├── page.ts       # PageMetadata
├── output.ts     # LinkItem, SectionGroup, LlmsTxtOutput
└── index.ts
```

**Purpose:** Consolidated TypeScript types used across the application.

**Note:** Replaced scattered `models/` and `interfaces/` folders with single `types/` folder.

---

### config/ (Configuration)

```
config/
├── presets.ts    # Preset configurations (quick, thorough, custom)
└── index.ts
```

---

## Architecture Decisions

### ✅ Removed Clean Architecture Layers

**Before:** domain/ → application/ → infrastructure/
**After:** Feature folders + shared services

**Why:** Clean Architecture is overkill for this Next.js app. Three abstract layers created unnecessary indirection.

### ✅ Simplified Class Names

**Before:** `CrawlerService`, `GhosteryAdBlockerAdapter`, `CheerioHtmlParser`
**After:** `Crawler`, `AdBlocker`, `HtmlParser`

**Why:** Removed redundant suffixes. The folder structure provides context.

### ✅ Feature-Based Organization

**Before:** Scattered across use-cases/, services/, adapters/
**After:** llms-txt/ folder contains all generation logic

**Why:** Next.js standard. Easy to find related code. Clear feature boundaries.

### ✅ Renamed content-generation → ai-enhancement

**Why:** Better conveys purpose (AI-powered enhancement). Heuristic fallback is implementation detail.

### ✅ Removed Hardcoded Classification

**Before:** 300+ lines of YouTube-specific URL patterns
**After:** AI-first classification with simple fallback

**Why:** AI is better at understanding content semantics. Removed fragile pattern matching.

### ✅ Consolidated Types

**Before:** domain/models/, domain/interfaces/ scattered everywhere
**After:** Single types/ folder

**Why:** Types are shared across layers. No need for separation.

### ✅ Moved Utilities to Correct Locations

**Before:** rate-limiter in http/ (only used by AI)
**After:** rate-limiter in ai-enhancement/

**Why:** Utilities should live with their consumers.

---

## Design Patterns

### Strategy Pattern with Fallback Chains

```typescript
// Factory creates chains: AI → Heuristic
const descriptionGenerator = factory.createDescriptionGenerator();

// Automatically tries Groq first, falls back to heuristic
const description = await descriptionGenerator.generateDescription(page);
```

### Interfaces Only Where Needed

Interfaces exist for:

1. AI strategies (multiple implementations: Groq, Heuristic)
2. Crawling services with DI (AdBlocker)

No interfaces for:

- Single implementations (Crawler, Formatter)
- Pure utility functions (URL helpers)

### Dependency Injection

```typescript
// Constructor injection for testability
class Crawler {
  constructor(
    config: CrawlConfig,
    httpClient?: HttpClient,
    sitemapClient?: SitemapClient,
    languageDetector?: LanguageDetector,
    adBlocker?: IAdBlocker
  ) {}
}
```

---

## Data Flow

### Request Flow

```
POST /api/v1/llms-txt
  ↓
Validation (Zod schemas)
  ↓
GenerateLlmsTxt.execute()
  ↓
Crawler.crawl() → Pages
  ↓
ContentGeneratorFactory → AI services
  ↓
Formatter.generate() → llms.txt content
  ↓
Standardized API response
```

### AI Enhancement Flow

```
Page data
  ↓
ContentGeneratorFactory
  ↓
Try Groq (if API key available)
  ↓ (on failure or unavailable)
Fall back to Heuristic
  ↓
Enhanced content
```

---

## Testing Strategy

### Unit Tests

- Domain logic (URL normalization, boundaries)
- AI services (mocked)
- Validation schemas
- SSRF protection

### Integration Tests

- Full generation flow
- Crawling with real HTTP
- Formatter with AI services

### Test Coverage

```bash
npm test              # Run all tests
npm run test:coverage # Coverage report
```

---

## Key Files

| File                                                                                               | Purpose            | Lines |
| -------------------------------------------------------------------------------------------------- | ------------------ | ----- |
| [llms-txt/generate.ts](src/lib/llms-txt/generate.ts)                                               | Main orchestrator  | ~130  |
| [llms-txt/formatter.ts](src/lib/llms-txt/formatter.ts)                                             | Formats output     | ~200  |
| [crawling/crawler.ts](src/lib/crawling/crawler.ts)                                                 | Crawl orchestrator | ~250  |
| [ai-enhancement/content-generator-factory.ts](src/lib/ai-enhancement/content-generator-factory.ts) | Creates AI chains  | ~150  |
| [api/schemas.ts](src/lib/api/schemas.ts)                                                           | Zod validation     | ~100  |

---

## Adding New Features

### Example: Adding Sitemap Generation Feature

1. Create feature folder:

```
lib/sitemap-generation/
├── generate.ts        # Main orchestrator
├── builder.ts         # Builds sitemap XML
├── validator.ts       # Validates sitemap spec
└── index.ts
```

2. Add API endpoint:

```typescript
// src/app/api/v1/sitemap/route.ts
import { generateSitemapUseCase } from "@/lib/sitemap-generation";
```

3. Add DTOs:

```typescript
// lib/api/dtos/sitemap.ts
export interface GenerateSitemapRequest {}
export interface GenerateSitemapResponse {}
```

**No changes needed to:** crawling/, http/, types/ (already shared)

---

## Performance Considerations

### Concurrency

- Configurable concurrent requests (default: 5)
- Token bucket rate limiting for AI APIs (30 req/min)

### Caching

- HTTP responses cached per request
- Robots.txt cached per domain
- Sitemap parsed once per request

### Timeouts

- Per-request timeout: 10s (configurable)
- AI API timeout: 30s
- Total request timeout: 2 minutes

---

## Security

### SSRF Protection

- Blocks private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Blocks localhost (127.0.0.0/8, ::1)
- Blocks metadata endpoints (169.254.169.254)

### Input Validation

- Zod schemas for all API inputs
- URL format validation
- Pattern validation (regex)

### Rate Limiting

- AI API: 30 requests/minute (token bucket)
- Future: Per-IP rate limiting

---

## Environment Variables

```bash
GROQ_API_KEY=xxx         # Optional: Groq API for AI enhancement
NODE_ENV=development     # Environment
```

---

## API Documentation

### POST /api/v1/llms-txt

**Request:**

```json
{
  "url": "https://example.com",
  "preset": "quick",
  "maxPages": 50,
  "maxDepth": 3,
  "timeout": 10000,
  "concurrency": 5
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "content": "# Example\n\n> Description\n\n## Section\n...",
    "stats": {
      "pagesFound": 42,
      "url": "https://example.com"
    }
  }
}
```

---

## Summary

**Architecture:** Next.js standard patterns with feature folders
**Organization:** Flat, practical, easy to navigate
**Naming:** Simple, no redundant suffixes
**AI Strategy:** AI-first with automatic fallback chains
**Tests:** 98/98 passing

**Result:** Production-ready, maintainable, scalable Next.js application ✅
