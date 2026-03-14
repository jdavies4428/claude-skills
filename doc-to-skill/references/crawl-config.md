# Crawl Config Reference

All configuration options for the Cloudflare `/crawl` endpoint, with patterns
organized by docs platform type and use case.

---

## Full parameter reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | Starting URL for the crawl |
| `maxDepth` | integer | 3 | How deep to follow links (1 = start URL only) |
| `limit` | integer | 50 | Max pages to crawl (max: 1000) |
| `include` | string[] | [] | URL glob patterns — only crawl matching URLs |
| `exclude` | string[] | [] | URL glob patterns — skip matching URLs |
| `render` | boolean | false | Use headless browser (for JS-rendered sites) |
| `outputFormats` | string[] | ["markdown"] | Return formats per page |
| `modifiedSince` | string | null | ISO datetime — skip unchanged pages |
| `maxAge` | integer | null | Use cached version if fetched within N seconds |
| `discovery` | string | "both" | "sitemap", "links", or "both" |

---

## Render mode decision guide

```
Is the page blank when you curl it?
├── YES → render: true (JS-rendered, needs headless browser)
└── NO → render: false (static or SSR, use fast mode)

Common render: false (most docs sites):
  - Stripe, Twilio, Cloudflare, Vercel, Railway, Supabase
  - GitHub Pages, Hugo sites, Jekyll sites
  - Docusaurus (has pre-rendered routes by default)
  - Most OpenAPI / Redoc / Swagger static outputs

Common render: true (SPA docs):
  - Some Readme.io setups
  - Fully client-rendered custom doc sites
  - Sites that show "Loading..." in curl output
```

---

## Output format guide

| Format | Size | Use for |
|--------|------|---------|
| `markdown` | ~30% of HTML | Feed to Claude — clean, no nav/chrome |
| `json` | ~10% of HTML | Scoring and filtering only — never feed raw to Claude |
| `html` | 100% | Extract structured data (pricing tables, param grids) |

Always request at least `["markdown", "json"]`. The JSON metadata enables page
scoring without tokenizing the full content.

---

## URL pattern syntax

Patterns use glob syntax with `*` as wildcard:

```
"stripe.com/docs/api/*"           — everything under /docs/api/
"stripe.com/docs/api/charges*"    — /charges, /charges/create, etc.
"*/reference/*"                   — any URL with /reference/ in path
"stripe.com/docs/!(changelog)/*"  — everything except changelog (negation)
```

Tip: Start broad, then narrow. Test with a 20-page crawl first to see what
URLs actually get discovered before committing to tight patterns.

---

## Configs by docs platform

### Mintlify-based docs

Mintlify sites are often fully static. Common pattern:

```json
{
  "render": false,
  "include": ["{domain}/api-reference/*", "{domain}/getting-started/*"],
  "exclude": ["*/changelog/*", "*/blog/*"]
}
```

### Docusaurus sites

Pre-rendered by default, `render: false` works. Often organized as:
- `/docs/` — main guides
- `/api/` — API reference  
- `/blog/` — skip this

```json
{
  "render": false,
  "include": ["{domain}/docs/*", "{domain}/api/*"],
  "exclude": ["{domain}/blog/*", "{domain}/community/*"]
}
```

### ReadMe.io sites

Variable — some are SSR, some are SPA. Try `render: false` first.
URL structure: `/{version}/reference/` and `/{version}/docs/`

```json
{
  "render": false,
  "include": ["*/v2.0/reference/*", "*/v2.0/docs/*"],
  "exclude": ["*/changelog/*", "*/recipes/*"]
}
```

### GitBook sites

Usually static, `render: false` works.

```json
{
  "render": false,
  "include": ["{domain}/*"],
  "exclude": ["*/changelog/*"]
}
```

---

## Scoping strategy by skill type

### Pure API reference skill (tightest scope)

For when you only need to know "how do I call this endpoint":

```json
{
  "maxDepth": 2,
  "limit": 50,
  "include": ["*/api-reference/*", "*/reference/*", "*/api/v*/*"],
  "exclude": ["*/guides/*", "*/tutorials/*", "*/blog/*", "*/changelog/*"]
}
```

### Full developer experience skill (broader scope)

For when you need quickstart + guides + reference:

```json
{
  "maxDepth": 3,
  "limit": 200,
  "include": ["*/docs/*", "*/guides/*", "*/reference/*", "*/api/*"],
  "exclude": ["*/changelog/*", "*/blog/*", "*/community/*",
              "*/status/*", "*/pricing/*", "*/legal/*"]
}
```

### SDK-specific skill (language-scoped)

When a library has multi-language docs and you only want one SDK:

```json
{
  "include": ["*/sdk/js/*", "*/reference/javascript/*",
              "*/client-libraries/node/*"],
  "exclude": ["*/sdk/python/*", "*/sdk/ruby/*", "*/sdk/php/*",
              "*/sdk/go/*", "*/sdk/java/*"]
}
```

---

## modifiedSince patterns

### Weekly cron (Monday 6am)

```js
// Store after successful run:
await kv.set('lastCrawl', new Date().toISOString());

// Use on next run:
const lastCrawl = await kv.get('lastCrawl');
const crawlPayload = {
  url: docsUrl,
  ...baseConfig,
  ...(lastCrawl && { modifiedSince: lastCrawl })
};
```

### Skip if recently crawled (maxAge alternative)

```json
{
  "maxAge": 604800
}
```

`maxAge: 604800` (7 days in seconds) — tells the crawler to return cached versions
of pages fetched within the last 7 days. Good for reducing redundant work on
unmodified pages even without tracking your own timestamps.

---

## Debugging crawl results

### Check what URLs were actually discovered

```js
const urlList = result.pages.map(p => p.url).sort();
console.log('Discovered URLs:\n' + urlList.join('\n'));
```

Run this before scoring/filtering to verify your include/exclude patterns
are capturing the right pages.

### Check page quality

```js
const summary = result.pages.map(p => ({
  url: p.url,
  words: p.json.wordCount,
  codeBlocks: p.json.codeBlockCount,
  headings: p.json.headingCount
})).sort((a, b) => b.codeBlocks - a.codeBlocks);

console.table(summary.slice(0, 20));
```

A good docs page for skill generation has: `codeBlocks >= 3`, `wordCount >= 300`.
If all pages have 0 code blocks, you likely hit a JS-rendered site — switch to `render: true`.
