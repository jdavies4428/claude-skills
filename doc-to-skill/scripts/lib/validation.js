import fs from 'fs/promises';

import { skillPaths } from './skill-state.js';

function splitFrontmatter(content) {
  const match = String(content).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return null;
  }

  return {
    frontmatter: match[1],
    body: match[2],
  };
}

function stripQuotes(value) {
  return String(value).trim().replace(/^['"]|['"]$/g, '');
}

function parseFrontmatter(frontmatter) {
  const result = {};
  const lines = frontmatter.split('\n');
  const topLevelKeys = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!keyMatch) {
      continue;
    }

    const [, key, rawValue] = keyMatch;
    topLevelKeys.push(key);

    if (key === 'description' && ['>', '|'].includes(rawValue.trim())) {
      const blockLines = [];
      for (let blockIndex = index + 1; blockIndex < lines.length; blockIndex += 1) {
        blockLines.push(lines[blockIndex].replace(/^\s{2}/, '').trimEnd());
      }
      result[key] = blockLines.join(' ').replace(/\s+/g, ' ').trim();
      break;
    }

    result[key] = stripQuotes(rawValue);
  }

  result.__topLevelKeys = topLevelKeys;
  return result;
}

function countCodeBlocks(body) {
  const fenceCount = body.match(/^```/gm)?.length ?? 0;
  return Math.floor(fenceCount / 2);
}

function extractMarkdownLinks(body) {
  return Array.from(body.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g), (match) => match[1]);
}

function listHeadings(body) {
  return Array.from(body.matchAll(/^(#{1,6})\s+(.+)$/gm), (match) => ({
    level: match[1].length,
    title: match[2].trim(),
    index: match.index,
  }));
}

function firstCodeFenceIndex(body) {
  return body.search(/^```/m);
}

function nearestHeadingBefore(headings, bodyIndex) {
  let candidate = null;

  for (const heading of headings) {
    if (heading.index >= bodyIndex) {
      break;
    }
    candidate = heading;
  }

  return candidate;
}

function invalidUrlError(url) {
  try {
    return new URL(url).protocol !== 'https:' && new URL(url).protocol !== 'http:';
  } catch {
    return true;
  }
}

export function validateSkillContent(content, options = {}) {
  const validation = {
    errors: [],
    warnings: [],
    frontmatter: null,
    bodyLineCount: 0,
    codeBlockCount: 0,
  };

  const split = splitFrontmatter(content);
  if (!split) {
    validation.errors.push('Missing YAML frontmatter wrapped in --- markers.');
    return validation;
  }

  const parsedFrontmatter = parseFrontmatter(split.frontmatter);
  validation.frontmatter = parsedFrontmatter;
  validation.bodyLineCount = split.body.split('\n').length;
  validation.codeBlockCount = countCodeBlocks(split.body);

  if (!parsedFrontmatter.name) {
    validation.errors.push('Frontmatter is missing a name field.');
  }

  if (!parsedFrontmatter.description) {
    validation.errors.push('Frontmatter is missing a description field.');
  }

  const allowedKeys = new Set(['name', 'description']);
  const extraKeys = (parsedFrontmatter.__topLevelKeys ?? []).filter((key) => !allowedKeys.has(key));
  if (extraKeys.length > 0) {
    validation.errors.push(`Frontmatter contains unsupported keys: ${extraKeys.join(', ')}.`);
  }

  const libraryName = String(options.libraryName ?? parsedFrontmatter.name ?? '').trim();
  const description = parsedFrontmatter.description ?? '';
  if (libraryName && !description.toLowerCase().includes(libraryName.toLowerCase())) {
    validation.warnings.push(`Description does not mention the library name "${libraryName}".`);
  }

  if (validation.bodyLineCount > (options.maxBodyLines ?? 400)) {
    validation.errors.push(`Skill body is ${validation.bodyLineCount} lines; expected 400 or fewer.`);
  }

  if (validation.codeBlockCount < 3) {
    validation.errors.push('Skill body has fewer than 3 fenced code examples.');
  }

  if (/\b(best way|world-class|industry-leading|seamless|revolutionary|powerful platform)\b/i.test(split.body)) {
    validation.errors.push('Skill body contains marketing prose that should be removed.');
  }

  const headings = listHeadings(split.body);
  const firstFence = firstCodeFenceIndex(split.body);
  if (firstFence !== -1) {
    const nearestHeading = nearestHeadingBefore(headings, firstFence);
    if (!nearestHeading || !/(initial|setup|install|quickstart|get(ting)? started)/i.test(nearestHeading.title)) {
      validation.errors.push('The first code block is not under an initialization/setup heading.');
    }
  }

  if (!headings.some((heading) => /(error|troubleshooting|failure|gotcha)/i.test(heading.title))) {
    validation.errors.push('Skill body is missing an error handling or troubleshooting section.');
  }

  const links = extractMarkdownLinks(split.body);
  for (const link of links) {
    if (invalidUrlError(link)) {
      validation.errors.push(`Invalid URL in markdown link: ${link}`);
      continue;
    }

    const knownUrls = options.knownUrls ?? [];
    if (knownUrls.length === 0 || !options.docsUrl) {
      continue;
    }

    const docsHost = new URL(options.docsUrl).host;
    const linkHost = new URL(link).host;
    if (linkHost === docsHost && !knownUrls.includes(link)) {
      validation.warnings.push(`Docs-host link was not present in crawl metadata: ${link}`);
    }
  }

  return validation;
}

export async function validateSkillFolder(skillDir) {
  const { skillPath, statePath } = skillPaths(skillDir);
  const content = await fs.readFile(skillPath, 'utf8');
  let state = null;

  try {
    state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  } catch {
    state = null;
  }

  return validateSkillContent(content, {
    libraryName: state?.libraryName,
    docsUrl: state?.docsUrl,
    knownUrls: state?.knownUrls ?? [],
  });
}

export function formatValidationReport(validation) {
  const lines = [];

  if (validation.errors.length === 0) {
    lines.push('Validation passed.');
  } else {
    lines.push(`Validation failed with ${validation.errors.length} error(s):`);
    for (const error of validation.errors) {
      lines.push(`- ${error}`);
    }
  }

  if (validation.warnings.length > 0) {
    lines.push(`Warnings (${validation.warnings.length}):`);
    for (const warning of validation.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join('\n');
}
