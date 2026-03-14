import test from 'node:test';
import assert from 'node:assert/strict';

import { formatReviewReport, reviewSkillContent, runSkillReviewStage } from '../scripts/lib/review.js';

const highQualitySkill = `---
name: example-sdk
description: >
  Use Example SDK to build integrations, configure auth, debug API calls, refresh setup,
  and fix Example SDK request handlers when users ask for code or troubleshooting help.
---

# Example SDK

Build and maintain Example SDK integrations for this project.

## Initialization

\`\`\`ts
import { ExampleClient } from 'example-sdk';

const client = new ExampleClient({ apiKey: process.env.EXAMPLE_API_KEY });
\`\`\`

## This project's setup

Language: Node.js ESM

## Create widgets

\`\`\`ts
await client.widgets.create({ id: 'widget_123', name: 'Example' });
\`\`\`

## Update widgets

\`\`\`ts
await client.widgets.update('widget_123', { name: 'Renamed' });
\`\`\`

## Troubleshooting

Retry 429 responses and log validation failures.

## Key links

[Widgets reference](https://docs.example.dev/reference/widgets)
`;

test('reviewSkillContent passes a strong SKILL.md with only minor or no issues', () => {
  const review = reviewSkillContent(highQualitySkill, {
    libraryName: 'Example SDK',
    docsUrl: 'https://docs.example.dev',
    userContext: { appName: 'Example App' },
  });

  assert.equal(review.failures.length, 0);
  assert.ok(review.summary.passed >= 5);
});

test('reviewSkillContent flags missing project setup and weak trigger description', () => {
  const weakSkill = highQualitySkill
    .replace(/Use Example SDK to build integrations, configure auth, debug API calls, refresh setup,\n  and fix Example SDK request handlers when users ask for code or troubleshooting help\./, 'Example SDK help.')
    .replace('## This project\'s setup\n\nLanguage: Node.js ESM\n\n', '');

  const review = reviewSkillContent(weakSkill, {
    libraryName: 'Example SDK',
    docsUrl: 'https://docs.example.dev',
    userContext: { appName: 'Example App' },
  });

  assert.ok(review.failures.some((check) => check.id === 'trigger-description'));
  assert.ok(review.failures.some((check) => check.id === 'project-setup'));
  assert.match(formatReviewReport(review), /Trigger-rich description/);
});

test('runSkillReviewStage revises a weak skill once and returns the repaired version', async () => {
  const weakSkill = `---
name: example-sdk
description: >
  Example SDK help.
---

# Example SDK

## Initialization

\`\`\`ts
const client = init();
\`\`\`

## Patterns

\`\`\`ts
client.doThing();
\`\`\`

## Troubleshooting

Retry on failure.

\`\`\`ts
client.retry();
\`\`\`
`;

  const result = await runSkillReviewStage({
    libraryName: 'Example SDK',
    docsUrl: 'https://docs.example.dev',
    userContext: { appName: 'Example App' },
    skillContent: weakSkill,
    reviseSkill: async () => highQualitySkill,
  });

  assert.equal(result.review.failures.length, 0);
  assert.match(result.skillContent, /This project's setup/);
});
