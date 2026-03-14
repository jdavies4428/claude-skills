import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const SKILL_ROOT = path.resolve(__dirname, '..', '..');

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
  return { key, value };
}

export async function loadEnvFiles() {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.join(SKILL_ROOT, '.env'),
  ];

  for (const candidatePath of candidatePaths) {
    let raw;
    try {
      raw = await fs.readFile(candidatePath, 'utf8');
    } catch {
      continue;
    }

    for (const line of raw.split('\n')) {
      const parsed = parseEnvLine(line);
      if (!parsed || parsed.key in process.env) {
        continue;
      }

      process.env[parsed.key] = parsed.value;
    }
  }
}
