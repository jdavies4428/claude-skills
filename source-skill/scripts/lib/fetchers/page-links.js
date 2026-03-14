import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { URL } from 'url';

const DOWNLOAD_EXTENSIONS = new Set(['.xls', '.xlsx', '.csv', '.pdf', '.zip']);

/**
 * Perform an HTTP GET request and return status, headers, and body.
 *
 * @param {string} urlString
 * @returns {Promise<{statusCode: number, headers: object, body: string}>}
 */
function httpGet(urlString) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'source-skill/1.0',
        Accept: 'text/html,*/*',
      },
      timeout: 15000,
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Resolve a potentially relative href against a base URL.
 *
 * @param {string} href
 * @param {string} baseUrl
 * @returns {string|null}
 */
function resolveHref(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Extract download links from HTML source.
 *
 * @param {string} html
 * @param {string} baseUrl
 * @param {RegExp|null} pattern
 * @returns {{url: string, filename: string, extension: string}[]}
 */
function extractDownloadLinks(html, baseUrl, pattern) {
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  const seen = new Set();
  const links = [];

  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1].trim();
    const lower = href.toLowerCase().split('?')[0]; // strip query for extension check
    const dotIndex = lower.lastIndexOf('.');
    if (dotIndex === -1) continue;

    const ext = lower.slice(dotIndex);
    if (!DOWNLOAD_EXTENSIONS.has(ext)) continue;

    const resolved = resolveHref(href, baseUrl);
    if (!resolved) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    if (pattern && !pattern.test(resolved)) continue;

    const filename = resolved.split('/').at(-1).split('?')[0] || resolved;

    links.push({ url: resolved, filename, extension: ext });
  }

  return links;
}

/**
 * Compute a sha256 hash of sorted link URLs for change detection.
 *
 * @param {{url: string}[]} links
 * @returns {string}
 */
function hashLinks(links) {
  const sorted = links.map((l) => l.url).sort();
  return crypto.createHash('sha256').update(sorted.join('\n')).digest('hex');
}

/**
 * Quick HTTP HEAD — returns true if the URL exists (2xx), false on 4xx/5xx/error.
 *
 * @param {string} urlString
 * @returns {Promise<{exists: boolean, lastModified: string|null}>}
 */
function httpHeadCheck(urlString) {
  return new Promise((resolve) => {
    const parsed = new URL(urlString);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'HEAD',
      headers: { 'User-Agent': 'source-skill/1.0' },
      timeout: 10000,
    };

    const req = lib.request(options, (res) => {
      res.resume();
      const ct = res.headers['content-type'] || '';
      // A file link that returns HTML is a soft 404
      const isHtml = ct.includes('text/html');
      const exists = res.statusCode >= 200 && res.statusCode < 400 && !isHtml;
      resolve({ exists, lastModified: res.headers['last-modified'] ?? null });
    });

    req.on('timeout', () => { req.destroy(); resolve({ exists: false, lastModified: null }); });
    req.on('error', () => resolve({ exists: false, lastModified: null }));
    req.end();
  });
}

/**
 * Fetch an HTML page and return all embedded download links.
 *
 * @param {string} url - Page URL to fetch
 * @param {object} [opts]
 * @param {RegExp} [opts.pattern] - Optional regex to filter link URLs
 * @param {number} [opts.limit=10] - Max links to return
 * @param {boolean} [opts.probeLatest=false] - HEAD-check links to find first valid one
 * @param {function} [opts.onProbe] - Callback(link, exists) for progress reporting
 * @returns {Promise<{links: {url: string, filename: string, extension: string}[], pageHash: string, latestLink: object|null}>}
 */
export async function fetchPageLinks(url, opts = {}) {
  const limit = opts.limit ?? 10;
  const pattern = opts.pattern ?? null;
  const probeLatest = opts.probeLatest ?? false;

  const response = await httpGet(url);

  if (response.statusCode < 200 || response.statusCode >= 400) {
    throw new Error(`HTTP ${response.statusCode} fetching page: ${url}`);
  }

  const allLinks = extractDownloadLinks(response.body, url, pattern);
  const links = allLinks.slice(0, limit);
  const pageHash = hashLinks(allLinks); // hash over full set, not truncated

  let latestLink = null;

  if (probeLatest && allLinks.length > 0) {
    for (const link of allLinks) {
      const { exists, lastModified } = await httpHeadCheck(link.url);
      if (opts.onProbe) opts.onProbe(link, exists);
      if (exists) {
        latestLink = { ...link, lastModified };
        break;
      }
    }
  }

  return { links, pageHash, latestLink };
}
