import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { listProfiles, loadProfile, saveProfile } from '../scripts/lib/profiles.js';

test('saveProfile and loadProfile round-trip profile data', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-to-skill-profiles-'));
  const previous = process.env.DOC_TO_SKILL_PROFILES_DIR;
  process.env.DOC_TO_SKILL_PROFILES_DIR = root;

  try {
    await saveProfile('PastPix', {
      skillType: { id: 'api-sdk', promptLabel: 'API / SDK' },
      userContext: { appName: 'PastPix', language: 'Swift' },
      lastDocsUrl: 'https://docs.revenuecat.com',
    });

    const loaded = await loadProfile('PastPix');
    assert.equal(loaded.profileName, 'PastPix');
    assert.equal(loaded.userContext.appName, 'PastPix');
    assert.equal(loaded.lastDocsUrl, 'https://docs.revenuecat.com');

    const listed = await listProfiles({ loadData: true });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].name, 'PastPix');
  } finally {
    if (previous === undefined) {
      delete process.env.DOC_TO_SKILL_PROFILES_DIR;
    } else {
      process.env.DOC_TO_SKILL_PROFILES_DIR = previous;
    }
  }
});
