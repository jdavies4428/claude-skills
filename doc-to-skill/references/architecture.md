# Doc-to-Skill Compiler — Architecture Reference

Full architecture reference, design decisions, worked examples, and operational guide.

---

## Table of contents

1. [What this is](#what-this-is)
2. [Why it works](#why-it-works)
3. [Architecture deep-dive](#architecture-deep-dive)
4. [Cloudflare /crawl API reference](#cloudflare-crawl-api-reference)
5. [Pre-processing strategy](#pre-processing-strategy)
6. [Skill-creator prompt engineering](#skill-creator-prompt-engineering)
7. [User context: the key differentiator](#user-context-the-key-differentiator)
8. [Worked examples](#worked-examples)
9. [The modifiedSince cron loop](#the-modifiedsince-cron-loop)
10. [Failure modes and mitigations](#failure-modes-and-mitigations)
11. [Cost and performance benchmarks](#cost-and-performance-benchmarks)

---

## What this is

A pipeline that takes a docs URL and a user's configuration context, and produces a
Claude SKILL.md file that makes Claude an expert in that library *as that user uses it*.

The key word is "as that user uses it." Generic docs-to-skill compilers already exist
in various forms. What makes this different is the user-context personalization layer —
the difference between "here is the full Stripe API" and "here is Stripe as used by
a developer who runs a Connect platform with per-user accounts, charges in MXN, and
uses Railway-deployed webhooks."

---

## Why it works

Technical docs have three properties that make them ideal for skill generation:

1. **They're structured.** Headings, code blocks, parameter tables — the signal is
   densely packed and clearly delimited. This makes pre-processing (finding what matters)
   tractable.

2. **They change slowly.** Most doc sites update incrementally. The `modifiedSince` param
   means re-runs are cheap — you're only re-processing changed pages.

3. **Their structure maps to SKILL.md sections.** Quickstart = initialization pattern.
   API reference = code patterns. Troubleshooting = gotchas. Error codes = error reference.
   The transformation is almost structural, not semantic.

The Cloudflare `/crawl` endpoint handles the hard part (JS rendering, link discovery,
pagination, `robots.txt` compliance) so the pipeline starts at clean Markdown.

---

## Architecture deep-dive

### Why async crawl jobs matter

The `/crawl` endpoint is async by design. Large docs sites (Stripe, Supabase, AWS)
have hundreds of pages. A synchronous request would timeout. The job-based model means:

- Submit crawl → get `jobId`
- Store `jobId`
- Poll on interval (5s recommended) until `status === "complete"`
- Process results

For a 200-page crawl with `render: false`, expect 30–90 seconds to completion.
For `render: true` (headless browser), expect 3–8 minutes.

### The three-format output

The crawl returns each page in three formats simultaneously:

- **`markdown`**: Clean Markdown, best for feeding to Claude. Images stripped,
  nav/header/footer removed, code blocks preserved with language tags.

- **`json`**: Structured metadata — heading tree, code block list, link list, word count.
  Used for scoring and filtering in pre-processing (never fed raw to Claude).

- **`html`**: Full rendered HTML. Rarely needed for skill generation; useful if you
  need to extract structured data (pricing tables, parameter grids) that markdown
  flattens.

### Why `render: false` is almost always right

Most technical docs sites are either:
- Static HTML served directly (GitHub Pages, plain HTML)  
- Server-side rendered (Next.js, Astro with SSR, Hugo)
- Cacheable SPA output (Docusaurus with pre-rendered routes)

In all three cases, `render: false` works — it fetches the HTML response and converts
to Markdown without spinning up a headless browser. This is 5–10x faster and uses
no browser worker resources.

Only use `render: true` when:
- The docs site shows a blank page in curl output (pure client-side rendering)
- Content loads via authenticated API calls on page load
- You see "Loading..." in the markdown output

### Page discovery: sitemaps vs. link-following

The crawler discovers URLs in two modes (configurable):

- **Sitemap**: reads `sitemap.xml`, queues all listed URLs within your include patterns.
  Reliable, respects canonical URLs, misses pages not in sitemap.

- **Links**: follows `<a href>` tags recursively up to `maxDepth`. Finds everything,
  including pages not in sitemaps, but can wander into unrelated sections.

- **Both** (default): tries sitemap first, supplements with link-following.

For docs sites, "both" is the right default. Most docs have sitemaps but they're
sometimes incomplete.

---

## Cloudflare /crawl API reference

### Full request schema

```json
{
  "url": "string (required)",
  "maxDepth": "integer (default: 3)",
  "limit": "integer (default: 50, max: 1000)",
  "include": ["array of URL glob patterns"],
  "exclude": ["array of URL glob patterns"],
  "render": "boolean (default: false)",
  "outputFormats": ["markdown", "json", "html"],
  "modifiedSince": "ISO 8601 datetime string",
  "maxAge": "integer (max page age in seconds to use cached version)",
  "discovery": "sitemap | links | both (default: both)"
}
```

### Pattern reference for common docs platforms

**Stripe**
```json
{
  "include": ["stripe.com/docs/api/*", "stripe.com/docs/payments/*",
              "stripe.com/docs/connect/*"],
  "exclude": ["*/changelog/*", "*/data-pipeline/*", "*/issuing/*",
              "*/terminal/*", "*/radar/*"]
}
```

**Supabase**
```json
{
  "include": ["supabase.com/docs/reference/javascript/*",
              "supabase.com/docs/guides/auth/*",
              "supabase.com/docs/guides/database/*"],
  "exclude": ["*/changelog/*", "*/cli/*", "*/self-hosting/*",
              "*/platform/*", "*/studio/*"]
}
```

**RevenueCat**
```json
{
  "include": ["docs.revenuecat.com/docs/sdk/*",
              "docs.revenuecat.com/docs/entitlements/*",
              "docs.revenuecat.com/docs/paywalls/*",
              "docs.revenuecat.com/reference/*"],
  "exclude": ["*/changelog/*", "*/migrations/*", "*/server-notifications/*"]
}
```

**Apify**
```json
{
  "include": ["docs.apify.com/sdk/js/*",
              "docs.apify.com/api/v2/*",
              "docs.apify.com/platform/actors/*"],
  "exclude": ["*/changelog/*", "*/community/*", "*/academy/*"]
}
```

**Railway**
```json
{
  "include": ["docs.railway.app/guides/*",
              "docs.railway.app/reference/*",
              "docs.railway.app/deploy/*"],
  "exclude": ["*/changelog/*", "*/tutorials/*"]
}
```

**Exa AI**
```json
{
  "include": ["docs.exa.ai/*"],
  "exclude": ["*/changelog/*"]
}
```

### Polling implementation

```js
async function pollJob(jobId, accountId, apiToken, intervalMs = 5000) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/crawl/${jobId}`;
  const headers = { 'Authorization': `Bearer ${apiToken}` };

  while (true) {
    const res = await fetch(url, { headers });
    const data = await res.json();

    if (data.status === 'complete') return data;
    if (data.status === 'failed') throw new Error(`Crawl failed: ${data.error}`);

    await new Promise(r => setTimeout(r, intervalMs));
  }
}
```

---

## Pre-processing strategy

### The token budget problem

A full docs site crawl easily produces 300k–2M tokens of Markdown. Claude's context
window and practical prompt economics require getting this to ≤ 60k tokens before
the skill-creator call. Pre-processing is the entire strategy.

### Three-pass filtering

**Pass 1 — Page scoring** (eliminates ~70% of pages)

Score each page on information density. Higher = more useful for skill generation:

```js
function scorePage(page) {
  const { codeBlockCount, headingCount, wordCount } = page.json;
  const urlBonus = getUrlBonus(page.url); // +10 for quickstart/auth/reference URLs
  return (codeBlockCount * 3) + headingCount + (wordCount / 100) + urlBonus;
}

function getUrlBonus(url) {
  const highValue = ['quickstart', 'getting-started', 'authentication', 'auth',
                     'reference', 'api', 'error', 'errors', 'rate-limit'];
  const lowValue  = ['changelog', 'migration', 'deprecated', 'blog', 'about',
                     'faq', 'pricing', 'community', 'status'];
  const u = url.toLowerCase();
  if (highValue.some(kw => u.includes(kw))) return 10;
  if (lowValue.some(kw => u.includes(kw)))  return -20;
  return 0;
}
```

Keep top 30 pages.

**Pass 2 — Section extraction** (reduces each page to high-signal sections)

For each scored page, extract only:
- All code blocks with their preceding heading + surrounding 2 paragraphs
- Sections whose heading matches: install, init, setup, auth, example, usage,
  error, rate limit, limit, response, parameter, argument, return

Discard: introductory prose ("X is a powerful library..."), comparison tables
with competitors, footnotes, and any section > 200 words with no code.

**Pass 3 — Feed ordering** (maximizes what Claude attends to)

Claude's attention is front-loaded within a long context. Order matters:

```
1. Quickstart page (full text, up to 2000 tokens)
2. Authentication / initialization section (full, up to 1500 tokens)
3. Core resource pages — top 5 by score (code + 2-para context, ≤ 800 tokens each)
4. Error codes / rate limits (full section, up to 1000 tokens)
5. Secondary pages (first 400 words each, until token budget exhausted)
```

### Token counting

Use `cl100k_base` tokenizer (GPT-4 tokenizer, close enough for Claude):

```js
import { encoding_for_model } from 'tiktoken';
const enc = encoding_for_model('gpt-4');

function countTokens(text) {
  return enc.encode(text).length;
}
```

Track running total. Stop adding sections when cumulative count hits 55,000.

---

## Skill-creator prompt engineering

### The base template

The system prompt matters more than the user message. Key requirements:

```
System: You are a technical writer generating a Claude coding assistant skill.
Your output is a SKILL.md file — structured instructions Claude loads into context
when a user needs help with {library_name}.

Rules:
1. Code examples must be complete and runnable (not pseudocode, not "...fill in...")
2. Trigger phrases must be specific: include the library name + action verbs +
   file extensions used with this library
3. Never include marketing prose, architecture justifications, or "why to use X"
4. If you don't have enough info for a section, omit it rather than fabricating
5. Code examples must match the language/SDK specified in user context
6. The description field in frontmatter is the most important part — Claude decides
   to load the skill based on description alone. Make it trigger-rich.

Output format: valid SKILL.md (YAML frontmatter + Markdown body)
```

### Writing trigger-rich descriptions

Bad (too vague):
```yaml
description: Help with Stripe payments integration and API calls.
```

Good (trigger-rich):
```yaml
description: >
  Expert patterns for Stripe API, including Payment Intents, Stripe Connect,
  webhooks, subscription management, and customer portal. Use whenever the user
  writes Stripe integration code, asks about stripe.js, stripe-node, stripe-python,
  creates checkout sessions, handles webhook events, manages subscriptions,
  configures prices or products, works with the Stripe CLI, tests with
  stripe listen, or mentions stripe.com in any context.
```

The description is the only thing Claude sees when deciding whether to load the skill.
More trigger phrases = more reliable loading. Specific noun phrases > vague descriptions.

### Structuring patterns sections

Each pattern in the skill should follow this micro-format:

```markdown
### {Operation name}

{One-sentence description of when to use this pattern}

```{language}
{complete, runnable code example}
```

{Optional: 1-2 sentence gotcha or caveat}
```

Never more than 3 sentences of prose per pattern. If you need more explanation,
it's a sign the pattern itself is too complex for the skill — link to the docs instead.

---

## User context: the key differentiator

### Why generic skills underperform

A skill built from raw Stripe docs will show you `stripe.charges.create()` examples.
A personalized skill will show you `stripe.paymentIntents.create()` with *your*
product IDs, *your* idempotency key naming convention, and *your* error handling wrapper.

The delta in usefulness is enormous. Generic skills save ~20% of the lookup time.
Personalized skills save ~80% — you almost never need to leave the conversation.

### The context-gathering interview

When building a skill for a user, always ask these 5 questions:

```
1. "What language/framework are you using this library in?"
   → Swift, Node ESM, Python asyncio, etc.
   → Affects every code example in the skill

2. "What are your actual config values? (IDs, names, env vars)"
   → Package IDs, entitlement names, tier names, API endpoint prefixes
   → Gets hardcoded into examples so zero translation needed

3. "How does this library fit in your architecture?"
   → Singleton service? Direct calls? Wrapped in a class? Called from a cron job?
   → Affects initialization pattern and import style

4. "What features do you actually use?"
   → Strips the skill of irrelevant patterns (noise reduction)
   → Avoids Claude suggesting features you've deliberately not adopted

5. "What's the one thing that always trips you up with this library?"
   → Goes straight into the Gotchas section
   → Often the highest-value content in the entire skill
```

### Context injection into the skill body

After generation, insert a "This project's setup" section at the top of the skill body:

```markdown
## This project's setup

Language: iOS Swift 5.9, SDK: RevenueCat iOS v5.x
App: FitTrack (fitness tracking)
Packages: `fittrack_monthly` ($4.99/mo), `fittrack_annual` ($39.99/yr)
Entitlement: `pro_access`
Paywall: V2 remote config (managed in RevenueCat dashboard)
Init location: AppDelegate.application(_:didFinishLaunchingWithOptions:)
Env: API key in Info.plist under RC_API_KEY
```

This section loads every time the skill loads. It's like a persistent system prompt
addendum specific to this library — no re-explanation required.

---

## Worked examples

### Example 1 — RevenueCat for FitTrack (iOS Swift)

**Crawl config:**
```json
{
  "url": "https://docs.revenuecat.com",
  "include": ["*/sdk/ios/*", "*/entitlements/*", "*/paywalls/*", "*/api-v1/*"],
  "exclude": ["*/changelog/*", "*/server-notifications/*", "*/stripe/*"],
  "render": false,
  "maxDepth": 3
}
```

**Context block for skill-creator:**
```
User builds FitTrack — an iOS fitness tracking app (Swift 5.9).
RevenueCat SDK v5+. Single pro tier with monthly ($4.99) and annual ($39.99) packages.
Package IDs: fittrack_monthly, fittrack_annual.
Entitlement identifier: pro_access.
Uses Paywall V2 with remote config.
Initializes in AppDelegate. API key stored in Info.plist as RC_API_KEY.
Does NOT use: server-side purchases, RevenueCat webhooks, Stripe integration.
Primary question Claude should answer: "is this user subscribed?" and
"how do I show the paywall?"
```

**Result:** Skill with initialization in AppDelegate, `checkUserSubscription()` using
`pro_access` entitlement, `showPaywall()` using Paywall V2 with the user's package IDs
pre-filled, and a gotcha about `prefetchingEligibility` timing on cold launch.

---

### Example 2 — Apify for the FB Ads Agent

**Crawl config:**
```json
{
  "url": "https://docs.apify.com",
  "include": ["*/sdk/js/*", "*/api/v2/actor-runs*",
              "*/api/v2/datasets*", "*/api/v2/key-value-stores*"],
  "exclude": ["*/changelog/*", "*/academy/*", "*/community/*"],
  "render": false,
  "maxDepth": 2
}
```

**Context block:**
```
User builds a Facebook ads intelligence agent.
Language: Node.js ESM (import/export syntax).
Actors are deployed to Railway, read config from environment variables.
Named datasets with prefix "fb-ads-" + date string.
KV store used for last-run timestamps and state between runs.
Does NOT use: Apify proxy, browser actors, storage views.
Actor entry point: Actor.main() async IIFE.
Results are pushed to dataset then read back for aggregation.
```

**Result:** Skill with `Actor.main()` pattern using env vars, `Actor.openDataset('fb-ads-${dateStr}')` pattern, `Actor.openKeyValueStore()` for state persistence, and a gotcha about `Actor.exit()` vs. natural completion.

---

### Example 3 — Exa AI for competitive intelligence queries

**Crawl config:**
```json
{
  "url": "https://docs.exa.ai",
  "maxDepth": 3,
  "render": false
}
```
(Small enough to crawl fully)

**Context block:**
```
User runs competitive intelligence pipelines.
Queries: ad landing pages (need full content extraction), company changelog/blog
pages (need date filtering), and product feature pages (need highlights).
Language: Node.js ESM.
Uses: contents extraction, highlights, numResults tuning, date range filtering.
Does NOT use: embeddings endpoint, semantic similarity, image search.
Key insight: type:"auto" for landing pages, type:"keyword" for changelog lookups.
```

**Result:** Skill with the `type` selection heuristic as the first pattern (the #1
thing people get wrong with Exa), `contents: { text: true, highlights: true }` in
every example, and a gotcha about `numResults` affecting quality vs. cost tradeoff.

---

## The modifiedSince cron loop

### How it works mechanically

`modifiedSince` is an ISO 8601 timestamp passed in the crawl request. When provided,
the crawler only returns pages whose `last-modified` header (or sitemap `<lastmod>`)
is newer than that timestamp. Pages that haven't changed return no content.

This means:
- First run: full crawl, all pages
- Subsequent runs: only changed pages

For a weekly cron on a typical library's docs site, 90% of runs return 0–5 changed
pages. The skill update is a surgical patch, not a full rebuild.

### Diff-based skill update strategy

When changed pages come back, don't regenerate the entire skill. Instead:

1. Identify which skill sections are affected by the changed pages (by URL pattern)
2. Re-run the skill-creator prompt with ONLY those sections + the existing skill
3. Prompt: "Update only the sections of this skill affected by these changed pages.
   Preserve everything else exactly."

This keeps intentional personalizations intact and only updates what actually changed.

### Storing crawl state

```json
// .crawl-state.json (stored alongside the skill)
{
  "lastCrawlTime": "2026-03-10T06:00:00Z",
  "lastCrawlJobId": "abc123",
  "docsUrl": "https://docs.revenuecat.com",
  "crawlConfig": { "include": ["*/sdk/ios/*"], "exclude": ["*/changelog/*"], "maxDepth": 3, "limit": 150, "render": false },
  "pageCount": 183,
  "hash": "sha256 of combined markdown (detects changes even without lastModified headers)"
}
```

### Alerting on significant changes

If a crawl returns > 10 changed pages, it's worth logging a warning — a large batch
of doc changes often signals a breaking API change, major version release, or
deprecation wave. These warrant a full skill review, not just a patch update.

```js
if (result.pages.length > 10) {
  console.warn(`[ALERT] ${result.pages.length} pages changed in ${library} docs.
Possible breaking changes or major release. Manual skill review recommended.`);
}
```

---

## Failure modes and mitigations

### Crawl returns empty / partial results

**Cause:** Overly restrictive `include` patterns, or site uses JS rendering with
`render: false`.

**Fix:** Start with no `include` patterns on a test crawl of 20 pages to verify
what URLs are actually discovered. Then tighten.

### Skill triggers too broadly / too rarely

**Cause:** Trigger phrases in description are too generic (broad) or library name
only (narrow).

**Fix:** Add 3–5 specific task-verb phrases ("create a payment intent", "check
entitlement status", "push to actor dataset") alongside the library name. Run
the skill-creator's trigger optimizer to A/B test descriptions.

### Generated examples use deprecated API

**Cause:** Crawl included old version migration guides or the docs have deprecated
content without clear labeling.

**Fix:** Add URL exclusion patterns for old versions. Prompt skill-creator explicitly:
"Only include patterns from the current stable API (v{X}). If you see deprecated
method signatures, do not include them."

### Token budget exceeded

**Cause:** Docs site is very large and page scoring didn't filter aggressively enough.

**Fix:** Reduce `limit` in crawl config (start with 100 pages max). Lower the
`codeBlockCount` threshold in scoring to be more aggressive. Accept that some rarely-
used API sections won't be in the skill and add them later manually.

### User context not captured before skill generation

**Cause:** Jumped straight to crawling without the context interview.

**Fix:** Always run the 5-question interview first. If user says "just build it",
build the generic version first and then ask: "Do you want me to personalize this
to your specific config? Give me your package IDs / API structure and I'll update it."

---

## Cost and performance benchmarks

### Typical crawl costs (Cloudflare Browser Rendering)

| Site | Pages | `render` | Time | CF cost |
|------|-------|----------|------|---------|
| Exa docs | ~40 | false | ~15s | negligible |
| RevenueCat | ~120 | false | ~45s | ~$0.02 |
| Supabase JS SDK | ~180 | false | ~60s | ~$0.03 |
| Stripe (scoped) | ~200 | false | ~75s | ~$0.04 |
| Full Stripe | ~800 | false | ~5min | ~$0.15 |

### Claude call costs (skill generation)

| Input tokens | Output tokens | claude-sonnet-4-5 cost |
|-------------|---------------|----------------------|
| 30k (small lib) | ~2k | ~$0.05 |
| 60k (medium lib) | ~3k | ~$0.09 |
| 60k + context pass | ~3k × 2 | ~$0.18 |

### Total per skill: ~$0.10–$0.25 for a fully personalized skill.
### Cron refresh run (no changes): ~$0.01 (crawl only, no Claude call).
### Cron refresh run (5 changed pages): ~$0.04.
