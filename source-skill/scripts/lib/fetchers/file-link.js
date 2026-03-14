import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { URL } from 'url';

const MAX_REDIRECTS = 5;

/**
 * Follow redirects and perform an HTTP request.
 *
 * @param {string} urlString
 * @param {'GET'|'HEAD'} method
 * @param {import('fs').WriteStream} [dest]  Only used for GET with streaming
 * @param {number} [redirectCount]
 * @returns {Promise<{statusCode: number, headers: object, bytesWritten: number}>}
 */
function httpRequest(urlString, method, dest = null, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: { 'User-Agent': 'source-skill/1.0' },
      timeout: method === 'HEAD' ? 10000 : 60000,
    };

    const req = lib.request(options, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirectCount >= MAX_REDIRECTS) {
          reject(new Error(`Too many redirects for: ${urlString}`));
          return;
        }
        const next = new URL(res.headers.location, urlString).href;
        httpRequest(next, method, dest, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} fetching: ${urlString}`));
        return;
      }

      if (method === 'HEAD' || !dest) {
        res.resume();
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, bytesWritten: 0 });
        });
        return;
      }

      // GET with streaming to disk
      let bytesWritten = 0;
      res.on('data', (chunk) => { bytesWritten += chunk.length; });
      res.pipe(dest);
      dest.on('finish', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, bytesWritten });
      });
      dest.on('error', reject);
      res.on('error', reject);
    });

    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });
}

/**
 * Derive a filename from a URL.
 */
function filenameFromUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const segment = parsed.pathname.split('/').at(-1);
    return segment || 'download';
  } catch {
    return 'download';
  }
}

/** Content types that indicate the response is an HTML error page, not a real file. */
const HTML_CONTENT_TYPES = ['text/html', 'application/xhtml'];

/**
 * Download a file from url to destDir.
 * Follows redirects and validates that the response is a real file (not an HTML error page).
 *
 * @param {string} url
 * @param {string} destDir
 * @returns {Promise<{filePath: string, contentType: string, size: number, etag: string|null, lastModified: string|null}>}
 */
export async function fetchFile(url, destDir) {
  await fs.mkdir(destDir, { recursive: true });

  const filename = filenameFromUrl(url);
  const filePath = path.join(destDir, filename);

  const writeStream = createWriteStream(filePath);
  const { headers, bytesWritten } = await httpRequest(url, 'GET', writeStream);

  const contentType = headers['content-type'] ?? '';

  // Reject if the server returned HTML instead of a file (likely a 404/error page with 200 status)
  if (HTML_CONTENT_TYPES.some((t) => contentType.includes(t))) {
    await fs.unlink(filePath).catch(() => {});
    throw new Error(`Expected a file but got HTML (${contentType}). URL may not exist: ${url}`);
  }

  // Reject empty files
  if (bytesWritten === 0) {
    await fs.unlink(filePath).catch(() => {});
    throw new Error(`Downloaded 0 bytes from: ${url}`);
  }

  return {
    filePath,
    contentType,
    size: bytesWritten,
    etag: headers['etag'] ?? null,
    lastModified: headers['last-modified'] ?? null,
  };
}

/**
 * Check whether a remote file has changed since last seen.
 */
export async function checkFileChanged(url, lastETag, lastModified) {
  const { statusCode, headers } = await httpRequest(url, 'HEAD');

  const currentETag = headers['etag'] ?? null;
  const currentLastModified = headers['last-modified'] ?? null;

  let changed = true;
  if (lastETag && currentETag) {
    changed = lastETag !== currentETag;
  } else if (lastModified && currentLastModified) {
    changed = new Date(lastModified).getTime() !== new Date(currentLastModified).getTime();
  }

  return { changed, etag: currentETag, lastModified: currentLastModified };
}
