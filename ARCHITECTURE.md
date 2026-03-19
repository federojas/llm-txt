# Architecture Documentation

## System Overview

The llms.txt Generator is a full-stack Next.js application that crawls websites and generates llms.txt files following the official specification. The system is designed with production-grade concerns including security, performance, and reliability, following Clean Architecture and Domain-Driven Design principles.

## High-Level Architecture

```
┌─────────────┐
│   Browser   │
│   (React)   │
└──────┬──────┘
       │ HTTP
       ↓
┌─────────────────────┐
│   Next.js Server    │
│   ┌─────────────┐   │
│   │  API Routes │   │
│   └──────┬──────┘   │
│          │          │
│   ┌──────↓──────┐   │
│   │  Crawler    │───┼──→ External Websites
│   │   Service   │   │
│   └──────┬──────┘   │
│          │          │
│   ┌──────↓──────┐   │
│   │  Generator  │   │
│   └─────────────┘   │
└─────────────────────┘
```

---

## Layered Architecture

The application follows a strict layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────┐
│   Application/API Layer             │
│   (app/api/generate/route.ts)       │
└───────────────┬─────────────────────┘
                │ depends on
┌───────────────▼─────────────────────┐
│   Use Cases Layer                   │
│   (Application Orchestration)       │
│   - generate-llms-txt.use-case.ts   │
└───────────────┬─────────────────────┘
                │ depends on
┌───────────────▼─────────────────────┐
│   Domain Layer                      │
│   (Business Logic)                  │
│   - Services, Interfaces            │
│   - Depends on INTERFACES only      │
└───────────────┬─────────────────────┘
                │ depends on (abstraction)
┌───────────────▼─────────────────────┐
│   Infrastructure Layer              │
│   (External Adapters)               │
│   - HTTP clients, AI adapters       │
│   - Implements domain interfaces    │
└─────────────────────────────────────┘
```

### Directory Structure by Layer

```
src/lib/
├── domain/              # Business Logic (Layer 1)
│   ├── interfaces/      # Contracts/Abstractions
│   │   ├── crawler-service.interface.ts
│   │   ├── description-generator.interface.ts
│   │   └── description-service.interface.ts
│   ├── services/        # Domain services
│   │   ├── crawler.service.ts
│   │   └── description.service.ts
│   ├── generator/       # llms.txt generation logic
│   ├── parser/          # HTML/sitemap parsing
│   ├── logic/           # Domain logic (URL classification)
│   └── validation/      # Domain validation rules
│
├── infrastructure/      # External Adapters (Layer 2)
│   ├── adapters/
│   │   └── description-generators/
│   │       ├── groq-generator.ts
│   │       ├── heuristic-generator.ts
│   │       └── generator-factory.ts
│   └── clients/
│       ├── http-client.ts
│       └── sitemap-client.ts
│
├── use-cases/           # Application Layer (Layer 3)
│   └── generate-llms-txt.use-case.ts
│
├── api/                 # API Layer (Layer 4)
│   ├── dtos/            # Data Transfer Objects
│   ├── errors/          # API error handling
│   ├── middleware/      # Express/Next.js middleware
│   ├── responses/       # Standardized responses
│   ├── security/        # SSRF protection
│   └── validation/      # Request validation (Zod)
│
├── shared/              # Pure Utilities (No Layer)
│   └── url-utils.ts     # URL formatting/parsing (pure functions)
│
└── config/              # Configuration (No Layer)
    └── presets.ts       # Crawl presets
```

### Layer Definitions

#### Domain Layer (`src/lib/domain/`)

**Purpose**: Business logic and domain rules

**Characteristics**:

- No external dependencies (DB, HTTP, APIs)
- Depends only on domain interfaces (abstractions)
- Contains business rules and workflows
- Pure business logic, framework-agnostic

**Components**:

- `services/crawler.service.ts` - Crawling strategy and BFS logic
- `services/description.service.ts` - Description generation orchestration
- `generator/` - llms.txt generation rules
- `parser/` - HTML/sitemap parsing logic
- `interfaces/` - Contracts that infrastructure implements

**Example**:

```typescript
// Domain depends on abstraction, not implementation
import { IDescriptionGenerator } from "../interfaces";

export class DescriptionService {
  constructor(
    private primaryGenerator: IDescriptionGenerator, // Interface
    private fallbackGenerator: IDescriptionGenerator
  ) {}
}
```

#### Infrastructure Layer (`src/lib/infrastructure/`)

**Purpose**: External adapters and infrastructure concerns

**Characteristics**:

- Implements domain interfaces
- Handles external I/O (HTTP, APIs, databases)
- Contains infrastructure code (rate limiting, caching)
- Has side effects (network calls, file I/O)

**Components**:

- `adapters/description-generators/groq-generator.ts` - Groq API adapter
- `adapters/description-generators/heuristic-generator.ts` - Fallback generator
- `clients/http-client.ts` - HTTP client (wraps axios)
- `clients/sitemap-client.ts` - Sitemap fetching

**Example**:

```typescript
// Infrastructure implements domain interface
export class GroqDescriptionGenerator implements IDescriptionGenerator {
  private client: Groq;

  async generateDescription(page: PageMetadata): Promise<string> {
    // External API call
    const response = await this.client.chat.completions.create({...});
    return response.choices[0].message.content;
  }
}
```

#### Use Cases Layer (`src/lib/use-cases/`)

**Purpose**: Application orchestration and business workflows

**Characteristics**:

- Coordinates between domain services
- Implements application-specific workflows
- No framework dependencies
- Reusable across different entry points (API, CLI, workers)

**Example**:

```typescript
export class GenerateLlmsTxtUseCase {
  async execute(request: GenerateRequest): Promise<GenerateResponse> {
    // Orchestrate domain services
    const crawlerService = new CrawlerService(config);
    const pages = await crawlerService.crawl();
    const content = await generateLlmsTxt(pages);
    return { content, stats: {...} };
  }
}
```

#### API Layer (`src/lib/api/`)

**Purpose**: HTTP API concerns (Next.js routes)

**Characteristics**:

- Request/response handling
- Validation, serialization
- Error handling
- Security (SSRF protection)
- Framework-specific (Next.js)

#### Shared Utilities (`src/lib/shared/`)

**Purpose**: Pure, stateless utility functions

**Characteristics**:

- **No side effects** (no I/O, no state mutation)
- **Pure functions** - same input → same output
- **No external dependencies**
- Testable without mocks

**Examples**:

- ✅ `url-utils.ts` - URL parsing, normalization
- ❌ `http-client.ts` - Has side effects, belongs in infrastructure
- ❌ Database client - Has side effects
- ❌ Cache - Stateful

### Dependency Flow Principles

**Key Principle**: Dependencies point inward. Domain → Abstractions, Infrastructure → Implementations

```
API Layer
   ↓ (uses)
Use Cases Layer
   ↓ (uses)
Domain Layer (depends on interfaces)
   ↑ (implements)
Infrastructure Layer
```

**Benefits**:

1. **Testability**: Mock interfaces, not implementations
2. **Maintainability**: Clear separation of concerns
3. **Flexibility**: Swap implementations without changing domain
4. **Understandability**: Consistent structure across codebase
5. **Scalability**: Easy to add new features in the right place

### Decision Tree: Where Does This Code Go?

#### Is it a pure function with no side effects?

- **Yes** → `shared/`
- **No** → Continue

#### Does it contain business logic/rules?

- **Yes** → `domain/`
- **No** → Continue

#### Does it interact with external systems (HTTP, DB, APIs)?

- **Yes** → `infrastructure/`
- **No** → Continue

#### Is it HTTP API-specific (routes, validation, DTOs)?

- **Yes** → `api/`
- **No** → `use-cases/` or `config/`

### Common Mistakes to Avoid

#### ❌ Wrong: HTTP Client in Shared Utilities

```
src/lib/shared/
└── http-client.ts  # ❌ Has side effects, not pure
```

**Why wrong**: HTTP client has I/O, state (rate limiter, retries), not pure

#### ✅ Correct: HTTP Client in Infrastructure

```
src/lib/infrastructure/clients/
└── http-client.ts  # ✓ External adapter
```

#### ❌ Wrong: Domain Depending on Concrete Implementation

```typescript
// domain/services/description.service.ts
import { GroqDescriptionGenerator } from "@/lib/infrastructure/adapters/description-generators/groq-generator"; // ❌

class DescriptionService {
  private adapter = new GroqDescriptionGenerator(); // ❌ Tightly coupled
}
```

**Why wrong**: Domain coupled to specific infrastructure, can't test or swap

#### ✅ Correct: Domain Depending on Interface

```typescript
// domain/services/description.service.ts
import { IDescriptionGenerator } from "../interfaces"; // ✓

class DescriptionService {
  constructor(private generator: IDescriptionGenerator) {} // ✓ Loosely coupled
}
```

---

## Core Components

### 1. Frontend (React/Next.js)

**Location**: `app/page.tsx`, `components/`

**Responsibilities**:

- User input collection
- Progress visualization
- Result preview and editing
- Download/copy functionality

**Key Components**:

- `UrlInput`: Form with URL validation and preset selection
- `LoadingState`: Progress indicator during crawling
- `ResultPreview`: Display, edit, copy, and download generated content

### 2. API Layer

**Location**: `app/api/generate/route.ts`

**Responsibilities**:

- Request validation using Zod schemas
- Orchestrating crawl and generation
- Error handling and response formatting

**Endpoint**: `POST /api/generate`

**Request Flow**:

```
1. Receive request with URL and options
2. Validate input (Zod + SSRF protection)
3. Delegate to use case
4. Return formatted response
```

### 3. Crawler Service

**Location**: `src/lib/domain/services/crawler.service.ts`

**Design**: Hybrid sitemap-first + BFS (Breadth-First Search) crawler

**Key Features**:

- **Sitemap-first strategy** (10-100x faster)
- Fallback to BFS crawling
- Concurrent request handling
- Visited URL tracking
- Depth limiting
- Timeout protection

**Crawl Strategy**:

```typescript
1. Try to find and parse sitemap.xml
   ├─ Check common paths: /sitemap.xml, /sitemap_index.xml, etc.
   ├─ Check robots.txt for sitemap URL
   ├─ If found → Extract URLs (priority-sorted)
   └─ If not found OR insufficient → Start BFS from homepage

2. For each URL:
   ├─ Check if already visited
   ├─ Fetch HTML content
   ├─ Extract metadata
   ├─ Extract internal links
   └─ Add new links to queue (if within depth limit)

3. Continue until:
   ├─ Max pages reached
   ├─ Max depth exceeded
   └─ Queue empty
```

**Concurrency Model**:

```
┌──────────────┐
│  Main Queue  │
└──────┬───────┘
       │
       ├─→ [Batch 1: 5 URLs] ──→ Process in parallel
       │
       ├─→ [Batch 2: 5 URLs] ──→ Process in parallel
       │
       └─→ [Batch 3: 5 URLs] ──→ Process in parallel
```

### 4. Parser Layer

**Location**: `src/lib/domain/parser/`

**Components**:

- `html.ts`: Extracts metadata from HTML using Cheerio
- `sitemap.ts`: Parses sitemap.xml files

**Metadata Extraction**:

```typescript
Sources (in priority order):
Title:
1. <title> tag
2. <meta property="og:title">
3. <h1> tag
4. Fallback: "Untitled"

Description:
1. <meta name="description">
2. <meta property="og:description">
3. None
```

---

## AI Description Generation Architecture

### Overview

The description generation system follows strict layered architecture with dependency inversion:

```
┌─────────────────────────────────────────────┐
│         Domain Layer (Business Logic)       │
│  - DescriptionService                       │
│  - IDescriptionGenerator Interface          │
│  - IDescriptionService Interface            │
└─────────────────┬───────────────────────────┘
                  │ (depends on abstraction)
┌─────────────────▼───────────────────────────┐
│      Infrastructure Layer (Adapters)        │
│  - GroqDescriptionGenerator (AI)            │
│  - HeuristicDescriptionGenerator (fallback) │
│  - DescriptionGeneratorFactory              │
│  - RateLimiter (token bucket)               │
└─────────────────────────────────────────────┘
```

### Components

#### Domain Layer

**`interfaces/description-generator.interface.ts`**

Defines the contract that all description generators must implement:

```typescript
export interface IDescriptionGenerator {
  generateDescription(page: PageMetadata): Promise<string>;
  generateBusinessSummary(homepage: PageMetadata): Promise<string>;
  isAvailable(): boolean;
}
```

**Why**: Dependency Inversion Principle - domain logic depends on abstractions, not implementations.

**`interfaces/description-service.interface.ts`**

```typescript
export interface IDescriptionService {
  generateBusinessSummary(homepage: PageMetadata): Promise<string>;
  generateDescriptions(pages: PageMetadata[]): Promise<Map<string, string>>;
}
```

**`services/description.service.ts`**

Orchestrates description generation with fallback handling:

```typescript
export class DescriptionService implements IDescriptionService {
  constructor(
    private primaryGenerator: IDescriptionGenerator,
    private fallbackGenerator: IDescriptionGenerator
  ) {}

  async generateDescriptions(
    pages: PageMetadata[]
  ): Promise<Map<string, string>> {
    const descriptions = new Map<string, string>();

    for (const page of pages) {
      try {
        const desc = await this.primaryGenerator.generateDescription(page);
        descriptions.set(page.url, desc);
      } catch (error) {
        // Automatic fallback
        const desc = await this.fallbackGenerator.generateDescription(page);
        descriptions.set(page.url, desc);
      }
    }

    return descriptions;
  }
}
```

**Responsibilities**:

- Orchestrate multi-page description generation
- Handle generator failures with automatic fallback
- Business logic for description generation flow
- Sequential processing with rate limiting

#### Infrastructure Layer

**`adapters/description-generators/groq-generator.ts`**

Concrete implementation using Groq SDK (Llama 3.3 70B):

```typescript
export class GroqDescriptionGenerator implements IDescriptionGenerator {
  private client: Groq;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string, requestsPerMinute: number = 30) {
    this.client = new Groq({ apiKey });
    this.rateLimiter = new RateLimiter(requestsPerMinute);
  }

  async generateDescription(page: PageMetadata): Promise<string> {
    await this.rateLimiter.waitForToken();

    const response = await this.client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Generate a concise 15-word description for: ${page.title}`,
        },
      ],
      max_tokens: 50,
    });

    return response.choices[0].message.content;
  }
}
```

**Features**:

- Rate limiting (30 RPM for free tier)
- Token bucket algorithm for smooth rate distribution
- Error handling with meaningful messages
- Generates concise 15-word summaries per page
- Creates 2-3 sentence business summaries for homepages

**`adapters/description-generators/heuristic-generator.ts`**

Fallback generator using rule-based heuristics:

```typescript
export class HeuristicDescriptionGenerator implements IDescriptionGenerator {
  generateDescription(page: PageMetadata): Promise<string> {
    // Priority order:
    // 1. og:description meta tag
    // 2. meta description tag
    // 3. URL pattern matching:
    //    - /docs/* → "Documentation for {topic}"
    //    - /blog/* → "Blog post: {title}"
    //    - /api/* → "API reference for {topic}"
    // 4. Page title as last resort
  }
}
```

**When used**:

- No API key configured
- Primary generator fails
- Development/testing without API costs

**`adapters/description-generators/generator-factory.ts`**

Factory for creating generators based on configuration:

```typescript
export class DescriptionGeneratorFactory {
  static createPrimaryGenerator(): IDescriptionGenerator | null {
    const apiKey = process.env.GROQ_API_KEY;
    return apiKey ? new GroqDescriptionGenerator(apiKey, 30) : null;
  }

  static createFallbackGenerator(): IDescriptionGenerator {
    return new HeuristicDescriptionGenerator();
  }

  static createGenerator(): IDescriptionGenerator {
    return this.createPrimaryGenerator() || this.createFallbackGenerator();
  }
}
```

**Pattern**: Factory Pattern - centralizes generator creation logic.

### Rate Limiting Strategy

**Problem**: Groq free tier = 30 requests per minute (RPM)

**Solution**: Token Bucket Algorithm

```typescript
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private refillRate: number; // tokens per millisecond
  private capacity: number;

  constructor(requestsPerMinute: number, burstCapacity?: number) {
    this.capacity = burstCapacity || requestsPerMinute;
    this.tokens = this.capacity;
    this.refillRate = requestsPerMinute / 60000; // RPM to tokens/ms
    this.lastRefill = Date.now();
  }

  async waitForToken(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate;
      await this.sleep(waitTime);
      this.refill();
    }

    this.tokens -= 1;
  }
}
```

**Benefits**:

- Smooth rate distribution (not bursty)
- No 429 rate limit errors
- Automatic pacing
- Allows small bursts within limit

### Usage Example

```typescript
import { DescriptionService } from "@/lib/domain/services/description.service";
import { DescriptionGeneratorFactory } from "@/lib/infrastructure/adapters/description-generators";

// Create generators
const primaryGenerator = DescriptionGeneratorFactory.createPrimaryGenerator();
const fallbackGenerator = DescriptionGeneratorFactory.createFallbackGenerator();

// Initialize service
const descriptionService = new DescriptionService(
  primaryGenerator || fallbackGenerator,
  fallbackGenerator
);

// Generate descriptions
const summary = await descriptionService.generateBusinessSummary(homepage);
const descriptions = await descriptionService.generateDescriptions(pages);
```

### Design Principles Applied

1. **Dependency Inversion**: Domain depends on abstractions (`IDescriptionGenerator`), not implementations (`GroqDescriptionGenerator`)

2. **Open/Closed**: Easy to add new generators (OpenAI, Anthropic, etc.) without modifying existing code

3. **Single Responsibility**:
   - `GroqDescriptionGenerator`: Groq API integration only
   - `RateLimiter`: Rate limiting only
   - `DescriptionService`: Orchestration only
   - `DescriptionGeneratorFactory`: Generator creation only

4. **Testability**: Mock the interface for unit tests:
   ```typescript
   class MockDescriptionGenerator implements IDescriptionGenerator {
     async generateDescription() {
       return "test description";
     }
     async generateBusinessSummary() {
       return "test summary";
     }
     isAvailable() {
       return true;
     }
   }
   ```

### Future Extensions

#### Adding a New Generator (OpenAI Example)

1. Implement interface:

```typescript
// src/lib/infrastructure/adapters/description-generators/openai-generator.ts
export class OpenAIDescriptionGenerator implements IDescriptionGenerator {
  private client: OpenAI;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
    this.rateLimiter = new RateLimiter(60); // 60 RPM
  }

  async generateDescription(page: PageMetadata): Promise<string> {
    await this.rateLimiter.waitForToken();
    const response = await this.client.chat.completions.create({...});
    return response.choices[0].message.content;
  }
}
```

2. Update factory:

```typescript
static createPrimaryGenerator(): IDescriptionGenerator | null {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) return new OpenAIDescriptionGenerator(openaiKey);

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) return new GroqDescriptionGenerator(groqKey);

  return null;
}
```

#### Caching Layer

```typescript
export class CachedDescriptionService implements IDescriptionService {
  private cache = new Map<string, string>();

  async generateDescriptions(
    pages: PageMetadata[]
  ): Promise<Map<string, string>> {
    // Check cache first, only generate for cache misses
  }
}
```

---

## Generator

**Location**: `src/lib/domain/generator/index.ts`

**Responsibilities**:

- Classify pages by URL patterns
- Group pages into sections
- Integrate AI descriptions for each page
- Format according to llms.txt specification
- Validate output

**Classification Logic**:

```typescript
URL Pattern → Section
────────────────────────
/docs/*     → Documentation
/api/*      → API Reference
/guide/*    → Guides
/tutorial/* → Tutorials
/blog/*     → Blog
/about/*    → About
/           → Overview
*           → Additional Resources
```

**Output Structure**:

```
1. H1: Project Name (required)
2. Blockquote: Summary (optional)
3. Sections (H2):
   - Overview
   - Documentation
   - Guides
   - API Reference
4. Optional Section (H2):
   - Lower priority content
```

---

## Complete Data Flow

### End-to-End Request Flow

```
1. User Input
   └─→ URL + Options (preset: quick/thorough)

2. Frontend Validation
   └─→ Basic URL format check

3. API Request
   └─→ POST /api/generate

4. Backend Validation
   ├─→ Zod schema validation
   └─→ SSRF protection check

5. Use Case Execution
   └─→ GenerateLlmsTxtUseCase.execute()

6. Crawler Service Initialization
   ├─→ Build config with presets
   └─→ Create CrawlerService instance

7. Sitemap Discovery
   ├─→ Try /sitemap.xml
   ├─→ Try /sitemap_index.xml
   └─→ Parse robots.txt for sitemap

8. Crawling Phase
   ├─→ If sitemap: Extract URLs
   │   └─→ Sort by priority
   └─→ If no sitemap OR insufficient: BFS from homepage

9. Page Processing (per URL)
   ├─→ Fetch HTML
   ├─→ Check robots meta tag
   ├─→ Extract metadata
   │   ├─→ Title
   │   ├─→ Description
   │   └─→ Internal links
   └─→ Add links to queue

10. Description Generation Phase
    ├─→ Initialize DescriptionService with adapters
    │   ├─→ Primary: GroqDescriptionGenerator (if GROQ_API_KEY)
    │   └─→ Fallback: HeuristicDescriptionGenerator
    ├─→ Generate homepage business summary
    ├─→ Generate descriptions for all pages
    │   ├─→ Process sequentially (respects 30 RPM rate limit)
    │   ├─→ Token bucket rate limiter (2 sec/request)
    │   └─→ Automatic fallback on adapter failures
    └─→ Map descriptions to page URLs

11. Generation Phase
    ├─→ Classify all pages
    ├─→ Group by section
    ├─→ Attach generated descriptions
    ├─→ Sort by depth and title
    └─→ Format as Markdown

12. Response
    └─→ Return llms.txt content + stats

13. Client Display
    ├─→ Show preview
    ├─→ Enable editing
    └─→ Provide download/copy
```

---

## Performance Considerations

### Optimization Strategies

1. **Sitemap-First Approach**
   - 10-100x faster than crawling
   - Avoids redundant requests
   - Gets high-priority pages first
   - Falls back to BFS if needed

2. **Concurrent Processing**
   - Default: 5 parallel requests
   - Prevents server overwhelming
   - Reduces total crawl time
   - Configurable concurrency

3. **Smart Deduplication**
   - URL normalization before checking
   - Removes tracking parameters
   - Prevents duplicate fetches

4. **Depth Limiting**
   - Prevents exponential growth
   - Focuses on important pages
   - Typical depth: 2-3 levels

5. **Timeout Protection**
   - Per-request: 10s default
   - Total crawl: 60s max
   - Prevents hanging requests

6. **AI Rate Limiting**
   - Token bucket algorithm
   - 30 RPM for Groq free tier
   - Sequential processing with automatic pacing

### Scaling Considerations

**Current Limits**:

- Max pages: 200
- Max depth: 5
- Request timeout: 30s
- Total timeout: 60s
- AI: 30 RPM (Groq free tier)

**For Larger Scale**:

- Add Redis for caching crawled results
- Implement job queue (Bull/BullMQ)
- Use worker threads for parsing
- Add rate limiting per IP
- Consider Puppeteer for JS-heavy sites
- Implement batch AI generation with retries

---

## Security Architecture

### SSRF Prevention

**Defense Layers**:

1. URL scheme validation (HTTP/HTTPS only)
2. Hostname blocklist
3. IP range blocklist
4. .local domain blocking

**Blocked Hosts**:

```typescript
- localhost, 127.0.0.1, 0.0.0.0
- ::1 (IPv6 localhost)
- 169.254.169.254 (AWS metadata)
- metadata.google.internal (GCP metadata)
```

**Blocked Networks**:

```typescript
- 10.0.0.0/8 (Private)
- 172.16.0.0/12 (Private)
- 192.168.0.0/16 (Private)
- *.local domains
```

### Input Validation

**Zod Schemas**:

- Runtime type checking
- Constraint enforcement
- Detailed error messages
- Type inference for TypeScript

### Error Handling

**Strategy**:

- Never expose internal errors to users
- Log detailed errors server-side
- Return generic error messages
- Include correlation IDs for debugging

---

## Testing Strategy

### Unit Tests (`tests/unit/`)

**Coverage**:

- URL utilities (normalization, classification)
- Validation schemas (SSRF, limits)
- Generator (formatting, validation)
- Domain services (mocked dependencies)

**Framework**: Vitest

**Example**:

```typescript
describe("DescriptionService", () => {
  it("falls back to heuristic when primary fails", async () => {
    const mockPrimary = {
      generateDescription: vi.fn().mockRejectedValue(new Error("API error")),
      generateBusinessSummary: vi.fn(),
      isAvailable: () => true,
    };

    const mockFallback = {
      generateDescription: vi.fn().mockResolvedValue("fallback desc"),
      generateBusinessSummary: vi.fn(),
      isAvailable: () => true,
    };

    const service = new DescriptionService(mockPrimary, mockFallback);
    const result = await service.generateDescriptions([mockPage]);

    expect(mockFallback.generateDescription).toHaveBeenCalled();
  });
});
```

### Integration Tests (Future)

- API endpoint testing
- Crawler end-to-end tests
- Mock external requests
- Test fallback scenarios

### E2E Tests (Future)

- Playwright for browser testing
- Full user flow testing
- Visual regression testing

---

## Deployment Architecture

### Vercel (Recommended)

```
┌─────────────────┐
│  Vercel Edge    │
│   (CDN/WAF)     │
└────────┬────────┘
         │
┌────────↓────────┐
│  Serverless     │
│  Functions      │
│  (API Routes)   │
└─────────────────┘
```

**Benefits**:

- Auto-scaling
- Global CDN
- Zero-config deployment
- Automatic HTTPS
- Environment variables for API keys

**Environment Variables**:

- `GROQ_API_KEY` - Required for AI descriptions

### Docker (Self-Hosted)

```
┌─────────────────┐
│  Nginx/Caddy    │
│  (Reverse Proxy)│
└────────┬────────┘
         │
┌────────↓────────┐
│  Docker         │
│  Container      │
│  (Node.js)      │
└─────────────────┘
```

---

## Technology Decisions

### Why Next.js?

- Full-stack in one framework
- Excellent TypeScript support
- Built-in API routes
- Easy deployment to Vercel
- Great developer experience

### Why Cheerio over Puppeteer?

- Much faster (no browser overhead)
- Lower memory usage
- Sufficient for static HTML
- Can add Puppeteer later for JS-heavy sites

### Why Zod?

- Runtime validation
- Type inference for TypeScript
- Excellent error messages
- Composable schemas

### Why Vitest?

- Fast (ESM native)
- Compatible with Jest API
- Great DX with UI mode
- Native TypeScript support

### Why Groq?

- **Free tier**: 14,400 requests/day (Llama 3.3 70B)
- **No credit card** required for signup
- **Blazing fast**: ~100 tokens/sec inference speed
- **High quality**: State-of-the-art open-source models (Llama 3.3 70B)
- **Simple API**: Compatible with OpenAI SDK
- **Cost effective**: $0.59/million tokens vs Claude $8-15/million
- **Easy to extend**: Clean architecture allows swapping to other providers

### Why Clean Architecture?

- **Testability**: Easy to test business logic in isolation
- **Flexibility**: Swap infrastructure (Groq → OpenAI) without changing domain
- **Maintainability**: Clear boundaries between layers
- **Scalability**: Easy to add new features
- **Reusability**: Domain logic works with API, CLI, or workers

---

## Monitoring and Observability

### Recommended Tools

**Error Tracking**:

- Sentry for error monitoring
- Track failed crawls
- Monitor API errors
- Alert on rate limit issues

**Analytics**:

- Vercel Analytics (built-in)
- Google Analytics (optional)
- Custom event tracking
- Track generator fallback usage

**Logging**:

- Structured logging with Pino
- Log levels: error, warn, info, debug
- Include correlation IDs
- Track AI API usage

**Metrics to Monitor**:

- Crawl success rate
- Average pages per crawl
- Sitemap vs BFS usage ratio
- AI generation success rate
- Fallback usage frequency
- API response times

---

## Future Enhancements

### Potential Improvements

1. **Caching Layer**
   - Cache generated llms.txt per domain
   - TTL: 24 hours
   - Reduce redundant crawls
   - Redis-backed caching

2. **Queue System**
   - Background job processing
   - Handle larger sites
   - Progress websocket updates
   - Bull/BullMQ integration

3. **Authentication**
   - Optional: Custom headers
   - OAuth for private sites
   - API key for power users
   - Rate limiting per user

4. **Advanced Features**
   - Scheduled regeneration
   - Diff detection
   - Historical versions
   - Batch processing
   - Custom prompts for AI generation

5. **Analytics**
   - Track popular domains
   - Monitor crawl success rates
   - Performance metrics
   - Cost tracking for AI usage

6. **Multi-Provider AI**
   - Support multiple AI providers simultaneously
   - Intelligent load balancing
   - Cost optimization
   - Quality comparison

---

## Conclusion

This architecture balances simplicity with production-readiness through:

- **Clean Architecture**: Clear separation between domain, infrastructure, and API layers
- **Dependency Inversion**: Domain depends on interfaces, infrastructure implements them
- **Secure**: SSRF protection, input validation, rate limiting
- **Performant**: Sitemap-first crawling, concurrent processing, smart caching
- **Reliable**: Automatic fallbacks, timeout protection, error handling
- **Maintainable**: Layered structure, typed APIs, comprehensive tests
- **Extensible**: Easy to add new AI providers, crawling strategies, or features
- **Scalable**: Ready for Redis/queue additions without major refactoring

The modular design allows for easy enhancements while maintaining code quality and testability.
