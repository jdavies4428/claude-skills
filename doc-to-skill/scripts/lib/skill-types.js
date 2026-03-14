function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

const COMMON_EXCLUDES = [
  '*/changelog/*',
  '*/blog/*',
  '*/community/*',
  '*/forum/*',
  '*/pricing/*',
  '*/legal/*',
  '*/status/*',
];

const SKILL_TYPES = [
  {
    id: 'api-sdk',
    label: 'API / SDK',
    description: 'Libraries used through SDK calls, auth, requests, responses, and error handling.',
    generationGuidance: 'Prioritize initialization, authentication, canonical request patterns, pagination, retries, and error handling.',
    crawlDefaults: {
      limit: 120,
      maxDepth: 3,
      discovery: 'both',
      render: false,
      exclude: COMMON_EXCLUDES,
    },
  },
  {
    id: 'cli-tool',
    label: 'CLI Tool',
    description: 'Command-line tools with install/setup, commands, flags, config files, and troubleshooting.',
    generationGuidance: 'Prioritize install/setup, command examples, config file locations, flags, subcommands, and troubleshooting.',
    crawlDefaults: {
      limit: 90,
      maxDepth: 2,
      discovery: 'both',
      render: false,
      exclude: COMMON_EXCLUDES,
    },
  },
  {
    id: 'workflow-app',
    label: 'Workflow App',
    description: 'Platforms with multi-step setup, integrations, webhooks, dashboards, and automation flows.',
    generationGuidance: 'Prioritize workflow setup, event flows, webhooks, configuration screens, and the task sequences users repeat most.',
    crawlDefaults: {
      limit: 110,
      maxDepth: 3,
      discovery: 'both',
      render: false,
      exclude: COMMON_EXCLUDES,
    },
  },
  {
    id: 'data-source',
    label: 'Data Source',
    description: 'Data providers, query interfaces, schemas, metrics definitions, and transformation patterns.',
    generationGuidance: 'Prioritize schemas, query parameters, filters, pagination, units, freshness caveats, and interpretation gotchas.',
    crawlDefaults: {
      limit: 100,
      maxDepth: 3,
      discovery: 'both',
      render: false,
      exclude: COMMON_EXCLUDES,
    },
  },
  {
    id: 'frontend-lib',
    label: 'Frontend Library',
    description: 'UI libraries with install/setup, components, hooks, patterns, state, styling, and edge cases.',
    generationGuidance: 'Prioritize installation, imports, component patterns, hooks, state interactions, styling variants, and SSR/client caveats.',
    crawlDefaults: {
      limit: 110,
      maxDepth: 3,
      discovery: 'both',
      render: false,
      exclude: COMMON_EXCLUDES,
    },
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Anything that does not fit the preset categories.',
    generationGuidance: 'Use the user-provided custom skill type label and adapt the examples and sections to match it.',
    crawlDefaults: {
      limit: 100,
      maxDepth: 3,
      discovery: 'both',
      render: false,
      exclude: COMMON_EXCLUDES,
    },
  },
];

export function listSkillTypes() {
  return SKILL_TYPES.map((type) => ({ ...type }));
}

export function resolveSkillType(inputId = 'api-sdk', otherLabel = '') {
  const normalizedId = String(inputId || 'api-sdk').trim().toLowerCase();
  const base = SKILL_TYPES.find((type) => type.id === normalizedId) ?? SKILL_TYPES.find((type) => type.id === 'other');
  const customLabel = String(otherLabel ?? '').trim();

  return {
    ...base,
    otherLabel: customLabel,
    promptLabel: base.id === 'other' && customLabel ? customLabel : base.label,
  };
}

export function mergeCrawlConfigs(...configs) {
  const result = {};

  for (const config of configs) {
    if (!config) {
      continue;
    }

    if (Array.isArray(config.include)) {
      result.include = unique([...(result.include ?? []), ...config.include]);
    }

    if (Array.isArray(config.exclude)) {
      result.exclude = unique([...(result.exclude ?? []), ...config.exclude]);
    }

    for (const key of ['limit', 'maxDepth', 'render', 'discovery', 'maxAge']) {
      if (config[key] !== undefined && config[key] !== null && config[key] !== '') {
        result[key] = config[key];
      }
    }
  }

  if ((result.include ?? []).length === 0) {
    delete result.include;
  }

  if ((result.exclude ?? []).length === 0) {
    delete result.exclude;
  }

  return result;
}
