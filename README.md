# llms.txt Generator

> **Live Demo**: [llm-txt-nine.vercel.app](https://llm-txt-nine.vercel.app/) • **Specification**: [llmstxt.org](https://llmstxt.org/)

An automated tool that generates [llms.txt](https://llmstxt.org/) files for any website. Help Large Language Models better understand and interact with your website's content.

## 🎯 What is llms.txt?

llms.txt is a proposed standard for providing structured information about websites to Large Language Models. Similar to `robots.txt` for search engines, `llms.txt` helps AI systems understand your site's structure and key content.

## ✨ Features

- **Async Job Processing**: Non-blocking API with PostgreSQL persistence and background workers
- **Real-time Status Updates**: Poll-based status tracking with job progress visibility
- **AI-Powered Content Generation**: Uses Groq (Llama 3.3 70B) to generate descriptions, discover sections, and clean titles
- **Automated Crawling**: Intelligently crawls websites using sitemap.xml or BFS traversal
- **Smart Section Discovery**: AI-powered categorization of pages into logical sections
- **Language Filtering**: Detects and prefers English content, skips language variants
- **SSRF Protection**: Built-in security to prevent Server-Side Request Forgery attacks
- **Configurable Depth**: Choose between Quick (50 pages) or Thorough (150 pages) crawling
- **Real-time Preview**: Edit the generated llms.txt before downloading
- **Copy & Download**: Easy export options for immediate use
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- PostgreSQL 14+ (local or cloud instance)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/federojas/llms-txt.git
cd llms-txt

# Configure environment variables
cp .env.example .env
# Edit .env and set: GROQ_API_KEY=your_groq_key_here
# Get free API key from: https://console.groq.com/keys

# Start everything with Docker Compose
docker-compose up -d

# Access the application:
# - Next.js App:     http://localhost:3000
# - Inngest UI:      http://localhost:8288
# - PostgreSQL:      localhost:5432

# View logs:
docker-compose logs -f

# Stop everything:
docker-compose down
```

### Using the Tool

1. **Enter a URL**: Input any public website URL (e.g., `https://nextjs.org`)
2. **Choose language**: Select "Prefer English" or "Page language"
3. **Generate**: Click "Generate llms.txt" and wait for crawling to complete (~60-90s)
4. **Review**: Preview the generated file and edit if needed
5. **Download**: Click "Download" or "Copy" to get your llms.txt file

**Default Configuration:**

- Crawls up to 50 pages (optimal balance of coverage and speed)
- Depth of 3 levels (captures main sections)
- Typical completion time: 60-90 seconds

## 🌐 Access URLs

**Local Development:**

- Frontend: http://localhost:3000
- Inngest UI: http://localhost:8288
- PostgreSQL: localhost:5432

**Production:**

- Live app: https://llm-txt-nine.vercel.app/
- Preview deployments: `https://llm-txt-[branch]-[user].vercel.app/`

## 📦 Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/federojas/llms-txt)

**Environment Setup:**

- **Preview**: Isolated Neon database branches for feature testing (safe to test migrations)
- **Production**: Main Neon database branch with production data

**Required Environment Variables:**

- `GROQ_API_KEY` - Get from https://console.groq.com/keys
- `INNGEST_EVENT_KEY` - Get from https://www.inngest.com/ dashboard
- `INNGEST_SIGNING_KEY` - Get from https://www.inngest.com/ dashboard
- `DATABASE_URL` - Auto-set by Neon integration
- `UPSTASH_REDIS_REST_URL` - Upstash Redis URL (see setup below)
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token (see setup below)

**Upstash Redis Setup (Rate Limiting):**

Rate limiting is required for production to prevent API abuse:

1. Sign up at https://console.upstash.com/ (free tier: 10K requests/day)
2. Create Redis database (choose region closest to Vercel deployment)
3. Copy REST URL and Token to Vercel environment variables
4. Default limits: 5 jobs/min per IP, 30 polls/min per IP
5. Tune limits based on your LLM API tier and infrastructure capacity

Without Redis, rate limiting is disabled (development only).

**GitHub Secrets (CI/CD):**

Configure these secrets in **Settings → Secrets and variables → Actions**:

- `GROQ_API_KEY` - Get from https://console.groq.com/keys
- `INNGEST_EVENT_KEY` - Get from https://www.inngest.com/ dashboard (required for E2E tests)
- `INNGEST_SIGNING_KEY` - Get from https://www.inngest.com/ dashboard (required for E2E tests)

## 🤖 AI-Powered Descriptions

The generator uses [Groq](https://groq.com) with Llama 3.3 70B to create high-quality page descriptions:

**Features:**

- Generates concise 15-word summaries for each page
- Creates 2-3 sentence business summaries for homepages
- Batch processes pages with rate limiting (5 parallel, 100ms delay)
- Falls back to heuristic descriptions without API key (for development/testing)

**Why Groq?**

- **Free tier**: 14,400 requests/day (Llama 3.3 70B)
- **Blazing fast**: ~100 tokens/sec inference speed
- **No credit card**: Free signup at [console.groq.com](https://console.groq.com)
- **High quality**: State-of-the-art open-source models
- **Cost effective**: $0.59/million tokens vs Claude $8-15/million

## 🧪 Testing & Development

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests (fast, ~10s)
npm run test:integration

# Run AI integration tests (slow, 5-10 minutes, not in CI)
npm run test:integration:ai

# Run E2E tests
npm run test:e2e

# Run tests with UI
npm run test:ui

# Type check
npm run type-check

# Lint code
npm run lint
```

**Test Suites:**

- **Unit Tests** (214 tests, ~2s): Fast, isolated tests for business logic
- **Integration Tests** (15 tests, ~10s): Database operations, job lifecycle
- **AI Integration Tests** (3 tests, 5-10min): Real Groq API calls with live sites (run separately, not in CI)
- **E2E Tests** (15 tests, ~26s): Critical user flows through real API

## 📖 API Documentation

### Async Job Pattern

The API uses an asynchronous job pattern with PostgreSQL persistence and background processing:

1. **Create Job** - POST returns immediately with job ID (202 Accepted)
2. **Poll Status** - Client polls with exponential backoff (5s → 10s → 15s)
3. **Get Result** - Job completes with content or error

**Polling Strategy (Exponential Backoff):**

- **First 30s**: Poll every 5 seconds (6 attempts)
- **Next 2min**: Poll every 10 seconds (12 attempts)
- **After 2.5min**: Poll every 15 seconds
- **Timeout**: 5 minutes (28 attempts) - prevents infinite polling if job hangs
- Industry standard for 60-90s jobs: balances responsiveness with efficiency

### POST /api/v1/llms-txt

Create a new crawl job.

**Request:**

```json
{
  "url": "https://example.com",
  "languageStrategy": "prefer-english" // optional: "prefer-english" | "page-language"
}
```

**Default Configuration:**

- `maxPages`: 50 (optimal for 60-90s execution)
- `maxDepth`: 3 (captures main sections)

**Response (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "jobId": "clx1234567890",
    "status": "pending",
    "statusUrl": "/api/v1/jobs/clx1234567890"
  }
}
```

### GET /api/v1/jobs/:id

Poll job status and retrieve results.

**Response (Processing):**

```json
{
  "success": true,
  "data": {
    "id": "clx1234567890",
    "status": "processing",
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

**Response (Completed):**

```json
{
  "success": true,
  "data": {
    "id": "clx1234567890",
    "status": "completed",
    "result": {
      "content": "# Example Site\n\n> Description...",
      "stats": {
        "pagesFound": 42,
        "url": "https://example.com"
      }
    },
    "createdAt": "2024-01-01T12:00:00Z",
    "completedAt": "2024-01-01T12:01:30Z"
  }
}
```

**Response (Failed):**

```json
{
  "success": true,
  "data": {
    "id": "clx1234567890",
    "status": "failed",
    "error": "Could not crawl any pages from the provided URL",
    "createdAt": "2024-01-01T12:00:00Z",
    "completedAt": "2024-01-01T12:00:15Z"
  }
}
```

See [ARCHITECTURE.md](./ARCHITECTURE.md#api-documentation) for full API documentation.

## 🏗️ Architecture

**Tech Stack:**

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- PostgreSQL + Prisma ORM (job persistence)
- Inngest (background job processing)
- Groq (Llama 3.3 70B) for AI descriptions
- Cheerio for HTML parsing
- Zod for validation
- Vitest for testing

**Architecture Highlights:**

- **Async job processing** - Non-blocking API with PostgreSQL persistence and Inngest workers
- **Scalable by design** - Handles long-running crawls (60+ seconds) without blocking requests
- **Step-based execution** - Checkpointed job steps with automatic retries (3 attempts)
- **Exponential backoff polling** - Client polls with increasing intervals (5s → 10s → 15s) optimized for 60-90s jobs
- **Feature-based organization** - Clean, flat structure following Next.js conventions
- **AI-first with fallbacks** - Groq (Llama 3.3 70B) with automatic heuristic fallback using Chain of Responsibility pattern
- **Sitemap-first crawling** - 10-100x faster than full site traversal
- **BFS fallback** - For sites without sitemaps
- **SSRF protection** - Blocks localhost, private networks, cloud metadata endpoints
- **Concurrent processing** - Queue-based crawling with configurable concurrency
- **Comprehensive testing** - Unit tests covering core functionality

📚 See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design, architecture decisions, and technical deep-dive.

## 🔒 Security

- **SSRF Protection**: Validates all URLs to prevent internal network access
- **Input Validation**: Zod schemas validate all user input
- **Rate Limiting**: Configurable concurrency prevents server overload
- **Timeout Protection**: All requests have timeouts to prevent hanging
- **No Stored Data**: No user data or generated content is stored

## 📝 Project Structure

```
llms-txt/
├── prisma/
│   └── schema.prisma           # Database schema (jobs, status)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── llms-txt/   # Create job endpoint
│   │   │   │   └── jobs/[id]/  # Poll job status endpoint
│   │   │   └── inngest/        # Inngest webhook handler
│   │   └── page.tsx            # Main UI with polling
│   ├── inngest/
│   │   ├── client.ts           # Inngest client
│   │   └── functions.ts        # Background job processor
│   ├── components/             # React components
│   ├── lib/
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── llms-txt/           # Main feature (generate, format, validate)
│   │   ├── ai-enhancement/     # AI + fallback strategies
│   │   ├── crawling/           # Web crawling engine
│   │   ├── http/               # HTTP client, sitemap, robots.txt
│   │   ├── url/                # URL utilities
│   │   ├── api/                # API layer (errors, DTOs, validation, SSRF)
│   │   ├── types/              # TypeScript types
│   │   └── config/             # Configuration
│   └── tests/unit/             # Test suite
└── ARCHITECTURE.md             # Detailed architecture documentation
```

## 📸 Demo

TODO ADD DEMO VIDEO / SCREENSHOTS

Try it live at [llm-txt-nine.vercel.app](https://llm-txt-nine.vercel.app/)

**Demo workflow:**

1. Enter a URL (e.g., `https://youtube.com` or `https://www.fastht.ml/`)
2. Select preset (Quick for 50 pages, Thorough for 150 pages)
3. Click "Generate llms.txt"
4. Wait for crawling to complete (~30-90 seconds)
5. Review the generated file
6. Copy to clipboard or download

## 🔗 Resources

- [llms.txt Specification](https://llmstxt.org/)
- [llms.txt Examples](https://llmstxt.site/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Architecture Documentation](./ARCHITECTURE.md)

## 📄 License

This project is licensed under the MIT License.
