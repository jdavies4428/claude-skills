---
name: doc-to-skill
description: >
  Use doc-to-skill to compile a third-party documentation site into a reusable SKILL.md,
  then keep it current from the source docs. Use this skill when the user wants to build a skill from docs,
  crawl a docs site into a skill, personalize a library/API/SDK skill for a real project,
  refresh an existing generated skill, or check whether a generated skill is outdated.
  Trigger on requests such as "build me a [library] skill", "crawl [docs URL] into a
  skill", "make Claude know [API]", "refresh my [library] skill", "update my [library]
  skill", "re-crawl [library] docs", or "is my [library] skill current?"
---

# Doc-to-Skill Compiler

Turn a docs site into a project-aware `SKILL.md` with a portable state file.
Use the bundled scripts instead of manually repeating crawl, filtering, generation, review, and validation steps.

---

## Load Only What You Need

- Read `references/crawl-config.md` when you need to choose include/exclude patterns, render mode, or discovery mode.
- Read `references/user-context.md` when you need examples of high-value project context to gather or inject.
- Read `references/preprocessing.md` when you need to change page scoring, section extraction, or feed ordering.
- Read `references/architecture.md` only when you are changing the pipeline design or debugging why the generated skill quality is off.

---

## Build a New Skill

1. Prefer the guided path first:
   - Run `node scripts/build.js --wizard`
   - Ask for the docs URL or homepage/repo URL
   - Ask for the skill type
   - Ask for project-specific context
   - Preview the candidate docs URL before building
2. Gather or infer five pieces of context before generating anything:
   - Language/framework
   - Project-specific config values
   - Architecture/integration pattern
   - Features they use
   - Features they do not use
3. If the docs site structure is unclear, use `--discover`, `--auto-discover`, `--preview`, or `scripts/crawl.js` before running a full build.
4. Use a saved project profile when possible, or save one at the end of the wizard for the next run.
5. Run the dedicated review stage to catch SKILL.md quality issues before validation.
6. Write the generated skill into `./output/{library-slug}/`.
7. **Final requests gate** — Before validating, ask the user if they have additional
   requests. Use `AskUserQuestion`:
   ```
   Question: "The skill is built. Any changes or additions before I finalize it?"
   Header: "Final check"
   Options:
     A) Looks good — proceed to validation
     B) Add custom instructions — I have specific behaviors or rules to add
     C) Change something — adjust the output, patterns, or structure
   ```
   If B or C: incorporate changes, rebuild affected sections, show preview, ask again.
   Loop until the user selects A.
8. Validate the result with `scripts/validate.js ./output/{library-slug}` before presenting it as final.

## Quickstart

```bash
node scripts/build.js --wizard
```

Example:

```bash
node scripts/build.js \
  --url https://docs.revenuecat.com \
  --name RevenueCat \
  --skill-type api-sdk \
  --slug revenue-cat \
  --include "*/sdk/ios/*" \
  --include "*/entitlements/*" \
  --include "*/paywalls/*" \
  --exclude "*/changelog/*" \
  --language "iOS Swift 5.9" \
  --architecture "Configured in AppDelegate via Info.plist API key" \
  --config "Packages: fittrack_monthly, fittrack_annual; entitlement: pro_access" \
  --use "Paywall V2, entitlement checks" \
  --avoid "webhooks, server-side purchases"
```

Skill type choices:

- `api-sdk`
- `cli-tool`
- `workflow-app`
- `data-source`
- `frontend-lib`
- `other` → ask for a custom label and store it in the profile/state file

Useful discovery/profile commands:

```bash
node scripts/build.js --discover --url https://example.com
node scripts/build.js --preview --url https://docs.example.com
node scripts/build.js --list-profiles
node scripts/build.js --profile fittrack --wizard
```

---

## Refresh an Existing Skill

1. Read `./output/{library-slug}/.crawl-state.json`.
2. Reuse the stored `docsUrl`, `crawlConfig`, and `userContext`.
3. Crawl with `modifiedSince: lastCrawlTime`.
4. If the crawl returns zero changed pages, report that the skill is current.
5. If pages changed, update only the affected sections while preserving existing personalization.
6. Run the dedicated review stage again because an update can regress trigger quality or structure.
7. Re-run validation before writing the refreshed skill.

Use the script when possible:

```bash
node scripts/refresh.js --skill-dir ./output/revenue-cat
```

Use the dashboard-first flow for easier maintenance:

```bash
node scripts/refresh.js
node scripts/refresh.js --refresh-all --stale-only
```

Use `--dry-run` to inspect changed URLs without rewriting the skill.

---

## Validate Every Generated Skill

Generated skills must satisfy all of the following before you treat them as complete:

- YAML frontmatter contains only `name` and `description`.
- Body stays under 400 lines.
- First code block is the initialization/setup pattern.
- At least 3 fenced code examples are present.
- Troubleshooting or error handling section exists.
- Marketing prose is absent.
- Markdown links are valid URLs, and docs-host links should match crawl metadata when possible.

The bundled validator enforces these checks and the scripts will attempt one repair pass automatically if generation misses them.

```bash
node scripts/validate.js ./output/revenue-cat
```

---

## Review Every Generated Skill

Run the dedicated review stage before validation. It is lighter-weight than validation and is specifically aimed at SKILL.md quality.

The review checklist covers:

- Trigger-rich description quality
- Overview readability
- Presence of a project setup section when personalized context exists
- Example density and pattern coverage
- Troubleshooting guidance
- Official links or explicit key-links section
- Skimmable structure and technical tone

The pipeline runs this stage automatically and will request one focused repair pass if the review finds failures. You can also run it directly:

```bash
node scripts/review.js ./output/revenue-cat
```

---

## Error Handling

- If the review stage fails after its repair pass, stop and inspect the reported checklist findings before validating.
- If the crawl returns zero pages, tighten or relax the include/exclude patterns before generating anything.
- If validation fails after the repair pass, keep the generated skill on disk for inspection and report the exact validator errors.
- If more than 10 pages change on refresh, treat the update as a likely major release and recommend manual review of the generated diff.

---

## Keep the State File Portable

Write a `.crawl-state.json` next to every generated skill and keep it self-sufficient.
It must store:

- `libraryName` and `librarySlug`
- `docsInputUrl` and `docsUrl`
- `crawlConfig`
- `userContext`
- `skillType`
- `profileName`
- `lastCrawlTime`
- `knownUrls`

Do not hard-code a central skill registry. Refresh must work from the generated skill folder alone.

---

## Key Links

- `references/crawl-config.md`
- `references/preprocessing.md`
- `references/user-context.md`
- `references/architecture.md`

---

## Use the Bundled Tools

| File | Purpose |
|------|---------|
| `scripts/build.js` | Wizard, discovery, preview, profile reuse, and full build flow |
| `scripts/refresh.js` | Status dashboard plus incremental refresh from `.crawl-state.json` |
| `scripts/crawl.js` | Manual crawl probe for tuning include/exclude patterns |
| `scripts/review.js` | Lightweight SKILL.md quality review for generated skill folders |
| `scripts/validate.js` | Deterministic validation for any generated skill folder |
| `references/crawl-config.md` | Crawl heuristics and docs-platform patterns |
| `references/preprocessing.md` | Page scoring, extraction, and feed assembly rules |
| `references/user-context.md` | Personalization interview and worked examples |
| `references/architecture.md` | Full pipeline rationale and design notes |
