# llms.txt Generator

> **Live Demo**: [your-app.vercel.app](#) • **Specification**: [llmstxt.org](https://llmstxt.org/)

An automated tool that generates [llms.txt](https://llmstxt.org/) files for any website. Help Large Language Models better understand and interact with your website's content.

## 🎯 What is llms.txt?

llms.txt is a proposed standard for providing structured information about websites to Large Language Models. Similar to `robots.txt` for search engines, `llms.txt` helps AI systems understand your site's structure and key content.

## ✨ Features

- **Automated Crawling**: Intelligently crawls websites using sitemap.xml or BFS traversal
- **Smart Classification**: Automatically categorizes pages (docs, API, guides, blog, etc.)
- **SSRF Protection**: Built-in security to prevent Server-Side Request Forgery attacks
- **Configurable Depth**: Choose between Quick (25 pages) or Thorough (100 pages) crawling
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
git clone https://github.com/yourusername/llm-txt.git
cd llm-txt

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

### Using the Tool

1. **Enter a URL**: Input any public website URL (e.g., `https://nextjs.org`)
2. **Choose preset**: Select "Quick" (25 pages) or "Thorough" (100 pages)
3. **Generate**: Click "Generate llms.txt" and wait for crawling to complete
4. **Review**: Preview the generated file and edit if needed
5. **Download**: Click "Download" or "Copy" to get your llms.txt file

## 📦 Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR-USERNAME/llm-txt)

Or manually:

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Click "Deploy" (zero configuration needed!)

**That's it!** Vercel will automatically:

- Install dependencies
- Run build
- Deploy to production
- Set up auto-deployments on every push

### Docker Deployment

```bash
# Using Docker Compose
docker-compose up -d

# Or using Docker directly
docker build -t llms-txt-generator .
docker run -p 3000:3000 llms-txt-generator
```

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

### POST /api/generate

Generate an llms.txt file for a given URL.

**Request:**

```json
{
  "url": "https://example.com",
  "preset": "quick" // "quick" | "thorough"
}
```

**Response:**

```json
{
  "success": true,
  "content": "# Example Site\n\n> Description...",
  "stats": {
    "pagesFound": 42,
    "url": "https://example.com"
  }
}
```

See [ARCHITECTURE.md](./ARCHITECTURE.md#api-layer) for full API documentation.

## 🏗️ Architecture

**Tech Stack:**

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS v4
- Cheerio for HTML parsing
- Zod for validation
- Vitest for testing

**Key Features:**

- Sitemap-first crawling strategy (10-100x faster)
- BFS fallback for sites without sitemaps
- SSRF protection (blocks localhost, private networks, cloud metadata)
- Queue-based concurrent processing
- Comprehensive test suite (39 unit tests)

📚 See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design, technology decisions, and scaling considerations.

## 🔒 Security

- **SSRF Protection**: Validates all URLs to prevent internal network access
- **Input Validation**: Zod schemas validate all user input
- **Rate Limiting**: Configurable concurrency prevents server overload
- **Timeout Protection**: All requests have timeouts to prevent hanging
- **No Stored Data**: No user data or generated content is stored

## 📝 Project Structure

```
llm-txt/
├── app/
│   ├── api/generate/       # API endpoint
│   └── page.tsx            # Main UI
├── components/             # React components
├── lib/
│   ├── crawler/            # Crawling engine
│   ├── parser/             # HTML/sitemap parsing
│   ├── generator/          # llms.txt generation
│   ├── validation/         # Input validation + SSRF
│   └── utils/              # Utilities
├── tests/unit/             # Test suite
└── types/                  # TypeScript definitions
```

## 📸 Screenshots & Demo

> 🚧 TODO Screenshots and demo video will be added after deployment

## 🔗 Resources

- [llms.txt Specification](https://llmstxt.org/)
- [llms.txt Examples](https://llmstxt.site/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Architecture Documentation](./ARCHITECTURE.md)

## 📄 License

This project is licensed under the MIT License.
