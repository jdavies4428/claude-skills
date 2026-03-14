#!/usr/bin/env node
/**
 * scripts/refresh.js
 *
 * Re-fetch source content and regenerate SKILL.md for one or all skills.
 *
 * Usage:
 *   node scripts/refresh.js --skill-dir <path> [--changed-only]
 *   node scripts/refresh.js --all [--changed-only]
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

import { parseArgs, getString, getBoolean, resolvePathFromCwd } from './lib/cli.js';
import { readState, writeState } from './lib/source-state.js';
import { SOURCE_TYPES } from './lib/source-detect.js';
import { fetchPageLinks } from './lib/fetchers/page-links.js';
import { fetchFile } from './lib/fetchers/file-link.js';
import { xlsToText } from './lib/converters/xls-to-text.js';
import { csvToText } from './lib/converters/csv-to-text.js';
import { generateSkill } from './lib/generator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute a short sha256 hash for change detection.
 *
 * @param {string} text
 * @returns {string}
 */
function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Fetch raw JSON/text from a URL.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchRawText(url) {
  const { default: https } = await import('https');
  const { default: http } = await import('http');

  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': 'source-skill/1.0', Accept: 'application/json, text/plain, */*' },
      timeout: 15000,
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });

    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });
}

/**
 * Collect all skill dirs with a .source-state.json under outputRoot.
 *
 * @param {string} outputRoot
 * @returns {Promise<string[]>}
 */
async function findSkillDirs(outputRoot) {
  let entries;
  try {
    entries = await fs.readdir(outputRoot, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const dirs = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (e) => {
        const candidate = path.join(outputRoot, e.name);
        const stateFile = path.join(candidate, '.source-state.json');
        try {
          await fs.access(stateFile);
          return candidate;
        } catch {
          return null;
        }
      }),
  );

  return dirs.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Core refresh logic for a single skill
// ---------------------------------------------------------------------------

/**
 * Refresh one skill directory: re-fetch, re-convert, re-generate SKILL.md.
 *
 * @param {string} skillDir
 * @param {object} opts
 * @param {boolean} opts.changedOnly  Skip refresh if content hash is unchanged.
 * @returns {Promise<void>}
 */
async function refreshSkill(skillDir, { changedOnly }) {
  const state = await readState(skillDir);
  if (!state) {
    console.error(`  No .source-state.json found in ${skillDir}. Skipping.`);
    return;
  }

  const { skillName, skillSlug, sourceType, sourceUrl, monitorConfig, userContext } = state;
  const label = skillName || path.basename(skillDir);

  console.log(`\nRefreshing: ${label}`);
  console.log(`  URL         : ${sourceUrl}`);
  console.log(`  Source type : ${sourceType}`);

  // -- Re-fetch
  let rawContent = '';
  let downloadedFilePath = null;
  let newMonitorConfig = { ...monitorConfig };

  if (sourceType === SOURCE_TYPES.PAGE_WITH_LINKS) {
    console.log(`  Re-fetching page links...`);
    let pageResult;
    try {
      pageResult = await fetchPageLinks(sourceUrl, { limit: 20 });
    } catch (err) {
      console.error(`  Error fetching page links: ${err.message}`);
      return;
    }

    const { links } = pageResult;
    if (links.length === 0) {
      console.error(`  No download links found on page. Skipping.`);
      return;
    }

    newMonitorConfig.lastKnownLinks = links.map((l) => l.url);

    const chosen = links[0];
    console.log(`  Downloading: ${chosen.url}`);
    try {
      const fetchResult = await fetchFile(chosen.url, skillDir);
      downloadedFilePath = fetchResult.filePath;
      newMonitorConfig.lastETag = fetchResult.etag ?? monitorConfig?.lastETag ?? null;
      newMonitorConfig.lastModified =
        fetchResult.lastModified ?? monitorConfig?.lastModified ?? null;
    } catch (err) {
      console.error(`  Error downloading file: ${err.message}`);
      return;
    }
  } else if (sourceType === SOURCE_TYPES.DIRECT_FILE) {
    console.log(`  Re-downloading file...`);
    try {
      const fetchResult = await fetchFile(sourceUrl, skillDir);
      downloadedFilePath = fetchResult.filePath;
      newMonitorConfig.lastETag = fetchResult.etag ?? monitorConfig?.lastETag ?? null;
      newMonitorConfig.lastModified =
        fetchResult.lastModified ?? monitorConfig?.lastModified ?? null;
    } catch (err) {
      console.error(`  Error downloading file: ${err.message}`);
      return;
    }
    console.log(`  Downloaded: ${downloadedFilePath}`);
  } else {
    // API_ENDPOINT or UNKNOWN
    console.log(`  Re-fetching URL content...`);
    try {
      rawContent = await fetchRawText(sourceUrl);
    } catch (err) {
      console.error(`  Error fetching URL: ${err.message}`);
      return;
    }
    console.log(`  Fetched ${rawContent.length} bytes.`);
  }

  // -- Convert downloaded file to text
  if (downloadedFilePath) {
    const ext = path.extname(downloadedFilePath).toLowerCase();
    console.log(`  Converting ${ext} to text...`);
    try {
      if (ext === '.xls' || ext === '.xlsx') {
        rawContent = await xlsToText(downloadedFilePath, {});
      } else if (ext === '.csv') {
        rawContent = await csvToText(downloadedFilePath, {});
      } else {
        rawContent = await fs.readFile(downloadedFilePath, 'utf8');
      }
    } catch (err) {
      console.error(`  Error converting file: ${err.message}`);
      return;
    }
    console.log(`  Converted to ${rawContent.length} characters.`);
  }

  if (!rawContent || rawContent.trim().length === 0) {
    console.error(`  No content extracted. Skipping refresh.`);
    return;
  }

  // -- Optional: skip if content hash unchanged
  if (changedOnly) {
    const newHash = hashContent(rawContent);
    if (state.contentHash && newHash === state.contentHash) {
      console.log(`  Content unchanged (hash match). Skipping regeneration.`);
      // Still update lastCheckTime
      await writeState(skillDir, { ...state, lastCheckTime: new Date().toISOString() });
      return;
    }
  }

  // -- Re-generate SKILL.md
  console.log(`  Regenerating SKILL.md...`);
  const storedUserContext = userContext ?? {};
  let newSkillContent;
  try {
    newSkillContent = await generateSkill(rawContent, storedUserContext, {
      skillName,
      skillSlug,
      sourceUrl,
      sourceType,
    });
  } catch (err) {
    console.error(`  Error generating skill: ${err.message}`);
    return;
  }

  // -- Write updated artifacts
  const skillMdPath = path.join(skillDir, 'SKILL.md');

  // Diff summary: line count change
  let previousLines = 0;
  try {
    const prev = await fs.readFile(skillMdPath, 'utf8');
    previousLines = prev.split('\n').length;
  } catch {
    // File may not exist yet
  }
  const newLines = newSkillContent.split('\n').length;

  await fs.writeFile(skillMdPath, newSkillContent, 'utf8');

  const newContentHash = hashContent(newSkillContent);
  const now = new Date().toISOString();
  const updatedState = {
    ...state,
    monitorConfig: newMonitorConfig,
    contentHash: newContentHash,
    lastCheckTime: now,
    lastRefreshTime: now,
  };
  await writeState(skillDir, updatedState);

  const lineDiff = newLines - previousLines;
  const diffLabel = lineDiff === 0 ? 'no line change' : lineDiff > 0 ? `+${lineDiff} lines` : `${lineDiff} lines`;
  console.log(`  Done. SKILL.md updated (${newLines} lines, ${diffLabel}).`);
  console.log(`  Content hash: ${newContentHash}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const skillDirArg = getString(args, 'skill-dir');
  const all = getBoolean(args, 'all');
  const changedOnly = getBoolean(args, 'changed-only');

  if (!skillDirArg && !all) {
    console.error('Error: provide --skill-dir <path> or --all.');
    console.error('Usage: node scripts/refresh.js --skill-dir <path> [--changed-only]');
    console.error('       node scripts/refresh.js --all [--changed-only]');
    process.exit(1);
  }

  if (changedOnly) {
    console.log('Mode: skip skills whose content has not changed.');
  }

  if (skillDirArg) {
    const skillDir = resolvePathFromCwd(skillDirArg);
    await refreshSkill(skillDir, { changedOnly });
    return;
  }

  // --all
  const outputRoot = resolvePathFromCwd('output');
  const skillDirs = await findSkillDirs(outputRoot);

  if (skillDirs.length === 0) {
    console.log('No skills found in ./output/.');
    return;
  }

  console.log(`Refreshing ${skillDirs.length} skill(s)...`);
  let refreshed = 0;

  for (const dir of skillDirs) {
    const stateBefore = await readState(dir);
    const hashBefore = stateBefore?.contentHash;
    await refreshSkill(dir, { changedOnly });
    const stateAfter = await readState(dir);
    if (stateAfter?.contentHash !== hashBefore) refreshed += 1;
  }

  console.log(`\nRefresh complete. ${refreshed} of ${skillDirs.length} skill(s) updated.`);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
