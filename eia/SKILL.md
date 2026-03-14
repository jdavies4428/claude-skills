---
name: eia
description: >
  Fetch, analyze, and visualize U.S. energy data from the EIA (Energy Information
  Administration) API. Use this skill whenever the user asks about electricity prices,
  natural gas production or storage, petroleum/crude oil, coal, renewables, energy
  trends, power generation, fuel costs, state energy comparisons, or any U.S. energy
  data. Also triggers for phrases like "energy data", "EIA", "power prices", "gas storage",
  "oil production", "utility rates", or "energy mix". Automatically builds interactive
  charts and visualizations inline. Always use this skill even if the request seems
  simple — it handles aliasing, routing, fetching, and charting end-to-end.
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - AskUserQuestion
---

# EIA Energy Data Skill

Fetch live U.S. energy data from the EIA API and render interactive visualizations.
**Always use the guided flow below** — walk the user through selections step by step
using `AskUserQuestion`. Never guess. Never skip steps.

---

## Step 1 — What data?

Use `AskUserQuestion` to ask what energy data the user wants to see.
If the user's request already specifies a dataset (e.g., "show me oil prices"),
skip this step and proceed with their choice.

```
Question: "What energy data do you want to visualize?"
Header: "Dataset"
Options:
  A) Electricity — retail prices, generation, capacity
  B) Natural Gas — prices, storage, production
  C) Petroleum — crude oil, gasoline, diesel, stocks
  D) Coal & Other — coal, renewables, nuclear, CO2 emissions
```

Based on their selection, use `AskUserQuestion` again with specific datasets:

**If Electricity:**
```
Question: "Which electricity dataset?"
Header: "Electricity"
Options:
  A) Retail Prices (residential) — monthly, cents/kWh
  B) Generation by Source — monthly, GWh
  C) Capacity — annual, MW
```

**If Natural Gas:**
```
Question: "Which natural gas dataset?"
Header: "Natural Gas"
Options:
  A) Prices (summary) — monthly, $/Mcf
  B) Weekly Storage — weekly, Bcf
  C) Production — monthly, Mcf
```

**If Petroleum:**
```
Question: "Which petroleum dataset?"
Header: "Petroleum"
Options:
  A) Brent Crude Spot Price — weekly, $/barrel
  B) WTI Crude Spot Price — weekly, $/barrel
  C) Gasoline Retail — weekly, $/gal
  D) Crude Production — monthly, bbl/day
```

**If Coal & Other:**
```
Question: "Which dataset?"
Header: "Category"
Options:
  A) Coal Production — quarterly
  B) Coal Prices — quarterly
  C) CO2 Emissions — annual
```

### Dataset → Endpoint Map

| Dataset | Endpoint | Params | Color | Y Label | Units |
|---------|----------|--------|-------|---------|-------|
| Electricity Retail Prices | /v2/electricity/retail-sales | frequency=monthly&data[]=price&facets[sectorid][]=RES&facets[stateid][]=US | #3B82F6 | cents/kWh | |
| Electricity Generation | /v2/electricity/electric-power-operational | frequency=monthly&data[]=generation | #3B82F6 | GWh | |
| Electricity Capacity | /v2/electricity/capacity | frequency=annual&data[]=nameplate-capacity-mw | #3B82F6 | MW | |
| Natural Gas Prices | /v2/natural-gas/pri/sum | frequency=monthly&data[]=value | #F97316 | $/Mcf | $ |
| Natural Gas Storage | /v2/natural-gas/stor/wkly | frequency=weekly&data[]=value | #F97316 | Bcf | |
| Natural Gas Production | /v2/natural-gas/prod/sum | frequency=monthly&data[]=value | #F97316 | Mcf | |
| Brent Crude Spot | /v2/petroleum/pri/spt | frequency=weekly&data[]=value&facets[product][]=EPCBRENT | #EF4444 | $/barrel | $ |
| WTI Crude Spot | /v2/petroleum/pri/spt | frequency=weekly&data[]=value&facets[product][]=EPCWTI | #EF4444 | $/barrel | $ |
| Gasoline Retail | /v2/petroleum/pri/gnd | frequency=weekly&data[]=value | #EF4444 | $/gal | $ |
| Crude Production | /v2/petroleum/crd/crpdn | frequency=monthly&data[]=value | #EF4444 | bbl/day | |
| Coal Production | /v2/coal/production/quarterly | frequency=quarterly&data[]=value | #6B7280 | short tons | |
| Coal Prices | /v2/coal/shipments/receipts/quarterly | frequency=quarterly&data[]=value | #6B7280 | $/short ton | $ |
| CO2 Emissions | /v2/co2-emissions/co2-emissions-aggregates | frequency=annual&data[]=value | #22C55E | MMT CO2 | |

For datasets not in this table, load the appropriate reference file:

| Topic | Reference file |
|-------|---------------|
| electricity, power, grid | references/electricity.md |
| natural gas, gas storage | references/natural-gas.md |
| oil, crude, petroleum | references/petroleum.md |
| coal, renewables, solar | references/other.md |

---

## Step 2 — Frequency

Use `AskUserQuestion` to ask for the data frequency.
Only show frequencies that make sense for the chosen dataset.
If the dataset only supports one frequency, skip this step.

```
Question: "What time frequency?"
Header: "Frequency"
Options:
  A) Weekly (Recommended) — most granular for this dataset
  B) Monthly — smoother trend
  C) Annual — long-term view
```

Update the `frequency=` parameter in the params string to match.

---

## Step 3 — Date range

Use `AskUserQuestion` to ask how far back the data should go.

```
Question: "How far back should the data go?"
Header: "Date range"
Options:
  A) 5 years (Recommended)
  B) 1 year
  C) 10 years
  D) Max (all available data)
```

Map the selection to a `start=` param (calculate from today's date) and a
`default_range` for the chart controls.

---

## Step 4 — Single chart or dashboard?

Use `AskUserQuestion` to ask if they want a single chart or a multi-chart dashboard.

```
Question: "Single chart or add more datasets to a dashboard?"
Header: "Output"
Options:
  A) Single chart — just this one dataset
  B) Dashboard — I'll pick additional charts to compare
```

**If Dashboard:** Repeat Step 1's dataset selection (multi-select this time)
to let the user pick additional charts. Then use `build_dashboard.py` with a
JSON config. Ask for a dashboard name.

**If Single chart:** Proceed to Step 5.

---

## Step 5 — Fetch and Render

### Single Chart

Pipe fetch output into the renderer:

```bash
python3 scripts/fetch.py \
  --endpoint "{endpoint}" \
  --params "{params}" \
  | python3 scripts/render_chart.py \
    --title "{title}" \
    --color "{color}" \
    --y-label "{y_label}" \
    --units "{units}" \
    --range "{default_range}" \
    --output ~/eia-dashboards/{slug}.html
```

### Dashboard

Write a JSON config file to `dashboards/{slug}.json`, then run:

```bash
python3 scripts/build_dashboard.py dashboards/{slug}.json --open
```

---

## Step 5.5 — Validate the Output

After rendering, **always** validate before opening in the browser:

```bash
python3 scripts/validate_chart.py ~/eia-dashboards/{filename}.html
```

If validation **fails**, fix the issue and re-render. Never open a chart
that fails validation.

---

## Step 6 — Open and Follow Up

Open the chart in the browser:

```bash
open ~/eia-dashboards/{filename}.html
```

Then use `AskUserQuestion` to offer follow-ups:

```
Question: "What next?"
Header: "Follow up"
Options:
  A) Compare across states
  B) Overlay another dataset on this chart
  C) Switch to a different chart type or range
  D) Build a dashboard with multiple charts
```

---

## Conversation Controls

After the initial chart is built, the user can adjust it by just saying it.
No need for `AskUserQuestion` on follow-up tweaks — just rebuild:

```
"switch to bar chart"          → rebuild as bar
"zoom into last 2 years"       → filter date range
"compare to national average"  → fetch national series, overlay
"show top 5 states"            → filter + rank by value
"dark mode"                    → toggle theme
"export this"                  → download as SVG/HTML
"refresh this"                 → re-fetch latest data
```

Always rebuild the full visual when the user requests a change — never
describe changes in text when you can just show them.

---

## Color Palette by Energy Type

```
Electricity:  #3B82F6  (blue)
Natural Gas:  #F97316  (orange)
Petroleum:    #EF4444  (red)
Coal:         #6B7280  (gray)
Renewable:    #22C55E  (green)
Nuclear:      #8B5CF6  (purple)
```

---

## Reference Files

- `references/electricity.md` — Electricity endpoints, aliases, facets
- `references/natural-gas.md` — Natural gas endpoints, aliases, facets
- `references/petroleum.md`   — Petroleum/crude endpoints, aliases, facets
- `references/other.md`       — Coal, renewables, nuclear endpoints
- `scripts/fetch.py`          — API fetch script (handles auth + pagination)
- `scripts/render_chart.py`   — Chart template engine (data + config → HTML)
- `scripts/validate_chart.py` — HTML validator (run after every render)
- `scripts/build_dashboard.py` — Dashboard builder (JSON config → multi-chart HTML)
- `scripts/eia-routes.yaml`   — Master route config (single source of truth)
- `dashboards/*.json`         — Saved dashboard configs
