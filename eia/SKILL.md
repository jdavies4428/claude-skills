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
---

# EIA Energy Data Skill

Fetch live U.S. energy data from the EIA API and render interactive visualizations
inline. Handles plain-language requests, maps them to the correct API routes, fetches
the data, and builds charts with user-controlled interactivity.

---

## Step 1 — Resolve the Request

Translate the user's plain-language request into an API call using the alias tables
in `references/`. Load only the relevant reference file — not all of them.

| Topic mentioned            | Load this file                    |
|----------------------------|-----------------------------------|
| electricity, power, grid   | references/electricity.md         |
| natural gas, gas storage   | references/natural-gas.md         |
| oil, crude, petroleum      | references/petroleum.md           |
| coal, renewables, solar    | references/other.md               |
| unsure / multiple topics   | load all, pick best match         |

---

## Step 2 — Apply User Preferences

Read the **User Preferences** block below before building any visualization.
These are the defaults — apply them unless the user overrides in conversation.

```yaml
# ── USER PREFERENCES ──────────────────────────────────────────
theme:            dark          # dark | light | auto
chart_type:       auto          # auto | line | bar | area | pie
default_range:    5y            # 1y | 3y | 5y | 10y | max
scope:            national      # national | state | both
favorite_states:  []            # e.g. [TX, CA, FL] — pre-filters comparisons
units:            imperial      # imperial | metric
show_data_table:  false         # show raw numbers below chart
show_source:      true          # always label "Source: EIA API"
export_format:    svg           # svg | html | png
interactive:      true          # embed controls in chart (sliders, dropdowns)
# ──────────────────────────────────────────────────────────────
```

> To change defaults: edit the values above, or just say it in conversation
> ("use light theme", "always show Texas", "give me bar charts by default").

---

## Step 3 — Fetch the Data

Use `scripts/fetch.py` to retrieve data. The script handles auth, pagination,
and response normalization automatically.

```bash
python3 scripts/fetch.py \
  --endpoint "/v2/electricity/retail-sales" \
  --params "frequency=monthly&data[]=price&facets[]=stateid[]&start=2019-01"
```

The script outputs clean JSON:
```json
{
  "series": "Electricity Retail Prices",
  "unit": "cents/kWh",
  "frequency": "monthly",
  "data": [["2019-01", 10.54], ["2019-02", 10.61], ...]
}
```

If `EIA_API_KEY` is not set in the environment, print a clear error:
> "EIA API key not found. Set it with: export EIA_API_KEY=your_key_here"
> Get a free key at: https://www.eia.gov/opendata/

---

## Step 4 — Build the Visualization

Use the **chart template engine** (`scripts/render_chart.py`) instead of generating
HTML from scratch. This ensures consistent, polished output every time.

### Single Chart

Pipe fetch output into the renderer:

```bash
python3 scripts/fetch.py \
  --endpoint "/v2/petroleum/pri/spt" \
  --params "frequency=weekly&data[]=value&facets[product][]=EPCBRENT" \
  | python3 scripts/render_chart.py \
    --title "Brent Crude Oil Spot Price" \
    --color "#EF4444" \
    --y-label "$/barrel" \
    --units "$" \
    --output output/oil-prices.html
```

### Dashboard (Multiple Charts)

When the user asks for a dashboard, comparison, or multiple charts at once,
use the **dashboard builder**:

```bash
python3 scripts/build_dashboard.py dashboards/energy-overview.json --open
```

The dashboard config is a JSON file listing charts to include. Create or edit
the config to match the user's request, then run the builder. Example config:

```json
{
  "dashboard": "Energy Overview",
  "output": "output/energy-overview.html",
  "charts": [
    {
      "name": "Brent Crude Oil Spot Price",
      "endpoint": "/v2/petroleum/pri/spt",
      "params": "frequency=weekly&data[]=value&facets[product][]=EPCBRENT",
      "color": "#EF4444",
      "y_label": "$/barrel",
      "units": "$"
    }
  ]
}
```

Multi-series overlays (e.g., Brent vs WTI on one chart) use a `series` array:

```json
{
  "name": "Crude Oil: Brent vs WTI",
  "series": [
    { "label": "Brent", "endpoint": "/v2/petroleum/pri/spt",
      "params": "frequency=weekly&data[]=value&facets[product][]=EPCBRENT",
      "color": "#EF4444" },
    { "label": "WTI", "endpoint": "/v2/petroleum/pri/spt",
      "params": "frequency=weekly&data[]=value&facets[product][]=EPCWTI",
      "color": "#F97316" }
  ],
  "y_label": "$/barrel",
  "units": "$"
}
```

### Color Palette by Energy Type
```
Electricity:  #3B82F6  (blue)
Natural Gas:  #F97316  (orange)
Petroleum:    #EF4444  (red)
Coal:         #6B7280  (gray)
Renewable:    #22C55E  (green)
Nuclear:      #8B5CF6  (purple)
```

### What the Template Handles Automatically
- Chart type toggle (Line / Bar / Area)
- Date range selector (1Y / 3Y / 5Y / 10Y / Max)
- Dark/Light theme toggle
- Copy to clipboard button
- Download as SVG button
- Stats bar (Current, High, Low, Avg, Change)
- Labeled axes with units
- "Source: EIA API" footer
- 300ms load animation
- Tooltip on hover
- Responsive layout

---

## Step 5 — Offer Follow-Ups

After every visualization, offer 2–3 natural next steps:

> "Want me to compare this across states? Break it down by fuel type?
> Export this as a file?"

---

## Conversation Controls

The user can adjust any visualization by just saying it:

```
"switch to bar chart"          → rebuild as bar
"zoom into last 2 years"       → filter date range
"add a trend line"             → overlay linear regression
"compare to national average"  → fetch national series, overlay
"show top 5 states"            → filter + rank by value
"dark mode"                    → toggle theme
"show the raw numbers"         → toggle data table
"export this"                  → download as SVG/HTML
```

Always rebuild the full visual when the user requests a change — never
describe changes in text when you can just show them.

---

## Reference Files

- `references/electricity.md` — Electricity endpoints, aliases, facets
- `references/natural-gas.md` — Natural gas endpoints, aliases, facets
- `references/petroleum.md`   — Petroleum/crude endpoints, aliases, facets
- `references/other.md`       — Coal, renewables, nuclear endpoints
- `scripts/fetch.py`          — API fetch script (handles auth + pagination)
- `scripts/render_chart.py`   — Chart template engine (data + config → HTML)
- `scripts/build_dashboard.py` — Dashboard builder (JSON config → multi-chart HTML)
- `scripts/eia-routes.yaml`   — Master route config (single source of truth)
- `dashboards/*.json`         — Saved dashboard configs
