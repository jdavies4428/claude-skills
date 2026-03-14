import { discoverSkillDirs, loadState } from './skill-state.js';

function daysBetween(startIso, end = new Date()) {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function truncate(value, maxLength) {
  const text = String(value ?? '');
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

export async function collectSkillStatuses(rootDir, options = {}) {
  const staleAfterDays = options.staleAfterDays ?? 14;
  const skillDirs = await discoverSkillDirs(rootDir);
  const rows = [];

  for (const skillDir of skillDirs) {
    const state = await loadState(skillDir).catch(() => null);
    if (!state) {
      continue;
    }

    const ageDays = daysBetween(state.lastCrawlTime);
    rows.push({
      skillDir,
      librarySlug: state.librarySlug,
      libraryName: state.libraryName,
      skillTypeLabel: state.skillType?.promptLabel ?? state.skillType?.label ?? 'Unknown',
      profileName: state.profileName ?? '',
      docsUrl: state.docsUrl,
      lastCrawlTime: state.lastCrawlTime,
      ageDays,
      stale: ageDays === null ? true : ageDays > staleAfterDays,
      lastChangedCount: state.lastChangedUrls?.length ?? 0,
    });
  }

  return rows.sort((left, right) => {
    if (left.stale !== right.stale) {
      return left.stale ? -1 : 1;
    }
    return (right.ageDays ?? -1) - (left.ageDays ?? -1);
  });
}

export function formatStatusTable(rows) {
  if (rows.length === 0) {
    return 'No generated skills found.';
  }

  const header = ['slug', 'type', 'age', 'status', 'profile', 'docs'];
  const body = rows.map((row) => [
    row.librarySlug,
    truncate(row.skillTypeLabel, 16),
    row.ageDays === null ? '?' : `${row.ageDays}d`,
    row.stale ? 'stale' : 'fresh',
    truncate(row.profileName || '-', 14),
    truncate(row.docsUrl, 48),
  ]);

  const widths = header.map((title, index) => Math.max(title.length, ...body.map((row) => row[index].length)));
  const lines = [];

  lines.push(header.map((title, index) => title.padEnd(widths[index])).join('  '));
  lines.push(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of body) {
    lines.push(row.map((cell, index) => cell.padEnd(widths[index])).join('  '));
  }

  return lines.join('\n');
}

export function summarizeStatuses(rows) {
  return {
    total: rows.length,
    stale: rows.filter((row) => row.stale).length,
    fresh: rows.filter((row) => !row.stale).length,
  };
}
