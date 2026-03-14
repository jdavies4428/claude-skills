import https from 'https';
import http from 'http';

export const SOURCE_TYPES = {
  DOCS_SITE: 'docs-site',
  PAGE_WITH_LINKS: 'page-with-links',
  PRODUCT_PAGE: 'product-page',
  DIRECT_FILE: 'direct-file',
  API_ENDPOINT: 'api-endpoint',
  UNKNOWN: 'unknown',
};

const DIRECT_FILE_EXTENSIONS = new Set(['.xls', '.xlsx', '.csv', '.pdf', '.json', '.zip']);

const DOWNLOAD_LINK_EXTENSIONS = new Set(['.xls', '.xlsx', '.csv', '.pdf', '.zip']);

const DOCS_SUBDOMAINS = new Set(['docs', 'documentation', 'developer', 'developers', 'dev']);

const DOCS_PLATFORMS = [
  'readthedocs.io',
  'readthedocs.org',
  'gitbook.io',
  'gitbook.com',
  'mintlify.com',
  'docusaurus.io',
  '.github.io',
];

const DOCS_PATH_SEGMENTS = ['/docs/', '/documentation/', '/guide/', '/guides/', '/reference/'];

function getPathExtension(urlString) {
  try {
    const parsed = new URL(urlString);
    const pathname = parsed.pathname;
    const lastSegment = pathname.split('/').at(-1) ?? '';
    const dotIndex = lastSegment.lastIndexOf('.');
    if (dotIndex === -1) return '';
    return lastSegment.slice(dotIndex).toLowerCase();
  } catch {
    return '';
  }
}

function isDocsSite(urlString) {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Check docs subdomain
    const subdomain = hostname.split('.').at(0);
    if (DOCS_SUBDOMAINS.has(subdomain)) return true;

    // Check known doc platform hostnames
    if (DOCS_PLATFORMS.some((platform) => hostname.includes(platform))) return true;

    // Check path segments
    if (DOCS_PATH_SEGMENTS.some((segment) => pathname.includes(segment))) return true;

    return false;
  } catch {
    return false;
  }
}

function isApiLike(urlString) {
  try {
    const parsed = new URL(urlString);
    const pathname = parsed.pathname.toLowerCase();
    return /\/(api|v\d+)\//i.test(pathname);
  } catch {
    return false;
  }
}

function httpGet(urlString, method = 'GET') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'User-Agent': 'source-skill/1.0',
        Accept: '*/*',
      },
      timeout: 30000,
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: method === 'HEAD' ? '' : Buffer.concat(chunks).toString('utf8'),
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

function scanForDownloadLinks(html) {
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  const links = [];
  let match;

  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1];
    const lower = href.toLowerCase();
    const dotIndex = lower.lastIndexOf('.');
    if (dotIndex !== -1) {
      const ext = lower.slice(dotIndex);
      if (DOWNLOAD_LINK_EXTENSIONS.has(ext)) {
        links.push(href);
      }
    }
  }

  return links;
}

/**
 * Classify a URL into a source type.
 *
 * @param {string} url
 * @returns {Promise<string>} one of SOURCE_TYPES values
 */
export async function detectSourceType(url) {
  // 1. Direct file by extension
  const ext = getPathExtension(url);
  if (DIRECT_FILE_EXTENSIONS.has(ext)) {
    return SOURCE_TYPES.DIRECT_FILE;
  }

  // 2. Docs site by URL shape
  if (isDocsSite(url)) {
    return SOURCE_TYPES.DOCS_SITE;
  }

  // 3. API-like path heuristic (fast, before network)
  if (isApiLike(url)) {
    return SOURCE_TYPES.API_ENDPOINT;
  }

  // 4. Network probe: GET the URL to check content and scan for download links
  //    (Skip HEAD — many servers don't support it or return different content-types)
  let getResult;
  try {
    getResult = await httpGet(url, 'GET');
  } catch {
    return SOURCE_TYPES.UNKNOWN;
  }

  const contentType = (getResult.headers['content-type'] ?? '').toLowerCase();

  if (contentType.includes('application/json') || contentType.includes('text/json')) {
    return SOURCE_TYPES.API_ENDPOINT;
  }

  // 5. If HTML, scan for download links
  if (contentType.includes('text/html') || getResult.body.includes('<html')) {
    const downloadLinks = scanForDownloadLinks(getResult.body);
    if (downloadLinks.length > 0) {
      return SOURCE_TYPES.PAGE_WITH_LINKS;
    }
  }

  return SOURCE_TYPES.UNKNOWN;
}
