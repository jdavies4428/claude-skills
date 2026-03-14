#!/usr/bin/env node

import fs from 'fs/promises';

import { getBoolean, getInteger, getMany, getString, parseArgs } from './lib/cli.js';
import { runCrawl } from './lib/crawl-client.js';
import { loadEnvFiles } from './lib/env.js';

function usage() {
  return `
Usage:
  node scripts/crawl.js --url <url> [options]

Options:
  --limit <n>          Max pages (default: 20)
  --depth <n>          Max depth (default: 2)
  --include <glob>     Include URL glob (repeatable)
  --exclude <glob>     Exclude URL glob (repeatable)
  --render             Use headless browser
  --discovery <mode>   sitemap | links | both (default: both)
  --modified-since <t> ISO datetime for incremental crawl
  --max-age <seconds>  Reuse cached pages younger than N seconds
  --out <file>         Save full results to JSON
  --dry-run            Print the payload only
`.trim();
}

async function main() {
  await loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const url = getString(args, 'url');

  if (getBoolean(args, 'help', false)) {
    console.log(usage());
    process.exit(0);
  }

  if (!url) {
    console.log(usage());
    process.exit(1);
  }

  const payload = {
    url,
    limit: getInteger(args, 'limit', 20),
    maxDepth: getInteger(args, 'depth', 2),
    render: getBoolean(args, 'render', false),
    discovery: getString(args, 'discovery', 'both'),
    outputFormats: ['markdown', 'json'],
  };

  const include = getMany(args, 'include');
  const exclude = getMany(args, 'exclude');
  const modifiedSince = getString(args, 'modified-since');
  const maxAge = getInteger(args, 'max-age', undefined);

  if (include.length > 0) {
    payload.include = include;
  }

  if (exclude.length > 0) {
    payload.exclude = exclude;
  }

  if (modifiedSince) {
    payload.modifiedSince = modifiedSince;
  }

  if (maxAge) {
    payload.maxAge = maxAge;
  }

  console.log(JSON.stringify(payload, null, 2));
  if (getBoolean(args, 'dry-run', false)) {
    process.exit(0);
  }

  const crawl = await runCrawl(payload, {
    onPoll: () => process.stdout.write('.'),
  });
  console.log('');
  console.log(`Crawl complete: ${crawl.result.pages.length} pages`);

  const summary = crawl.result.pages
    .map((page) => ({
      url: page.url,
      words: page.json?.wordCount ?? 0,
      codeBlocks: page.json?.codeBlockCount ?? 0,
      headings: page.json?.headingCount ?? 0,
    }))
    .sort((left, right) => right.codeBlocks - left.codeBlocks);

  console.log('URL                                                     words  code  hdgs');
  console.log('-'.repeat(75));
  for (const page of summary) {
    const trimmedUrl = page.url.replace(/https?:\/\/[^/]+/, '').padEnd(52).slice(0, 52);
    console.log(`${trimmedUrl}  ${String(page.words).padStart(5)}  ${String(page.codeBlocks).padStart(4)}  ${String(page.headings).padStart(4)}`);
  }

  const outputFile = getString(args, 'out');
  if (outputFile) {
    await fs.writeFile(outputFile, `${JSON.stringify(crawl.result, null, 2)}\n`);
    console.log(`Saved raw crawl to ${outputFile}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
