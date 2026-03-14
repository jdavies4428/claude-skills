import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInitialState, readState, writeState } from '../scripts/lib/source-state.js';

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

describe('createInitialState', () => {
  it('returns object with all expected top-level keys', () => {
    const state = createInitialState({
      skillName: 'My Skill',
      skillSlug: 'my-skill',
      sourceType: 'docs-site',
      sourceUrl: 'https://docs.example.com',
    });

    const keys = Object.keys(state);
    for (const expected of [
      'skillName', 'skillSlug', 'sourceType', 'sourceUrl',
      'monitorConfig', 'userContext', 'lastCheckTime', 'lastRefreshTime', 'contentHash',
    ]) {
      assert.ok(keys.includes(expected), `missing key: ${expected}`);
    }
  });

  it('uses provided values', () => {
    const state = createInitialState({
      skillName: 'FitTrack',
      skillSlug: 'fittrack',
      sourceType: 'direct-file',
      sourceUrl: 'https://example.com/data.csv',
    });

    assert.equal(state.skillName, 'FitTrack');
    assert.equal(state.skillSlug, 'fittrack');
    assert.equal(state.sourceType, 'direct-file');
    assert.equal(state.sourceUrl, 'https://example.com/data.csv');
  });

  it('defaults skillName and skillSlug to empty string when omitted', () => {
    const state = createInitialState({ sourceType: 'unknown', sourceUrl: '' });
    assert.equal(state.skillName, '');
    assert.equal(state.skillSlug, '');
  });

  it('defaults sourceType to "unknown" when omitted', () => {
    const state = createInitialState({ skillName: 'x', skillSlug: 'x', sourceUrl: '' });
    assert.equal(state.sourceType, 'unknown');
  });

  it('defaults monitorConfig fields', () => {
    const state = createInitialState({ skillName: 'x', skillSlug: 'x', sourceType: 'unknown', sourceUrl: '' });
    assert.equal(state.monitorConfig.strategy, 'http-head');
    assert.deepEqual(state.monitorConfig.lastKnownLinks, []);
    assert.equal(state.monitorConfig.lastETag, null);
    assert.equal(state.monitorConfig.lastModified, null);
  });

  it('accepts custom monitorConfig', () => {
    const state = createInitialState({
      skillName: 'x',
      skillSlug: 'x',
      sourceType: 'page-with-links',
      sourceUrl: 'https://example.com',
      monitorConfig: {
        strategy: 'page-diff',
        lastKnownLinks: ['https://example.com/a.csv'],
        lastETag: '"abc123"',
        lastModified: 'Tue, 01 Jan 2025 00:00:00 GMT',
      },
    });

    assert.equal(state.monitorConfig.strategy, 'page-diff');
    assert.deepEqual(state.monitorConfig.lastKnownLinks, ['https://example.com/a.csv']);
    assert.equal(state.monitorConfig.lastETag, '"abc123"');
    assert.equal(state.monitorConfig.lastModified, 'Tue, 01 Jan 2025 00:00:00 GMT');
  });

  it('defaults userContext fields', () => {
    const state = createInitialState({ skillName: 'x', skillSlug: 'x', sourceType: 'unknown', sourceUrl: '' });
    assert.equal(state.userContext.purpose, '');
    assert.deepEqual(state.userContext.features, []);
    assert.equal(state.userContext.outputFormat, '');
  });

  it('accepts custom userContext', () => {
    const state = createInitialState({
      skillName: 'x',
      skillSlug: 'x',
      sourceType: 'unknown',
      sourceUrl: '',
      userContext: {
        purpose: 'analytics',
        features: ['search', 'export'],
        outputFormat: 'markdown',
      },
    });

    assert.equal(state.userContext.purpose, 'analytics');
    assert.deepEqual(state.userContext.features, ['search', 'export']);
    assert.equal(state.userContext.outputFormat, 'markdown');
  });

  it('defaults contentHash to null', () => {
    const state = createInitialState({ skillName: 'x', skillSlug: 'x', sourceType: 'unknown', sourceUrl: '' });
    assert.equal(state.contentHash, null);
  });

  it('accepts explicit contentHash', () => {
    const state = createInitialState({
      skillName: 'x', skillSlug: 'x', sourceType: 'unknown', sourceUrl: '',
      contentHash: 'deadbeef',
    });
    assert.equal(state.contentHash, 'deadbeef');
  });

  it('sets lastCheckTime and lastRefreshTime to valid ISO strings', () => {
    const before = Date.now();
    const state = createInitialState({ skillName: 'x', skillSlug: 'x', sourceType: 'unknown', sourceUrl: '' });
    const after = Date.now();

    const checkMs = new Date(state.lastCheckTime).getTime();
    const refreshMs = new Date(state.lastRefreshTime).getTime();

    assert.ok(checkMs >= before && checkMs <= after, 'lastCheckTime not in expected range');
    assert.ok(refreshMs >= before && refreshMs <= after, 'lastRefreshTime not in expected range');
  });

  it('accepts explicit lastCheckTime and lastRefreshTime', () => {
    const ts = '2025-01-01T00:00:00.000Z';
    const state = createInitialState({
      skillName: 'x', skillSlug: 'x', sourceType: 'unknown', sourceUrl: '',
      lastCheckTime: ts,
      lastRefreshTime: ts,
    });
    assert.equal(state.lastCheckTime, ts);
    assert.equal(state.lastRefreshTime, ts);
  });
});

// ---------------------------------------------------------------------------
// readState / writeState round-trip
// ---------------------------------------------------------------------------

describe('writeState + readState', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'source-state-test-'));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('round-trips a state object', async () => {
    const original = createInitialState({
      skillName: 'RoundTrip',
      skillSlug: 'round-trip',
      sourceType: 'docs-site',
      sourceUrl: 'https://docs.example.com',
      contentHash: 'abc123',
    });

    await writeState(tmpDir, original);
    const loaded = await readState(tmpDir);

    assert.deepEqual(loaded, original);
  });

  it('writes valid JSON with pretty formatting', async () => {
    const state = createInitialState({ skillName: 'x', skillSlug: 'x', sourceType: 'unknown', sourceUrl: '' });
    const subDir = path.join(tmpDir, 'pretty-test');

    await writeState(subDir, state);

    const raw = await fs.readFile(path.join(subDir, '.source-state.json'), 'utf8');
    // Pretty-formatted JSON will have newlines
    assert.ok(raw.includes('\n'), 'expected pretty-printed JSON with newlines');
    // Should parse without error
    const parsed = JSON.parse(raw);
    assert.equal(parsed.skillName, 'x');
  });

  it('creates the skillDir when it does not exist yet', async () => {
    const newDir = path.join(tmpDir, 'nested', 'new-skill');
    const state = createInitialState({ skillName: 'y', skillSlug: 'y', sourceType: 'unknown', sourceUrl: '' });

    await writeState(newDir, state);

    const loaded = await readState(newDir);
    assert.equal(loaded.skillName, 'y');
  });

  it('overwrites an existing state file', async () => {
    const skillDir = path.join(tmpDir, 'overwrite-test');
    const first = createInitialState({ skillName: 'first', skillSlug: 'first', sourceType: 'unknown', sourceUrl: '' });
    await writeState(skillDir, first);

    const second = { ...first, skillName: 'second', contentHash: 'newHash' };
    await writeState(skillDir, second);

    const loaded = await readState(skillDir);
    assert.equal(loaded.skillName, 'second');
    assert.equal(loaded.contentHash, 'newHash');
  });
});

// ---------------------------------------------------------------------------
// readState edge cases
// ---------------------------------------------------------------------------

describe('readState', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'source-state-read-test-'));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns null for a directory that has no state file', async () => {
    const emptyDir = path.join(tmpDir, 'empty');
    await fs.mkdir(emptyDir);
    const result = await readState(emptyDir);
    assert.equal(result, null);
  });

  it('returns null when the skillDir itself does not exist', async () => {
    const result = await readState(path.join(tmpDir, 'nonexistent-dir'));
    assert.equal(result, null);
  });
});
