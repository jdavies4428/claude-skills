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

## Entry Point

When this skill is invoked, immediately determine the user's intent:

- **User provides a URL** → Start the Guided Build Flow at Step 0.
- **User provides multiple URLs** → Start multi-URL build (see Multi-URL Support below).
- **User says "check", "status", "monitor"** → Run `node scripts/monitor.js --status`
- **User says "refresh", "update"** → Run the refresh flow.
- **No URL provided** → Ask for one using the format below.

### Asking for a URL

When no URL is provided, use `AskUserQuestion` with a free-text prompt.
Do NOT show example URLs — they are useless placeholders. Just ask directly:

```
Question: "Paste the URL you want to build a skill from. You can enter multiple URLs separated by spaces for comparison/competitive analysis."
Header: "Source URL"
Options:
  A) Single URL — one data source, docs site, or product page
  B) Multiple URLs — compare products or combine sources
```

The user will select an option and type their URL(s) in the text field.
Once you have the URL(s), start Step 0 immediately.

---

## Guided Build Flow

Walk through these steps in order. Use `AskUserQuestion` at each gate — one question
at a time. Be opinionated: recommend the best option and explain why. Do not batch
questions. Do not skip steps.

### Multi-URL Support (Product Pages / Competitive Analysis)

When the user provides multiple URLs or wants competitive analysis:

1. Accept multiple URLs in a single invocation:
   ```
   /source-skill https://photomyne.com https://remini.ai https://myheritage.com
   ```
   Or: "Build a competitive analysis skill comparing Photomyne, Remini, and MyHeritage"

2. For each URL, run Steps 0-4 independently but generate a **unified skill**:
   - Single SKILL.md with sections per competitor
   - Comparison dashboard showing all products side-by-side
   - One `.source-state.json` tracking all source URLs

3. Let the user know: "You can add multiple product URLs to build a comparison.
   Each page will be analyzed independently, then merged into a single competitive
   intelligence skill."

---

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

3. If the source type is `product-page` or the user mentions competitors/comparison:
   - **AskUserQuestion**: "Do you have other product URLs to compare against?
     You can enter multiple URLs to build a side-by-side competitive analysis.
     Or just proceed with this one."
     - **Just this URL** — proceed with single product
     - **Add more URLs** — user provides additional URLs, repeat Step 0 for each

4. **AskUserQuestion**: Which file/link to use? Recommend the latest one based on
   filename patterns (sort by date embedded in name). Explain your recommendation.

   If docs-site detected:
   - Check for Cloudflare API credentials in doc-to-skill's `.env`:
     ```bash
     grep -q CF_API_TOKEN ../doc-to-skill/.env 2>/dev/null && echo "found" || echo "missing"
     grep -q CF_ACCOUNT_ID ../doc-to-skill/.env 2>/dev/null && echo "found" || echo "missing"
     ```
   - If credentials are present → proceed with docs-site crawl. source-skill
     delegates to the doc-to-skill pipeline internally.

   - If credentials are missing, give the user setup commands to copy and run:

     "This is a documentation site. To crawl it, doc-to-skill needs Cloudflare
     Browser Rendering credentials. Run these commands to set them up:

     1. Get your credentials at https://developers.cloudflare.com/browser-rendering/
     2. Add them to doc-to-skill's `.env` file:"

     ```bash
     echo 'CF_API_TOKEN=your_token_here' >> doc-to-skill/.env
     echo 'CF_ACCOUNT_ID=your_account_id' >> doc-to-skill/.env
     ```

     "Replace `your_token_here` and `your_account_id` with your actual values,
     then re-run `/source-skill` with the same URL."

   - **AskUserQuestion**: "Want to proceed without Cloudflare, or come back after setup?"
     - **Skip crawling** — fetch the landing page HTML only and build a skill from
       what's available (limited but works for simple docs sites)
     - **Come back later** — exit now, set up credentials, re-run

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

### Step 2: Name, Purpose & Context

1. Propose a skill name based on the source and detected content.

2. **AskUserQuestion**: "What should we call this skill?"
   - Suggest a concise, descriptive name based on what was found.
   - Examples: "EIA Generator Inventory", "Photomyne Competitor Analysis",
     "Stripe API Reference"
   - The name becomes the skill's display name and slug (e.g., `eia-generator-inventory`)
   - Keep it short — 2-4 words is ideal.

**STOP.** Wait for user response before proceeding.

3. Based on what you've seen in the data, propose a purpose and use case.

4. **AskUserQuestion**: Gather context with an opinionated recommendation:
   - "Based on the data, this looks like a monthly inventory of planned electric
     generators. I recommend building a skill that:"
   - Propose 2-3 specific features (e.g., "breakdown by technology", "state-level analysis")
   - Ask what the user actually wants to do with this data
   - Ask if there are specific questions they want the skill to answer

**STOP.** Wait for user response before proceeding.

### Step 3: Output Format

1. **AskUserQuestion**: What output do you want? (can select multiple)

   **Primary deliverable:**
   - **Interactive dashboard** — Chart.js HTML file with charts, filters, toggles,
     export to PNG. Best for: multi-dimensional data, comparisons, time series.
   - **SKILL.md analysis tool** — Teaches Claude how to fetch, parse, and answer
     questions about this data source on demand. Best for: reference data, lookups.
   - **Competitive intel report** — Structured markdown with SWOT, pricing comparison,
     feature matrix. Best for: product pages, competitor analysis.

   **Additional exports** (select any that apply):
   - **CSV export** — Raw parsed data as CSV for use in Excel/Sheets/Pandas
   - **JSON export** — Structured data as JSON for programmatic use
   - **Screenshot** — Static PNG snapshot of key charts/tables (requires gstack)
   - **Comparison table** — Side-by-side markdown table (for multi-URL skills)

   Recommend based on data shape and source type:
   - Data files (EIA, spreadsheets) → dashboard + CSV export
   - Product pages → competitive intel report + comparison table
   - Docs sites → SKILL.md analysis tool
   - API endpoints → SKILL.md + JSON export

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

First, check if gstack is available:
```bash
B=~/.claude/skills/gstack/browse/dist/browse
[ -x "$B" ] && echo "gstack: available" || echo "gstack: not installed"
```

**If gstack is available** — use headless Chromium for full visual verification:

1. **Open the dashboard in headless Chromium**:
   ```bash
   $B goto "file:///path/to/output/{slug}/dashboard.html"
   $B screenshot /tmp/source-skill-verify.png
   $B console
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

4. **Test interactivity** (gstack only):
   - Click the chart type toggle (if present) — does it switch?
   - Test the export button — does it produce output?
   - Hover over data points — do tooltips appear with correct values?

**If gstack is NOT available** — fall back to structural validation only:

1. Read the dashboard HTML and verify:
   - Chart.js CDN script tag is present and well-formed
   - Data arrays are non-empty (search for data constants, verify they have entries)
   - Canvas elements exist with expected IDs
   - No malformed `</script>` tags
   - Control buttons (chart type toggle, export) are present in the HTML

2. Cross-check 3 data points against the source data (same as above).

3. Print a note:
   "Visual verification skipped — gstack not installed. Structural checks passed.
   For full visual verification, install gstack: https://github.com/garrytan/gstack"

4. Open the dashboard in the user's browser for manual review:
   ```bash
   open ./output/{slug}/dashboard.html
   ```

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

### Step 6: Schedule Monitoring

1. Present the cost and resource implications clearly, then ask:

   **Cost breakdown per check:**
   | Source Type | Check Cost | Method |
   |---|---|---|
   | Data files (page-diff) | Free | Single HTTP GET, compare link URLs |
   | Product pages (smart-diff) | Free usually | HTTP GET hash check; gstack only if changed (~$0.01-0.05/page) |
   | Docs sites (docs-crawl) | ~$0.02-0.15 | Cloudflare Browser Rendering API call |
   | Direct files (http-head) | Free | Single HEAD request |
   | API endpoints (api-hash) | Free | Single GET request |

   **Other considerations:**
   - Scheduled checks run in the background — no terminal needed
   - If a change is detected, the skill is refreshed automatically (re-downloads,
     re-parses, regenerates). This uses Claude API tokens if ANTHROPIC_API_KEY is set,
     or waits for next `/source-skill refresh` conversation if not.
   - Logs written to `/tmp/source-skill-monitor.log` — check for errors
   - launchd is preferred over cron on macOS (survives sleep/restart)
   - Multiple skills can be monitored in one scheduled run with `--all`

   **AskUserQuestion**: "Want to schedule automatic change detection?"

   - **Weekly (Recommended for product pages)** — checks every Monday at 9am.
     Cost: ~$0/week for data files, ~$0.01-0.15/week for docs sites.
   - **Monthly (Recommended for data files)** — checks on the 1st of each month.
     Aligned with government data publish schedules. Cost: ~$0/month.
   - **Daily** — for fast-moving sources or during launch monitoring.
     Cost: ~$0/day for data files, ~$0.07-1.05/week for docs sites.
   - **No schedule** — manual only, run `node scripts/monitor.js` when needed.
     Zero cost until you run it.

   Recommend based on source type:
   - Data files (EIA, government data) → monthly (aligned with publish schedule)
   - Product pages → weekly
   - Docs sites → weekly
   - API endpoints → daily

2. If the user wants a schedule, set it up:

   Using the `/loop` skill (if available):
   ```
   /loop 7d node ~/.claude/skills/source-skill/scripts/monitor.js --skill-dir <install-path>
   ```

   Or write a cron entry:
   ```bash
   # Weekly (Monday 9am)
   (crontab -l 2>/dev/null; echo "0 9 * * 1 cd /Users/jeffdai/ClaudeSkills/source-skill && node scripts/monitor.js --skill-dir <install-path> >> /tmp/source-skill-monitor.log 2>&1") | crontab -
   ```

   Or launchd plist for macOS (more reliable than cron):
   ```bash
   cat > ~/Library/LaunchAgents/com.source-skill.monitor.plist << 'EOF'
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0"><dict>
     <key>Label</key><string>com.source-skill.monitor</string>
     <key>ProgramArguments</key><array>
       <string>node</string>
       <string>/Users/jeffdai/ClaudeSkills/source-skill/scripts/monitor.js</string>
       <string>--skill-dir</string>
       <string><install-path></string>
     </array>
     <key>StartCalendarInterval</key><dict>
       <key>Weekday</key><integer>1</integer>
       <key>Hour</key><integer>9</integer>
     </dict>
     <key>StandardOutPath</key><string>/tmp/source-skill-monitor.log</string>
   </dict></plist>
   EOF
   launchctl load ~/Library/LaunchAgents/com.source-skill.monitor.plist
   ```

3. Confirm the schedule is set and tell the user how to check status:
   ```bash
   node scripts/monitor.js --status
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

### Scheduling

Recommended refresh frequencies by source type:

| Source Type | Frequency | Why |
|---|---|---|
| Data files (EIA, CSV) | Monthly | Government data publishes on fixed schedules |
| Product pages | Weekly | Pricing/features change slowly, weekly catches updates |
| Docs sites | Weekly | Documentation updates are infrequent |
| API endpoints | Daily | API responses can change frequently |

To schedule, use the `/loop` skill:
```
/loop 7d node ~/.claude/skills/source-skill/scripts/monitor.js --all
```

Or set up a cron:
```bash
# Weekly check every Monday at 9am
0 9 * * 1 cd /path/to/source-skill && node scripts/monitor.js --all 2>&1 >> /tmp/source-skill-monitor.log
```

### Smart Diff (Cost Optimization)

For product pages monitored via gstack, the monitor uses a **two-phase check** to
minimize cost:

1. **Phase 1: Cheap HTTP GET** — fetch the page HTML, compute content hash, compare
   to stored hash. If unchanged, stop here. Cost: free.
2. **Phase 2: gstack (only if Phase 1 detects change)** — fire up headless Chrome to
   render JS-heavy pages and extract updated data. Cost: ~$0.01-0.05 per page.

Most weekly checks will stop at Phase 1 (no change), so monitoring is essentially free
until something actually changes.

### Change Detection Strategies

| Source Type | Strategy | How It Works | Cost |
|---|---|---|---|
| Docs site | `docs-crawl` | `modifiedSince` crawl via doc-to-skill | ~$0.02-0.15 |
| Page with links | `page-diff` | Re-fetch page, diff download link URLs | Free |
| Product page | `smart-diff` | HTTP GET hash check, gstack only on change | Free (usually) |
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
