#!/usr/bin/env node

import {
  getBoolean,
  getInteger,
  getMany,
  getString,
  loadJsonFile,
  parseArgs,
  slugify,
} from './lib/cli.js';
import { discoverDocsCandidates, previewDocsTarget } from './lib/discovery.js';
import { loadEnvFiles } from './lib/env.js';
import { saveProfile, listProfiles, loadProfile } from './lib/profiles.js';
import { mergeCrawlConfigs, listSkillTypes, resolveSkillType } from './lib/skill-types.js';
import { buildSkill } from './lib/workflow.js';
import { runBuildWizard } from './lib/wizard.js';

function usage() {
  return `
Usage:
  node scripts/build.js --url <docs-or-homepage-url> --name <library-name> [options]
  node scripts/build.js --wizard

Required without --wizard:
  --url <url>                  Docs URL, homepage, or repo URL
  --name <name>                Human-readable library name

Guided workflow:
  --wizard                     Launch an interactive build wizard

Skill typing:
  --skill-type <id>            api-sdk | cli-tool | workflow-app | data-source | frontend-lib | other
  --skill-type-other <label>   Custom label when skill type is "other"
  --list-types                 Show available skill types

Profiles:
  --profile <name>             Load a saved project profile
  --save-profile <name>        Save current answers as a reusable profile
  --list-profiles              Show saved profiles

Discovery and preview:
  --discover                   Probe and print likely docs URLs, then exit
  --auto-discover              Pick the highest-ranked discovered docs URL automatically
  --preview                    Preview the chosen docs URL before building
  --preview-only               Preview the chosen docs URL, then exit

Output and context:
  --slug <slug>                Output folder slug (default: slugified name)
  --output-root <dir>          Generated skills root (default: ./output)
  --skill-dir <dir>            Explicit generated skill folder path
  --context-file <file>        JSON file with userContext/crawlConfig defaults
  --app-name <value>           Project/app name
  --language <value>           Language or framework
  --architecture <value>       How the library is used in the codebase
  --config <value>             Project-specific IDs, env vars, package names
  --use <value>                Features the project uses
  --avoid <value>              Features the project does not use
  --naming <value>             Naming conventions to preserve
  --notes <value>              Extra project notes

Crawl tuning:
  --include <glob>             Include URL glob (repeatable)
  --exclude <glob>             Exclude URL glob (repeatable)
  --limit <n>                  Max pages to crawl
  --depth <n>                  Max crawl depth
  --render                     Use headless browser rendering
  --discovery-mode <mode>      sitemap | links | both
  --max-age <seconds>          Cloudflare cache max age
  --target-tokens <n>          Approximate input budget for generation
  --dry-run                    Crawl + preprocess only; do not generate or write files
`.trim();
}

function printSkillTypes() {
  for (const type of listSkillTypes()) {
    console.log(`${type.id.padEnd(13)} ${type.label} — ${type.description}`);
  }
}

async function printProfiles() {
  const profiles = await listProfiles({ loadData: true });
  if (profiles.length === 0) {
    console.log('No saved profiles found.');
    return;
  }

  for (const profile of profiles) {
    const typeLabel = profile.data?.skillType?.promptLabel ?? profile.data?.skillType?.label ?? 'Unknown';
    console.log(`${profile.name} — ${typeLabel}`);
  }
}

function buildUserContext(args, contextFile, profileData, wizardResult) {
  if (wizardResult?.userContext) {
    return wizardResult.userContext;
  }

  return {
    ...(contextFile?.userContext ?? contextFile ?? {}),
    ...(profileData?.userContext ?? {}),
    appName: getString(args, 'app-name', profileData?.userContext?.appName ?? contextFile?.userContext?.appName ?? contextFile?.appName ?? ''),
    language: getString(args, 'language', profileData?.userContext?.language ?? contextFile?.userContext?.language ?? contextFile?.language ?? ''),
    architecture: getString(args, 'architecture', profileData?.userContext?.architecture ?? contextFile?.userContext?.architecture ?? contextFile?.architecture ?? ''),
    config: getString(args, 'config', profileData?.userContext?.config ?? contextFile?.userContext?.config ?? contextFile?.config ?? ''),
    use: getString(args, 'use', profileData?.userContext?.use ?? contextFile?.userContext?.use ?? contextFile?.use ?? ''),
    avoid: getString(args, 'avoid', profileData?.userContext?.avoid ?? contextFile?.userContext?.avoid ?? contextFile?.avoid ?? ''),
    naming: getString(args, 'naming', profileData?.userContext?.naming ?? contextFile?.userContext?.naming ?? contextFile?.naming ?? ''),
    extraNotes: getString(args, 'notes', profileData?.userContext?.extraNotes ?? contextFile?.userContext?.extraNotes ?? contextFile?.extraNotes ?? ''),
  };
}

function buildExplicitCrawlConfig(args) {
  return {
    include: getMany(args, 'include'),
    exclude: getMany(args, 'exclude'),
    limit: getInteger(args, 'limit', undefined),
    maxDepth: getInteger(args, 'depth', undefined),
    render: 'render' in args ? getBoolean(args, 'render', false) : undefined,
    discovery: getString(args, 'discovery-mode', ''),
    maxAge: getInteger(args, 'max-age', undefined),
  };
}

function printDocsPreview(preview) {
  console.log(`Preview: ${preview.title || preview.url}`);
  console.log(`URL: ${preview.url}`);
  console.log(`Status: ${preview.status} | headings: ${preview.headingCount} | code blocks: ${preview.codeBlockCount}`);
  if (preview.suggestedDocsLinks?.length > 0) {
    console.log('Docs-like links on this page:');
    preview.suggestedDocsLinks.slice(0, 5).forEach((link) => console.log(`- ${link.url}`));
  }
}

function printDiscoveredCandidates(candidates) {
  if (candidates.length === 0) {
    console.log('No likely docs URLs discovered.');
    return;
  }

  candidates.slice(0, 8).forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.url}`);
    console.log(`   title: ${candidate.title || 'No title'} | score: ${candidate.docsScore} | reason: ${candidate.reason}`);
  });
}

function buildProfilePayload(options) {
  return {
    skillType: options.skillType,
    userContext: options.userContext,
    crawlConfig: options.crawlConfig,
    preferredOutputRoot: options.outputRoot,
    lastDocsInput: options.docsInputUrl,
    lastDocsUrl: options.docsUrl,
  };
}

async function main() {
  await loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  if (getBoolean(args, 'help', false)) {
    console.log(usage());
    process.exit(0);
  }

  if (getBoolean(args, 'list-types', false)) {
    printSkillTypes();
    process.exit(0);
  }

  if (getBoolean(args, 'list-profiles', false)) {
    await printProfiles();
    process.exit(0);
  }

  const contextFile = getString(args, 'context-file')
    ? await loadJsonFile(getString(args, 'context-file'))
    : {};
  const loadedProfileName = getString(args, 'profile');
  const profileData = loadedProfileName
    ? await loadProfile(loadedProfileName).catch(() => {
      throw new Error(`Profile not found: ${loadedProfileName}`);
    })
    : null;

  const shouldUseWizard = getBoolean(args, 'wizard', false)
    || ((!getString(args, 'url') || !getString(args, 'name')) && process.stdin.isTTY && process.stdout.isTTY);

  const wizardResult = shouldUseWizard
    ? await runBuildWizard({
      defaults: {
        docsInputUrl: getString(args, 'url', profileData?.lastDocsInput ?? ''),
        docsUrl: getString(args, 'url', profileData?.lastDocsUrl ?? ''),
        libraryName: getString(args, 'name', ''),
        outputRoot: getString(args, 'output-root', profileData?.preferredOutputRoot ?? process.env.DOC_TO_SKILL_OUTPUT_ROOT ?? 'output'),
        skillTypeId: getString(args, 'skill-type', profileData?.skillType?.id ?? 'api-sdk'),
        skillTypeOther: getString(args, 'skill-type-other', profileData?.skillType?.otherLabel ?? ''),
        appName: getString(args, 'app-name', profileData?.userContext?.appName ?? ''),
        language: getString(args, 'language', profileData?.userContext?.language ?? ''),
        architecture: getString(args, 'architecture', profileData?.userContext?.architecture ?? ''),
        config: getString(args, 'config', profileData?.userContext?.config ?? ''),
        use: getString(args, 'use', profileData?.userContext?.use ?? ''),
        avoid: getString(args, 'avoid', profileData?.userContext?.avoid ?? ''),
        naming: getString(args, 'naming', profileData?.userContext?.naming ?? ''),
        notes: getString(args, 'notes', profileData?.userContext?.extraNotes ?? ''),
      },
    })
    : null;

  const docsInputUrl = wizardResult?.docsInputUrl || getString(args, 'url');
  let docsUrl = wizardResult?.docsUrl || getString(args, 'url');
  const libraryName = wizardResult?.libraryName || getString(args, 'name');

  if (!docsInputUrl || !libraryName) {
    console.error(usage());
    process.exit(1);
  }

  const skillType = wizardResult?.skillType ?? resolveSkillType(
    getString(args, 'skill-type', profileData?.skillType?.id ?? 'api-sdk'),
    getString(args, 'skill-type-other', profileData?.skillType?.otherLabel ?? ''),
  );

  if (getBoolean(args, 'discover', false) || getBoolean(args, 'auto-discover', false)) {
    const candidates = await discoverDocsCandidates(docsInputUrl);
    if (getBoolean(args, 'discover', false)) {
      printDiscoveredCandidates(candidates);
      process.exit(0);
    }

    if (candidates.length > 0) {
      docsUrl = candidates[0].url;
      console.log(`Using discovered docs URL: ${docsUrl}`);
    } else {
      console.log('Auto-discovery found no better docs URL; using the supplied URL.');
    }
  }

  if (getBoolean(args, 'preview', false) || getBoolean(args, 'preview-only', false)) {
    const preview = await previewDocsTarget(docsUrl);
    printDocsPreview(preview);
    if (getBoolean(args, 'preview-only', false)) {
      process.exit(0);
    }
  }

  const userContext = buildUserContext(args, contextFile, profileData, wizardResult);
  const crawlConfig = mergeCrawlConfigs(
    skillType.crawlDefaults,
    contextFile?.crawlConfig,
    profileData?.crawlConfig,
    buildExplicitCrawlConfig(args),
  );
  const outputRoot = wizardResult?.outputRoot || getString(args, 'output-root', profileData?.preferredOutputRoot ?? process.env.DOC_TO_SKILL_OUTPUT_ROOT ?? 'output');
  const saveProfileName = wizardResult?.saveProfileName || getString(args, 'save-profile');
  const effectiveProfileName = saveProfileName || loadedProfileName || wizardResult?.selectedProfileName || '';

  if (saveProfileName) {
    await saveProfile(saveProfileName, buildProfilePayload({
      skillType,
      userContext,
      crawlConfig,
      outputRoot,
      docsInputUrl,
      docsUrl,
    }));
    console.log(`Saved profile: ${saveProfileName}`);
  }

  const summary = await buildSkill({
    libraryName,
    librarySlug: getString(args, 'slug', slugify(libraryName)),
    docsInputUrl,
    docsUrl,
    crawlConfig,
    skillType,
    profileName: effectiveProfileName,
    userContext,
    outputRoot,
    skillDir: getString(args, 'skill-dir', ''),
    preprocessOptions: {
      targetTokens: getInteger(args, 'target-tokens', 55000),
    },
    dryRun: getBoolean(args, 'dry-run', false),
    onProgress: (message) => console.log(message),
    onPoll: () => process.stdout.write('.'),
  });

  console.log('');
  if (summary.dryRun) {
    console.log(`Dry run complete for ${libraryName}.`);
    console.log(`Docs URL: ${docsUrl}`);
    console.log(`Skill type: ${skillType.promptLabel}`);
    console.log(`Output dir: ${summary.skillDir}`);
    console.log(`Pages crawled: ${summary.pageCount}`);
    console.log(`Selected pages: ${summary.preprocess.selectedPages.length}`);
    console.log(`Estimated feed tokens: ${summary.preprocess.tokenEstimate}`);
    process.exit(0);
  }

  console.log(`Built ${libraryName} skill at ${summary.skillPath}`);
  console.log(`Docs URL: ${docsUrl}`);
  console.log(`Skill type: ${skillType.promptLabel}`);
  console.log(`Pages crawled: ${summary.pageCount}`);
  console.log(`Selected pages: ${summary.preprocess.selectedPages.length}`);
  console.log(`Estimated feed tokens: ${summary.preprocess.tokenEstimate}`);
  console.log(`Review: ${summary.review.summary.failures} failure(s), ${summary.review.summary.warnings} warning(s)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
