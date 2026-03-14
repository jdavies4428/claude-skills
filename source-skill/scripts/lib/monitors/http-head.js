import { checkFileChanged } from '../fetchers/file-link.js';

/**
 * Check whether a remote resource has changed by inspecting HTTP headers.
 *
 * Delegates to checkFileChanged for the actual HEAD request and comparison.
 *
 * @param {string} url
 * @param {string|null} lastETag
 * @param {string|null} lastModified
 * @returns {Promise<{changed: boolean, etag: string|null, lastModified: string|null}>}
 */
export async function checkHttpHead(url, lastETag, lastModified) {
  return checkFileChanged(url, lastETag, lastModified);
}
