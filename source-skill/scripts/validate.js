#!/usr/bin/env node
/**
 * scripts/validate.js
 *
 * Basic validation for a generated skill directory.
 *
 * Usage:
 *   node scripts/validate.js <skill-dir>
 *
 * Checks:
 *   1. SKILL.md exists
 *   2. SKILL.md has YAML frontmatter with name and description fields
 *   3. SKILL.md body is under 400 lines
 *   4. SKILL.md contains at least one code block
 *   5. .source-state.json exists and parses as valid JSON
 *   6. sourceUrl in state is a valid URL
 *
 * Exits with code 1 if any check fails.
 */

import fs from 'fs/promises';
import path from 'path';

import { resolvePathFromCwd } from './lib/cli.js';

// ---------------------------------------------------------------------------
// Check helpers — each returns { label, pass, detail? }
// ---------------------------------------------------------------------------

/**
 * Check that a file exists and return its text, or return null.
 *
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
async function tryReadFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Parse YAML frontmatter delimited by leading/trailing `---` lines.
 * Returns a plain object of key→value pairs (string values only),
 * or null if no valid frontmatter block is found.
 *
 * Handles the minimal subset needed: single-line `key: value` entries.
 *
 * @param {string} content
 * @returns {{ fields: Record<string, string>, bodyStartLine: number }|null}
 */
function parseFrontmatter(content) {
  const lines = content.split('\n');

  // Must start with ---
  if (lines[0].trim() !== '---') return null;

  const closeIndex = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (closeIndex === -1) return null;

  const fmLines = lines.slice(1, closeIndex);
  const fields = {};
  for (const line of fmLines) {
    const colonPos = line.indexOf(':');
    if (colonPos === -1) continue;
    const key = line.slice(0, colonPos).trim();
    const value = line.slice(colonPos + 1).trim();
    if (key) fields[key] = value;
  }

  return { fields, bodyStartLine: closeIndex + 1 };
}

/**
 * Count the number of fenced code blocks (``` or ~~~) in text.
 *
 * @param {string} text
 * @returns {number}
 */
function countCodeBlocks(text) {
  const fencePattern = /^(`{3,}|~{3,})/gm;
  const matches = text.match(fencePattern);
  if (!matches) return 0;
  // Each code block is an open + close fence; pair them up.
  return Math.floor(matches.length / 2);
}

// ---------------------------------------------------------------------------
// Main validation runner
// ---------------------------------------------------------------------------

/**
 * Run all checks and print results.
 *
 * @param {string} skillDir  Absolute path to the skill directory.
 * @returns {Promise<boolean>}  true if all checks pass.
 */
async function validate(skillDir) {
  const results = [];

  const pass = (label, detail) => results.push({ label, pass: true, detail });
  const fail = (label, detail) => results.push({ label, pass: false, detail });

  // -- 1. SKILL.md exists
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const skillMdContent = await tryReadFile(skillMdPath);

  if (skillMdContent !== null) {
    pass('SKILL.md exists');
  } else {
    fail('SKILL.md exists', 'File not found');
    // Remaining SKILL.md checks are moot
    results.push({ label: 'YAML frontmatter has name and description', pass: false, detail: 'SKILL.md missing' });
    results.push({ label: 'Body is under 400 lines', pass: false, detail: 'SKILL.md missing' });
    results.push({ label: 'Contains at least 1 code block', pass: false, detail: 'SKILL.md missing' });
  }

  if (skillMdContent !== null) {
    // -- 2. YAML frontmatter with name and description
    const fm = parseFrontmatter(skillMdContent);
    if (!fm) {
      fail('YAML frontmatter has name and description', 'No valid frontmatter block (expected opening and closing ---)');
    } else {
      const missing = ['name', 'description'].filter((k) => !fm.fields[k]);
      if (missing.length === 0) {
        pass('YAML frontmatter has name and description');
      } else {
        fail(
          'YAML frontmatter has name and description',
          `Missing field(s): ${missing.join(', ')}`,
        );
      }
    }

    // -- 3. Body under 400 lines
    const bodyStart = fm ? fm.bodyStartLine : 0;
    const allLines = skillMdContent.split('\n');
    const bodyLines = allLines.slice(bodyStart);
    const lineCount = bodyLines.length;
    if (lineCount <= 400) {
      pass('Body is under 400 lines', `${lineCount} lines`);
    } else {
      fail('Body is under 400 lines', `${lineCount} lines (exceeds limit of 400)`);
    }

    // -- 4. At least 1 code block
    const codeBlockCount = countCodeBlocks(skillMdContent);
    if (codeBlockCount >= 1) {
      pass('Contains at least 1 code block', `${codeBlockCount} code block(s) found`);
    } else {
      fail('Contains at least 1 code block', 'No fenced code blocks found');
    }
  }

  // -- 5. .source-state.json exists and is valid JSON
  const stateFilePath = path.join(skillDir, '.source-state.json');
  const stateRaw = await tryReadFile(stateFilePath);

  let parsedState = null;
  if (stateRaw === null) {
    fail('.source-state.json exists and is valid JSON', 'File not found');
    results.push({ label: 'sourceUrl is a valid URL', pass: false, detail: '.source-state.json missing' });
  } else {
    try {
      parsedState = JSON.parse(stateRaw);
      pass('.source-state.json exists and is valid JSON');
    } catch (err) {
      fail('.source-state.json exists and is valid JSON', `JSON parse error: ${err.message}`);
      results.push({ label: 'sourceUrl is a valid URL', pass: false, detail: '.source-state.json invalid' });
    }
  }

  // -- 6. sourceUrl is a valid URL
  if (parsedState !== null) {
    const sourceUrl = parsedState.sourceUrl;
    if (!sourceUrl) {
      fail('sourceUrl is a valid URL', 'sourceUrl field is missing or empty');
    } else {
      try {
        new URL(sourceUrl);
        pass('sourceUrl is a valid URL', sourceUrl);
      } catch {
        fail('sourceUrl is a valid URL', `"${sourceUrl}" is not a valid URL`);
      }
    }
  }

  // -- Print results
  console.log(`\nValidating: ${skillDir}`);
  console.log('');

  const WIDTH = 52;
  for (const result of results) {
    const status = result.pass ? 'PASS' : 'FAIL';
    const icon = result.pass ? '[PASS]' : '[FAIL]';
    const label = result.label.padEnd(WIDTH);
    const detail = result.detail ? ` — ${result.detail}` : '';
    console.log(`  ${icon}  ${label}${detail}`);
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const allPassed = passed === total;

  console.log('');
  console.log(`Result: ${passed}/${total} checks passed.`);

  if (allPassed) {
    console.log('All checks passed.\n');
  } else {
    console.log(`${total - passed} check(s) failed.\n`);
  }

  return allPassed;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));

  if (positional.length === 0) {
    console.error('Error: skill directory argument is required.');
    console.error('Usage: node scripts/validate.js <skill-dir>');
    process.exit(1);
  }

  const skillDir = resolvePathFromCwd(positional[0]);

  // Verify the directory exists
  try {
    const stat = await fs.stat(skillDir);
    if (!stat.isDirectory()) {
      console.error(`Error: "${skillDir}" is not a directory.`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: directory not found: ${skillDir}`);
    process.exit(1);
  }

  const allPassed = await validate(skillDir);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
