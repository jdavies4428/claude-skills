import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { collectSkillStatuses, formatStatusTable } from '../scripts/lib/status.js';
import { writeState } from '../scripts/lib/skill-state.js';

test('collectSkillStatuses marks old skills as stale and formats a table', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-to-skill-status-'));
  await writeState(path.join(root, 'fresh-skill'), {
    librarySlug: 'fresh-skill',
    libraryName: 'Fresh Skill',
    docsUrl: 'https://docs.example.dev/fresh',
    skillType: { promptLabel: 'API / SDK' },
    lastCrawlTime: new Date().toISOString(),
    lastChangedUrls: [],
  });
  await writeState(path.join(root, 'stale-skill'), {
    librarySlug: 'stale-skill',
    libraryName: 'Stale Skill',
    docsUrl: 'https://docs.example.dev/stale',
    skillType: { promptLabel: 'CLI Tool' },
    lastCrawlTime: '2025-01-01T00:00:00.000Z',
    lastChangedUrls: [],
  });

  const statuses = await collectSkillStatuses(root, { staleAfterDays: 14 });
  assert.equal(statuses.length, 2);
  assert.equal(statuses[0].librarySlug, 'stale-skill');
  assert.equal(statuses[0].stale, true);
  assert.equal(statuses[1].stale, false);

  const table = formatStatusTable(statuses);
  assert.match(table, /stale-skill/);
  assert.match(table, /CLI Tool/);
});
