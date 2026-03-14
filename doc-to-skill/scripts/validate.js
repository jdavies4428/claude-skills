#!/usr/bin/env node

import path from 'path';

import { formatValidationReport, validateSkillFolder } from './lib/validation.js';

async function main() {
  const targetDir = path.resolve(process.cwd(), process.argv[2] ?? '.');
  const validation = await validateSkillFolder(targetDir);

  console.log(formatValidationReport(validation));
  process.exit(validation.errors.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
