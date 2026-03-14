import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSkillContent } from '../scripts/lib/validation.js';

const validSkill = `---
name: example-sdk
description: >
  Use Example SDK to initialize the client, create widgets, handle webhooks, debug errors,
  and answer requests such as "build me an Example SDK integration", "update Example SDK auth",
  or "fix my Example SDK webhook handler".
---

# Example SDK

Build and maintain Example SDK integrations.

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

## Error handling

Retry 429 responses and log validation failures.

[Widgets reference](https://docs.example.dev/reference/widgets)
`;

test('validateSkillContent accepts a well-formed skill', () => {
  const validation = validateSkillContent(validSkill, {
    libraryName: 'Example SDK',
    docsUrl: 'https://docs.example.dev',
    knownUrls: ['https://docs.example.dev/reference/widgets'],
  });

  assert.deepEqual(validation.errors, []);
  assert.equal(validation.codeBlockCount, 3);
});

test('validateSkillContent catches missing required sections', () => {
  const invalidSkill = validSkill
    .replace('## Error handling\n\nRetry 429 responses and log validation failures.\n\n', '')
    .replace(/\`\`\`ts[\s\S]*?\`\`\`\n\n## Update widgets/, '## Update widgets');

  const validation = validateSkillContent(invalidSkill, {
    libraryName: 'Example SDK',
    docsUrl: 'https://docs.example.dev',
  });

  assert.ok(validation.errors.some((error) => error.includes('fewer than 3 fenced code examples')));
  assert.ok(validation.errors.some((error) => error.includes('missing an error handling')));
});
