import fs from 'fs/promises';
import path from 'path';

const STATE_FILENAME = '.source-state.json';

/**
 * Read and parse .source-state.json from skillDir.
 * Returns null if the file does not exist.
 *
 * @param {string} skillDir
 * @returns {Promise<object|null>}
 */
export async function readState(skillDir) {
  const filePath = path.join(skillDir, STATE_FILENAME);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Write state to .source-state.json in skillDir with pretty formatting.
 *
 * @param {string} skillDir
 * @param {object} state
 */
export async function writeState(skillDir, state) {
  const filePath = path.join(skillDir, STATE_FILENAME);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

/**
 * Create an initial state object from build options.
 *
 * @param {object} opts
 * @param {string} opts.skillName
 * @param {string} opts.skillSlug
 * @param {string} opts.sourceType
 * @param {string} opts.sourceUrl
 * @param {object} [opts.monitorConfig]
 * @param {string} [opts.monitorConfig.strategy]
 * @param {string[]} [opts.monitorConfig.lastKnownLinks]
 * @param {string} [opts.monitorConfig.lastETag]
 * @param {string} [opts.monitorConfig.lastModified]
 * @param {object} [opts.userContext]
 * @param {string} [opts.userContext.purpose]
 * @param {string[]} [opts.userContext.features]
 * @param {string} [opts.userContext.outputFormat]
 * @param {string} [opts.contentHash]
 * @returns {object}
 */
export function createInitialState(opts) {
  const now = new Date().toISOString();

  return {
    skillName: opts.skillName ?? '',
    skillSlug: opts.skillSlug ?? '',
    sourceType: opts.sourceType ?? 'unknown',
    sourceUrl: opts.sourceUrl ?? '',
    monitorConfig: {
      strategy: opts.monitorConfig?.strategy ?? 'http-head',
      lastKnownLinks: opts.monitorConfig?.lastKnownLinks ?? [],
      lastETag: opts.monitorConfig?.lastETag ?? null,
      lastModified: opts.monitorConfig?.lastModified ?? null,
    },
    userContext: {
      purpose: opts.userContext?.purpose ?? '',
      features: opts.userContext?.features ?? [],
      outputFormat: opts.userContext?.outputFormat ?? '',
    },
    lastCheckTime: opts.lastCheckTime ?? now,
    lastRefreshTime: opts.lastRefreshTime ?? now,
    contentHash: opts.contentHash ?? null,
  };
}
