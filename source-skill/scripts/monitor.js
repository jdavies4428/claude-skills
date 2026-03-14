#!/usr/bin/env node
/**
 * scripts/monitor.js
 *
 * Change detection orchestrator. Scans skill directories for source changes
 * using the strategy recorded in each .source-state.json.
 *
 * Usage:
 *   node scripts/monitor.js [--status]
 *   node scripts/monitor.js --skill-dir <path> [--dry-run]
 *   node scripts/monitor.js --all [--dry-run]
 */

import fs from 'fs/promises';
import path from 'path';

import { parseArgs, getString, getBoolean, resolvePathFromCwd } from './lib/cli.js';
import { readState, writeState } from './lib/source-state.js';
import { checkPageDiff } from './lib/monitors/page-diff.js';
import { checkHttpHead } from './lib/monitors/http-head.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collect all skill directories under ./output/ that contain a
 * .source-state.json file.
 *
 * @param {string} outputRoot  Absolute path to the output directory.
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

/**
 * Format an ISO timestamp as a short human-readable string.
 *
 * @param {string|null} iso
 * @returns {string}
 */
function formatTime(iso) {
  if (!iso) return 'never';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Compute a rough staleness label based on lastCheckTime.
 *
 * @param {string|null} lastCheckTime
 * @returns {string}
 */
function staleness(lastCheckTime) {
  if (!lastCheckTime) return 'UNKNOWN';
  const ageMs = Date.now() - new Date(lastCheckTime).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours < 1) return 'fresh';
  if (ageHours < 24) return `${Math.floor(ageHours)}h ago`;
  const ageDays = Math.floor(ageHours / 24);
  return `${ageDays}d ago`;
}

/**
 * Print a simple ASCII dashboard table for --status mode.
 *
 * @param {{ dir: string, state: object }[]} entries
 */
function printStatusTable(entries) {
  if (entries.length === 0) {
    console.log('No skills found in ./output/. Run build.js to create one.');
    return;
  }

  const COL_NAME = 28;
  const COL_TYPE = 18;
  const COL_LAST_CHECK = 24;
  const COL_STALE = 12;

  const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
  const hr = '-'.repeat(COL_NAME + COL_TYPE + COL_LAST_CHECK + COL_STALE + 7);

  console.log('');
  console.log('Skill Status Dashboard');
  console.log(hr);
  console.log(
    `${pad('Name', COL_NAME)} | ${pad('Source Type', COL_TYPE)} | ${pad('Last Check', COL_LAST_CHECK)} | ${pad('Staleness', COL_STALE)}`,
  );
  console.log(hr);

  for (const { state } of entries) {
    const name = state.skillName || '(unnamed)';
    const type = state.sourceType || 'unknown';
    const lastCheck = formatTime(state.lastCheckTime);
    const stale = staleness(state.lastCheckTime);
    console.log(
      `${pad(name, COL_NAME)} | ${pad(type, COL_TYPE)} | ${pad(lastCheck, COL_LAST_CHECK)} | ${pad(stale, COL_STALE)}`,
    );
  }

  console.log(hr);
  console.log(`Total: ${entries.length} skill(s)`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Per-skill check logic
// ---------------------------------------------------------------------------

/**
 * Run change detection for a single skill directory.
 * Returns true if changes were detected.
 *
 * @param {string} skillDir
 * @param {object} opts
 * @param {boolean} opts.dryRun
 * @returns {Promise<boolean>}
 */
async function checkSkill(skillDir, { dryRun }) {
  const state = await readState(skillDir);
  if (!state) {
    console.error(`  No .source-state.json found in ${skillDir}`);
    return false;
  }

  const { skillName, sourceUrl, monitorConfig } = state;
  const strategy = monitorConfig?.strategy ?? 'http-head';
  const label = skillName || path.basename(skillDir);

  console.log(`\nChecking: ${label}`);
  console.log(`  URL      : ${sourceUrl}`);
  console.log(`  Strategy : ${strategy}`);

  let changed = false;
  let updatedMonitorConfig = { ...monitorConfig };

  try {
    if (strategy === 'page-diff') {
      const lastKnownLinks = monitorConfig?.lastKnownLinks ?? [];
      const result = await checkPageDiff(sourceUrl, lastKnownLinks, {});
      changed = result.changed;
      if (changed) {
        updatedMonitorConfig.lastKnownLinks = result.currentLinks ?? lastKnownLinks;
        console.log(`  Result   : CHANGED — link set differs from last check`);
        if (result.added?.length) {
          console.log(`  Added    : ${result.added.join(', ')}`);
        }
        if (result.removed?.length) {
          console.log(`  Removed  : ${result.removed.join(', ')}`);
        }
      } else {
        console.log(`  Result   : no changes detected`);
      }
    } else {
      // Default: http-head
      const lastETag = monitorConfig?.lastETag ?? null;
      const lastModified = monitorConfig?.lastModified ?? null;
      const result = await checkHttpHead(sourceUrl, lastETag, lastModified);
      changed = result.changed;
      if (changed) {
        updatedMonitorConfig.lastETag = result.etag ?? lastETag;
        updatedMonitorConfig.lastModified = result.lastModified ?? lastModified;
        console.log(`  Result   : CHANGED — HTTP headers indicate new content`);
        if (result.etag) console.log(`  ETag     : ${result.etag}`);
        if (result.lastModified) console.log(`  Modified : ${result.lastModified}`);
      } else {
        console.log(`  Result   : no changes detected`);
      }
    }
  } catch (err) {
    console.error(`  Error during check: ${err.message}`);
    return false;
  }

  // Update lastCheckTime (and possibly monitor data) unless dry-run
  if (!dryRun) {
    const updatedState = {
      ...state,
      monitorConfig: updatedMonitorConfig,
      lastCheckTime: new Date().toISOString(),
    };
    await writeState(skillDir, updatedState);
    console.log(`  State updated.`);
  } else {
    console.log(`  Dry-run: state not updated.`);
  }

  return changed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const showStatus = getBoolean(args, 'status');
  const skillDirArg = getString(args, 'skill-dir');
  const all = getBoolean(args, 'all');
  const dryRun = getBoolean(args, 'dry-run');

  const outputRoot = resolvePathFromCwd('output');

  // -- --status: print dashboard and exit
  if (showStatus) {
    const skillDirs = await findSkillDirs(outputRoot);
    const entries = await Promise.all(
      skillDirs.map(async (dir) => {
        const state = await readState(dir);
        return { dir, state };
      }),
    );
    printStatusTable(entries.filter((e) => e.state !== null));
    return;
  }

  // -- --skill-dir: check one specific skill
  if (skillDirArg) {
    const skillDir = resolvePathFromCwd(skillDirArg);
    const changed = await checkSkill(skillDir, { dryRun });
    if (changed && !dryRun) {
      console.log(`\nRun: node scripts/refresh.js --skill-dir "${skillDirArg}" to update.`);
    }
    return;
  }

  // -- --all: check every skill in ./output/
  if (all) {
    const skillDirs = await findSkillDirs(outputRoot);
    if (skillDirs.length === 0) {
      console.log('No skills found in ./output/.');
      return;
    }

    console.log(`Checking ${skillDirs.length} skill(s)...`);
    const changedDirs = [];

    for (const dir of skillDirs) {
      const changed = await checkSkill(dir, { dryRun });
      if (changed) changedDirs.push(dir);
    }

    console.log(`\nSummary: ${changedDirs.length} of ${skillDirs.length} skill(s) have changes.`);
    if (changedDirs.length > 0 && !dryRun) {
      console.log(`\nRun refresh for changed skills:`);
      for (const dir of changedDirs) {
        const rel = path.relative(process.cwd(), dir);
        console.log(`  node scripts/refresh.js --skill-dir "${rel}"`);
      }
    }
    return;
  }

  // -- No mode selected: print usage
  console.log('Usage:');
  console.log('  node scripts/monitor.js --status');
  console.log('  node scripts/monitor.js --skill-dir <path> [--dry-run]');
  console.log('  node scripts/monitor.js --all [--dry-run]');
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
