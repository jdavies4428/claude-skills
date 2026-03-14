import fs from 'fs/promises';

import { skillPaths } from './skill-state.js';

const ACTION_VERBS = [
  'build',
  'create',
  'generate',
  'integrate',
  'configure',
  'fix',
  'debug',
  'update',
  'refresh',
  'crawl',
  'review',
  'sync',
];

function splitFrontmatter(content) {
  const match = String(content).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: '', body: String(content ?? '') };
  }

  return {
    frontmatter: match[1],
    body: match[2],
  };
}

function parseFrontmatter(frontmatter) {
  const result = {};
  const lines = String(frontmatter ?? '').split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!keyMatch) {
      continue;
    }

    const [, key, rawValue] = keyMatch;
    if (key === 'description' && ['>', '|'].includes(rawValue.trim())) {
      const blockLines = [];
      for (let blockIndex = index + 1; blockIndex < lines.length; blockIndex += 1) {
        blockLines.push(lines[blockIndex].replace(/^\s{2}/, '').trimEnd());
      }
      result[key] = blockLines.join(' ').replace(/\s+/g, ' ').trim();
      break;
    }

    result[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }

  return result;
}

function listHeadings(body) {
  return Array.from(String(body ?? '').matchAll(/^(#{1,6})\s+(.+)$/gm), (match) => ({
    level: match[1].length,
    title: match[2].trim(),
    index: match.index,
  }));
}

function countCodeBlocks(body) {
  const fenceCount = String(body ?? '').match(/^```/gm)?.length ?? 0;
  return Math.floor(fenceCount / 2);
}

function extractMarkdownLinks(body) {
  return Array.from(String(body ?? '').matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g), (match) => match[1]);
}

function firstParagraphAfterTitle(body) {
  const lines = String(body ?? '').split('\n');
  let foundTitle = false;
  let paragraph = [];

  for (const line of lines) {
    if (!foundTitle) {
      if (/^#\s+/.test(line)) {
        foundTitle = true;
      }
      continue;
    }

    if (/^#{2,6}\s+/.test(line)) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    if (line.trim() === '') {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    paragraph.push(line.trim());
  }

  return paragraph.join(' ').trim();
}

function longestParagraphWordCount(body) {
  return String(body ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph)
    .reduce((max, paragraph) => Math.max(max, paragraph.split(/\s+/).filter(Boolean).length), 0);
}

function stripCodeBlocks(body) {
  return String(body ?? '').replace(/```[\s\S]*?```/g, '');
}

function addCheck(checks, id, label, status, detail) {
  checks.push({ id, label, status, detail });
}

function hasProjectContext(userContext) {
  return Object.values(userContext ?? {}).some((value) => String(value ?? '').trim().length > 0);
}

function docsHostLinks(links, docsUrl) {
  if (!docsUrl) {
    return [];
  }

  let docsHost = '';
  try {
    docsHost = new URL(docsUrl).host;
  } catch {
    return [];
  }

  return links.filter((link) => {
    try {
      return new URL(link).host === docsHost;
    } catch {
      return false;
    }
  });
}

function countActionVerbs(description) {
  const lowered = String(description ?? '').toLowerCase();
  return ACTION_VERBS.filter((verb) => new RegExp(`\\b${verb}\\b`, 'i').test(lowered)).length;
}

function summarizeChecks(checks) {
  return {
    total: checks.length,
    passed: checks.filter((check) => check.status === 'pass').length,
    warnings: checks.filter((check) => check.status === 'warn').length,
    failures: checks.filter((check) => check.status === 'fail').length,
  };
}

export function reviewSkillContent(content, options = {}) {
  const { frontmatter, body } = splitFrontmatter(content);
  const parsedFrontmatter = parseFrontmatter(frontmatter);
  const description = parsedFrontmatter.description ?? '';
  const libraryName = String(options.libraryName ?? parsedFrontmatter.name ?? '').trim();
  const headings = listHeadings(body);
  const codeBlocks = countCodeBlocks(body);
  const links = extractMarkdownLinks(body);
  const checks = [];
  const overviewParagraph = firstParagraphAfterTitle(body);
  const sectionHeadings = headings.filter((heading) => heading.level === 2);
  const projectSetupPresent = headings.some((heading) => /this project'?s setup/i.test(heading.title));
  const troubleshootingPresent = headings.some((heading) => /(error|troubleshooting|failure|gotcha)/i.test(heading.title));
  const keyLinksPresent = headings.some((heading) => /(key links|references|official links)/i.test(heading.title));
  const docsLinks = docsHostLinks(links, options.docsUrl);
  const actionVerbCount = countActionVerbs(description);
  const proseBodyLower = stripCodeBlocks(body).toLowerCase();

  if (!description) {
    addCheck(checks, 'trigger-description', 'Trigger-rich description', 'fail', 'Description is missing from the frontmatter.');
  } else if (libraryName && !description.toLowerCase().includes(libraryName.toLowerCase())) {
    addCheck(checks, 'trigger-description', 'Trigger-rich description', 'fail', `Description should explicitly mention "${libraryName}".`);
  } else if (actionVerbCount < 2) {
    addCheck(checks, 'trigger-description', 'Trigger-rich description', 'fail', 'Description should include at least two concrete action verbs or trigger phrases.');
  } else {
    addCheck(checks, 'trigger-description', 'Trigger-rich description', 'pass', `Description includes ${actionVerbCount} trigger verbs.`);
  }

  if (!overviewParagraph || overviewParagraph.split(/\s+/).filter(Boolean).length < 10) {
    addCheck(checks, 'overview', 'Overview paragraph', 'warn', 'Add a short overview paragraph immediately under the title for skimmability.');
  } else {
    addCheck(checks, 'overview', 'Overview paragraph', 'pass', 'Overview paragraph is present and readable.');
  }

  if (hasProjectContext(options.userContext)) {
    if (!projectSetupPresent) {
      addCheck(checks, 'project-setup', 'Project setup section', 'fail', 'Personalized skills should include a "This project\'s setup" section.');
    } else {
      addCheck(checks, 'project-setup', 'Project setup section', 'pass', 'Project setup section is present.');
    }
  } else {
    addCheck(checks, 'project-setup', 'Project setup section', 'pass', 'No project-specific context was provided, so a setup section is optional.');
  }

  if (codeBlocks < 3) {
    addCheck(checks, 'example-density', 'Code example density', 'fail', 'Include at least 3 fenced code examples.');
  } else if (codeBlocks < 4 || sectionHeadings.length < 5) {
    addCheck(checks, 'example-density', 'Code example density', 'warn', 'The skill passes the minimum bar, but adding another pattern example would improve usability.');
  } else {
    addCheck(checks, 'example-density', 'Code example density', 'pass', `Includes ${codeBlocks} fenced code examples across ${sectionHeadings.length} sections.`);
  }

  if (!troubleshootingPresent) {
    addCheck(checks, 'troubleshooting', 'Troubleshooting guidance', 'fail', 'Add a troubleshooting, gotchas, or error handling section.');
  } else {
    addCheck(checks, 'troubleshooting', 'Troubleshooting guidance', 'pass', 'Troubleshooting or error handling guidance is present.');
  }

  if (docsLinks.length === 0 && !keyLinksPresent) {
    addCheck(checks, 'official-links', 'Official reference links', 'warn', 'Consider adding a dedicated key links section or at least one official docs-host link.');
  } else {
    addCheck(checks, 'official-links', 'Official reference links', 'pass', `Includes ${docsLinks.length} docs-host link(s) or an explicit links section.`);
  }

  if (longestParagraphWordCount(body) > 140 || sectionHeadings.length < 4) {
    addCheck(checks, 'skimmability', 'Skimmable structure', 'warn', 'Shorter paragraphs or more section headings would make the skill easier to scan quickly.');
  } else {
    addCheck(checks, 'skimmability', 'Skimmable structure', 'pass', 'Heading structure and paragraph length are skimmable.');
  }

  if (/\b(best way|world-class|industry-leading|seamless|revolutionary|powerful platform)\b/i.test(stripCodeBlocks(body))) {
    addCheck(checks, 'tone', 'Technical tone', 'fail', 'Remove marketing language and keep the tone operational.');
  } else if (/(changelog|blog|community|forum)/i.test(proseBodyLower)) {
    addCheck(checks, 'tone', 'Technical tone', 'warn', 'The skill references lower-signal content such as changelog or community material.');
  } else {
    addCheck(checks, 'tone', 'Technical tone', 'pass', 'Tone is focused on technical execution.');
  }

  const summary = summarizeChecks(checks);

  return {
    checks,
    summary,
    failures: checks.filter((check) => check.status === 'fail'),
    warnings: checks.filter((check) => check.status === 'warn'),
    passed: summary.failures === 0,
    frontmatter: parsedFrontmatter,
  };
}

export function summarizeReview(review) {
  return {
    ...review.summary,
    passed: review.passed,
  };
}

export function formatReviewReport(review) {
  const lines = [];
  lines.push(`Skill review: ${review.summary.failures} failure(s), ${review.summary.warnings} warning(s), ${review.summary.passed} pass check(s).`);

  for (const check of review.checks) {
    if (check.status === 'pass') {
      continue;
    }
    lines.push(`- [${check.status}] ${check.label}: ${check.detail}`);
  }

  return lines.join('\n');
}

export async function runSkillReviewStage(options) {
  let candidate = options.skillContent;
  const maxReviewPasses = options.maxReviewPasses ?? 1;

  for (let attempt = 0; attempt <= maxReviewPasses; attempt += 1) {
    const review = reviewSkillContent(candidate, {
      libraryName: options.libraryName,
      docsUrl: options.docsUrl,
      userContext: options.userContext,
      skillType: options.skillType,
      knownUrls: options.knownUrls,
    });

    if (review.failures.length === 0) {
      return { skillContent: candidate, review };
    }

    if (attempt === maxReviewPasses) {
      throw new Error(formatReviewReport(review));
    }

    if (!options.reviseSkill) {
      throw new Error(formatReviewReport(review));
    }

    options.onProgress?.(`Skill review found ${review.failures.length} issue(s); requesting review pass ${attempt + 1}.`);
    candidate = await options.reviseSkill(candidate, review);
  }

  throw new Error('Skill review failed unexpectedly.');
}

export async function reviewSkillFolder(skillDir) {
  const { skillPath, statePath } = skillPaths(skillDir);
  const content = await fs.readFile(skillPath, 'utf8');
  let state = null;

  try {
    state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  } catch {
    state = null;
  }

  return reviewSkillContent(content, {
    libraryName: state?.libraryName,
    docsUrl: state?.docsUrl,
    userContext: state?.userContext,
    skillType: state?.skillType,
    knownUrls: state?.knownUrls ?? [],
  });
}
