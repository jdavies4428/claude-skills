import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';

import { preprocessPages, scorePages } from '../scripts/lib/preprocess.js';

const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/sample-crawl.json');

async function loadFixture() {
  return JSON.parse(await fs.readFile(fixturePath, 'utf8'));
}

test('scorePages prefers high-signal docs and drops changelog pages', async () => {
  const fixture = await loadFixture();
  const scored = scorePages(fixture.pages);

  assert.ok(scored.length >= 4);
  assert.equal(scored.some((page) => page.url.includes('/changelog/')), false);
  assert.equal(scored[0].url, 'https://docs.example.dev/quickstart');
});

test('preprocessPages assembles prioritized feed sections', async () => {
  const fixture = await loadFixture();
  const result = preprocessPages(fixture.pages, { targetTokens: 10000 });

  assert.match(result.feed, /\[QUICKSTART\] Source: https:\/\/docs\.example\.dev\/quickstart/);
  assert.match(result.feed, /\[AUTHENTICATION\] Source: https:\/\/docs\.example\.dev\/guides\/authentication/);
  assert.match(result.feed, /\[ERROR REFERENCE\] Source: https:\/\/docs\.example\.dev\/reference\/errors/);
  assert.ok(result.tokenEstimate > 0);
  assert.ok(result.selectedPages.length >= 4);
});
