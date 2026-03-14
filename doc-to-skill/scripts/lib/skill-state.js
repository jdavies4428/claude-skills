import fs from 'fs/promises';
import path from 'path';

import { slugify } from './cli.js';

export const DEFAULT_OUTPUT_ROOT = 'output';
export const STATE_FILENAME = '.crawl-state.json';

export function normalizeUserContext(input = {}) {
  return {
    appName: String(input.appName ?? '').trim(),
    language: String(input.language ?? '').trim(),
    architecture: String(input.architecture ?? '').trim(),
    config: String(input.config ?? '').trim(),
    use: String(input.use ?? input.usedFeatures ?? '').trim(),
    avoid: String(input.avoid ?? input.unusedFeatures ?? '').trim(),
    naming: String(input.naming ?? '').trim(),
    extraNotes: String(input.extraNotes ?? '').trim(),
  };
}

export function userContextToMarkdown(context) {
  const normalized = normalizeUserContext(context);
  const lines = [];

  if (normalized.appName) {
    lines.push(`- App: ${normalized.appName}`);
  }

  if (normalized.language) {
    lines.push(`- Language/framework: ${normalized.language}`);
  }

  if (normalized.architecture) {
    lines.push(`- Architecture: ${normalized.architecture}`);
  }

  if (normalized.config) {
    lines.push(`- Specific config: ${normalized.config}`);
  }

  if (normalized.use) {
    lines.push(`- They use: ${normalized.use}`);
  }

  if (normalized.avoid) {
    lines.push(`- They do not use: ${normalized.avoid}`);
  }

  if (normalized.naming) {
    lines.push(`- Naming conventions: ${normalized.naming}`);
  }

  if (normalized.extraNotes) {
    lines.push(`- Extra notes: ${normalized.extraNotes}`);
  }

  return lines.length > 0 ? lines.join('\n') : '- No project-specific context provided yet.';
}

export function buildSkillDir(options = {}) {
  if (options.skillDir) {
    return path.resolve(process.cwd(), options.skillDir);
  }

  const outputRoot = path.resolve(process.cwd(), options.outputRoot ?? DEFAULT_OUTPUT_ROOT);
  const slug = options.slug ?? slugify(options.libraryName ?? options.name ?? 'generated-skill');
  return path.join(outputRoot, slug);
}

export function skillPaths(skillDir) {
  return {
    skillDir,
    skillPath: path.join(skillDir, 'SKILL.md'),
    statePath: path.join(skillDir, STATE_FILENAME),
  };
}

export async function loadState(skillDir) {
  const { statePath } = skillPaths(skillDir);
  const raw = await fs.readFile(statePath, 'utf8');
  return JSON.parse(raw);
}

export async function writeState(skillDir, state) {
  const { statePath } = skillPaths(skillDir);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

export async function discoverSkillDirs(rootDir) {
  const rootPath = path.resolve(process.cwd(), rootDir ?? DEFAULT_OUTPUT_ROOT);
  const entries = await fs.readdir(rootPath, { withFileTypes: true }).catch(() => []);
  const skillDirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillDir = path.join(rootPath, entry.name);
    const { statePath } = skillPaths(skillDir);

    try {
      await fs.access(statePath);
      skillDirs.push(skillDir);
    } catch {
      // Skip directories without crawl state.
    }
  }

  return skillDirs.sort();
}

export function mergeKnownUrls(existingUrls = [], newUrls = []) {
  return Array.from(new Set([...(existingUrls ?? []), ...(newUrls ?? [])])).sort();
}
