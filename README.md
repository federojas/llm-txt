# llms.txt Generator

> **Live Demo**: [llm-txt-nine.vercel.app](https://llm-txt-nine.vercel.app/) • **Specification**: [llmstxt.org](https://llmstxt.org/)

An automated tool that generates [llms.txt](https://llmstxt.org/) files for any website. Help Large Language Models better understand and interact with your website's content.

## 🎯 What is llms.txt?

llms.txt is a proposed standard for providing structured information about websites to Large Language Models. Similar to `robots.txt` for search engines, `llms.txt` helps AI systems understand your site's structure and key content.

## ✨ Features

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

### Local Setup

```bash
# Clone the repository
git clone https://github.com/federojas/llms-txt.git
cd llm-txt

# Install dependencies
npm install

# Get your Groq API key (required for AI descriptions)
# 1. Sign up at https://console.groq.com (free, no credit card required)
# 2. Get your API key from https://console.groq.com/keys
# 3. Configure environment variables:
cp .env.example .env
# Edit .env and add: GROQ_API_KEY=your_key_here

# Run development server
npm run dev

# Open http://localhost:3000 (or visit https://llm-txt-nine.vercel.app/)
```

### Using the Tool

1. **Enter a URL**: Input any public website URL (e.g., `https://nextjs.org`)
2. **Choose preset**: Select "Quick" (50 pages) or "Thorough" (150 pages)
3. **Generate**: Click "Generate llms.txt" and wait for crawling to complete
4. **Review**: Preview the generated file and edit if needed
5. **Download**: Click "Download" or "Copy" to get your llms.txt file

## 📦 Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/federojas/llms-txt)

Or manually:

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. **Add environment variable**: `GROQ_API_KEY` (get it from [console.groq.com/keys](https://console.groq.com/keys))
5. Click "Deploy"

**That's it!** Vercel will automatically:

- Install dependencies
- Run build
- Deploy to production
- Set up auto-deployments on every push

### Docker Deployment

```bash
# Set your Groq API key
export GROQ_API_KEY=your_key_here

# Using Docker Compose
docker-compose up -d

# Or using Docker directly
docker build -t llms-txt-generator .
docker run -p 3000:3000 -e GROQ_API_KEY=$GROQ_API_KEY llms-txt-generator
```

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

# Run tests with UI
npm run test:ui

# Type check
npm run type-check

# Lint code
npm run lint
```

## 📖 API Documentation

### POST /api/v1/llms-txt

Generate an llms.txt file for a given URL.

**Request:**

```json
{
  "url": "https://example.com",
  "preset": "quick" // "quick" | "thorough" | "custom"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "content": "# Example Site\n\n> Description...",
    "stats": {
      "pagesFound": 42,
      "url": "https://example.com"
    }
  }
}
```

See [ARCHITECTURE.md](./ARCHITECTURE.md#api-documentation) for full API documentation.

## 🏗️ Architecture

**Tech Stack:**

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS v4
- Groq (Llama 3.3 70B) for AI descriptions
- Cheerio for HTML parsing
- Zod for validation
- Vitest for testing

**Architecture Highlights:**

- **Feature-based organization** - Clean, flat structure following Next.js conventions
- **AI-first with fallbacks** - Groq (Llama 3.3 70B) with automatic heuristic fallback using Chain of Responsibility pattern
- **Sitemap-first crawling** - 10-100x faster than full site traversal
- **BFS fallback** - For sites without sitemaps
- **SSRF protection** - Blocks localhost, private networks, cloud metadata endpoints
- **Concurrent processing** - Queue-based crawling with configurable concurrency
- **Comprehensive testing** - 98 unit tests covering core functionality

📚 See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design, architecture decisions, and technical deep-dive.

## 🔒 Security

- **SSRF Protection**: Validates all URLs to prevent internal network access
- **Input Validation**: Zod schemas validate all user input
- **Rate Limiting**: Configurable concurrency prevents server overload
- **Timeout Protection**: All requests have timeouts to prevent hanging
- **No Stored Data**: No user data or generated content is stored

## 📝 Project Structure

```
llm-txt/
├── src/
│   ├── app/
│   │   ├── api/v1/llms-txt/    # API endpoint
│   │   └── page.tsx            # Main UI
│   ├── components/             # React components
│   ├── lib/
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
