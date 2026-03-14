# Pre-processing Reference

Full implementation guide for filtering and preparing crawled docs for the skill-creator.

---

## The core problem

A full docs crawl returns too much. Examples from real libraries:

| Library | Pages | Raw markdown tokens |
|---------|-------|-------------------|
| Exa AI | 42 | ~28k |
| RevenueCat | 127 | ~210k |
| Supabase JS | 183 | ~380k |
| Stripe (scoped) | 201 | ~490k |

Target: ≤ 60k tokens into skill-creator. Pre-processing achieves this in three passes.

---

## Pass 1: page scoring

Score pages by information density. High score = dense with patterns and code.

```js
function scorePages(pages) {
  return pages.map(page => {
    const { codeBlockCount, headingCount, wordCount } = page.json;
    const urlBonus   = getUrlBonus(page.url);
    const titleBonus = getTitleBonus(page.metadata?.title ?? '');

    const score = (codeBlockCount * 3)
                + headingCount
                + (wordCount / 100)
                + urlBonus
                + titleBonus;

    return { ...page, score };
  })
  .filter(p => p.score > 0)           // remove negatively scored pages
  .sort((a, b) => b.score - a.score)
  .slice(0, 30);                       // keep top 30
}

function getUrlBonus(url) {
  const u = url.toLowerCase();
  if (/\/(quickstart|getting-started|getting_started)/.test(u)) return 15;
  if (/\/(authentication|auth|api-keys?)/.test(u))              return 12;
  if (/\/(reference|api-reference)/.test(u))                    return 8;
  if (/\/(error|errors|rate-limit|rate_limit)/.test(u))         return 10;
  if (/\/(install|installation|setup|initialize|init)/.test(u)) return 8;
  if (/\/(changelog|migration|deprecated|blog|about)/.test(u))  return -20;
  if (/\/(pricing|legal|compliance|community|forum)/.test(u))   return -15;
  return 0;
}

function getTitleBonus(title) {
  const t = title.toLowerCase();
  if (/(quick ?start|getting started)/.test(t)) return 10;
  if (/(authentication|authorization)/.test(t))  return 8;
  if (/(api reference|reference)/.test(t))       return 5;
  if (/(migration|deprecated|v[12]\.x)/.test(t)) return -15;
  return 0;
}
```

---

## Pass 2: section extraction

For each scored page, extract only high-signal sections.

```js
function extractSections(markdownText) {
  const sections = splitBySections(markdownText);
  return sections.filter(section => isHighSignal(section));
}

function splitBySections(text) {
  // Split on ## and ### headings
  const lines = text.split('\n');
  const sections = [];
  let current = { heading: '', body: [] };

  for (const line of lines) {
    if (/^#{2,3} /.test(line)) {
      if (current.body.length > 0) sections.push(current);
      current = { heading: line, body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.length > 0) sections.push(current);
  return sections;
}

function isHighSignal(section) {
  const text = section.body.join('\n');
  const heading = section.heading.toLowerCase();

  // Always include: sections with code blocks
  if (/```/.test(text)) return true;

  // Always include: key concept sections by heading
  const highValueHeadings = [
    'install', 'setup', 'init', 'authentication', 'auth',
    'quickstart', 'getting started', 'usage', 'example',
    'error', 'rate limit', 'response', 'parameter', 'argument',
    'return', 'webhook', 'event'
  ];
  if (highValueHeadings.some(kw => heading.includes(kw))) return true;

  // Skip: long prose sections with no code
  if (text.split('\n').length > 20 && !/```/.test(text)) return false;

  return false;
}
```

### Code block extraction with context

The most important extraction: code block + surrounding prose context.

```js
function extractCodeWithContext(markdownText) {
  const lines = markdownText.split('\n');
  const result = [];
  let inCodeBlock = false;
  let codeStart = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('```') && !inCodeBlock) {
      inCodeBlock = true;
      codeStart = i;
      // Grab 2 paragraphs before the code block
      const contextBefore = getPrecedingContext(lines, i, 2);
      result.push(...contextBefore);
    } else if (lines[i].startsWith('```') && inCodeBlock) {
      inCodeBlock = false;
      // Include the code block itself
      result.push(...lines.slice(codeStart, i + 1));
      // Grab 1 paragraph after
      const contextAfter = getFollowingContext(lines, i, 1);
      result.push(...contextAfter);
      result.push(''); // spacer
    }
  }

  return result.join('\n');
}

function getPrecedingContext(lines, codeStart, paragraphCount) {
  let paragraphs = 0;
  let i = codeStart - 1;
  const context = [];

  while (i >= 0 && paragraphs < paragraphCount) {
    if (lines[i] === '') paragraphs++;
    context.unshift(lines[i]);
    i--;
  }
  return context;
}
```

---

## Pass 3: feed ordering

Order matters. Claude front-loads attention. Structure the feed like this:

```js
function assembleFeed(scoredPages, targetTokens = 55000) {
  const feed = [];
  let tokenCount = 0;

  // Priority 1: quickstart / getting-started (full text)
  const quickstart = findByUrlPattern(scoredPages, /quickstart|getting.started/);
  if (quickstart) {
    feed.push(formatSection('QUICKSTART', quickstart.url, quickstart.markdown));
    tokenCount += countTokens(quickstart.markdown);
  }

  // Priority 2: authentication / init (full text)
  const auth = findByUrlPattern(scoredPages, /authentication|auth$|api.key/);
  if (auth && tokenCount < targetTokens) {
    const authSections = extractSections(auth.markdown);
    const authText = authSections.map(s => s.heading + '\n' + s.body.join('\n')).join('\n\n');
    feed.push(formatSection('AUTHENTICATION', auth.url, authText));
    tokenCount += countTokens(authText);
  }

  // Priority 3: top 5 code-dense pages
  const topPages = scoredPages
    .filter(p => !isQuickstartOrAuth(p.url))
    .slice(0, 5);

  for (const page of topPages) {
    if (tokenCount >= targetTokens) break;
    const codeContent = extractCodeWithContext(page.markdown);
    const sectionText = extractSections(page.markdown)
      .map(s => s.heading + '\n' + s.body.join('\n'))
      .join('\n\n');
    const content = codeContent.length > 200 ? codeContent : sectionText;
    feed.push(formatSection('REFERENCE', page.url, content));
    tokenCount += countTokens(content);
  }

  // Priority 4: error codes / rate limits
  const errors = findByUrlPattern(scoredPages, /error|rate.limit/);
  if (errors && tokenCount < targetTokens) {
    feed.push(formatSection('ERROR REFERENCE', errors.url, errors.markdown));
    tokenCount += countTokens(errors.markdown);
  }

  // Priority 5: remaining pages, first 400 words each
  for (const page of scoredPages.slice(5)) {
    if (tokenCount >= targetTokens) break;
    const excerpt = truncateToWords(page.markdown, 400);
    feed.push(formatSection('SUPPLEMENTAL', page.url, excerpt));
    tokenCount += countTokens(excerpt);
  }

  console.log(`Feed assembled: ${tokenCount} tokens across ${feed.length} sections`);
  return feed.join('\n\n---\n\n');
}

function formatSection(type, url, content) {
  return `[${type}] Source: ${url}\n\n${content}`;
}

function truncateToWords(text, maxWords) {
  const words = text.split(/\s+/);
  return words.slice(0, maxWords).join(' ') + (words.length > maxWords ? '...' : '');
}
```

---

## Token counting

Use the `tiktoken` package (GPT-4 tokenizer; close to Claude's token counts):

```js
import { get_encoding } from 'tiktoken';
const enc = get_encoding('cl100k_base');

function countTokens(text) {
  return enc.encode(text).length;
}

// Batch count for page array
function countAllTokens(pages) {
  return pages.reduce((sum, p) => sum + countTokens(p.markdown), 0);
}
```

If `tiktoken` is unavailable, estimate: `tokens ≈ wordCount * 1.3`.

---

## Edge cases

### Pages with 0 code blocks

Some docs pages are conceptual explanations with no code. Score them lower but
don't discard entirely if their headings match high-value patterns (auth concepts,
error code explanations, architectural overviews). Cap at 200 words from these pages.

### Multi-language code tabs

Some docs render code examples in tabs (Swift / Kotlin / JS). The Markdown output
from the crawl usually includes all tab content sequentially with language tags.
Filter to only the user's language:

```js
function filterToLanguage(markdown, language) {
  const lines = markdown.split('\n');
  const result = [];
  let inBlock = false;
  let blockLang = '';

  for (const line of lines) {
    if (line.startsWith('```')) {
      blockLang = line.replace('```', '').trim().toLowerCase();
      inBlock = !inBlock;
      if (isTargetLanguage(blockLang, language)) result.push(line);
    } else if (inBlock) {
      if (isTargetLanguage(blockLang, language)) result.push(line);
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}

function isTargetLanguage(blockLang, targetLanguage) {
  const langMap = {
    'swift': ['swift'],
    'node': ['js', 'javascript', 'typescript', 'ts'],
    'python': ['python', 'py'],
  };
  const targets = langMap[targetLanguage.toLowerCase()] || [targetLanguage.toLowerCase()];
  return targets.includes(blockLang) || blockLang === '' || blockLang === 'bash' || blockLang === 'shell';
}
```

### Very short pages (< 100 words)

Usually nav pages, index pages, or stubs. Score them 0 and discard entirely.

### Duplicate content

Some docs sites have the same content at multiple URLs (versioned aliases, canonical
redirects). Deduplicate by content hash before scoring:

```js
const seen = new Set();
const deduped = pages.filter(page => {
  const hash = simpleHash(page.markdown.slice(0, 500)); // first 500 chars
  if (seen.has(hash)) return false;
  seen.add(hash);
  return true;
});

function simpleHash(str) {
  return str.split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0).toString();
}
```
