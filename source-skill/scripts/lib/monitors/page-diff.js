import { fetchPageLinks } from '../fetchers/page-links.js';

/**
 * Check whether the download links on a page have changed.
 *
 * Uses probeLatest to find the actual latest valid file (skips 404s).
 * Change is detected when:
 *   - The latest valid file URL differs from the stored latest
 *   - OR the set of all links has changed
 *
 * @param {string} sourceUrl - The page to re-fetch
 * @param {string[]} lastKnownLinks - Array of previously seen link URLs
 * @param {object} [opts]
 * @param {RegExp} [opts.pattern] - Optional regex to filter links
 * @param {number} [opts.limit] - Max links to consider
 * @param {string} [opts.lastLatestUrl] - The previously identified latest valid URL
 * @returns {Promise<{changed: boolean, addedLinks: string[], removedLinks: string[], currentLinks: string[], latestLink: object|null}>}
 */
export async function checkPageDiff(sourceUrl, lastKnownLinks = [], opts = {}) {
  const { links, latestLink } = await fetchPageLinks(sourceUrl, {
    ...opts,
    probeLatest: !!opts.lastLatestUrl,
  });

  const currentLinks = links.map((l) => l.url);

  const lastSet = new Set(lastKnownLinks);
  const currentSet = new Set(currentLinks);

  const addedLinks = currentLinks.filter((url) => !lastSet.has(url));
  const removedLinks = lastKnownLinks.filter((url) => !currentSet.has(url));

  // Check if the latest valid file changed (the key signal for data sources)
  let latestChanged = false;
  if (opts.lastLatestUrl && latestLink) {
    latestChanged = latestLink.url !== opts.lastLatestUrl;
  }

  const changed = latestChanged || addedLinks.length > 0 || removedLinks.length > 0;

  return { changed, addedLinks, removedLinks, currentLinks, latestLink };
}
