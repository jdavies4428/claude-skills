#!/usr/bin/env node

import path from 'path';

import { getBoolean, getInteger, getString, parseArgs } from './lib/cli.js';
import { loadEnvFiles } from './lib/env.js';
import { collectSkillStatuses, formatStatusTable, summarizeStatuses } from './lib/status.js';
import { discoverSkillDirs } from './lib/skill-state.js';
import { refreshSkill } from './lib/workflow.js';

function usage() {
  return `
Usage:
  node scripts/refresh.js                  # show status dashboard
  node scripts/refresh.js --refresh-all    # refresh every generated skill
  node scripts/refresh.js --slug <slug>    # refresh one generated skill

Options:
  --status                Show the status dashboard and exit
  --refresh-all           Refresh every generated skill under --skills-root
  --skill-dir <dir>       Refresh one generated skill folder directly
  --skills-root <dir>     Root containing generated skills (default: ./output)
  --slug <slug>           Refresh one generated skill under --skills-root
  --stale-only            Limit dashboard or refresh-all to stale skills only
  --stale-after-days <n>  Mark skills stale after N days (default: 14)
  --target-tokens <n>     Approximate input budget for changed-page updates
  --dry-run               Crawl + preprocess only; do not update files
`.trim();
}

async function showStatus(skillsRoot, staleAfterDays, staleOnly) {
  const rows = await collectSkillStatuses(skillsRoot, { staleAfterDays });
  const filtered = staleOnly ? rows.filter((row) => row.stale) : rows;
  const summary = summarizeStatuses(rows);

  console.log(formatStatusTable(filtered));
  if (rows.length > 0) {
    console.log('');
    console.log(`Total: ${summary.total} | fresh: ${summary.fresh} | stale: ${summary.stale}`);
  }
}

async function main() {
  await loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  if (getBoolean(args, 'help', false)) {
    console.log(usage());
    process.exit(0);
  }

  const directSkillDir = getString(args, 'skill-dir');
  const skillsRoot = getString(args, 'skills-root', 'output');
  const slug = getString(args, 'slug');
  const refreshAll = getBoolean(args, 'refresh-all', false);
  const staleOnly = getBoolean(args, 'stale-only', false);
  const staleAfterDays = getInteger(args, 'stale-after-days', 14);
  const showDashboard = getBoolean(args, 'status', false) || (!directSkillDir && !slug && !refreshAll);

  if (showDashboard) {
    await showStatus(skillsRoot, staleAfterDays, staleOnly);
    process.exit(0);
  }

  let targets = [];
  if (directSkillDir) {
    targets = [directSkillDir];
  } else if (slug) {
    targets = [path.join(skillsRoot, slug)];
  } else if (refreshAll) {
    if (staleOnly) {
      const statuses = await collectSkillStatuses(skillsRoot, { staleAfterDays });
      targets = statuses.filter((row) => row.stale).map((row) => row.skillDir);
    } else {
      targets = await discoverSkillDirs(skillsRoot);
    }
  }

  if (targets.length === 0) {
    console.error('No generated skills matched the refresh request.');
    console.error(usage());
    process.exit(1);
  }

  for (const target of targets) {
    console.log(`Refreshing ${target}`);
    const summary = await refreshSkill(target, {
      dryRun: getBoolean(args, 'dry-run', false),
      preprocessOptions: {
        targetTokens: getInteger(args, 'target-tokens', 55000),
      },
      onProgress: (message) => console.log(message),
      onPoll: () => process.stdout.write('.'),
    });

    console.log('');
    if (summary.current) {
      console.log(`Current: ${summary.librarySlug} (no docs changes since ${summary.lastCrawlTime})`);
      continue;
    }

    if (summary.dryRun) {
      console.log(`Dry run for ${summary.librarySlug}: ${summary.changedUrls.length} changed page(s).`);
      continue;
    }

    console.log(`Updated ${summary.librarySlug} at ${summary.skillPath}`);
    console.log(`Changed pages: ${summary.changedUrls.length}`);
    console.log(`Estimated feed tokens: ${summary.preprocess.tokenEstimate}`);
    console.log(`Review: ${summary.review.summary.failures} failure(s), ${summary.review.summary.warnings} warning(s)`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
