function normalizeInputUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new Error('A docs, homepage, or repository URL is required.');
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new URL(withProtocol);
}

function normalizeCandidateUrl(baseUrl, href) {
  try {
    const url = new URL(href, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function stripTags(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(text) {
  return String(text ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function countMatches(text, pattern) {
  return String(text ?? '').match(pattern)?.length ?? 0;
}

function titleFromHtml(html) {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtml(match?.[1] ?? '').replace(/\s+/g, ' ').trim();
}

function extractAnchors(html, baseUrl) {
  const anchors = [];
  const pattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of String(html ?? '').matchAll(pattern)) {
    const url = normalizeCandidateUrl(baseUrl, match[1]);
    if (!url) {
      continue;
    }

    anchors.push({
      url,
      text: stripTags(match[2]).slice(0, 120),
    });
  }

  return anchors;
}

function uniqueByUrl(items) {
  const seen = new Set();
  const uniqueItems = [];

  for (const item of items) {
    if (!item?.url || seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

function isDocsLike(text) {
  return /(docs?|documentation|developer|developers|reference|api|sdk|get started|quickstart|guide)/i.test(text);
}

function looksLikeDocsUrl(url) {
  const value = String(url ?? '').toLowerCase();
  return /(^https?:\/\/docs\.)|(\/docs\/?)|(\/documentation\/?)|(\/developers?\/?)|(\/reference\/?)|(\/api-reference\/?)|(\/sdk\/?)/.test(value);
}

function buildHeuristicCandidates(url) {
  const seeds = [{ url: url.toString(), reason: 'entered URL' }];
  const host = url.host;
  const root = `${url.protocol}//${host}`;
  const subdomains = ['docs', 'developer', 'developers', 'api'];
  const paths = ['/docs', '/documentation', '/developers', '/developer', '/reference', '/api-reference', '/api-docs'];

  for (const subdomain of subdomains) {
    if (!host.startsWith(`${subdomain}.`)) {
      seeds.push({ url: `${url.protocol}//${subdomain}.${host}${url.pathname === '/' ? '' : url.pathname}`, reason: `${subdomain} subdomain` });
    }
  }

  for (const candidatePath of paths) {
    seeds.push({ url: `${root}${candidatePath}`, reason: `${candidatePath} path` });
  }

  if (host === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      seeds.push({
        url: `https://${parts[0]}.github.io/${parts[1]}`,
        reason: 'GitHub Pages heuristic',
      });
    }
  }

  return uniqueByUrl(seeds);
}

async function fetchText(url, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    headers: {
      'user-agent': 'doc-to-skill-discovery/1.0',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });

  const text = await response.text().catch(() => '');
  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url ?? url,
    text,
  };
}

async function probeUrl(candidate, options = {}, cache = new Map()) {
  if (cache.has(candidate.url)) {
    return { ...cache.get(candidate.url), reason: candidate.reason };
  }

  try {
    const result = await fetchText(candidate.url, options);
    const html = result.text;
    const title = titleFromHtml(html);
    const headingCount = countMatches(html, /<h[1-6]\b/gi);
    const codeBlockCount = countMatches(html, /<(pre|code)\b/gi);
    const textPreview = stripTags(html).slice(0, 220);
    const docsLinks = extractAnchors(html, result.finalUrl)
      .filter((anchor) => isDocsLike(`${anchor.url} ${anchor.text}`))
      .slice(0, 5);

    let docsScore = result.ok ? 20 : -10;
    if (looksLikeDocsUrl(result.finalUrl)) {
      docsScore += 20;
    }
    if (isDocsLike(title)) {
      docsScore += 15;
    }
    if (isDocsLike(candidate.reason)) {
      docsScore += 5;
    }
    if (headingCount >= 4) {
      docsScore += 5;
    }
    if (codeBlockCount >= 2) {
      docsScore += 5;
    }
    if (/(blog|changelog|pricing|legal|community|forum)/i.test(result.finalUrl)) {
      docsScore -= 25;
    }

    const probed = {
      url: result.finalUrl,
      originalUrl: candidate.url,
      ok: result.ok,
      status: result.status,
      title,
      headingCount,
      codeBlockCount,
      docsScore,
      textPreview,
      docsLinks,
      reason: candidate.reason,
    };

    cache.set(candidate.url, probed);
    return probed;
  } catch (error) {
    const failed = {
      url: candidate.url,
      originalUrl: candidate.url,
      ok: false,
      status: 0,
      title: '',
      headingCount: 0,
      codeBlockCount: 0,
      docsScore: -100,
      textPreview: '',
      docsLinks: [],
      reason: candidate.reason,
      error: error.message,
    };

    cache.set(candidate.url, failed);
    return failed;
  }
}

export async function discoverDocsCandidates(inputUrl, options = {}) {
  const normalized = normalizeInputUrl(inputUrl);
  const cache = new Map();
  const seeds = buildHeuristicCandidates(normalized);

  const inputProbe = await probeUrl({ url: normalized.toString(), reason: 'entered URL' }, options, cache);
  if (inputProbe.docsLinks.length > 0) {
    for (const anchor of inputProbe.docsLinks) {
      seeds.push({
        url: anchor.url,
        reason: `page link: ${anchor.text || 'docs-like link'}`,
      });
    }
  }

  const results = [];
  for (const candidate of uniqueByUrl(seeds).slice(0, 12)) {
    results.push(await probeUrl(candidate, options, cache));
  }

  return uniqueByUrl(results)
    .filter((result) => result.ok)
    .sort((left, right) => right.docsScore - left.docsScore || left.url.localeCompare(right.url));
}

export async function previewDocsTarget(inputUrl, options = {}) {
  const normalized = normalizeInputUrl(inputUrl);
  const preview = await probeUrl({ url: normalized.toString(), reason: 'preview target' }, options);
  return {
    ...preview,
    suggestedDocsLinks: preview.docsLinks,
  };
}

export function guessLibraryName(inputUrl, title = '') {
  const cleanedTitle = String(title ?? '')
    .replace(/\b(docs?|documentation|developer(s)?|api reference|reference|sdk)\b/gi, ' ')
    .replace(/[-|:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanedTitle) {
    return cleanedTitle;
  }

  const url = normalizeInputUrl(inputUrl);
  const host = url.hostname.replace(/^docs\./, '').replace(/^developers?\./, '').replace(/^api\./, '');
  const [name] = host.split('.');
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
