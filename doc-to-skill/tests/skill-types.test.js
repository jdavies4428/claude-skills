import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeCrawlConfigs, resolveSkillType } from '../scripts/lib/skill-types.js';

test('resolveSkillType preserves custom label for other', () => {
  const skillType = resolveSkillType('other', 'Internal Platform');

  assert.equal(skillType.id, 'other');
  assert.equal(skillType.promptLabel, 'Internal Platform');
});

test('mergeCrawlConfigs combines excludes and respects later scalar overrides', () => {
  const merged = mergeCrawlConfigs(
    { limit: 90, exclude: ['*/blog/*', '*/changelog/*'] },
    { maxDepth: 4, exclude: ['*/pricing/*'] },
    { limit: 120, include: ['*/docs/*'] },
  );

  assert.equal(merged.limit, 120);
  assert.equal(merged.maxDepth, 4);
  assert.deepEqual(merged.include, ['*/docs/*']);
  assert.deepEqual(merged.exclude, ['*/blog/*', '*/changelog/*', '*/pricing/*']);
});
