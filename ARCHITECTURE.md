# Architecture Documentation

## System Overview

The llms.txt Generator is a full-stack Next.js application that crawls websites and generates llms.txt files following the official specification. The system is designed with production-grade concerns including security, performance, and reliability.

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
│   │   Crawler   │───┼──→ External Websites
│   │   Engine    │   │
│   └──────┬──────┘   │
│          │          │
│   ┌──────↓──────┐   │
│   │  Generator  │   │
│   └─────────────┘   │
└─────────────────────┘
```

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
3. Build crawler configuration
4. Execute crawl
5. Generate llms.txt
6. Return formatted response
```

### 3. Crawler Engine

**Location**: `lib/crawler/index.ts`

**Design**: Queue-based BFS (Breadth-First Search) crawler

**Key Features**:

- Sitemap-first strategy (fast path)
- Fallback to BFS crawling
- Concurrent request handling
- Visited URL tracking
- Depth limiting
- Timeout protection

**Crawl Strategy**:

```typescript
1. Try to find and parse sitemap.xml
   ├─ If found → Extract URLs (priority-sorted)
   └─ If not found → Start BFS from homepage

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

**Location**: `lib/parser/`

**Components**:

- `html.ts`: Extracts metadata from HTML
- `sitemap.ts`: Parses sitemap.xml files

**Metadata Extraction**:

```typescript
Sources (in priority order):
1. <title> tag
2. <meta property="og:title">
3. <h1> tag
4. Fallback: "Untitled"

Description:
1. <meta name="description">
2. <meta property="og:description">
3. None
```

### 5. Generator

**Location**: `lib/generator/index.ts`

**Responsibilities**:

- Classify pages by URL patterns
- Group pages into sections
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

### 6. Validation Layer

**Location**: `lib/validation/schemas.ts`

**Security Features**:

**SSRF Protection**:

```typescript
Blocked Hosts:
- localhost, 127.0.0.1, 0.0.0.0
- ::1 (IPv6 localhost)
- 169.254.169.254 (AWS metadata)
- metadata.google.internal (GCP metadata)

Blocked Networks:
- 10.0.0.0/8 (Private)
- 172.16.0.0/12 (Private)
- 192.168.0.0/16 (Private)
- *.local domains
```

**Input Validation**:

- URL format validation
- Numeric range checking
- Type safety with TypeScript + Zod

### 7. Utility Layer

**Location**: `lib/utils/`

**Key Functions**:

**URL Utilities** (`url.ts`):

- `normalizeUrl()`: Remove tracking params, sort query strings
- `isInternalUrl()`: Check if URL is same domain
- `toAbsoluteUrl()`: Convert relative to absolute URLs
- `getUrlDepth()`: Calculate link depth from base
- `classifyUrl()`: Categorize by URL pattern

## Data Flow

### Complete Request Flow

```
1. User Input
   └─→ URL + Options

2. Frontend Validation
   └─→ Basic URL format check

3. API Request
   └─→ POST /api/generate

4. Backend Validation
   ├─→ Zod schema validation
   └─→ SSRF protection check

5. Crawler Initialization
   ├─→ Build config with presets
   └─→ Create Crawler instance

6. Sitemap Discovery
   ├─→ Try /sitemap.xml
   ├─→ Try /sitemap_index.xml
   └─→ Parse robots.txt for sitemap

7. Crawling Phase
   ├─→ If sitemap: Extract URLs
   │   └─→ Sort by priority
   └─→ If no sitemap: BFS from homepage

8. Page Processing (per URL)
   ├─→ Fetch HTML
   ├─→ Check robots meta tag
   ├─→ Extract metadata
   │   ├─→ Title
   │   ├─→ Description
   │   └─→ Internal links
   └─→ Add links to queue

9. Generation Phase
   ├─→ Classify all pages
   ├─→ Group by section
   ├─→ Sort by depth and title
   └─→ Format as Markdown

10. Response
    └─→ Return llms.txt content + stats

11. Client Display
    ├─→ Show preview
    ├─→ Enable editing
    └─→ Provide download/copy
```

## Performance Considerations

### Optimization Strategies

1. **Sitemap-First Approach**
   - 10-100x faster than crawling
   - Avoids redundant requests
   - Gets high-priority pages first

2. **Concurrent Processing**
   - Default: 5 parallel requests
   - Prevents server overwhelming
   - Reduces total crawl time

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

### Scaling Considerations

**Current Limits**:

- Max pages: 200
- Max depth: 5
- Request timeout: 30s
- Total timeout: 60s

**For Larger Scale**:

- Add Redis for caching crawled results
- Implement job queue (Bull/BullMQ)
- Use worker threads for parsing
- Add rate limiting per IP
- Consider Puppeteer for JS-heavy sites

## Security Architecture

### SSRF Prevention

**Defense Layers**:

1. URL scheme validation (HTTP/HTTPS only)
2. Hostname blocklist
3. IP range blocklist
4. .local domain blocking

### Input Validation

**Zod Schemas**:

- Runtime type checking
- Constraint enforcement
- Detailed error messages

### Error Handling

**Strategy**:

- Never expose internal errors to users
- Log detailed errors server-side
- Return generic error messages
- Include correlation IDs for debugging

## Testing Strategy

### Unit Tests (`tests/unit/`)

**Coverage**:

- URL utilities (normalization, classification)
- Validation schemas (SSRF, limits)
- Generator (formatting, validation)

**Framework**: Vitest

### Integration Tests

**Future Implementation**:

- API endpoint testing
- Crawler end-to-end tests
- Mock external requests

### E2E Tests

**Future Implementation**:

- Playwright for browser testing
- Full user flow testing
- Visual regression testing

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

## Future Enhancements

### Potential Improvements

1. **Caching Layer**
   - Cache generated llms.txt per domain
   - TTL: 24 hours
   - Reduce redundant crawls

2. **Queue System**
   - Background job processing
   - Handle larger sites
   - Progress websocket updates

3. **Authentication**
   - Optional: Custom headers
   - OAuth for private sites
   - API key for power users

4. **Advanced Features**
   - Scheduled regeneration
   - Diff detection
   - Historical versions
   - Batch processing

5. **Analytics**
   - Track popular domains
   - Monitor crawl success rates
   - Performance metrics

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

## Monitoring and Observability

### Recommended Tools

**Error Tracking**:

- Sentry for error monitoring
- Track failed crawls
- Monitor API errors

**Analytics**:

- Vercel Analytics (built-in)
- Google Analytics (optional)
- Custom event tracking

**Logging**:

- Structured logging with Pino
- Log levels: error, warn, info, debug
- Include correlation IDs

## Conclusion

This architecture balances simplicity with production-readiness. The system is designed to be:

- **Secure**: SSRF protection, input validation
- **Performant**: Concurrent processing, smart caching
- **Reliable**: Timeout protection, error handling
- **Maintainable**: Clear separation of concerns, typed APIs
- **Scalable**: Ready for Redis/queue additions

The modular design allows for easy enhancements without major refactoring.
