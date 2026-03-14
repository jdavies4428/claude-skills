# EIA Energy Data Skill

Fetch live U.S. energy data from the EIA API and build interactive dashboards.

## Setup

1. Get a free API key at https://www.eia.gov/opendata/
2. Add it to `.env` at the project root:
   ```
   EIA_API_KEY=your_key_here
   ```

## Quick Start

### Interactive wizard (no config needed)
```bash
python3 scripts/build_dashboard.py
```
Walks you through picking charts, validates endpoints, and builds a dashboard.

### Single chart
```bash
python3 scripts/fetch.py \
  --endpoint "/v2/petroleum/pri/spt" \
  --params "frequency=weekly&data[]=value&facets[product][]=EPCBRENT" \
  | python3 scripts/render_chart.py \
    --title "Brent Crude Oil" \
    --color "#EF4444" \
    --y-label "$/barrel" \
    --output ~/eia-dashboards/oil.html
```

### Dashboard from config
```bash
python3 scripts/build_dashboard.py dashboards/energy-overview.json --open
```

### Refresh an existing dashboard (re-fetch latest data)
```bash
python3 scripts/build_dashboard.py --refresh ~/eia-dashboards/energy-overview.html
```

## Where Things Save

| What | Where |
|------|-------|
| Dashboard HTML files | `~/eia-dashboards/` |
| Dashboard configs (JSON) | `eia/dashboards/` (in project) |
| API key | `.env` (project root) |

## Dashboard Config

Create a JSON file in `dashboards/`:

```json
{
  "dashboard": "My Dashboard",
  "output": "~/eia-dashboards/my-dashboard.html",
  "charts": [
    {
      "name": "Oil Prices",
      "endpoint": "/v2/petroleum/pri/spt",
      "params": "frequency=weekly&data[]=value&facets[product][]=EPCBRENT",
      "color": "#EF4444",
      "y_label": "$/barrel",
      "units": "$"
    }
  ]
}
```

### Optional fields per chart

| Field | Default | Description |
|-------|---------|-------------|
| `y_label` | auto-detected | Y-axis label (auto-filled from API if omitted) |
| `units` | auto-detected | Value prefix ("$", "", etc.) |
| `start` | none | Start date filter (e.g., "2020-01") |
| `max_rows` | 5000 | Max data points to fetch |

`start` and `max_rows` can also be set at the top level to apply to all charts.

### Multi-series (overlay two datasets on one chart)

```json
{
  "name": "Brent vs WTI",
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

## Chart Controls

Every chart includes:
- Line / Bar / Area toggle
- Date range: 1Y / 3Y / 5Y / 10Y / Max
- Dark / Light theme
- Copy to clipboard
- Download as SVG
- Stats: current, high, low, avg, change

## Color Palette

| Category | Color | Hex |
|----------|-------|-----|
| Electricity | Blue | #3B82F6 |
| Natural Gas | Orange | #F97316 |
| Petroleum | Red | #EF4444 |
| Coal | Gray | #6B7280 |
| Renewable | Green | #22C55E |
| Nuclear | Purple | #8B5CF6 |

## Files

```
eia/
├── SKILL.md                  # Skill instructions (for Claude)
├── README.md                 # This file
├── scripts/
│   ├── fetch.py              # Fetch + normalize EIA data
│   ├── render_chart.py       # Data → interactive HTML chart
│   ├── build_dashboard.py    # JSON config → multi-chart dashboard + wizard
│   └── eia-routes.yaml       # All API endpoints
├── dashboards/
│   └── energy-overview.json  # Example dashboard config
└── references/               # Endpoint docs per category

~/eia-dashboards/             # Generated dashboard HTML files
```
