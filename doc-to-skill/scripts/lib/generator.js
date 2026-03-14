import { normalizeUserContext, userContextToMarkdown } from './skill-state.js';

function baseRules() {
  return [
    'Return valid SKILL.md content only: YAML frontmatter with name and description, followed by Markdown.',
    'Keep the body under 400 lines.',
    'Make code examples complete and runnable, not pseudocode.',
    'Put the initialization/setup pattern in the first code block.',
    'Include 5-8 practical patterns, gotchas, error handling, and key links.',
    'Do not add marketing copy, history, roadmap content, or features absent from the docs feed.',
  ].join('\n');
}

function contextPrompt(context) {
  return userContextToMarkdown(normalizeUserContext(context));
}

function skillTypePrompt(skillType) {
  if (!skillType) {
    return '';
  }

  return [
    `Skill type: ${skillType.promptLabel ?? skillType.label}`,
    `Type-specific guidance: ${skillType.generationGuidance}`,
  ].join('\n');
}

export async function generateDraftSkill(options) {
  const system = [
    'You generate concise, high-signal skills for a Claude coding assistant.',
    baseRules(),
  ].join('\n\n');

  const user = [
    `Library: ${options.libraryName}`,
    `Docs URL: ${options.docsUrl}`,
    skillTypePrompt(options.skillType),
    '',
    'Generate a draft SKILL.md with:',
    '- A trigger-rich description that names the library and common user requests',
    '- A two-sentence overview',
    '- An initialization section',
    '- The highest-value patterns from the docs feed',
    '- A troubleshooting or error handling section',
    '- Official reference links only',
    '',
    'Documentation feed:',
    options.feed,
  ].join('\n');

  return options.client.createMessage({
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens: options.maxTokens ?? 4000,
  });
}

export async function personalizeSkill(options) {
  const context = normalizeUserContext(options.userContext);
  if (!Object.values(context).some(Boolean)) {
    return options.draftSkill;
  }

  const system = [
    'You personalize an existing SKILL.md for a specific project.',
    baseRules(),
    'Always add a "This project\'s setup" section immediately after the overview.',
    'Strip features the user does not use.',
  ].join('\n\n');

  const user = [
    `Library: ${options.libraryName}`,
    `Docs URL: ${options.docsUrl}`,
    skillTypePrompt(options.skillType),
    '',
    'Project context:',
    contextPrompt(context),
    '',
    'Take the draft SKILL.md below and personalize the examples, names, and setup details for this project.',
    '',
    options.draftSkill,
  ].join('\n');

  return options.client.createMessage({
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens: options.maxTokens ?? 4000,
  });
}

export async function updateExistingSkill(options) {
  const system = [
    'You update an existing SKILL.md using changed documentation pages.',
    baseRules(),
    'Preserve project-specific personalization unless the changed docs force an update.',
    'Only change sections impacted by the changed documentation feed.',
  ].join('\n\n');

  const user = [
    `Library: ${options.libraryName}`,
    `Docs URL: ${options.docsUrl}`,
    skillTypePrompt(options.skillType),
    '',
    'Project context:',
    contextPrompt(options.userContext),
    '',
    'Changed documentation feed:',
    options.feed,
    '',
    'Existing SKILL.md:',
    options.existingSkill,
  ].join('\n');

  return options.client.createMessage({
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens: options.maxTokens ?? 4000,
  });
}

export async function repairSkill(options) {
  const system = [
    'You repair SKILL.md files to satisfy deterministic validation checks.',
    baseRules(),
    'Fix only the issues listed by the validator and preserve the rest of the content.',
  ].join('\n\n');

  const user = [
    `Library: ${options.libraryName}`,
    `Docs URL: ${options.docsUrl}`,
    '',
    'Validation errors to fix:',
    ...options.validationErrors.map((error) => `- ${error}`),
    '',
    'Current SKILL.md:',
    options.skillContent,
  ].join('\n');

  return options.client.createMessage({
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens: options.maxTokens ?? 4000,
  });
}

export async function reviseSkillFromReview(options) {
  const system = [
    'You improve a SKILL.md after a dedicated quality review stage.',
    baseRules(),
    'Preserve factual accuracy, project context, and the overall structure unless a review finding requires a change.',
    'Do not invent undocumented APIs, links, or features.',
    'Address every review failure and any warning that can be fixed without adding noise.',
  ].join('\n\n');

  const findings = [
    ...options.review.failures.map((check) => `- [fail] ${check.label}: ${check.detail}`),
    ...options.review.warnings.map((check) => `- [warn] ${check.label}: ${check.detail}`),
  ];

  const user = [
    `Library: ${options.libraryName}`,
    `Docs URL: ${options.docsUrl}`,
    skillTypePrompt(options.skillType),
    '',
    'Project context:',
    contextPrompt(options.userContext),
    '',
    'Review findings to address:',
    ...findings,
    '',
    'Current SKILL.md:',
    options.skillContent,
  ].join('\n');

  return options.client.createMessage({
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens: options.maxTokens ?? 4000,
  });
}
