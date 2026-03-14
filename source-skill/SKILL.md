---
name: source-skill
description: >
  Build and maintain skills that stay in sync with their source. Use source-skill when
  a user wants to create a skill from any URL (docs site, spreadsheet, PDF, API endpoint),
  monitor a source for changes, refresh an existing source-linked skill, or check if a
  skill's source has been updated. Trigger on requests like "build a skill from this URL",
  "monitor this data source", "is my skill up to date?", "refresh my skill from source",
  "create a dashboard skill from this spreadsheet", or "track this page for changes".
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# source-skill

Skills that stay in sync with their source.

Takes any URL — docs site, page with download links, direct file, API endpoint — detects
what kind of source it is, fetches and processes the content, generates a SKILL.md, and
sets up change detection so the skill auto-refreshes when the source updates.

---

## Load Only What You Need

- Read `references/source-types.md` when you need to understand how URLs are classified or how detection heuristics work.

---

## Guided Build Flow

When the user provides a URL, walk through these steps in order. Use `AskUserQuestion`
at each gate — one question at a time. Be opinionated: recommend the best option and
explain why. Do not batch questions. Do not skip steps.

### Step 0: Source Analysis

1. Run source type detection:
   ```bash
   node scripts/build.js --url "<URL>" --type detect-only 2>&1 || true
   ```
   Or use the lib directly:
   ```js
   import { detectSourceType } from './scripts/lib/source-detect.js';
   import { fetchPageLinks } from './scripts/lib/fetchers/page-links.js';
   ```

2. Report findings to the user:
   - Detected source type (docs site, page with links, direct file, API)
   - For page-with-links: list all download links found, grouped by extension
   - For direct file: show content-type, size, last-modified
   - For docs site: recommend using doc-to-skill instead

3. **AskUserQuestion**: Which file/link to use? Recommend the latest one based on
   filename patterns (sort by date embedded in name). Explain your recommendation.

   If docs-site detected: "This looks like a documentation site. I recommend using
   doc-to-skill for this — it has a specialized pipeline for docs. Want to proceed
   with doc-to-skill instead, or override and treat this as a different source type?"

**STOP.** Wait for user response before proceeding.

### Step 1: Download & Inspect

1. Download the selected file using `fetchFile()` from `scripts/lib/fetchers/file-link.js`
2. Convert to text using the appropriate converter:
   - `.xls`/`.xlsx` → `scripts/lib/converters/xls-to-text.js`
   - `.csv` → `scripts/lib/converters/csv-to-text.js`
   - Other → read as text
3. Report what was found:
   - For spreadsheets: sheet names, row counts, column names
   - Sample of first 5-10 rows
   - Any obvious data structure observations

4. **AskUserQuestion**: Confirm the data looks right. Ask about scope:
   - "This spreadsheet has 4 sheets: Operating (27k rows), Planned (2k rows),
     Retired (7k rows), Canceled (1.6k rows). Which sheets do you want in the skill?"
   - Recommend the most useful subset based on the data.

**STOP.** Wait for user response before proceeding.

### Step 2: Purpose & Context

1. Based on what you've seen in the data, propose a purpose and use case.

2. **AskUserQuestion**: Gather context with an opinionated recommendation:
   - "Based on the data, this looks like a monthly inventory of planned electric
     generators. I recommend building a skill that:"
   - Propose 2-3 specific features (e.g., "breakdown by technology", "state-level analysis")
   - Ask what the user actually wants to do with this data
   - Ask if there are specific questions they want the skill to answer

**STOP.** Wait for user response before proceeding.

### Step 3: Output Format

1. **AskUserQuestion**: What should the skill produce?
   - **Interactive dashboard** (Recommended for data with multiple dimensions) —
     Chart.js HTML file with filters, toggles, export
   - **Data analysis skill** — SKILL.md that teaches Claude how to fetch, parse,
     and analyze this data source on demand
   - **Report generator** — Produces formatted markdown/HTML summaries
   - **Raw data skill** — Just fetches and returns the latest data

   Recommend based on data shape. Multi-dimensional data → dashboard.
   Time series → line charts. Categorical → bar charts.

**STOP.** Wait for user response before proceeding.

### Step 4: Build

1. Based on all gathered context, generate the skill artifacts:
   - For dashboards: parse the data, compute breakdowns, generate Chart.js HTML
   - For analysis skills: write a SKILL.md with patterns for querying this data
   - For all types: write `.source-state.json` with monitor config

2. Show the user a preview of what was generated. Open the dashboard if applicable.

3. Run validation:
   ```bash
   node scripts/validate.js ./output/{slug}
   ```

4. Report any issues and fix them before proceeding.

### Step 4.5: Validate & Test

Before presenting the skill as complete, run a thorough review. Do NOT skip this step.
Do NOT present the skill as done until every check passes.

#### 4.5A: Structural Validation

Run the validator:
```bash
node scripts/validate.js ./output/{slug}
```

All checks must pass:
- SKILL.md exists with valid YAML frontmatter (name + description)
- Body is under 400 lines
- At least 1 code block present
- `.source-state.json` exists, is valid JSON, has required keys
- Source URL is a valid URL

If any check fails, fix the issue and re-run before proceeding.

#### 4.5B: Dashboard Visual Verification (if dashboard was generated)

Use the `gstack` or `browse` skill to verify the dashboard renders correctly end-to-end:

1. **Open the dashboard in headless Chromium**:
   Use `/browse` or `/gstack` to navigate to the local HTML file:
   ```
   file:///path/to/output/{slug}/dashboard.html
   ```

2. **Take a screenshot** and visually verify:
   - All charts render (not blank canvases)
   - Data is populated (bars/lines visible, not empty)
   - Labels are readable and correctly formatted
   - Controls (chart type toggle, time range, export) are present
   - Color scheme and layout look polished
   - No JavaScript errors in the console

3. **Cross-check data accuracy**:
   - Pick 3 data points from the dashboard
   - Verify them against the source spreadsheet
   - Example: "Dashboard shows Solar PV at 121,060 MW — let me verify against the Planned sheet"
   - If any value is wrong, fix the data extraction and regenerate

4. **Test interactivity**:
   - Click the chart type toggle (if present) — does it switch?
   - Test the export button — does it produce output?
   - Hover over data points — do tooltips appear with correct values?

#### 4.5C: Monitor Verification

Test that change detection is properly configured:
```bash
node scripts/monitor.js --skill-dir ./output/{slug} --dry-run
```

Verify:
- Monitor reads the state file successfully
- Correct detection strategy is configured (page-diff, http-head, etc.)
- For page-diff: the latest valid link URL is stored correctly
- Report shows "no changes detected" (since we just built it)

#### 4.5D: Review Report

Present a structured report to the user:
```
VALIDATION REPORT
═════════════════
Structural checks:  X/Y passed
Dashboard renders:  ✓ All 3 charts visible, data populated
Data accuracy:      ✓ Spot-checked 3 values against source
Interactivity:      ✓ Toggles, tooltips, export working
Monitor configured: ✓ page-diff strategy, tracking {latest_file}
```

If ANY check failed, fix it and re-run the full validation. Do NOT proceed to Step 5
until the report is clean.

**STOP.** Wait for user confirmation before saving.

### Step 5: Save & Monitor Setup

1. **AskUserQuestion**: Save this as a skill?
   - "The skill is ready. Want to install it?"
   - Show where it will be installed (default: `ClaudeSkills/{slug}/`)
   - Offer custom install path
   - Explain what monitoring will do: "I'll track the source page for changes.
     When EIA publishes February 2026 data, the link will change from
     `january_generator2026.xlsx` to `february_generator2026.xlsx` and I can
     auto-refresh your dashboard."

2. If yes, install:
   ```bash
   # Copy output to install location
   node scripts/build.js --url "<URL>" --slug <slug> --save
   ```
   Or copy files directly from `./output/{slug}/` to the install dir.

3. Confirm installation and show how to check for updates:
   ```bash
   node scripts/monitor.js --skill-dir <install-path>
   ```

**STOP.** Done. Summarize what was built and how to use it.

---

## Monitor & Refresh (for existing skills)

### Check for Updates

```bash
# Status dashboard — all skills
node scripts/monitor.js --status

# Check specific skill
node scripts/monitor.js --skill-dir ./output/eia-860m

# Dry run — report changes without refreshing
node scripts/monitor.js --dry-run
```

### Refresh When Changes Detected

```bash
# Refresh specific skill
node scripts/refresh.js --skill-dir ./output/eia-860m

# Refresh all changed skills
node scripts/refresh.js --all --changed-only
```

### Change Detection Strategies

| Source Type | Strategy | How It Works | Cost |
|---|---|---|---|
| Docs site | `docs-crawl` | `modifiedSince` crawl via doc-to-skill | ~$0.02-0.15 |
| Page with links | `page-diff` | Re-fetch page, diff download link URLs | Free |
| Direct file | `http-head` | Compare ETag / Last-Modified headers | Free |
| API endpoint | `api-hash` | Fetch response, compare content hash | Free |

---

## State File

Every generated skill includes a `.source-state.json` that stores everything needed
for monitoring and refresh — no central registry required.

---

## Error Handling

- If source detection fails, ask the user to specify the source type manually.
- If a download returns HTML instead of a file, skip it and try the next link.
- If monitoring detects >10 changed items, flag as major update and recommend manual review.
- If a docs site is detected, recommend doc-to-skill.

---

## Use the Bundled Tools

| File | Purpose |
|------|---------|
| `scripts/build.js` | CLI build — detect, fetch, convert, generate, validate |
| `scripts/monitor.js` | Change detection across all registered skills |
| `scripts/refresh.js` | Re-fetch and update skills when source changes |
| `scripts/validate.js` | Quality checks for generated skills |
| `references/source-types.md` | Detection heuristics and per-type handling |
