#!/usr/bin/env node

import path from 'path';

import { formatReviewReport, reviewSkillFolder } from './lib/review.js';

async function main() {
  const targetDir = path.resolve(process.cwd(), process.argv[2] ?? '.');
  const review = await reviewSkillFolder(targetDir);

  console.log(formatReviewReport(review));
  process.exit(review.failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
