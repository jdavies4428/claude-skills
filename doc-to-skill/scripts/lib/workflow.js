import fs from 'fs/promises';
import path from 'path';

import { createAnthropicClient } from './anthropic-client.js';
import { runCrawl } from './crawl-client.js';
import {
  generateDraftSkill,
  personalizeSkill,
  repairSkill,
  reviseSkillFromReview,
  updateExistingSkill,
} from './generator.js';
import { preprocessPages } from './preprocess.js';
import { runSkillReviewStage, summarizeReview } from './review.js';
import {
  buildSkillDir,
  mergeKnownUrls,
  normalizeUserContext,
  skillPaths,
  writeState,
} from './skill-state.js';
import { formatValidationReport, validateSkillContent } from './validation.js';

function nowIso() {
  return new Date().toISOString();
}

function summarizeResult(result) {
  return {
    pageCount: result.pages?.length ?? 0,
    changedUrls: (result.pages ?? []).map((page) => page.url),
  };
}

function buildStatePayload(options) {
  return {
    version: 1,
    libraryName: options.libraryName,
    librarySlug: options.librarySlug,
    docsInputUrl: options.docsInputUrl,
    docsUrl: options.docsUrl,
    crawlConfig: options.crawlConfig,
    userContext: options.userContext,
    skillType: options.skillType,
    profileName: options.profileName,
    review: options.review,
    model: options.model,
    generatedAt: options.generatedAt,
    lastCrawlTime: options.lastCrawlTime,
    jobId: options.jobId,
    lastChangedUrls: options.changedUrls,
    knownUrls: options.knownUrls,
    sourceStats: options.sourceStats,
  };
}

async function ensureValidSkill(options) {
  let candidate = options.skillContent;

  for (let attempt = 0; attempt <= (options.maxRepairPasses ?? 1); attempt += 1) {
    const validation = validateSkillContent(candidate, {
      libraryName: options.libraryName,
      docsUrl: options.docsUrl,
      knownUrls: options.knownUrls,
    });

    if (validation.errors.length === 0) {
      return { skillContent: candidate, validation };
    }

    if (attempt === (options.maxRepairPasses ?? 1)) {
      throw new Error(formatValidationReport(validation));
    }

    options.onProgress?.(`Validation failed; requesting repair pass ${attempt + 1}.`);
    candidate = await repairSkill({
      client: options.client,
      libraryName: options.libraryName,
      docsUrl: options.docsUrl,
      skillContent: candidate,
      validationErrors: validation.errors,
    });
  }

  throw new Error('Validation failed unexpectedly.');
}

export async function buildSkill(options) {
  const libraryName = options.libraryName;
  const librarySlug = options.librarySlug;
  const docsUrl = options.docsUrl;
  const crawlConfig = options.crawlConfig;
  const userContext = normalizeUserContext(options.userContext);
  const skillType = options.skillType;
  const skillDir = buildSkillDir({
    skillDir: options.skillDir,
    outputRoot: options.outputRoot,
    slug: librarySlug,
    libraryName,
  });
  const { skillPath } = skillPaths(skillDir);

  options.onProgress?.(`Crawling ${docsUrl}...`);
  const crawl = await runCrawl(
    {
      url: docsUrl,
      ...crawlConfig,
      outputFormats: ['markdown', 'json'],
    },
    {
      intervalMs: options.intervalMs,
      onPoll: options.onPoll,
      fetchImpl: options.fetchImpl,
      env: options.env,
    },
  );

  const crawlSummary = summarizeResult(crawl.result);
  if (crawlSummary.pageCount === 0) {
    throw new Error('Crawl returned 0 pages; adjust include/exclude patterns before building the skill.');
  }

  const preprocess = preprocessPages(crawl.result.pages, options.preprocessOptions);
  const generatedAt = nowIso();

  if (options.dryRun) {
    return {
      dryRun: true,
      skillDir,
      jobId: crawl.jobId,
      pageCount: crawlSummary.pageCount,
      preprocess,
      changedUrls: crawlSummary.changedUrls,
      skillType,
    };
  }

  const client = options.client ?? createAnthropicClient({
    apiKey: options.apiKey,
    model: options.model,
    fetchImpl: options.fetchImpl,
  });

  options.onProgress?.('Generating draft skill...');
  const draftSkill = await generateDraftSkill({
    client,
    libraryName,
    docsUrl,
    skillType,
    feed: preprocess.feed,
  });

  options.onProgress?.('Personalizing skill...');
  const personalizedSkill = await personalizeSkill({
    client,
    libraryName,
    docsUrl,
    skillType,
    userContext,
    draftSkill,
  });

  const knownUrls = mergeKnownUrls([], crawlSummary.changedUrls);
  options.onProgress?.('Reviewing generated skill...');
  const reviewed = await runSkillReviewStage({
    client,
    libraryName,
    docsUrl,
    knownUrls,
    userContext,
    skillType,
    skillContent: personalizedSkill,
    onProgress: options.onProgress,
    reviseSkill: (skillContent, review) => reviseSkillFromReview({
      client,
      libraryName,
      docsUrl,
      skillType,
      userContext,
      skillContent,
      review,
    }),
  });

  const validated = await ensureValidSkill({
    client,
    libraryName,
    docsUrl,
    knownUrls,
    skillContent: reviewed.skillContent,
    onProgress: options.onProgress,
  });

  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(skillPath, `${validated.skillContent.trim()}\n`);

  await writeState(skillDir, buildStatePayload({
    libraryName,
    librarySlug,
    docsInputUrl: options.docsInputUrl ?? docsUrl,
    docsUrl,
    crawlConfig,
    userContext,
    skillType,
    profileName: options.profileName ?? '',
    review: summarizeReview(reviewed.review),
    model: client.model,
    generatedAt,
    lastCrawlTime: generatedAt,
    jobId: crawl.jobId,
    changedUrls: crawlSummary.changedUrls,
    knownUrls,
    sourceStats: {
      crawlPageCount: crawlSummary.pageCount,
      selectedPageCount: preprocess.selectedPages.length,
      tokenEstimate: preprocess.tokenEstimate,
    },
  }));

  return {
    dryRun: false,
    skillDir,
    skillPath,
    jobId: crawl.jobId,
    pageCount: crawlSummary.pageCount,
    preprocess,
    review: reviewed.review,
    validation: validated.validation,
  };
}

export async function refreshSkill(skillDir, options = {}) {
  const resolvedSkillDir = path.resolve(process.cwd(), skillDir);
  const { skillPath, statePath } = skillPaths(resolvedSkillDir);
  const rawState = await fs.readFile(statePath, 'utf8');
  const state = JSON.parse(rawState);
  const existingSkill = await fs.readFile(skillPath, 'utf8');

  options.onProgress?.(`Refreshing ${state.librarySlug} from ${state.docsUrl}...`);
  const crawl = await runCrawl(
    {
      url: state.docsUrl,
      ...state.crawlConfig,
      modifiedSince: state.lastCrawlTime,
      outputFormats: ['markdown', 'json'],
    },
    {
      intervalMs: options.intervalMs,
      onPoll: options.onPoll,
      fetchImpl: options.fetchImpl,
      env: options.env,
    },
  );

  const crawlSummary = summarizeResult(crawl.result);
  if (crawlSummary.pageCount === 0) {
    return {
      dryRun: false,
      current: true,
      skillDir: resolvedSkillDir,
      librarySlug: state.librarySlug,
      lastCrawlTime: state.lastCrawlTime,
    };
  }

  const preprocess = preprocessPages(crawl.result.pages, options.preprocessOptions);
  if (options.dryRun) {
    return {
      dryRun: true,
      current: false,
      skillDir: resolvedSkillDir,
      librarySlug: state.librarySlug,
      changedUrls: crawlSummary.changedUrls,
      preprocess,
    };
  }

  const client = options.client ?? createAnthropicClient({
    apiKey: options.apiKey,
    model: options.model ?? state.model,
    fetchImpl: options.fetchImpl,
  });

  options.onProgress?.('Generating updated skill...');
  const updatedSkill = await updateExistingSkill({
    client,
    libraryName: state.libraryName,
    docsUrl: state.docsUrl,
    skillType: state.skillType,
    userContext: state.userContext,
    feed: preprocess.feed,
    existingSkill,
  });

  const knownUrls = mergeKnownUrls(state.knownUrls, crawlSummary.changedUrls);
  options.onProgress?.('Reviewing updated skill...');
  const reviewed = await runSkillReviewStage({
    client,
    libraryName: state.libraryName,
    docsUrl: state.docsUrl,
    knownUrls,
    userContext: state.userContext,
    skillType: state.skillType,
    skillContent: updatedSkill,
    onProgress: options.onProgress,
    reviseSkill: (skillContent, review) => reviseSkillFromReview({
      client,
      libraryName: state.libraryName,
      docsUrl: state.docsUrl,
      skillType: state.skillType,
      userContext: state.userContext,
      skillContent,
      review,
    }),
  });

  const validated = await ensureValidSkill({
    client,
    libraryName: state.libraryName,
    docsUrl: state.docsUrl,
    knownUrls,
    skillContent: reviewed.skillContent,
    onProgress: options.onProgress,
  });

  const generatedAt = nowIso();
  await fs.writeFile(skillPath, `${validated.skillContent.trim()}\n`);
  await writeState(resolvedSkillDir, buildStatePayload({
    libraryName: state.libraryName,
    librarySlug: state.librarySlug,
    docsInputUrl: state.docsInputUrl ?? state.docsUrl,
    docsUrl: state.docsUrl,
    crawlConfig: state.crawlConfig,
    userContext: state.userContext,
    skillType: state.skillType,
    profileName: state.profileName ?? '',
    review: summarizeReview(reviewed.review),
    model: client.model,
    generatedAt,
    lastCrawlTime: generatedAt,
    jobId: crawl.jobId,
    changedUrls: crawlSummary.changedUrls,
    knownUrls,
    sourceStats: {
      crawlPageCount: crawlSummary.pageCount,
      selectedPageCount: preprocess.selectedPages.length,
      tokenEstimate: preprocess.tokenEstimate,
    },
  }));

  return {
    dryRun: false,
    current: false,
    skillDir: resolvedSkillDir,
    skillPath,
    librarySlug: state.librarySlug,
    changedUrls: crawlSummary.changedUrls,
    preprocess,
    review: reviewed.review,
    validation: validated.validation,
  };
}
