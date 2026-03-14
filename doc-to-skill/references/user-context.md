# User Context — Personalization Reference

How to transform a generic docs-mirror skill into a personalized coding assistant.
Worked examples for specific libraries Jeff uses.

---

## The personalization gap

| Generic skill | Personalized skill |
|--------------|-------------------|
| Shows `stripe.charges.create()` | Shows `stripe.paymentIntents.create()` with your product IDs |
| Imports from package root | Imports using your exact module path conventions |
| Example env var: `process.env.API_KEY` | Example env var: `process.env.RC_API_KEY` |
| Shows 8 subscription patterns | Shows only the 2 patterns you actually use |
| Generic error handling | Error handling that matches your existing wrapper |

**Time saved:** Generic skill reduces lookup time ~20%. Personalized skill ~80%.

---

## The context interview

Run these 5 questions before every skill generation. Extract answers from
conversation history when available — don't ask what the user has already told you.

```
Q1: Language + framework?
    → Determines every code example's syntax and import style
    → iOS Swift 5.9 ≠ RN ≠ Flutter ≠ Expo
    → Node ESM ≠ CJS ≠ TypeScript with strict mode

Q2: Your actual config values?
    → Package IDs, entitlement names, tier names, env var keys
    → These get hardcoded into every example
    → The biggest single driver of skill usefulness

Q3: How does this library fit your architecture?
    → Direct calls vs. singleton service vs. wrapper class
    → In a cron job vs. in a request handler vs. in a background task
    → Affects initialization pattern and where examples live

Q4: What do you actually use?
    → Narrows the skill to relevant patterns
    → Avoids Claude suggesting features you've deliberately skipped

Q5: What trips you up?
    → Goes straight into Gotchas — highest ROI content
    → Usually something not well-documented or counter-intuitive
```

---

## Context injection format

After generating the base skill, insert this block at the top of the skill body
(below the YAML frontmatter, before any other content):

```markdown
## This project's setup

{Library}: {version}
App: {app_name} — {one-line description}
Language: {language + version}

{Config block — all specific values, IDs, env vars}

Architecture: {how the library is used in this codebase}
Does NOT use: {unused features — stripped from this skill}
```

This section loads every time the skill triggers. Zero re-explanation needed.

---

## Worked examples

### RevenueCat for PastPix (iOS Swift)

**Context gathered:**
- Language: iOS Swift 5.9, RevenueCat SDK v5.x
- App: PastPix (photo restoration app)
- Packages: `pastpix_monthly` ($4.99/mo), `pastpix_annual` ($39.99/yr)
- Entitlement: `pro_access`
- Uses: Paywall V2 remote config
- Does NOT use: server-side purchases, webhooks, Stripe integration
- Init location: `AppDelegate.application(_:didFinishLaunchingWithOptions:)`
- API key: `Info.plist` key `RC_API_KEY`
- Pattern used most: check if subscribed + show paywall

**Context block in skill:**
```markdown
## This project's setup

RevenueCat: iOS SDK v5.x
App: PastPix — AI photo restoration iOS app
Language: Swift 5.9

Package IDs: `pastpix_monthly`, `pastpix_annual`
Entitlement: `pro_access`
Paywall: V2 remote config (managed in RC dashboard, no code changes for paywall updates)
Init: AppDelegate → `Purchases.configure(withAPIKey: Bundle.main.infoDictionary?["RC_API_KEY"])`
Does NOT use: server-side purchases, webhooks, Stripe, Observer Mode
```

**What changed in examples:**
```swift
// Generic skill would show:
let customerInfo = try await Purchases.shared.customerInfo()
if customerInfo.entitlements["premium"]?.isActive == true {

// Personalized skill shows:
let customerInfo = try await Purchases.shared.customerInfo()
if customerInfo.entitlements["pro_access"]?.isActive == true {
    // User has PastPix Pro
}
```

---

### Apify for the FB Ads Agent

**Context gathered:**
- Language: Node.js ESM (`import`/`export`)
- Deployed to Railway, reads config from env vars
- Named datasets: `fb-ads-{YYYY-MM-DD}` format
- KV store: used for last-run timestamps + run state
- Entry: `Actor.main()` async IIFE
- Does NOT use: Apify proxy, browser actors, storage views, Apify console
- Pain point: confusion between `Actor.exit()` vs. natural completion

**Context block in skill:**
```markdown
## This project's setup

Apify: SDK v3, Node.js ESM
Agent: Facebook ads intelligence agent
Deploy: Railway (no Apify platform deployment — runs as standalone)

Dataset naming: `fb-ads-${new Date().toISOString().slice(0, 10)}`
KV store: `fb-ads-state` (tracks last run timestamps, deduplication hashes)
Config source: Railway environment variables (not Apify input schema)
Entry pattern: Actor.main() async IIFE

Does NOT use: Apify proxy, browser actors, storage views, Apify scheduler,
              Apify webhooks, ActorInput validation
```

**What changed in examples:**
```js
// Generic skill:
import { Actor } from 'apify';
await Actor.init();
const input = await Actor.getInput();
const { url } = input;

// Personalized skill:
import { Actor } from 'apify';

await Actor.main(async () => {
  const docsUrl  = process.env.FB_ADS_TARGET_URL;
  const maxAds   = parseInt(process.env.MAX_ADS ?? '100');
  const dataset  = await Actor.openDataset(`fb-ads-${new Date().toISOString().slice(0,10)}`);
  const kvStore  = await Actor.openKeyValueStore('fb-ads-state');
  // ...
});
```

---

### Exa AI for competitive intelligence

**Context gathered:**
- Language: Node.js ESM
- Query types: landing pages (needs full text), changelog/blog (needs dates), feature pages (needs highlights)
- Always wants: `contents.text`, `highlights`
- Key nuance: `type: "auto"` for landing pages, `type: "keyword"` for changelog lookups
- Doesn't use: embeddings, semantic similarity, image search, `livecrawl`
- Pain point: confuses when to use `numResults` vs. `autoprompt`

**Context block in skill:**
```markdown
## This project's setup

Exa: Node.js SDK (ESM)
Use case: competitive intelligence — scraping ad landing pages, competitor changelogs,
          and product feature pages

Always include: { contents: { text: true, highlights: true } }
Type selection: "auto" for landing page URLs, "keyword" for changelog/blog searches
Date filtering: use startPublishedDate for changelog searches (last 30 days)

Does NOT use: embeddings, livecrawl, image search, autoprompt, semantic search
```

**What changed in examples:**
```js
// Generic skill:
const result = await exa.search("latest Remini AI features");

// Personalized skill (landing page pattern):
const landingPageResult = await exa.getContents([competitorUrl], {
  text: true,
  highlights: { numSentences: 3, highlightsPerUrl: 5 }
});

// Personalized skill (changelog search pattern):
const changelogResult = await exa.search(`${competitor} changelog new features`, {
  type: "keyword",
  startPublishedDate: thirtyDaysAgo.toISOString(),
  numResults: 10,
  contents: { text: true }
});
```

---

### Railway for agent deployments

**Context gathered:**
- Language: Node.js (agents), no web server
- Services named with `agent-` prefix
- Deploys: push-to-deploy from GitHub
- Uses: cron jobs, env vars, persistent volume mounts
- Does NOT use: Railway databases, Railway networking, multi-service stacks
- Pain point: cron expressions — always forgets syntax

**Context block in skill:**
```markdown
## This project's setup

Railway: Node.js worker services (no web server, no $PORT binding)
Service naming: `agent-{name}` (e.g., agent-fb-ads, agent-skill-refresher)
Deploy: push-to-deploy via GitHub (main branch)
Crons: defined in railway.toml [[crons]] blocks
Env vars: set in Railway dashboard, accessed via process.env

Does NOT use: Railway databases, Railway networking (no service-to-service calls),
              multi-service stacks, Nixpacks custom builds
```

**What changed in examples:**
```toml
# Generic skill might show a web server:
[deploy]
startCommand = "node server.js"

# Personalized skill shows the worker + cron pattern:
[deploy]
startCommand = "node agents/fb-ads/index.js"

[[crons]]
schedule = "0 6 * * 1"        # Mondays at 6am UTC
command  = "node agents/fb-ads/index.js"
```

---

## Personalization prompt template

Use this for the second-pass personalization after the base skill is generated:

```
Take this draft SKILL.md and personalize it for this user.

User's context:
- App: {app_name and description}
- Language: {language + version + module system}
- Library version: {version}
- Specific IDs/names: {all IDs, names, env var keys}
- Architecture: {how they use the library}
- Uses: {features they use}
- Does NOT use: {features to remove from skill}
- Top pain point: {what trips them up}

Transformation rules:
1. Insert "This project's setup" section at the top of the skill body with their config
2. Replace all generic IDs/names in code examples with their actual values
3. Remove entire sections for features in "Does NOT use"
4. Add their top pain point to the Gotchas section
5. Adjust all import statements and module syntax to match their language/module system
6. Rename generic variable names to match their naming conventions

Do not change:
- The YAML frontmatter (name, description)
- The structure/sections that remain relevant
- Code example correctness — only change variable names and IDs, not logic

Draft skill:
---
{draft_skill_md}
```

---

## Signs a skill needs more personalization

- User says "you keep suggesting X but I don't use X" → remove that section
- User re-explains their config in every conversation → add it to setup block
- User says "but my package IDs are..." → hardcode them into examples
- Claude suggests deprecated patterns → add version constraint to skill header
- Skill triggers on wrong queries → refine trigger phrases in description
