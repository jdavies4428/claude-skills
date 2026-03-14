import test from 'node:test';
import assert from 'node:assert/strict';

import { discoverDocsCandidates, previewDocsTarget } from '../scripts/lib/discovery.js';

function createMockFetch(pages) {
  return async function mockFetch(url) {
    const html = pages[url];
    if (!html) {
      return {
        ok: false,
        status: 404,
        url,
        async text() {
          return '<html><title>Not found</title></html>';
        },
      };
    }

    return {
      ok: true,
      status: 200,
      url,
      async text() {
        return html;
      },
    };
  };
}

test('discoverDocsCandidates ranks docs pages above the homepage', async () => {
  const fetchImpl = createMockFetch({
    'https://example.com/': `
      <html>
        <title>Example</title>
        <a href="/docs">Documentation</a>
        <a href="/blog">Blog</a>
      </html>
    `,
    'https://example.com/docs': `
      <html>
        <title>Example Docs</title>
        <h1>Docs</h1>
        <h2>Install</h2>
        <pre>npm install example</pre>
      </html>
    `,
  });

  const candidates = await discoverDocsCandidates('https://example.com', { fetchImpl });
  assert.ok(candidates.length >= 1);
  assert.equal(candidates[0].url, 'https://example.com/docs');
});

test('previewDocsTarget returns title and docs-like links', async () => {
  const fetchImpl = createMockFetch({
    'https://example.com/docs': `
      <html>
        <title>Example Docs</title>
        <h1>Docs</h1>
        <h2>Quickstart</h2>
        <pre>npm install example</pre>
        <a href="/reference">Reference</a>
      </html>
    `,
  });

  const preview = await previewDocsTarget('https://example.com/docs', { fetchImpl });
  assert.equal(preview.title, 'Example Docs');
  assert.ok(preview.headingCount >= 2);
  assert.ok(preview.suggestedDocsLinks.some((link) => link.url === 'https://example.com/reference'));
});
