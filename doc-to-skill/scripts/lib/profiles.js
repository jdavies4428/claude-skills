import fs from 'fs/promises';
import path from 'path';

import { slugify } from './cli.js';
import { SKILL_ROOT } from './env.js';

export function getProfilesDir(rootDir = process.env.DOC_TO_SKILL_PROFILES_DIR) {
  return path.resolve(rootDir ?? path.join(SKILL_ROOT, 'profiles'));
}

function getProfileFilename(name) {
  return `${slugify(name) || 'profile'}.json`;
}

export function profilePath(name, rootDir) {
  return path.join(getProfilesDir(rootDir), getProfileFilename(name));
}

export async function listProfiles(options = {}) {
  const profilesDir = getProfilesDir(options.rootDir);
  const entries = await fs.readdir(profilesDir, { withFileTypes: true }).catch(() => []);
  const profiles = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(profilesDir, entry.name);
    const raw = await fs.readFile(filePath, 'utf8').catch(() => null);
    if (!raw) {
      continue;
    }

    try {
      const data = JSON.parse(raw);
      profiles.push({
        name: data.profileName ?? entry.name.replace(/\.json$/, ''),
        slug: entry.name.replace(/\.json$/, ''),
        path: filePath,
        data: options.loadData === false ? undefined : data,
      });
    } catch {
      // Ignore invalid profile JSON.
    }
  }

  return profiles.sort((left, right) => left.name.localeCompare(right.name));
}

export async function loadProfile(name, options = {}) {
  const raw = await fs.readFile(profilePath(name, options.rootDir), 'utf8');
  return JSON.parse(raw);
}

export async function saveProfile(name, profile, options = {}) {
  const profilesDir = getProfilesDir(options.rootDir);
  await fs.mkdir(profilesDir, { recursive: true });

  const payload = {
    version: 1,
    profileName: name,
    savedAt: new Date().toISOString(),
    ...profile,
  };

  await fs.writeFile(profilePath(name, options.rootDir), `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}
