import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { discoverSkillDirs, mergeKnownUrls, writeState } from '../scripts/lib/skill-state.js';

test('mergeKnownUrls deduplicates and sorts URLs', () => {
  const merged = mergeKnownUrls(
    ['https://docs.example.dev/reference/widgets', 'https://docs.example.dev/quickstart'],
    ['https://docs.example.dev/quickstart', 'https://docs.example.dev/reference/errors'],
  );

  assert.deepEqual(merged, [
    'https://docs.example.dev/quickstart',
    'https://docs.example.dev/reference/errors',
    'https://docs.example.dev/reference/widgets',
  ]);
});

test('discoverSkillDirs finds generated skills by state file', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-to-skill-'));
  const alphaDir = path.join(root, 'alpha');
  const betaDir = path.join(root, 'beta');
  await fs.mkdir(betaDir, { recursive: true });
  await writeState(alphaDir, { librarySlug: 'alpha' });

  const skillDirs = await discoverSkillDirs(root);
  assert.deepEqual(skillDirs, [alphaDir]);
});
