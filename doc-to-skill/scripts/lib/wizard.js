import readline from 'node:readline/promises';

import { guessLibraryName, discoverDocsCandidates, previewDocsTarget } from './discovery.js';
import { listProfiles } from './profiles.js';
import { listSkillTypes, resolveSkillType } from './skill-types.js';

function ensureInteractive() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Wizard mode requires an interactive terminal.');
  }
}

function withDefault(prompt, defaultValue) {
  return defaultValue ? `${prompt} [${defaultValue}]` : prompt;
}

async function ask(rl, prompt, defaultValue = '') {
  const response = await rl.question(`${withDefault(prompt, defaultValue)}: `);
  const trimmed = response.trim();
  return trimmed || defaultValue;
}

async function confirm(rl, prompt, defaultValue = true) {
  const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
  const answer = (await rl.question(`${prompt}${suffix}: `)).trim().toLowerCase();
  if (!answer) {
    return defaultValue;
  }
  return ['y', 'yes'].includes(answer);
}

async function choose(rl, prompt, options, defaultIndex = 0) {
  console.log(prompt);
  options.forEach((option, index) => {
    const marker = index === defaultIndex ? '*' : ' ';
    const detail = option.detail ? ` — ${option.detail}` : '';
    console.log(` ${marker} ${index + 1}. ${option.label}${detail}`);
  });

  while (true) {
    const answer = await rl.question(`Choose 1-${options.length} [${defaultIndex + 1}]: `);
    const value = answer.trim();
    if (!value) {
      return options[defaultIndex];
    }

    const numeric = Number.parseInt(value, 10);
    if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= options.length) {
      return options[numeric - 1];
    }

    console.log('Enter the number for the option you want.');
  }
}

function profileDefaults(selectedProfile, seed = {}) {
  return {
    docsInputUrl: seed.docsInputUrl ?? selectedProfile?.lastDocsInput ?? selectedProfile?.lastDocsUrl ?? '',
    docsUrl: seed.docsUrl ?? selectedProfile?.lastDocsUrl ?? '',
    libraryName: seed.libraryName ?? '',
    outputRoot: seed.outputRoot ?? process.env.DOC_TO_SKILL_OUTPUT_ROOT ?? 'output',
    skillTypeId: seed.skillTypeId ?? selectedProfile?.skillType?.id ?? 'api-sdk',
    skillTypeOther: seed.skillTypeOther ?? selectedProfile?.skillType?.otherLabel ?? '',
    appName: seed.appName ?? selectedProfile?.userContext?.appName ?? '',
    language: seed.language ?? selectedProfile?.userContext?.language ?? '',
    architecture: seed.architecture ?? selectedProfile?.userContext?.architecture ?? '',
    config: seed.config ?? selectedProfile?.userContext?.config ?? '',
    use: seed.use ?? selectedProfile?.userContext?.use ?? '',
    avoid: seed.avoid ?? selectedProfile?.userContext?.avoid ?? '',
    naming: seed.naming ?? selectedProfile?.userContext?.naming ?? '',
    notes: seed.notes ?? selectedProfile?.userContext?.extraNotes ?? '',
  };
}

export async function runBuildWizard(options = {}) {
  ensureInteractive();

  const profiles = await listProfiles({ loadData: true }).catch(() => []);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    let selectedProfile = null;
    if (profiles.length > 0) {
      const profileChoice = await choose(
        rl,
        'Choose a saved project profile or start fresh:',
        [
          { label: 'Start fresh', value: null, detail: 'Answer everything manually' },
          ...profiles.map((profile) => ({
            label: profile.name,
            value: profile.data,
            detail: profile.data?.skillType?.promptLabel ?? profile.data?.skillType?.label ?? 'Saved project defaults',
          })),
        ],
        0,
      );
      selectedProfile = profileChoice.value;
    }

    const defaults = profileDefaults(selectedProfile, options.defaults);
    let docsInputUrl = await ask(rl, 'Docs URL, homepage, or repo URL', defaults.docsInputUrl);
    let docsUrl = defaults.docsUrl;
    let docsPreview = null;

    while (true) {
      console.log('Discovering likely docs URLs...');
      const discovered = await discoverDocsCandidates(docsInputUrl, { fetchImpl: options.fetchImpl }).catch(() => []);
      const candidateOptions = discovered.slice(0, 5).map((candidate) => ({
        label: candidate.url,
        value: candidate.url,
        detail: `${candidate.title || 'No title'} | score ${candidate.docsScore}`,
      }));

      const choice = await choose(
        rl,
        'Choose the docs URL to build from:',
        [
          ...candidateOptions,
          { label: 'Use the entered URL exactly', value: docsInputUrl, detail: 'Skip discovery and use it as-is' },
          { label: 'Enter a different URL', value: '__retry__', detail: 'Try another docs/home/repo URL' },
        ],
        0,
      );

      if (choice.value === '__retry__') {
        docsInputUrl = await ask(rl, 'Enter a different docs/home/repo URL', docsInputUrl);
        continue;
      }

      docsUrl = choice.value;
      docsPreview = await previewDocsTarget(docsUrl, { fetchImpl: options.fetchImpl }).catch(() => null);

      if (docsPreview) {
        console.log('');
        console.log(`Preview: ${docsPreview.title || docsUrl}`);
        console.log(`Status: ${docsPreview.status} | headings: ${docsPreview.headingCount} | code blocks: ${docsPreview.codeBlockCount}`);
        if (docsPreview.suggestedDocsLinks.length > 0) {
          console.log('Related docs-like links:');
          docsPreview.suggestedDocsLinks.slice(0, 3).forEach((link) => console.log(`- ${link.url}`));
        }
      }

      if (await confirm(rl, 'Use this docs URL?', true)) {
        break;
      }
    }

    const libraryName = await ask(
      rl,
      'Library name',
      defaults.libraryName || guessLibraryName(docsUrl, docsPreview?.title ?? ''),
    );

    const skillTypeChoice = await choose(
      rl,
      'Choose the skill type:',
      listSkillTypes().map((type) => ({
        label: type.label,
        value: type.id,
        detail: type.description,
      })),
      Math.max(
        0,
        listSkillTypes().findIndex((type) => type.id === defaults.skillTypeId),
      ),
    );

    let skillTypeOther = defaults.skillTypeOther;
    if (skillTypeChoice.value === 'other') {
      skillTypeOther = await ask(rl, 'Describe the custom skill type', defaults.skillTypeOther || 'Internal tool / platform');
    }
    const skillType = resolveSkillType(skillTypeChoice.value, skillTypeOther);

    const appName = await ask(rl, 'Project or app name', defaults.appName);
    const language = await ask(rl, 'Language or framework', defaults.language);
    const architecture = await ask(rl, 'Architecture or integration pattern', defaults.architecture);
    const config = await ask(rl, 'Project-specific config values', defaults.config);
    const use = await ask(rl, 'Features the project uses', defaults.use);
    const avoid = await ask(rl, 'Features the project does not use', defaults.avoid);
    const naming = await ask(rl, 'Naming conventions to preserve', defaults.naming);
    const notes = await ask(rl, 'Extra notes or recurring pain points', defaults.notes);
    const outputRoot = await ask(rl, 'Output root for generated skills', defaults.outputRoot);

    let saveProfileName = '';
    if (await confirm(rl, 'Save these answers as a reusable project profile?', !!selectedProfile)) {
      saveProfileName = await ask(
        rl,
        'Profile name',
        selectedProfile?.profileName ?? appName ?? libraryName,
      );
    }

    return {
      docsInputUrl,
      docsUrl,
      libraryName,
      skillType,
      outputRoot,
      saveProfileName,
      selectedProfileName: selectedProfile?.profileName ?? '',
      userContext: {
        appName,
        language,
        architecture,
        config,
        use,
        avoid,
        naming,
        extraNotes: notes,
      },
    };
  } finally {
    rl.close();
  }
}
