# llms.txt Generator

An automated tool that generates [llms.txt](https://llmstxt.org/) files for any website. Help Large Language Models better understand and interact with your website's content.

## 🎯 What is llms.txt?

llms.txt is a proposed standard for providing structured information about websites to Large Language Models. Similar to `robots.txt` for search engines, `llms.txt` helps AI systems understand your site's structure and key content, improving their ability to provide accurate information about your site.

## ✨ Features

- **Automated Crawling**: Intelligently crawls websites using sitemap.xml or BFS traversal
- **Smart Classification**: Automatically categorizes pages (docs, API, guides, blog, etc.)
- **SSRF Protection**: Built-in security to prevent Server-Side Request Forgery attacks
- **Configurable Depth**: Choose between Quick (25 pages) or Thorough (100 pages) crawling
- **Real-time Preview**: Edit the generated llms.txt before downloading
- **Copy & Download**: Easy export options for immediate use
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS v4
- **Crawling**: Cheerio for HTML parsing, native Fetch API
- **Validation**: Zod for runtime type safety
- **Testing**: Vitest for unit tests
- **Code Quality**: ESLint, Prettier, Husky pre-commit hooks

### Project Structure

```
llm-txt/
├── app/
│   ├── api/generate/      # API endpoint for crawling and generation
│   ├── layout.tsx          # Root layout with metadata
│   └── page.tsx            # Main application page
├── components/
│   ├── url-input.tsx       # URL input form with presets
│   ├── loading-state.tsx   # Loading indicator
│   └── result-preview.tsx  # Preview with edit/copy/download
├── lib/
│   ├── crawler/            # Website crawling logic
│   ├── parser/             # HTML and sitemap parsing
│   │   ├── html.ts         # Metadata extraction
│   │   └── sitemap.ts      # Sitemap.xml parsing
│   ├── generator/          # llms.txt generation
│   ├── validation/         # Zod schemas with SSRF protection
│   └── utils/              # URL utilities
├── tests/
│   ├── unit/               # Unit tests for core functions
│   └── integration/        # Integration tests
└── types/                  # TypeScript type definitions
```

### Key Design Decisions

1. **Sitemap-First Approach**: We prioritize parsing sitemap.xml when available, as it typically contains the most important pages and is much faster than crawling.

2. **BFS Traversal**: When crawling is needed, we use Breadth-First Search to discover pages at each depth level systematically.

3. **SSRF Protection**: All URLs are validated to prevent requests to:
   - localhost/127.0.0.1
   - Private networks (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
   - Cloud metadata endpoints (169.254.169.254)
   - .local domains

4. **Rate Limiting**: Configurable concurrency (default: 5) prevents overwhelming target servers.

5. **Page Classification**: URLs are automatically classified by pattern matching (e.g., `/docs/*` → documentation).

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/llm-txt.git
cd llm-txt
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

No environment variables are required for basic functionality. The application works out of the box.

## 🧪 Testing

### Run All Tests

```bash
npm run test
```

### Run Tests in Watch Mode

```bash
npm run test:ui
```

### Generate Coverage Report

```bash
npm run test:coverage
```

### Type Checking

```bash
npm run type-check
```

## 🎨 Code Quality

### Linting

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

### Formatting

```bash
npm run format        # Format all files
npm run format:check  # Check formatting
```

### Pre-commit Hooks

Husky is configured to run checks before each commit:

- ESLint
- Prettier format check
- TypeScript type checking

## 📦 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub

2. Import your repository on [Vercel](https://vercel.com):
   - Connect your GitHub account
   - Select the repository
   - Click "Deploy"

3. Vercel will automatically:
   - Install dependencies
   - Run build
   - Deploy to a production URL

### Deploy to Other Platforms

The app is a standard Next.js application and can be deployed to:

- Netlify
- Railway
- Render
- AWS Amplify
- Self-hosted with Docker

#### Docker Deployment

**Using Docker Compose (Recommended):**

```bash
docker-compose up -d
```

**Using Docker directly:**

```bash
# Build image
docker build -t llms-txt-generator .

# Run container
docker run -p 3000:3000 llms-txt-generator
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 📖 API Documentation

### POST /api/generate

Generate an llms.txt file for a given URL.

**Request Body:**

```json
{
  "url": "https://example.com",
  "preset": "quick", // "quick" | "thorough" | "custom" (optional)
  "maxPages": 50, // optional, overrides preset
  "maxDepth": 3, // optional, overrides preset
  "timeout": 10000, // optional, ms per request
  "concurrency": 5 // optional, parallel requests
}
```

**Response (Success):**

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

**Response (Error):**

```json
{
  "error": "Failed to generate llms.txt",
  "details": "Error message here"
}
```

## 🔒 Security

- **SSRF Protection**: Validates all URLs to prevent internal network access
- **Rate Limiting**: Prevents server overload with configurable concurrency
- **Timeout Protection**: All requests have timeouts to prevent hanging
- **Input Validation**: Zod schemas validate all user input
- **No Stored Data**: No user data or generated content is stored on the server

## 🧩 How It Works

1. **URL Input**: User enters a website URL
2. **Discovery**: System attempts to find sitemap.xml
3. **Crawling**:
   - If sitemap exists: Parse and extract URLs
   - If no sitemap: BFS crawl from homepage
4. **Metadata Extraction**: Extract title, description, and links from each page
5. **Classification**: Categorize pages by URL patterns
6. **Generation**: Build llms.txt structure following the specification
7. **Output**: Display preview with edit/copy/download options

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🔗 Resources

- [llms.txt Specification](https://llmstxt.org/)
- [llms.txt Examples](https://llmstxt.site/)
- [Next.js Documentation](https://nextjs.org/docs)

## 📸 Screenshots

_TODO: Add screenshots after deployment_

## 🙏 Acknowledgments

- [llmstxt.org](https://llmstxt.org) for the specification
- Next.js team for the amazing framework
- Vercel for hosting platform
