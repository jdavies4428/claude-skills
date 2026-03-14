#!/usr/bin/env node
/**
 * scripts/build.js
 *
 * Unified build flow: detect source type, fetch content, convert to text,
 * generate SKILL.md, and write output artifacts.
 *
 * Usage:
 *   node scripts/build.js --url <URL> [--name <Name>] [--slug <slug>]
 *     [--type <sourceType>] [--purpose <purpose>]
 *     [--output-format <format>] [--link-pattern <regex>]
 *     [--save] [--install-dir <path>]
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

import { parseArgs, getString, getBoolean, slugify, resolvePathFromCwd } from './lib/cli.js';
import { detectSourceType, SOURCE_TYPES } from './lib/source-detect.js';
import { readState, writeState, createInitialState } from './lib/source-state.js';
import { fetchPageLinks } from './lib/fetchers/page-links.js';
import { fetchFile, checkFileChanged } from './lib/fetchers/file-link.js';
import { xlsToText } from './lib/converters/xls-to-text.js';
import { csvToText } from './lib/converters/csv-to-text.js';
import { generateSkill } from './lib/generator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable skill name from a URL when --name is not provided.
 *
 * @param {string} url
 * @returns {string}
 */
function nameFromUrl(url) {
  try {
    const parsed = new URL(url);
    // Use the last non-empty pathname segment, stripping extension.
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments.at(-1) ?? parsed.hostname;
    const withoutExt = last.replace(/\.[^.]+$/, '');
    // Fall back to hostname when the path segment is just a version/id token.
    if (/^v?\d/.test(withoutExt) || withoutExt.length <= 2) {
      return parsed.hostname.replace(/^www\./, '');
    }
    return withoutExt.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return 'Unknown Source';
  }
}

/**
 * Determine the file extension of a URL path.
 *
 * @param {string} url
 * @returns {string}  e.g. ".xlsx" or ""
 */
function urlExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').at(-1) ?? '';
    const dot = last.lastIndexOf('.');
    return dot === -1 ? '' : last.slice(dot).toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Compute a short sha256 hash of a string for content change tracking.
 *
 * @param {string} text
 * @returns {string}
 */
function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Fetch the raw text for an API endpoint URL.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchApiJson(url) {
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
      headers: { 'User-Agent': 'source-skill/1.0', Accept: 'application/json' },
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // -- Required argument: --url
  const url = getString(args, 'url');
  if (!url) {
    console.error('Error: --url is required.');
    console.error('Usage: node scripts/build.js --url <URL> [--name <Name>] [--slug <slug>]');
    console.error('       [--type <sourceType>] [--purpose <purpose>]');
    console.error('       [--output-format <format>] [--link-pattern <regex>]');
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    console.error(`Error: "${url}" is not a valid URL.`);
    process.exit(1);
  }

  // -- Optional arguments
  const nameArg = getString(args, 'name');
  const slugArg = getString(args, 'slug');
  const typeArg = getString(args, 'type');
  const purpose = getString(args, 'purpose');
  const outputFormat = getString(args, 'output-format');
  const linkPatternStr = getString(args, 'link-pattern');
  const save = getBoolean(args, 'save');
  const installDir = getString(args, 'install-dir');

  // -- Derive name and slug
  const skillName = nameArg || nameFromUrl(url);
  const skillSlug = slugArg || slugify(skillName);

  console.log(`\nSource Skill Builder`);
  console.log(`====================`);
  console.log(`URL   : ${url}`);
  console.log(`Name  : ${skillName}`);
  console.log(`Slug  : ${skillSlug}`);

  // -- Detect or use provided source type
  let sourceType = typeArg;
  if (sourceType) {
    console.log(`\nSource type (provided): ${sourceType}`);
  } else {
    console.log(`\nDetecting source type...`);
    try {
      sourceType = await detectSourceType(url);
    } catch (err) {
      console.error(`Error detecting source type: ${err.message}`);
      process.exit(1);
    }
    console.log(`Detected source type: ${sourceType}`);
  }

  // -- Handle docs-site: delegate to doc-to-skill pipeline
  if (sourceType === SOURCE_TYPES.DOCS_SITE) {
    console.log(`\nDocs site detected. Delegating to doc-to-skill pipeline...`);

    const docToSkillBuild = resolvePathFromCwd(path.join('..', 'doc-to-skill', 'scripts', 'build.js'));
    try {
      await fs.access(docToSkillBuild);
    } catch {
      console.error(`Error: doc-to-skill not found at ${docToSkillBuild}`);
      console.error(`Install doc-to-skill alongside source-skill, or use --type to override.`);
      process.exit(1);
    }

    // Forward to doc-to-skill with matching args
    const { execFileSync } = await import('child_process');
    const forwardArgs = ['--url', url];
    if (nameArg) forwardArgs.push('--name', nameArg);
    if (slugArg) forwardArgs.push('--slug', slugArg);

    try {
      execFileSync('node', [docToSkillBuild, ...forwardArgs], {
        stdio: 'inherit',
        cwd: resolvePathFromCwd('../doc-to-skill'),
      });
    } catch (err) {
      console.error(`doc-to-skill exited with error.`);
      process.exit(1);
    }

    process.exit(0);
  }

  // -- Set up output directory
  const outputDir = resolvePathFromCwd(path.join('output', skillSlug));
  console.log(`\nOutput directory: ${outputDir}`);

  // -- Fetch content based on source type
  let rawContent = '';
  let downloadedFilePath = null;
  let monitorStrategy = 'http-head';
  let lastKnownLinks = [];
  let lastETag = null;
  let lastModified = null;

  if (sourceType === SOURCE_TYPES.PAGE_WITH_LINKS) {
    console.log(`\nFetching download links from page...`);

    let pattern = null;
    if (linkPatternStr) {
      try {
        pattern = new RegExp(linkPatternStr, 'i');
        console.log(`Filtering links with pattern: ${linkPatternStr}`);
      } catch {
        console.error(`Error: --link-pattern "${linkPatternStr}" is not a valid regex.`);
        process.exit(1);
      }
    }

    let pageResult;
    try {
      console.log(`Probing links to find the latest valid file...`);
      pageResult = await fetchPageLinks(url, {
        pattern,
        limit: 30,
        probeLatest: true,
        onProbe: (link, exists) => {
          console.log(`  ${exists ? 'VALID' : '404  '}  ${link.filename}`);
        },
      });
    } catch (err) {
      console.error(`Error fetching page links: ${err.message}`);
      process.exit(1);
    }

    const { links, latestLink } = pageResult;
    lastKnownLinks = links.map((l) => l.url);

    if (links.length === 0) {
      console.error(`No download links found on page: ${url}`);
      process.exit(1);
    }

    console.log(`\nFound ${links.length} link(s) on page.`);

    // Use the probed latest link, or fall back to trying links in order
    const chosen = latestLink || links[0];
    console.log(`Latest valid file: ${chosen.filename}`);
    console.log(`Downloading: ${chosen.url}`);

    try {
      const fetchResult = await fetchFile(chosen.url, outputDir);
      downloadedFilePath = fetchResult.filePath;
      lastETag = fetchResult.etag ?? null;
      lastModified = fetchResult.lastModified ?? null;
      console.log(`Downloaded: ${fetchResult.size} bytes`);
    } catch (err) {
      console.error(`Error downloading file: ${err.message}`);
      process.exit(1);
    }

    monitorStrategy = 'page-diff';
  } else if (sourceType === SOURCE_TYPES.DIRECT_FILE) {
    console.log(`\nDownloading file...`);

    try {
      const fetchResult = await fetchFile(url, outputDir);
      downloadedFilePath = fetchResult.filePath;
      lastETag = fetchResult.etag ?? null;
      lastModified = fetchResult.lastModified ?? null;
    } catch (err) {
      console.error(`Error downloading file: ${err.message}`);
      process.exit(1);
    }

    console.log(`Downloaded: ${downloadedFilePath}`);
    monitorStrategy = 'http-head';
  } else if (sourceType === SOURCE_TYPES.API_ENDPOINT) {
    console.log(`\nFetching API response...`);

    try {
      rawContent = await fetchApiJson(url);
    } catch (err) {
      console.error(`Error fetching API endpoint: ${err.message}`);
      process.exit(1);
    }

    console.log(`Fetched ${rawContent.length} bytes.`);
    monitorStrategy = 'http-head';
  } else {
    // UNKNOWN or unrecognised type — attempt a raw HTTP fetch as text
    console.log(`\nUnknown source type. Attempting raw fetch...`);

    try {
      rawContent = await fetchApiJson(url);
    } catch (err) {
      console.error(`Error fetching URL: ${err.message}`);
      process.exit(1);
    }

    console.log(`Fetched ${rawContent.length} bytes.`);
  }

  // -- Convert downloaded file to text
  if (downloadedFilePath) {
    const ext = path.extname(downloadedFilePath).toLowerCase();
    console.log(`\nConverting ${ext} file to text...`);

    try {
      if (ext === '.xls' || ext === '.xlsx') {
        const result = xlsToText(downloadedFilePath, {});
        rawContent = result.text;
      } else if (ext === '.csv') {
        const result = csvToText(downloadedFilePath, {});
        rawContent = result.text;
      } else {
        // Treat as plain text (e.g. JSON, PDF rendered elsewhere)
        rawContent = await fs.readFile(downloadedFilePath, 'utf8');
      }
    } catch (err) {
      console.error(`Error converting file: ${err.message}`);
      process.exit(1);
    }

    console.log(`Converted to ${rawContent.length} characters of text.`);
  }

  if (!rawContent || rawContent.trim().length === 0) {
    console.error(`Error: No content could be extracted from the source.`);
    process.exit(1);
  }

  // -- Build user context for the generator
  const userContext = {
    purpose: purpose || `Understand and use the data from ${skillName}`,
    features: [],
    outputFormat: outputFormat || 'markdown',
  };

  // -- Generate SKILL.md
  console.log(`\nGenerating SKILL.md...`);

  let skillContent;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    // Use API to generate
    try {
      skillContent = await generateSkill(rawContent, userContext, {
        skillName,
        skillSlug,
        sourceUrl: url,
        sourceType,
      });
    } catch (err) {
      console.error(`Error generating skill: ${err.message}`);
      process.exit(1);
    }
  } else {
    // No API key — write a scaffold SKILL.md for the user/Claude to fill in
    console.log(`No ANTHROPIC_API_KEY set. Writing scaffold SKILL.md.`);
    console.log(`Use the guided flow (SKILL.md instructions) to have Claude generate the full skill.`);
    skillContent = [
      `---`,
      `name: ${skillName}`,
      `description: >`,
      `  Skill generated from ${url}.`,
      `  ${userContext.purpose}`,
      `---`,
      ``,
      `# ${skillName}`,
      ``,
      `Source: ${url}`,
      ``,
      `## Purpose`,
      ``,
      userContext.purpose,
      ``,
      `## Data`,
      ``,
      `Content extracted from source (${rawContent.length} characters).`,
      `Use the guided build flow to generate the full skill with analysis and dashboards.`,
      ``,
    ].join('\n');
  }

  // -- Write output artifacts
  await fs.mkdir(outputDir, { recursive: true });

  const skillMdPath = path.join(outputDir, 'SKILL.md');
  await fs.writeFile(skillMdPath, skillContent, 'utf8');

  const contentHash = hashContent(skillContent);

  const state = createInitialState({
    skillName,
    skillSlug,
    sourceType,
    sourceUrl: url,
    monitorConfig: {
      strategy: monitorStrategy,
      lastKnownLinks,
      lastETag,
      lastModified,
    },
    userContext,
    contentHash,
  });

  await writeState(outputDir, state);

  // -- Save / install the skill
  if (save) {
    // Default install location: ClaudeSkills/{slug}/ (sibling of source-skill/)
    const projectRoot = path.resolve(import.meta.dirname, '..', '..');
    const targetDir = installDir
      ? path.resolve(process.cwd(), installDir, skillSlug)
      : path.join(projectRoot, skillSlug);

    console.log(`\nInstalling skill to: ${targetDir}`);
    await fs.mkdir(targetDir, { recursive: true });

    // Copy all files from output dir to install dir
    const files = await fs.readdir(outputDir);
    for (const file of files) {
      const src = path.join(outputDir, file);
      const dest = path.join(targetDir, file);
      const stat = await fs.stat(src);
      if (stat.isFile()) {
        await fs.copyFile(src, dest);
      }
    }

    console.log(`\nSkill installed.`);
    console.log(`  Location  : ${targetDir}`);
    console.log(`  SKILL.md  : ${path.join(targetDir, 'SKILL.md')}`);
    console.log(`  State     : ${path.join(targetDir, '.source-state.json')}`);
    console.log(`\n  To check for updates later:`);
    console.log(`  node scripts/monitor.js --skill-dir ${targetDir}`);
  } else {
    // -- Done without saving
    console.log(`\nBuild complete.`);
    console.log(`  SKILL.md  : ${skillMdPath}`);
    console.log(`  State     : ${path.join(outputDir, '.source-state.json')}`);
    console.log(`\n  To install this skill, re-run with --save:`);
    console.log(`  node scripts/build.js --url "${url}" --slug ${skillSlug} --save`);
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
