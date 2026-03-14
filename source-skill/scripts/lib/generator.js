const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;

/**
 * Build the system prompt for SKILL.md generation.
 *
 * @returns {string}
 */
function buildSystemPrompt() {
  return `You are an expert technical writer who creates concise, actionable SKILL.md files for Claude AI agents.

A SKILL.md teaches Claude how to work with a specific data source or API. It should be practical, not exhaustive.

Rules:
- Use YAML frontmatter with "name" and "description" fields
- Stay under 400 lines total
- Include concrete code examples (copy-pasteable)
- Include a "Data Refresh" section explaining how to update the data
- Reference the original source URL
- Focus on common tasks and gotchas, not exhaustive documentation
- Write for a developer audience`;
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

  return `Generate a SKILL.md for the following data source.

## Skill Metadata
- Name: ${opts.name}
- Slug: ${opts.slug}
- Source Type: ${opts.sourceType}
- Source URL: ${opts.sourceUrl}

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
7. Stays under 400 lines

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

  const systemPrompt = buildSystemPrompt();
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
