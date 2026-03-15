const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;

/**
 * Build the system prompt for SKILL.md generation.
 *
 * @returns {string}
 */
function buildSystemPrompt(interactive = false) {
  const base = `You are an expert technical writer who creates concise, actionable SKILL.md files for Claude AI agents.

A SKILL.md teaches Claude how to work with a specific data source or API. It should be practical, not exhaustive.

Rules:
- Use YAML frontmatter with "name" and "description" fields
- Stay under 400 lines total
- Include concrete code examples (copy-pasteable)
- Include a "Data Refresh" section explaining how to update the data
- Reference the original source URL
- Focus on common tasks and gotchas, not exhaustive documentation
- Write for a developer audience`;

  if (!interactive) return base;

  return base + `

INTERACTIVE SKILL PATTERN:
This skill must use AskUserQuestion to walk users through selections step by step.

Required YAML frontmatter:
\`\`\`yaml
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - AskUserQuestion
\`\`\`

Required flow structure — use AskUserQuestion at each step:

Step 1: Ask what specific dataset/query the user wants. Present 3-4 concrete options
based on what's available in this data source. Format:
\`\`\`
Question: "What do you want to see?"
Header: "Dataset"
Options:
  A) Option name — brief description
  B) Option name — brief description
  C) Option name — brief description
\`\`\`

Step 2: Ask about granularity/frequency if applicable (daily, weekly, monthly, annual).

Step 3: Ask about date range or scope.

Step 4: Ask single output or dashboard with multiple datasets.

Step 5: Fetch data, render chart/output, open in browser.

Step 6: Offer follow-up options via AskUserQuestion.

After initial build, support conversational adjustments without prompts
("switch to bar chart", "zoom to last 2 years").

Map each option to a specific endpoint/query with exact parameters.
Include a lookup table: Dataset → Endpoint → Params → Color → Units.

REFERENCE IMPLEMENTATION: The EIA energy data skill uses this exact pattern.
Study it: each AskUserQuestion presents clickable options, not free text.
Each option maps to a concrete API call. The user never types an endpoint.`;
}

/**
 * Build the user message asking Claude to generate the SKILL.md.
 *
 * @param {string} content - Processed source content
 * @param {object} userContext - { purpose, features, outputFormat }
 * @param {object} opts - { name, slug, sourceType, sourceUrl }
 * @returns {string}
 */
function buildUserPrompt(content, userContext, opts) {
  const featureList =
    Array.isArray(userContext.features) && userContext.features.length > 0
      ? userContext.features.map((f) => `- ${f}`).join('\n')
      : '- General data access and querying';

  const interactive = userContext.interactive === true;

  const interactiveReqs = interactive
    ? `
8. Include "allowed-tools" in YAML frontmatter with AskUserQuestion listed
9. Structure the skill as a step-by-step guided flow using AskUserQuestion
10. Each step presents 2-4 concrete clickable options (not free text)
11. Include a dataset-to-endpoint lookup table mapping each option to exact API params
12. Step 1: dataset selection, Step 2: frequency/granularity, Step 3: date range, Step 4: single vs dashboard, Step 5: fetch and render, Step 6: follow-up options
13. After initial build, support conversational adjustments without prompts`
    : '';

  return `Generate a SKILL.md for the following data source.

## Skill Metadata
- Name: ${opts.name}
- Slug: ${opts.slug}
- Source Type: ${opts.sourceType}
- Source URL: ${opts.sourceUrl}
- Interactive: ${interactive ? 'YES — generate a guided AskUserQuestion flow' : 'NO — generate a static reference skill'}

## User Intent
Purpose: ${userContext.purpose || 'Work with this data source'}
Desired features:
${featureList}
Output format preference: ${userContext.outputFormat || 'Structured text or JSON'}

## Source Content Sample
The following is a sample of the source data (tab-separated, headers on first line):

\`\`\`
${content.slice(0, 6000)}
\`\`\`

## Requirements
Create a SKILL.md that:
1. Has YAML frontmatter with name and description
2. Explains what this data source contains and its structure
3. Shows how to load/access the data with a setup/initialization code block
4. Provides 2-3 practical code examples for common tasks
5. Includes a "Data Refresh" section describing how to detect and apply updates
6. References the source URL: ${opts.sourceUrl}
7. Stays under 400 lines${interactiveReqs}

Output only the raw SKILL.md content — no commentary before or after.`;
}

/**
 * Call the Anthropic Messages API.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {string} apiKey
 * @returns {Promise<{content: string, tokensUsed: {input: number, output: number}}>}
 */
async function callAnthropicApi(systemPrompt, userMessage, apiKey) {
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
      'content-type': 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  const content =
    data.content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('') ?? '';

  const tokensUsed = {
    input: data.usage?.input_tokens ?? 0,
    output: data.usage?.output_tokens ?? 0,
  };

  return { content, tokensUsed };
}

/**
 * Generate a SKILL.md from processed source content via the Claude API.
 *
 * @param {string} content - Processed text from the source (e.g. tab-separated rows)
 * @param {object} userContext - { purpose: string, features: string[], outputFormat: string }
 * @param {object} opts - { name: string, slug: string, sourceType: string, sourceUrl: string }
 * @returns {Promise<{ skillMd: string, tokensUsed: { input: number, output: number } }>}
 */
export async function generateSkill(content, userContext, opts) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const interactive = userContext.interactive === true;
  const systemPrompt = buildSystemPrompt(interactive);
  const userMessage = buildUserPrompt(content, userContext, opts);

  const { content: skillMd, tokensUsed } = await callAnthropicApi(
    systemPrompt,
    userMessage,
    apiKey,
  );

  if (!skillMd.trim()) {
    throw new Error('Anthropic API returned empty content');
  }

  return { skillMd, tokensUsed };
}
