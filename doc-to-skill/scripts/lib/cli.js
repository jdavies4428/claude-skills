import fs from 'fs/promises';
import path from 'path';

export function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      args._ = args._ ?? [];
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    const isFlag = next === undefined || next.startsWith('--');

    if (isFlag) {
      args[key] = true;
      continue;
    }

    index += 1;
    if (key in args) {
      args[key] = [].concat(args[key], next);
    } else {
      args[key] = next;
    }
  }

  return args;
}

export function getMany(args, key) {
  if (!(key in args)) {
    return [];
  }

  return []
    .concat(args[key])
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getBoolean(args, key, fallback = false) {
  if (!(key in args)) {
    return fallback;
  }

  const value = args[key];
  if (typeof value === 'boolean') {
    return value;
  }

  return !['false', '0', 'no'].includes(String(value).toLowerCase());
}

export function getString(args, key, fallback = '') {
  if (!(key in args)) {
    return fallback;
  }

  const value = args[key];
  return Array.isArray(value) ? String(value.at(-1)) : String(value);
}

export function getInteger(args, key, fallback) {
  if (!(key in args)) {
    return fallback;
  }

  const value = Number.parseInt(getString(args, key), 10);
  return Number.isNaN(value) ? fallback : value;
}

export async function loadJsonFile(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(resolvedPath, 'utf8');
  return JSON.parse(raw);
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function formatList(values) {
  return values.filter(Boolean).join(', ');
}

export function resolvePathFromCwd(filePath) {
  return path.resolve(process.cwd(), filePath);
}
