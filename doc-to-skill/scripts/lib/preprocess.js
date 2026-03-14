function normalizeMarkdown(markdown) {
  return String(markdown ?? '').replace(/\r\n/g, '\n').trim();
}

export function estimateTokens(text) {
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return Math.ceil(words.length * 1.3);
}

export function truncateToWords(text, maxWords) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(' ');
  }

  return `${words.slice(0, maxWords).join(' ')}...`;
}

export function getUrlBonus(url) {
  const value = String(url ?? '').toLowerCase();

  if (/\/(quickstart|get-started|getting-started|getting_started)\b/.test(value)) {
    return 15;
  }

  if (/\/(authentication|auth|api-keys?|authorization)\b/.test(value)) {
    return 12;
  }

  if (/\/(reference|api-reference|reference-api|api\/v\d*)\b/.test(value)) {
    return 8;
  }

  if (/\/(error|errors|rate-limit|rate_limits?)\b/.test(value)) {
    return 10;
  }

  if (/\/(install|installation|setup|initialize|init)\b/.test(value)) {
    return 8;
  }

  if (/\/(changelog|migration|deprecated|blog|about|pricing|legal|compliance|community|forum|status)\b/.test(value)) {
    return -20;
  }

  return 0;
}

export function getTitleBonus(title) {
  const value = String(title ?? '').toLowerCase();

  if (/(quick ?start|get(ting)? started)/.test(value)) {
    return 10;
  }

  if (/(authentication|authorization|api keys?)/.test(value)) {
    return 8;
  }

  if (/(api reference|reference)/.test(value)) {
    return 5;
  }

  if (/(migration|deprecated|legacy|v[0-9]\.x)/.test(value)) {
    return -15;
  }

  return 0;
}

export function scorePage(page) {
  const markdown = normalizeMarkdown(page.markdown);
  const stats = page.json ?? {};
  const codeBlockCount = stats.codeBlockCount ?? (markdown.match(/^```/gm)?.length ?? 0) / 2;
  const headingCount = stats.headingCount ?? (markdown.match(/^#{1,6}\s/gm)?.length ?? 0);
  const wordCount = stats.wordCount ?? markdown.split(/\s+/).filter(Boolean).length;

  return (
    (codeBlockCount * 3)
    + headingCount
    + (wordCount / 100)
    + getUrlBonus(page.url)
    + getTitleBonus(page.metadata?.title)
  );
}

export function scorePages(pages, options = {}) {
  const maxPages = options.maxPages ?? 30;

  return pages
    .map((page) => ({
      ...page,
      markdown: normalizeMarkdown(page.markdown),
      score: scorePage(page),
    }))
    .filter((page) => page.score > 0 && page.markdown.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxPages);
}

export function splitBySections(markdown) {
  const lines = normalizeMarkdown(markdown).split('\n');
  const sections = [];
  let current = { heading: '# Document', body: [] };

  for (const line of lines) {
    if (/^#\s/.test(line) && current.heading === '# Document' && current.body.length === 0) {
      current.heading = line.trim();
      continue;
    }

    if (/^#{2,3}\s/.test(line)) {
      if (current.heading || current.body.length > 0) {
        sections.push({
          heading: current.heading,
          body: current.body.join('\n').trim(),
        });
      }

      current = { heading: line.trim(), body: [] };
      continue;
    }

    current.body.push(line);
  }

  if (current.heading || current.body.length > 0) {
    sections.push({
      heading: current.heading,
      body: current.body.join('\n').trim(),
    });
  }

  return sections.filter((section) => section.body.length > 0);
}

export function isHighSignal(section) {
  const heading = section.heading.toLowerCase();
  const body = section.body;

  if (/```/.test(body)) {
    return true;
  }

  if (/(install|setup|init|authentication|auth|quickstart|get(ting)? started|usage|example|error|rate limit|webhook|event|parameter|argument|response)/.test(heading)) {
    return true;
  }

  const lineCount = body.split('\n').length;
  return lineCount <= 20;
}

export function extractSections(markdown) {
  return splitBySections(markdown)
    .filter(isHighSignal)
    .map((section) => `${section.heading}\n${section.body}`.trim())
    .join('\n\n');
}

function getParagraphs(lines, startIndex, direction, maxParagraphs) {
  const collected = [];
  let paragraphCount = 0;
  let index = startIndex;

  while (index >= 0 && index < lines.length && paragraphCount < maxParagraphs) {
    const line = lines[index];
    collected[direction === -1 ? 'unshift' : 'push'](line);

    if (line.trim() === '') {
      paragraphCount += 1;
    }

    index += direction;
  }

  return collected;
}

export function extractCodeWithContext(markdown, options = {}) {
  const beforeParagraphs = options.beforeParagraphs ?? 2;
  const afterParagraphs = options.afterParagraphs ?? 1;
  const lines = normalizeMarkdown(markdown).split('\n');
  const chunks = [];
  let openFenceIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith('```') && openFenceIndex === -1) {
      openFenceIndex = index;
      chunks.push(...getParagraphs(lines, index - 1, -1, beforeParagraphs));
      continue;
    }

    if (lines[index].startsWith('```') && openFenceIndex !== -1) {
      chunks.push(...lines.slice(openFenceIndex, index + 1));
      chunks.push(...getParagraphs(lines, index + 1, 1, afterParagraphs));
      chunks.push('');
      openFenceIndex = -1;
    }
  }

  return chunks.join('\n').trim();
}

function formatSection(type, url, content) {
  return `[${type}] Source: ${url}\n\n${content}`.trim();
}

function matchesAnyPattern(url, patterns) {
  return patterns.some((pattern) => pattern.test(url));
}

function findPage(pages, patterns, usedUrls) {
  return pages.find((page) => !usedUrls.has(page.url) && matchesAnyPattern(page.url.toLowerCase(), patterns));
}

export function assembleFeed(scoredPages, options = {}) {
  const targetTokens = options.targetTokens ?? 55000;
  const supplementalWords = options.supplementalWords ?? 400;
  const usedUrls = new Set();
  const feedSections = [];
  const selectedPages = [];
  let tokenEstimate = 0;
  const errorPage = findPage(
    scoredPages,
    [/\/error/, /\/errors/, /rate-limit/, /rate_limits?/],
    usedUrls,
  );

  function addSection(type, page, content) {
    if (!page || !content) {
      return false;
    }

    const normalized = normalizeMarkdown(content);
    if (!normalized) {
      return false;
    }

    const sectionTokens = estimateTokens(normalized);
    if (feedSections.length > 0 && tokenEstimate + sectionTokens > targetTokens) {
      return false;
    }

    feedSections.push(formatSection(type, page.url, normalized));
    selectedPages.push({
      type,
      url: page.url,
      score: page.score,
      tokenEstimate: sectionTokens,
    });
    tokenEstimate += sectionTokens;
    usedUrls.add(page.url);
    return true;
  }

  const quickstart = findPage(
    scoredPages,
    [/quickstart/, /getting-started/, /getting_started/, /get-started/],
    usedUrls,
  );
  addSection('QUICKSTART', quickstart, quickstart?.markdown);

  const authPage = findPage(
    scoredPages,
    [/authentication/, /authorization/, /auth\b/, /api-key/, /api-keys/, /initialize/, /init\b/],
    usedUrls,
  );
  addSection('AUTHENTICATION', authPage, extractSections(authPage?.markdown));

  const topReferencePages = scoredPages
    .filter((page) => !usedUrls.has(page.url) && page.url !== errorPage?.url)
    .slice(0, 5);

  for (const page of topReferencePages) {
    const codeWithContext = extractCodeWithContext(page.markdown);
    const highSignalSections = extractSections(page.markdown);
    const content = codeWithContext.length >= 200 ? codeWithContext : highSignalSections;
    addSection('REFERENCE', page, content);
  }

  addSection('ERROR REFERENCE', errorPage, errorPage?.markdown);

  for (const page of scoredPages) {
    if (usedUrls.has(page.url)) {
      continue;
    }

    const excerpt = truncateToWords(page.markdown, supplementalWords);
    const added = addSection('SUPPLEMENTAL', page, excerpt);
    if (!added) {
      break;
    }
  }

  return {
    feed: feedSections.join('\n\n---\n\n'),
    tokenEstimate,
    selectedPages,
    totalPagesConsidered: scoredPages.length,
  };
}

export function preprocessPages(pages, options = {}) {
  const scoredPages = scorePages(pages, options);
  const assembled = assembleFeed(scoredPages, options);

  return {
    scoredPages,
    ...assembled,
  };
}
