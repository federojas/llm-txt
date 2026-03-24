# Structured Logging Implementation

Production-grade logging system with structured JSON output, correlation IDs for distributed tracing, and optional Axiom integration for long-term log retention and analytics.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Request                               │
│                             ↓                                     │
│  createRequestLogger() → Generates correlation ID                │
│                             ↓                                     │
│  API Route Handler → Logs request lifecycle with correlationId   │
│                             ↓                                     │
│  Inngest Event → Passes correlationId to background job          │
│                             ↓                                     │
│  Background Job → Logs with same correlationId                   │
│                             ↓                                     │
│  Crawler/Generator → Logs operations with correlationId          │
│                             ↓                                     │
│  Pino → Structured JSON logs                                     │
│         ├─→ stdout (Vercel logs)                                 │
│         └─→ Axiom (optional, long-term retention)                │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Logger Service (`src/lib/logger/index.ts`)

- **Pino-based**: Fast, structured JSON logging
- **Environment-aware**: Pretty printing for development, JSON for production
- **Axiom integration**: Optional log aggregation (500GB/month free tier)
- **Log levels**: debug, info, warn, error

### 2. Logging Middleware (`src/lib/api/middleware/logger.ts`)

- **Correlation IDs**: Automatic generation and propagation
- **Request lifecycle**: Start, completion, and error logging
- **Context enrichment**: Method, path, status, duration

### 3. Integration Points

- **API Routes**: `POST /api/v1/llms-txt` - Creates correlation ID, passes to Inngest
- **Inngest Jobs**: `processCrawl` - Receives correlation ID, logs job lifecycle
- **Crawler**: Logs crawl operations (sitemap discovery, page fetching, robots.txt)
- **Generator**: Logs generation mode, AI API calls, content generation

## Configuration

### Environment Variables

Add to `.env` (see `.env.example`):

```bash
# Optional - Axiom log aggregation (Production only)
AXIOM_API_KEY=xaat-your-api-key
AXIOM_DATASET=llms-txt-logs

# Optional - Log level override
LOG_LEVEL=debug  # Options: debug, info, warn, error
```

### Vercel Deployment

1. Go to Vercel dashboard → Project → Settings → Environment Variables
2. Add `AXIOM_API_KEY` and `AXIOM_DATASET` (production only)
3. Deploy - logs will appear in both:
   - Vercel dashboard (real-time)
   - Axiom dashboard (long-term, searchable)

## Usage

### Basic Logging

```typescript
import { getLogger } from "@/lib/logger";

const logger = getLogger();
logger.info("Simple log message");
logger.error({ error: err.message }, "Operation failed");
```

### Logger with Context

```typescript
import { createLogger } from "@/lib/logger";

const logger = createLogger({
  correlationId: "123-abc",
  jobId: "job_456",
  url: "https://example.com",
});

logger.info({
  event: "crawler.start",
  maxPages: 100,
  message: "Starting crawl",
});
```

### API Route Logging

```typescript
import { createRequestLogger } from "@/lib/api/middleware/logger";

export async function POST(request: NextRequest) {
  const { logger, correlationId } = createRequestLogger(request);

  logger.info({ event: "api.job.create", url: requestData.url });

  // Pass correlationId to Inngest for distributed tracing
  await inngest.send({
    name: CRAWL_REQUESTED,
    data: { jobId, correlationId, ...requestData },
  });

  // Return correlation ID in response headers
  response.headers.set("x-correlation-id", correlationId);
  return response;
}
```

### Inngest Job Logging

```typescript
import { createLogger } from "@/lib/logger";

export const processCrawl = inngest.createFunction(
  { id: "process-crawl" },
  async ({ event }) => {
    const { jobId, url, correlationId } = event.data;

    // Use correlation ID from API for distributed tracing
    const logger = createLogger({ jobId, url, correlationId });

    logger.info({ event: "inngest.job.start", jobId, url });

    try {
      const result = await generateLlmsTxtUseCase.execute(requestData);
      logger.info({
        event: "inngest.job.complete",
        jobId,
        pagesFound: result.stats.pagesFound,
      });
    } catch (error) {
      logger.error({
        event: "inngest.job.failed",
        jobId,
        error: error.message,
      });
      throw error;
    }
  }
);
```

## Log Events

### Naming Convention

`<service>.<operation>.<status>`

Examples:

- `api.job.create` - API creates job
- `inngest.job.start` - Inngest starts processing
- `crawler.fetch.success` - Page fetched successfully
- `generate.mode` - Generation mode selected

### Standard Fields

```typescript
{
  level: "info",              // Log level (debug, info, warn, error)
  time: "2024-03-24T10:30:00.000Z",  // ISO timestamp
  event: "crawler.fetch.success",     // Event identifier
  correlationId: "123-abc",   // Request/job correlation ID
  jobId: "job_456",          // Inngest job ID (if applicable)
  url: "https://example.com", // URL being processed
  duration: 1234,            // Operation duration (ms)
  message: "Human-readable message",
  // ... additional context fields
}
```

## Correlation ID Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Client Request                                            │
│    ↓                                                         │
│ 2. API generates correlation ID: "1234567890-abc123"        │
│    ↓                                                         │
│ 3. API logs: { correlationId: "...", event: "api.job.create" } │
│    ↓                                                         │
│ 4. Inngest receives correlationId in event.data             │
│    ↓                                                         │
│ 5. Inngest logs: { correlationId: "...", event: "inngest.job.start" } │
│    ↓                                                         │
│ 6. Crawler inherits correlationId                           │
│    ↓                                                         │
│ 7. All operations logged with same correlationId            │
│    ↓                                                         │
│ 8. Response includes correlationId in x-correlation-id header │
└─────────────────────────────────────────────────────────────┘
```

**Benefit**: Trace entire request flow (API → Inngest → Crawler → Generator) using single correlation ID.

## Querying Logs

### Vercel Dashboard

- Real-time logs for debugging
- Limited retention (30 days)
- Basic text search

### Axiom Dashboard

- Long-term retention (30+ days)
- Advanced search and filtering
- APL (Axiom Processing Language) queries

Example Axiom queries:

```apl
// All logs for a specific job
['llms-txt-logs']
| where jobId == "job_123"
| order by _time desc

// Failed crawl operations
['llms-txt-logs']
| where event startswith "crawler." and level == "error"
| summarize count() by url

// Average crawl duration
['llms-txt-logs']
| where event == "inngest.crawl.complete"
| summarize avg(duration), p95(duration), p99(duration)

// Trace entire request by correlation ID
['llms-txt-logs']
| where correlationId == "1234567890-abc123"
| order by _time asc
| project _time, event, message, duration
```

## Performance Impact

- **Development**: ~50-100 µs per log (pretty printing overhead)
- **Production**: ~10-20 µs per log (JSON serialization)
- **Axiom ingestion**: Asynchronous, fire-and-forget (no blocking)

## Best Practices

1. **Use structured fields**: `logger.info({ event, url, duration })` not `logger.info("Event: " + event)`
2. **Include correlation IDs**: Always pass correlationId across service boundaries
3. **Log at boundaries**: API entry/exit, job start/end, external API calls
4. **Avoid PII**: Don't log sensitive data (API keys, passwords, user emails)
5. **Use appropriate levels**:
   - `debug`: Verbose operational details (development only)
   - `info`: Important business events (job created, crawl complete)
   - `warn`: Recoverable errors (rate limit, 403 response)
   - `error`: Unrecoverable errors (job failed, database error)

## Migration from console.log

**Before**:

```typescript
console.log(`[Crawler] Found ${pages.length} pages`);
```

**After**:

```typescript
logger.info({
  event: "crawler.pages.found",
  pageCount: pages.length,
  message: "Crawl complete",
});
```

## Troubleshooting

### Logs not appearing in Axiom

1. Check environment variables: `AXIOM_API_KEY` and `AXIOM_DATASET` set in Vercel
2. Verify API key permissions in Axiom dashboard
3. Check Axiom quotas (500GB/month free tier)

### Logs not appearing in Vercel

- Logs always appear in Vercel dashboard (stdout)
- Check Functions → Logs tab
- Verify deployment succeeded

### Correlation IDs not linking

- Ensure correlationId passed from API → Inngest event data
- Check Inngest function receives correlationId parameter
- Verify logger created with correlationId context

## Future Enhancements

- [ ] Distributed tracing with OpenTelemetry
- [ ] Error aggregation (Sentry integration)
- [ ] Custom metrics (request duration, error rates)
- [ ] Log sampling for high-traffic endpoints
- [ ] Structured error types with error codes
