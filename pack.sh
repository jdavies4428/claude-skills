#!/bin/bash
# pack.sh — package a single skill folder for upload
# Usage: ./pack.sh <skill-name>

set -euo pipefail

SKILL="${1:-}"

if [ -z "$SKILL" ]; then
  echo "Usage: ./pack.sh <skill-name>"
  echo "Example: ./pack.sh doc-to-skill"
  exit 1
fi

if [ ! -d "$SKILL" ]; then
  echo "Error: skill folder '$SKILL' not found"
  exit 1
fi

mkdir -p dist
rm -f "dist/${SKILL}.zip"

(
  cd "$SKILL"
  zip -r "../dist/${SKILL}.zip" . \
    --exclude "*.pyc" \
    --exclude "*/__pycache__/*" \
    --exclude "*/.DS_Store" \
    --exclude "*/node_modules/*" \
    --exclude "tests/*" \
    --exclude ".env"
)

SIZE=$(du -sh "dist/${SKILL}.zip" | cut -f1)
echo ""
echo "Packaged: dist/${SKILL}.zip (${SIZE})"
echo "Zip root is the skill contents, so the archive is ready to upload directly."
