/**
 * Shared context about llms.txt format and purpose
 *
 * Based on the official llms.txt specification (https://llmstxt.org/)
 * Used by all AI providers to understand output requirements and content priorities.
 *
 * Domain-agnostic: Works for any website (software, e-commerce, education, government, etc.)
 * This ensures consistent behavior across different AI adapters (Groq, OpenAI, Claude, etc.)
 */

/**
 * Core purpose and format of llms.txt
 * Source: https://llmstxt.org/
 */
export const LLMS_TXT_PURPOSE = `
llms.txt is a proposed standard for providing LLM-friendly content on websites.

Purpose: Help LLMs navigate websites efficiently given limited context windows.
The file provides a curated, organized index of the most important content.

Format: Markdown file at /llms.txt with specific structure:
- H1: Project/site name
- Blockquote (>): Brief summary with key context
- Free markdown: Optional detailed background
- H2 sections: Organized links to resources
- ## Optional section: Secondary info that can be skipped for shorter context

Key principle: Be selective. Context windows are limited, so prioritize critical resources.
`.trim();

/**
 * Content priority guidelines for LLMs reading llms.txt
 * Domain-agnostic: Works for any type of website
 *
 * Source: https://llmstxt.org/ spec (main sections vs Optional section)
 */
export const CONTENT_PRIORITIES = `
Content Priority Levels for llms.txt:

The official spec defines:
- Main sections (H2): Core content LLMs need to accomplish tasks on this site
- Optional section: Secondary information that can be skipped for shorter context

To determine priority, ask: "Does an LLM need this to accomplish the site's core purpose?"

CRITICAL (Main sections) - Content needed to USE or INTERACT with the site:
Examples by domain:
- Software/Dev tools: API docs, SDK guides, getting started, integration guides
- E-commerce: Product catalog, pricing, checkout process, shipping policies
- Education: Course catalog, enrollment information, curriculum requirements
- Government: Legislative documents, policies, regulations, public records
- News/Media: Current articles, topic archives, editorial standards
- Healthcare: Services offered, appointment booking, patient resources

HIGH PRIORITY (Main sections) - Supporting content that enables understanding:
- Guides, tutorials, and how-to content
- FAQs and troubleshooting
- Best practices and recommendations
- Reference materials

LOW PRIORITY (Optional section) - Supplementary information:
- Blog posts and announcements (unless news is the core offering)
- Changelog and version history
- Company history and team bios
- Marketing content and case studies
- Legal documents (terms, privacy, disclaimers)
- Press releases and media coverage

Decision framework: "If an LLM only reads main sections, can it help users accomplish core tasks?"
- Yes → Structure is good
- No → Move critical content from Optional to main sections
`.trim();

/**
 * Guidelines for organizing sections
 * Domain-agnostic: Works for any website structure
 *
 * Source: https://llmstxt.org/ + https://llmstxthub.com/guides/getting-started-llms-txt
 */
export const SECTION_GUIDELINES = `
Section Organization (based on https://llmstxt.org/):

Good sections are:
- Organized by the site's natural structure and purpose
- Focused on helping LLMs complete tasks related to this specific site
- Named using clear, descriptive terms (avoid marketing language)
- Selective (typically 3-7 main sections, not 20+)

Section naming principles:
- Use the site's own terminology and domain language
- Be specific and descriptive
- Avoid hype: "Products" not "Amazing Products", "API" not "Powerful API"
- Match common patterns when appropriate, but don't force them
  * Software: Documentation, API, Guides, Examples
  * E-commerce: Products, Categories, Ordering, Support
  * Education: Courses, Programs, Admissions, Resources
  * Government: Legislation, Policies, Services, Contact

The "Optional" section:
- Has special meaning per spec: content LLMs can skip for shorter context
- Typical contents vary by domain:
  * Software: Blog, changelog, company info
  * E-commerce: About us, blog, press
  * Education: News, events, alumni info
  * Government: Press releases, archives, staff directory

Test: "Could an LLM accomplish the site's core tasks without this section?"
- Yes → Optional
- No → Main section
`.trim();

/**
 * Guidelines for writing link descriptions
 * Domain-agnostic: Works for any content type
 *
 * Source: https://llmstxthub.com/guides/getting-started-llms-txt
 */
export const DESCRIPTION_GUIDELINES = `
Link descriptions should:
- Be concise and clear (one sentence typically)
- Focus on WHAT the page contains, not marketing claims
- Help LLMs decide if the page is relevant to their current task
- Use descriptive language appropriate to the domain
- Avoid ambiguous terms or unexplained jargon

Good examples (various domains):
- Software: "API reference for authentication endpoints"
- E-commerce: "Product catalog for outdoor camping equipment"
- Education: "Bachelor's degree requirements and course prerequisites"
- Government: "Zoning regulations for commercial properties"
- News: "Coverage of 2024 climate policy developments"

Bad examples (any domain):
- "Learn more here!" (vague, no context)
- "Everything you need to know" (not descriptive)
- "Amazing resources" (marketing language)
- "Click for details" (no information about content)

Writing formula: "[Content type] for [specific topic/purpose]"
- "Guide to configuring database connections"
- "Tutorial for first-time home buyers"
- "Requirements for business license applications"
`.trim();

/**
 * Get system prompt for AI section discovery
 * Combines purpose and guidelines into a coherent instruction
 */
export function getSectionDiscoveryPrompt(): string {
  return `${LLMS_TXT_PURPOSE}

${CONTENT_PRIORITIES}

${SECTION_GUIDELINES}

Your task: Group pages into logical sections that help LLMs quickly find what they need.
Prioritize technical documentation and API references in main sections.
Move blog posts, changelog, and marketing content to the Optional section.
`;
}

/**
 * Get system prompt for AI description generation
 */
export function getDescriptionPrompt(): string {
  return `${LLMS_TXT_PURPOSE}

${DESCRIPTION_GUIDELINES}

Your task: Write concise, technical descriptions for each page that help LLMs decide if the page is relevant to their current task.
`;
}

/**
 * Get system prompt for AI business summary generation
 */
export function getBusinessSummaryPrompt(): string {
  return `${LLMS_TXT_PURPOSE}

Context: You are writing the brief summary (blockquote) that appears at the top of an llms.txt file.

The summary should:
- Be 1-3 sentences maximum
- Explain what the product/service is in technical terms
- Mention key technologies or frameworks if relevant
- Be concise and informative, not marketing-focused

Good examples:
- "FastHTML is a python library which brings together Starlette, Uvicorn, HTMX, and fastcore's FT FastTags into a library for creating server-rendered hypermedia applications."
- "Stripe provides payment processing APIs for internet businesses, with SDKs for multiple languages and frameworks."

Bad examples:
- "The best way to build web applications!" (vague, marketing)
- "An amazing tool that will change your life" (hyperbolic)
`;
}

/**
 * Get user prompt for description generation
 * Provides page metadata and formatting instructions
 */
export function getDescriptionUserPrompt(page: {
  title: string;
  url: string;
  description?: string;
  ogDescription?: string;
}): string {
  return `Create a concise description for this page (max 20 words).

Title: ${page.title}
URL: ${page.url}
Meta Description: ${page.description || page.ogDescription || "N/A"}

Output only the description, no quotes, no preamble.`;
}

/**
 * Get user prompt for business summary generation
 * Provides homepage metadata and formatting instructions
 */
export function getBusinessSummaryUserPrompt(homepage: {
  siteName?: string;
  title: string;
  url: string;
  ogDescription?: string;
  description?: string;
  h1?: string;
  bodyText?: string;
}): string {
  return `Analyze this website homepage and create content for an llms.txt file.

Site Name: ${homepage.siteName || homepage.title}
URL: ${homepage.url}
Description: ${homepage.ogDescription || homepage.description || "N/A"}
H1: ${homepage.h1 || "N/A"}
Body Text: ${homepage.bodyText?.slice(0, 1500) || "N/A"}

Generate a summary (1-3 sentences): Explain what this product/service is in technical terms. Be specific about core function, technologies, or key capabilities.

Examples:
- "FastHTML is a Python library combining Starlette, Uvicorn, and HTMX for server-rendered hypermedia applications"
- "YouTube is a video-sharing platform where users upload, view, rate, share, and comment on videos globally"
- "Stripe provides payment processing APIs for internet businesses with SDKs for multiple languages"

If the body text contains substantial additional information, add "|||" followed by 2-4 paragraphs of context that helps LLMs understand and assist users. If not, output ONLY the summary.

CRITICAL: Output ONLY the actual content sentences. NO labels, NO headers, NO format instructions in your output.`;
}
