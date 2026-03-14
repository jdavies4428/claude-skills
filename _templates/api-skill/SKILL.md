---
name: api-skill-name
description: >
  Fetch data from [API Name] and [what you do with it].
  Use this skill whenever the user asks about [topics], mentions [keywords],
  or wants to [actions]. Always use even for simple lookups.
---

# API Skill Name

Connects to the [API Name] API, fetches data based on plain-language requests,
and renders results as visualizations or structured output.

---

## Step 1 — Resolve the Request

Translate the user's request using the alias table in `references/routes.md`.
Load that file now to find the correct endpoint and params.

---

## Step 2 — Apply User Preferences

```yaml
# ── USER PREFERENCES ──────────────────────────────────────────
theme:         dark        # dark | light
output_format: visual      # visual | table | json | report
default_range: 1y          # time range default
# ──────────────────────────────────────────────────────────────
```

---

## Step 3 — Fetch the Data

Use `scripts/fetch.py` which wraps `_shared/scripts/fetch.py`:

```bash
python3 scripts/fetch.py --endpoint "/endpoint" --params "key=value"
```

The script:
- Reads API key from `.env` via `_shared/scripts/env.py`
- Handles pagination automatically
- Returns normalized JSON: `{ "data": [[label, value], ...], "unit": "..." }`

If the key is missing, the script prints a clear setup error and exits.

---

## Step 4 — Render Output

Based on `output_format` preference:

- `visual` → build interactive Chart.js HTML inline
- `table` → render a clean markdown or HTML table
- `json` → return raw normalized data
- `report` → produce a written summary with an embedded chart

Use `_shared/scripts/viz.py` helpers for chart generation.

---

## Conversation Controls

```
"switch to table view"     → re-render as table
"export this"              → download as HTML/PNG
"show raw data"            → toggle data table
"zoom into last 6 months"  → filter date range
```

---

## Reference Files

- `references/routes.md` — plain-language alias → endpoint mapping
- `scripts/fetch.py`     — API-specific fetch wrapper
