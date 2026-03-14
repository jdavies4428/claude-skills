/**
 * page-diff tests
 *
 * checkPageDiff delegates all its diff logic to a straightforward set-comparison
 * after calling fetchPageLinks. Rather than issuing real HTTP requests, we test:
 *
 *   1. The diff algorithm directly by re-implementing the same logic inline
 *      (verifying the algorithm's contract, which is what the module uses).
 *   2. checkPageDiff with a module-level mock of fetchPageLinks using
 *      Node.js built-in module mocking (available since Node 22).
 */

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// 1. Standalone diff-logic unit tests
//    These replicate the exact set-comparison from page-diff.js so we can
//    verify correctness independently of any I/O.
// ---------------------------------------------------------------------------

function computeDiff(currentLinks, lastKnownLinks) {
  const lastSet = new Set(lastKnownLinks);
  const currentSet = new Set(currentLinks);
  const addedLinks = currentLinks.filter((url) => !lastSet.has(url));
  const removedLinks = lastKnownLinks.filter((url) => !currentSet.has(url));
  const changed = addedLinks.length > 0 || removedLinks.length > 0;
  return { changed, addedLinks, removedLinks, currentLinks };
}

describe('page-diff set-comparison logic', () => {
  it('returns changed: false when link sets are identical', () => {
    const links = ['https://example.com/a.csv', 'https://example.com/b.xlsx'];
    const result = computeDiff(links, links);
    assert.equal(result.changed, false);
    assert.deepEqual(result.addedLinks, []);
    assert.deepEqual(result.removedLinks, []);
    assert.deepEqual(result.currentLinks, links);
  });

  it('returns changed: false when both sets are empty', () => {
    const result = computeDiff([], []);
    assert.equal(result.changed, false);
    assert.deepEqual(result.addedLinks, []);
    assert.deepEqual(result.removedLinks, []);
  });

  it('detects newly added links', () => {
    const last = ['https://example.com/a.csv'];
    const current = ['https://example.com/a.csv', 'https://example.com/b.xlsx'];
    const result = computeDiff(current, last);
    assert.equal(result.changed, true);
    assert.deepEqual(result.addedLinks, ['https://example.com/b.xlsx']);
    assert.deepEqual(result.removedLinks, []);
  });

  it('detects removed links', () => {
    const last = ['https://example.com/a.csv', 'https://example.com/b.xlsx'];
    const current = ['https://example.com/a.csv'];
    const result = computeDiff(current, last);
    assert.equal(result.changed, true);
    assert.deepEqual(result.addedLinks, []);
    assert.deepEqual(result.removedLinks, ['https://example.com/b.xlsx']);
  });

  it('detects both added and removed links simultaneously', () => {
    const last = ['https://example.com/old.csv', 'https://example.com/keep.pdf'];
    const current = ['https://example.com/keep.pdf', 'https://example.com/new.xlsx'];
    const result = computeDiff(current, last);
    assert.equal(result.changed, true);
    assert.deepEqual(result.addedLinks, ['https://example.com/new.xlsx']);
    assert.deepEqual(result.removedLinks, ['https://example.com/old.csv']);
  });

  it('treats duplicate URLs in current as a single entry (set semantics)', () => {
    const last = ['https://example.com/a.csv'];
    // duplicates in current should not cause false "added" entries
    const current = ['https://example.com/a.csv', 'https://example.com/a.csv'];
    // After Set dedup the current is just {a.csv} — same as last, no change
    const currentDeduped = [...new Set(current)];
    const result = computeDiff(currentDeduped, last);
    assert.equal(result.changed, false);
  });

  it('returns changed: true when going from non-empty to empty', () => {
    const last = ['https://example.com/a.csv'];
    const result = computeDiff([], last);
    assert.equal(result.changed, true);
    assert.deepEqual(result.addedLinks, []);
    assert.deepEqual(result.removedLinks, ['https://example.com/a.csv']);
  });

  it('returns changed: true when going from empty to non-empty', () => {
    const current = ['https://example.com/a.csv'];
    const result = computeDiff(current, []);
    assert.equal(result.changed, true);
    assert.deepEqual(result.addedLinks, ['https://example.com/a.csv']);
    assert.deepEqual(result.removedLinks, []);
  });
});

// ---------------------------------------------------------------------------
// 2. checkPageDiff with mocked fetchPageLinks
//
//    mock.module must be called only once per module URL per test run.
//    We install the mock before the suite, vary its behaviour via a shared
//    mutable variable, then restore after the suite.
// ---------------------------------------------------------------------------

describe('checkPageDiff with mocked fetchPageLinks', () => {
  // Mutable stub — each test sets this before calling checkPageDiff.
  let stubbedLinks = [];

  before(async () => {
    mock.module('../scripts/lib/fetchers/page-links.js', {
      namedExports: {
        fetchPageLinks: async () => ({ links: stubbedLinks, pageHash: 'stubbed-hash' }),
      },
    });
  });

  after(() => {
    mock.restoreAll();
  });

  it('returns changed: false when fetched links match lastKnownLinks', async () => {
    stubbedLinks = [
      { url: 'https://example.com/a.csv', filename: 'a.csv', extension: '.csv' },
    ];

    const { checkPageDiff } = await import('../scripts/lib/monitors/page-diff.js');
    const result = await checkPageDiff('https://example.com', ['https://example.com/a.csv']);

    assert.equal(result.changed, false);
    assert.deepEqual(result.addedLinks, []);
    assert.deepEqual(result.removedLinks, []);
    assert.deepEqual(result.currentLinks, ['https://example.com/a.csv']);
  });

  it('returns changed: true and populates addedLinks when new links appear', async () => {
    stubbedLinks = [
      { url: 'https://example.com/a.csv', filename: 'a.csv', extension: '.csv' },
      { url: 'https://example.com/b.xlsx', filename: 'b.xlsx', extension: '.xlsx' },
    ];

    const { checkPageDiff } = await import('../scripts/lib/monitors/page-diff.js');
    const result = await checkPageDiff('https://example.com', ['https://example.com/a.csv']);

    assert.equal(result.changed, true);
    assert.deepEqual(result.addedLinks, ['https://example.com/b.xlsx']);
    assert.deepEqual(result.removedLinks, []);
  });

  it('returns changed: true and populates removedLinks when links disappear', async () => {
    stubbedLinks = [
      { url: 'https://example.com/a.csv', filename: 'a.csv', extension: '.csv' },
    ];

    const { checkPageDiff } = await import('../scripts/lib/monitors/page-diff.js');
    const result = await checkPageDiff('https://example.com', [
      'https://example.com/a.csv',
      'https://example.com/gone.pdf',
    ]);

    assert.equal(result.changed, true);
    assert.deepEqual(result.addedLinks, []);
    assert.deepEqual(result.removedLinks, ['https://example.com/gone.pdf']);
  });

  it('defaults lastKnownLinks to [] when not provided', async () => {
    stubbedLinks = [
      { url: 'https://example.com/new.csv', filename: 'new.csv', extension: '.csv' },
    ];

    const { checkPageDiff } = await import('../scripts/lib/monitors/page-diff.js');
    const result = await checkPageDiff('https://example.com');

    assert.equal(result.changed, true);
    assert.deepEqual(result.addedLinks, ['https://example.com/new.csv']);
    assert.deepEqual(result.removedLinks, []);
  });
});
