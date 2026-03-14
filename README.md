# Skills Library

Personal skills library for Claude Code, Claude.ai, and compatible skill loaders.
Each real skill folder is intended to be portable on its own: copy the folder, zip it, or symlink it directly.

## Current Layout

```text
.
├── _shared/               reusable Python helpers shared by API skills
├── _templates/            starting points for new skills
├── doc-to-skill/          self-contained docs -> skill compiler skill
├── eia/                   EIA energy data skill
├── pack.sh                zip one skill folder for upload
└── .env.example           local development env template
```

## Real Skills

| Skill | Purpose |
|-------|---------|
| `doc-to-skill` | Crawl a docs site, generate a personalized `SKILL.md`, and refresh it later from stored crawl state |
| `eia` | Fetch and visualize U.S. energy data from the EIA API |

## Use One Skill by Itself

Copy or symlink a single skill folder when that is all you need.

```bash
# Claude Code / Codex-style local skills
ln -s "$(pwd)/doc-to-skill" ~/.claude/skills/doc-to-skill

# Package one skill for Claude.ai upload
./pack.sh doc-to-skill
```

`pack.sh` writes `dist/<skill-name>.zip` with the skill contents at the zip root.

## Local Setup

Copy the root env template for convenience:

```bash
cp .env.example .env
```

`doc-to-skill` also ships its own [`.env.example`](/Users/jeffdai/ClaudeSkills/doc-to-skill/.env.example) and [`.nvmrc`](/Users/jeffdai/ClaudeSkills/doc-to-skill/.nvmrc) because its scripts are self-contained.

To work on that skill locally:

```bash
cd doc-to-skill
npm install --package-lock-only
npm run wizard
npm run status
npm test
npm run validate
```

## Templates

Use `_templates/basic-skill` for a minimal skill and `_templates/api-skill` when the skill needs API fetch helpers from `_shared`.
