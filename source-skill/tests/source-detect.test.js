import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectSourceType, SOURCE_TYPES } from '../scripts/lib/source-detect.js';

// ---------------------------------------------------------------------------
// Heuristic pattern tests — these short-circuit before any network call
// ---------------------------------------------------------------------------

describe('detectSourceType – direct file extension (no network)', () => {
  const directFileUrls = [
    ['xlsx', 'https://example.com/data/report.xlsx'],
    ['xls',  'https://example.com/data/report.xls'],
    ['csv',  'https://example.com/export/data.csv'],
    ['pdf',  'https://example.com/files/manual.pdf'],
    ['json', 'https://example.com/config/settings.json'],
    ['zip',  'https://example.com/archive.zip'],
  ];

  for (const [ext, url] of directFileUrls) {
    it(`classifies .${ext} URL as DIRECT_FILE`, async () => {
      const result = await detectSourceType(url);
      assert.equal(result, SOURCE_TYPES.DIRECT_FILE);
    });
  }
});

describe('detectSourceType – docs site heuristics (no network)', () => {
  const docsSiteUrls = [
    ['docs. subdomain',       'https://docs.example.com/overview'],
    ['developer. subdomain',  'https://developer.example.com/guide'],
    ['developers. subdomain', 'https://developers.example.com/api'],
    ['readthedocs.io',        'https://myproject.readthedocs.io/en/latest/'],
    ['readthedocs.org',       'https://myproject.readthedocs.org/en/stable/'],
    ['gitbook.io',            'https://myorg.gitbook.io/my-book/'],
    ['gitbook.com',           'https://myorg.gitbook.com/my-book/'],
    ['mintlify.com',          'https://myapp.mintlify.com/introduction'],
    ['.github.io',            'https://myorg.github.io/project/'],
    ['/docs/ path segment',   'https://example.com/docs/getting-started'],
    ['/guide/ path segment',  'https://example.com/guide/installation'],
    ['/guides/ path segment', 'https://example.com/guides/quickstart'],
    ['/reference/ segment',   'https://example.com/reference/api'],
    ['/documentation/ seg',   'https://example.com/documentation/overview'],
  ];

  for (const [label, url] of docsSiteUrls) {
    it(`classifies "${label}" as DOCS_SITE`, async () => {
      const result = await detectSourceType(url);
      assert.equal(result, SOURCE_TYPES.DOCS_SITE);
    });
  }
});

describe('detectSourceType – API endpoint heuristics (no network)', () => {
  const apiUrls = [
    ['https://example.com/api/users',          '/api/ segment'],
    ['https://example.com/v1/products',         '/v1/ segment'],
    ['https://example.com/v2/orders',           '/v2/ segment'],
    ['https://example.com/v10/records',         '/v10/ segment'],
    ['https://example.com/api/v3/search',       '/api/ before /v3/'],
  ];

  for (const [url, label] of apiUrls) {
    it(`classifies ${label} as API_ENDPOINT`, async () => {
      const result = await detectSourceType(url);
      assert.equal(result, SOURCE_TYPES.API_ENDPOINT);
    });
  }
});

describe('detectSourceType – early patterns take precedence', () => {
  it('DIRECT_FILE wins over docs subdomain when URL has a direct extension', async () => {
    // docs.example.com/data.csv — extension check fires first
    const result = await detectSourceType('https://docs.example.com/data.csv');
    assert.equal(result, SOURCE_TYPES.DIRECT_FILE);
  });

  it('DIRECT_FILE wins over API-like path when URL has a direct extension', async () => {
    // /api/export.json — extension check fires first
    const result = await detectSourceType('https://example.com/api/export.json');
    assert.equal(result, SOURCE_TYPES.DIRECT_FILE);
  });

  it('DOCS_SITE wins over API path when docs subdomain is present', async () => {
    // docs.example.com/api/users — docs subdomain check fires before api check
    const result = await detectSourceType('https://docs.example.com/api/users');
    assert.equal(result, SOURCE_TYPES.DOCS_SITE);
  });
});

describe('SOURCE_TYPES constant shape', () => {
  it('exports expected keys', () => {
    assert.equal(SOURCE_TYPES.DOCS_SITE,      'docs-site');
    assert.equal(SOURCE_TYPES.PAGE_WITH_LINKS,'page-with-links');
    assert.equal(SOURCE_TYPES.DIRECT_FILE,    'direct-file');
    assert.equal(SOURCE_TYPES.API_ENDPOINT,   'api-endpoint');
    assert.equal(SOURCE_TYPES.UNKNOWN,        'unknown');
  });
});
