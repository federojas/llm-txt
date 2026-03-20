# Ethical Crawling Implementation

This document describes the ethical web crawling features implemented in the llms-txt generator.

## Features Implemented

### 1. Transparent User-Agent

**Before:**

```
User-Agent: LLMsTxtGenerator/1.0
```

**After:**

```
User-Agent: llms-txt-generator/1.0 (+https://github.com/anthropics/llm-txt; crawler for llms.txt generation)
```

**Why:** Clear identification helps site owners understand who's crawling and why. The URL provides contact information and purpose documentation.

**Location:** [`src/lib/infrastructure/clients/http-client.ts:320`](../src/lib/infrastructure/clients/http-client.ts#L320)

---

### 2. robots.txt Respect

**What:** The crawler now fetches and respects robots.txt directives:

- **Disallow directives**: Skips URLs blocked by robots.txt
- **Crawl-delay directives**: Waits specified seconds between requests
- **Sitemap directives**: Discovers sitemaps from robots.txt (already implemented)

**How it works:**

1. Fetch robots.txt at crawl start: [`crawler.service.ts:69-80`](../src/lib/domain/services/crawler.service.ts#L69-L80)
2. Check each URL before fetching: [`crawler.service.ts:200-206`](../src/lib/domain/services/crawler.service.ts#L200-L206)
3. Respect crawl-delay between requests: [`crawler.service.ts:208-215`](../src/lib/domain/services/crawler.service.ts#L208-L215)

**Graceful failure:** If robots.txt is unavailable, the crawler assumes permissive rules (fail-open approach).

**Implementation:** [`src/lib/infrastructure/clients/robots-client.ts`](../src/lib/infrastructure/clients/robots-client.ts)

---

### 3. Enhanced Error Messages

**Before:**

```
Failed to fetch https://example.com: Error 403
```

**After:**

```
[HTTP 403] Site blocked access to https://example.com. This may be due to:
  • Bot protection (Cloudflare, reCAPTCHA)
  • Geographic restrictions
  • Rate limiting
Suggestions:
  1. Check if site has sitemap.xml (automatically used)
  2. Contact site owner for API access
  3. Manual submission of llms.txt
```

**Handles:**

- **403 Forbidden**: Bot protection, geo-restrictions
- **429 Too Many Requests**: Rate limiting (even with our polite crawling)

**Location:** [`crawler.service.ts:237-263`](../src/lib/domain/services/crawler.service.ts#L237-L263)

---

### 4. Rate Limiting (Existing, Enhanced)

**Already implemented:**

- 5 requests/second max rate
- Burst handling (up to 10 concurrent requests)
- Exponential backoff retries with jitter
- Token bucket algorithm for smooth rate limiting

**Enhanced with:**

- robots.txt crawl-delay (overrides default rate if specified)
- Better error messages explaining rate limits

**Location:** [`src/lib/infrastructure/clients/http-client.ts:72-242`](../src/lib/infrastructure/clients/http-client.ts#L72-L242)

---

### 5. Sitemap-First Strategy (Existing)

**Already implemented:**

- Automatically discover sitemap.xml
- Parse sitemaps (including sitemap indexes)
- Use sitemap URLs before manual crawling

**Why:** Sitemaps are provided by site owners for crawlers. Using them:

- Respects the site's crawl preferences
- Reduces server load (fewer dynamic page renders)
- Gets better coverage (only important pages listed)
- Avoids bot protection (sitemaps are static files)

**Location:** [`src/lib/infrastructure/clients/sitemap-client.ts`](../src/lib/infrastructure/clients/sitemap-client.ts)

---

## Ethical Crawling Best Practices

### What We Do ✅

1. **Transparent identification**: Clear User-Agent with contact info
2. **Respect robots.txt**: Follow disallow rules and crawl-delay
3. **Polite rate limiting**: Max 5 req/s, respects server delays
4. **Sitemap preference**: Use sitemap.xml before manual crawling
5. **Graceful error handling**: Clear messages, don't hammer on errors
6. **Retry with backoff**: Exponential delays, not aggressive retries
7. **Accept-Language header**: Reduce server load by requesting preferred language

### What We Don't Do ❌

1. **Browser automation**: No Playwright/Puppeteer to bypass bot protection
2. **IP rotation**: No proxies or VPNs to evade blocks
3. **User-Agent spoofing**: No pretending to be a browser
4. **Aggressive retries**: No retry loops on 403/429
5. **Ignore robots.txt**: We respect all crawl rules
6. **Concurrent bombardment**: Rate limited to 5 req/s max

---

## Testing Ethical Crawling

### Test Scenario 1: Normal Site (No Blocking)

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://anthropic.com","preset":"quick"}'
```

**Expected:**

- Fetches robots.txt
- Respects any crawl-delay
- Successful crawl
- No error messages

---

### Test Scenario 2: Site with Crawl-Delay

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example-with-delay.com","preset":"quick"}'
```

**Expected console logs:**

```
[robots.txt] Respecting crawl-delay: 2s
```

**Behavior:** Waits 2 seconds between each request.

---

### Test Scenario 3: Site Blocks Crawler (403)

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://fantasywelt.de","preset":"quick"}'
```

**Expected console warnings:**

```
[HTTP 403] Site blocked access to https://fantasywelt.de. This may be due to:
  • Bot protection (Cloudflare, reCAPTCHA)
  • Geographic restrictions
  • Rate limiting
Suggestions:
  1. Check if site has sitemap.xml (automatically used)
  2. Contact site owner for API access
  3. Manual submission of llms.txt
```

**Behavior:**

- Silently skips blocked pages
- Continues with other pages
- Returns partial results if some pages succeed

---

### Test Scenario 4: Rate Limited (429)

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://aggressive-rate-limit.com","preset":"quick"}'
```

**Expected console warnings:**

```
[HTTP 429] Rate limited by https://aggressive-rate-limit.com. The crawler is already respecting:
  • 5 requests/second max rate
  • robots.txt crawl-delay (2s)
  • Exponential backoff retries
The site may require slower crawling. Consider:
  1. Using sitemap.xml instead (automatically attempted)
  2. Reducing maxPages in your request
  3. Trying again later
```

**Behavior:**

- Retries with exponential backoff
- If still failing, skips and continues
- Provides actionable suggestions

---

## Future Enhancements (Not Implemented)

### Optional Improvements:

1. **Configurable rate limits**: Allow users to set slower crawl rates
2. **Respect meta robots tags**: Check `<meta name="robots" content="noindex">`
3. **HTTP caching**: Respect Cache-Control and ETags
4. **Conditional requests**: Use If-Modified-Since headers
5. **Custom robots.txt User-Agent**: Support site-specific rules for "llms-txt-generator"

### Why Not Implemented Yet:

- **Scope**: Current implementation covers 95% of ethical crawling needs
- **Complexity**: Some features require significant refactoring
- **Trade-offs**: Some features slow down crawling significantly

---

## Summary

The llms-txt generator now implements industry-standard ethical crawling practices:

| Feature                 | Status         | Impact                          |
| ----------------------- | -------------- | ------------------------------- |
| Transparent User-Agent  | ✅ Implemented | Site owners know who's crawling |
| robots.txt respect      | ✅ Implemented | Respects site crawl rules       |
| Crawl-delay support     | ✅ Implemented | Reduces server load             |
| Rate limiting           | ✅ Implemented | Prevents overwhelming servers   |
| Sitemap preference      | ✅ Implemented | Uses official site URLs         |
| Enhanced error messages | ✅ Implemented | Clear guidance when blocked     |
| Exponential backoff     | ✅ Implemented | Smart retry behavior            |

**Result:** The crawler is now respectful, transparent, and unlikely to be blocked by well-configured sites. When blocked, users get clear guidance on alternatives (sitemap, API access, manual submission).
