#!/usr/bin/env python3
"""
eia/scripts/build_dashboard.py — EIA Dashboard Builder

Reads a JSON config, fetches data for each chart in parallel, renders chart
cards via render_chart(), and assembles a complete multi-chart dashboard HTML.

Usage:
    python3 eia/scripts/build_dashboard.py eia/dashboards/energy-overview.json [--open]
    python3 eia/scripts/build_dashboard.py   # launches interactive wizard
"""

import argparse
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

# ── Path setup ──────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
ROOT = SCRIPT_DIR.parents[1]  # eia/scripts → project root
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(SCRIPT_DIR))

from fetch import fetch_data, fetch_data_with_meta
from render_chart import render_chart


# ── Validation ──────────────────────────────────────────────────────────────

def validate_config(cfg):
    """Validate required fields in the dashboard config. Exits on failure."""
    missing = []
    if "dashboard" not in cfg:
        missing.append("'dashboard' (dashboard title)")
    if "output" not in cfg:
        missing.append("'output' (output file path)")
    if "charts" not in cfg:
        missing.append("'charts' (list of chart definitions)")
    if missing:
        print("ERROR: Config is missing required fields:")
        for m in missing:
            print(f"  - {m}")
        sys.exit(1)

    for i, chart_cfg in enumerate(cfg["charts"]):
        name = chart_cfg.get("name", f"chart[{i}]")
        if "endpoint" not in chart_cfg and "series" not in chart_cfg:
            print(f"ERROR: Chart '{name}' at index {i} must have either 'endpoint' or 'series'.")
            sys.exit(1)
        if "series" in chart_cfg:
            for j, s in enumerate(chart_cfg["series"]):
                if "endpoint" not in s:
                    print(
                        f"ERROR: Series[{j}] in chart '{name}' is missing 'endpoint'."
                    )
                    sys.exit(1)


# ── Unit conversion ───────────────────────────────────────────────────────────

_UNIT_MAP = {
    "cents per kilowatt-hour": ("cents/kWh", ""),
    "dollars per barrel":      ("$/barrel",  "$"),
    "billion cubic feet":      ("Bcf",       ""),
}


def _parse_api_units(raw_units):
    """Convert an EIA API unit string to a (y_label, units) display tuple.

    Known mappings are in _UNIT_MAP (case-insensitive lookup).  For unknown
    strings the raw value is used as y_label and units is left empty.

    Returns:
        (y_label, units) — both strings.
    """
    if not raw_units:
        return ("", "")
    key = raw_units.lower().strip()
    if key in _UNIT_MAP:
        return _UNIT_MAP[key]
    return (raw_units, "")


# ── Data fetching ────────────────────────────────────────────────────────────

def _fetch_single(endpoint, params, max_rows=5000):
    """Fetch data + metadata. Returns (data, meta) tuple via fetch_data_with_meta."""
    return fetch_data_with_meta(endpoint, params, max_rows=max_rows)


def _build_params(chart_cfg, top_level_cfg=None):
    """Build the final params string for a chart, appending start if present.

    Precedence: chart-level > top-level config > absent.
    """
    params = chart_cfg.get("params", "")
    # Determine effective start
    start = chart_cfg.get("start") or (top_level_cfg or {}).get("start")
    if start:
        sep = "&" if params else ""
        params = f"{params}{sep}start={start}"
    return params


def _chart_max_rows(chart_cfg, top_level_cfg=None):
    """Return the effective max_rows for a chart."""
    if "max_rows" in chart_cfg:
        return int(chart_cfg["max_rows"])
    if top_level_cfg and "max_rows" in top_level_cfg:
        return int(top_level_cfg["max_rows"])
    return 5000


def fetch_all_charts(charts, top_level_cfg=None):
    """
    Fetch data for every chart in parallel.

    Returns a list parallel to `charts`. Each entry is either:
      - list of [date, value] for single-series charts
      - list of {"label", "data", "color"} dicts for multi-series charts
      - Exception instance if the fetch failed

    Also mutates chart dicts in-place to fill missing y_label/units from
    API metadata (Change 2).
    """
    results = [None] * len(charts)
    # meta_results stores the meta dict from fetch_data_with_meta per chart
    meta_results = {}

    # Build a map of futures → chart index (and optional series index)
    futures_map = {}  # future -> (chart_idx, series_idx_or_None)

    with ThreadPoolExecutor() as executor:
        for i, chart_cfg in enumerate(charts):
            if "series" in chart_cfg:
                # Multi-series: submit one future per series
                for j, series in enumerate(chart_cfg["series"]):
                    params = _build_params(series, top_level_cfg)
                    max_rows = _chart_max_rows(series, top_level_cfg)
                    fut = executor.submit(
                        _fetch_single,
                        series["endpoint"],
                        params,
                        max_rows,
                    )
                    futures_map[fut] = (i, j)
            else:
                params = _build_params(chart_cfg, top_level_cfg)
                max_rows = _chart_max_rows(chart_cfg, top_level_cfg)
                fut = executor.submit(
                    _fetch_single,
                    chart_cfg["endpoint"],
                    params,
                    max_rows,
                )
                futures_map[fut] = (i, None)

        for fut in as_completed(futures_map):
            chart_idx, series_idx = futures_map[fut]
            try:
                result = fut.result()  # (data, meta) tuple
            except Exception as exc:
                if series_idx is None:
                    results[chart_idx] = exc
                else:
                    # Store partial failures per series slot
                    if results[chart_idx] is None:
                        results[chart_idx] = {}
                    results[chart_idx][series_idx] = exc
            else:
                data, meta = result
                if series_idx is None:
                    results[chart_idx] = data
                    # Store meta for the primary (single-series) chart
                    if chart_idx not in meta_results:
                        meta_results[chart_idx] = meta
                else:
                    if results[chart_idx] is None:
                        results[chart_idx] = {}
                    results[chart_idx][series_idx] = data
                    # Store meta from first series
                    if chart_idx not in meta_results:
                        meta_results[chart_idx] = meta

    # For multi-series charts, convert dict-of-results to ordered list
    for i, chart_cfg in enumerate(charts):
        if "series" not in chart_cfg:
            continue
        raw = results[i]
        if raw is None:
            results[i] = Exception("No data returned for any series")
            continue
        series_list = []
        first_error = None
        for j, series_cfg in enumerate(chart_cfg["series"]):
            entry = raw.get(j)
            if isinstance(entry, Exception):
                if first_error is None:
                    first_error = entry
            else:
                series_list.append(
                    {
                        "label": series_cfg.get("label", f"Series {j+1}"),
                        "data": entry,
                        "color": series_cfg.get("color", "#6366f1"),
                    }
                )
        if series_list:
            results[i] = series_list  # partial success is still rendered
        else:
            results[i] = first_error or Exception("All series failed to fetch")

    # Auto-fill y_label / units from API metadata when config omits them
    for i, chart_cfg in enumerate(charts):
        if isinstance(results[i], Exception):
            continue
        meta = meta_results.get(i, {})
        raw_units = meta.get("units", "")
        if raw_units:
            auto_y_label, auto_units = _parse_api_units(raw_units)
            if not chart_cfg.get("y_label"):
                chart_cfg["y_label"] = auto_y_label
            if "units" not in chart_cfg or chart_cfg["units"] == "":
                # Only set units if it was genuinely absent (not explicitly "")
                # We use a sentinel approach: check if key is missing entirely
                if "units" not in chart_cfg:
                    chart_cfg["units"] = auto_units

    return results


# ── Error card ───────────────────────────────────────────────────────────────

def render_error_card(name, error):
    """Return an error card HTML div styled to the dark theme."""
    safe_name = name.replace("<", "&lt;").replace(">", "&gt;")
    safe_error = str(error).replace("<", "&lt;").replace(">", "&gt;")
    return (
        f'<div class="chart-card" '
        f'style="display:flex;align-items:center;justify-content:center;min-height:300px;">'
        f'<div style="text-align:center;color:var(--text-muted);">'
        f'<div style="font-size:2rem;margin-bottom:8px;">&#9888;</div>'
        f'<div style="font-weight:600;">{safe_name}</div>'
        f'<div style="font-size:0.8rem;margin-top:4px;">Error: {safe_error}</div>'
        f"</div>"
        f"</div>"
    )


# ── Terminal output ───────────────────────────────────────────────────────────

def print_fetch_result(name, result):
    """Print a single fetch result line to the terminal."""
    if isinstance(result, Exception):
        print(f"  Fetching: {name}... \u2717 {result}")
    else:
        # result is either [[date, value], ...] or [{"data": [...], ...}, ...]
        if isinstance(result, list) and result and isinstance(result[0], dict):
            total = sum(len(s["data"]) for s in result)
        else:
            total = len(result)
        print(f"  Fetching: {name}... \u2713 {total:,} rows")


# ── Dashboard HTML assembly ──────────────────────────────────────────────────

def _build_head(title):
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

    :root {{
      --bg:          #0f1117;
      --surface:     #1a1d27;
      --border:      #2a2d3e;
      --text:        #e2e8f0;
      --text-muted:  #8892a4;
      --accent:      #6366f1;
      --accent-glow: rgba(99,102,241,0.18);
      --btn-bg:      #252838;
      --btn-active:  #6366f1;
      --btn-text:    #8892a4;
      --btn-active-text: #ffffff;
      --grid:        rgba(255,255,255,0.05);
      --tooltip-bg:  #1e2130;
    }}

    body.light {{
      --bg:          #f4f6fb;
      --surface:     #ffffff;
      --border:      #dde2ef;
      --text:        #1e2130;
      --text-muted:  #64748b;
      --btn-bg:      #edf0f7;
      --btn-active:  #6366f1;
      --btn-text:    #64748b;
      --btn-active-text: #ffffff;
      --grid:        rgba(0,0,0,0.06);
      --tooltip-bg:  #ffffff;
    }}

    body {{
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      padding: 24px 16px 40px;
      transition: background 0.25s, color 0.25s;
    }}

    /* ── Dashboard header ── */
    .dashboard-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      max-width: 1400px;
      margin: 0 auto 28px;
      flex-wrap: wrap;
    }}

    .dashboard-header h1 {{
      font-size: clamp(1.1rem, 3vw, 1.6rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.3;
    }}

    .dashboard-header .subtitle {{
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 4px;
    }}

    /* ── Buttons ── */
    button {{
      cursor: pointer;
      border: none;
      outline: none;
      font-family: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      border-radius: 6px;
      padding: 5px 11px;
      background: transparent;
      color: var(--btn-text);
      transition: background 0.18s, color 0.18s, box-shadow 0.18s;
    }}

    button.active {{
      background: var(--btn-active);
      color: var(--btn-active-text);
      box-shadow: 0 2px 8px rgba(99,102,241,0.35);
    }}

    button:not(.active):hover {{
      background: var(--border);
      color: var(--text);
    }}

    .icon-btn {{
      width: 34px;
      height: 34px;
      border-radius: 8px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--btn-bg);
      color: var(--text-muted);
      font-size: 1rem;
    }}

    .icon-btn:hover {{
      background: var(--border);
      color: var(--text);
    }}

    /* ── Dashboard grid ── */
    .dashboard-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(560px, 1fr));
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }}

    /* ── Chart card (shared with render_chart card mode) ── */
    .chart-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px 20px 14px;
      position: relative;
      box-shadow: 0 4px 32px rgba(0,0,0,0.18);
    }}

    .chart-wrap {{
      position: relative;
      width: 100%;
    }}

    /* ── Stats row ── */
    .stats {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 10px;
      margin-top: 16px;
    }}

    .stat {{
      background: var(--btn-bg);
      border-radius: 10px;
      padding: 10px 14px;
      border: 1px solid var(--border);
    }}

    .stat-label {{
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
      margin-bottom: 4px;
    }}

    .stat-value {{
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text);
    }}

    .stat-value.up   {{ color: #22c55e; }}
    .stat-value.down {{ color: #EF4444; }}

    .stat-meta {{
      font-size: 0.67rem;
      color: var(--text-muted);
      margin-top: 2px;
    }}

    /* ── Controls ── */
    .controls {{
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }}

    .controls-label {{
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }}

    .btn-group {{
      display: flex;
      gap: 4px;
      background: var(--btn-bg);
      border-radius: 8px;
      padding: 3px;
    }}

    .card-header {{
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }}

    .card-title {{
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }}

    .card-subtitle {{
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-top: 3px;
    }}

    /* ── Footer ── */
    footer {{
      text-align: center;
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-top: 32px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
      max-width: 1400px;
      margin-left: auto;
      margin-right: auto;
    }}

    /* ── Responsive ── */
    @media (max-width: 600px) {{
      .dashboard-grid {{
        grid-template-columns: 1fr;
      }}
      .controls {{ gap: 8px; }}
      .stats {{ grid-template-columns: repeat(2, 1fr); }}
    }}
  </style>
</head>
<body>
"""


def _build_header(title, chart_count, build_ts):
    return f"""\
<div class="dashboard-header">
  <div>
    <h1>{title}</h1>
    <div class="subtitle">{chart_count} chart{"s" if chart_count != 1 else ""} &bull; Built {build_ts}</div>
  </div>
  <button class="icon-btn" id="globalThemeToggle" title="Toggle theme" aria-label="Toggle light/dark theme">&#9790;</button>
</div>
"""


def _build_footer(build_ts):
    return f"""\
<footer>
  Source: EIA API &mdash; U.S. Energy Information Administration &bull; Built {build_ts}
</footer>
"""


def _build_global_theme_js():
    return """\
<script>
(function () {
  var isLight = false;
  window.chartCallbacks = window.chartCallbacks || [];
  document.getElementById('globalThemeToggle').addEventListener('click', function () {
    isLight = !isLight;
    document.body.classList.toggle('light', isLight);
    document.getElementById('globalThemeToggle').textContent = isLight ? '\u2600' : '\u263e';
    (window.chartCallbacks || []).forEach(function (fn) { fn(); });
  });
})();
</script>
"""


def assemble_dashboard(title, chart_html_blocks, build_ts, cfg=None):
    """Combine all pieces into a complete HTML document string.

    If ``cfg`` is provided it is embedded as a JSON blob in a
    ``<script id="dashboard-config" type="application/json">`` tag so that
    ``--refresh`` can extract and re-use it later.
    """
    chart_count = len(chart_html_blocks)
    head = _build_head(title)
    header = _build_header(title, chart_count, build_ts)
    footer = _build_footer(build_ts)
    theme_js = _build_global_theme_js()

    grid_items = "\n".join(chart_html_blocks)

    config_tag = ""
    if cfg is not None:
        config_json = json.dumps(cfg, indent=2)
        config_tag = (
            f'\n<script id="dashboard-config" type="application/json">\n'
            f'{config_json}\n'
            f'</script>\n'
        )

    return (
        head
        + header
        + '<div class="dashboard-grid">\n'
        + grid_items
        + "\n</div>\n"
        + footer
        + theme_js
        + config_tag
        + "\n</body>\n</html>\n"
    )


# ── Chart presets ─────────────────────────────────────────────────────────────

CHART_PRESETS = [
    # Electricity
    {
        "number": 1,
        "category": "Electricity",
        "name": "Retail Prices",
        "endpoint": "/v2/electricity/retail-sales",
        "params": "frequency=monthly&data[]=price&facets[sectorid][]=RES&facets[stateid][]=US",
        "color": "#3B82F6",
        "y_label": "cents/kWh",
        "units": "",
    },
    {
        "number": 2,
        "category": "Electricity",
        "name": "Generation by Source",
        "endpoint": "/v2/electricity/electric-power-operational",
        "params": "frequency=monthly&data[]=generation",
        "color": "#3B82F6",
        "y_label": "GWh",
        "units": "",
    },
    {
        "number": 3,
        "category": "Electricity",
        "name": "Capacity",
        "endpoint": "/v2/electricity/capacity",
        "params": "frequency=annual&data[]=nameplate-capacity-mw",
        "color": "#3B82F6",
        "y_label": "MW",
        "units": "",
    },
    # Natural Gas
    {
        "number": 4,
        "category": "Natural Gas",
        "name": "Prices (Summary)",
        "endpoint": "/v2/natural-gas/pri/sum",
        "params": "frequency=monthly&data[]=value",
        "color": "#F97316",
        "y_label": "$/Mcf",
        "units": "$",
    },
    {
        "number": 5,
        "category": "Natural Gas",
        "name": "Weekly Storage",
        "endpoint": "/v2/natural-gas/stor/wkly",
        "params": "frequency=weekly&data[]=value",
        "color": "#F97316",
        "y_label": "Bcf",
        "units": "",
    },
    {
        "number": 6,
        "category": "Natural Gas",
        "name": "Production",
        "endpoint": "/v2/natural-gas/prod/sum",
        "params": "frequency=monthly&data[]=value",
        "color": "#F97316",
        "y_label": "Mcf",
        "units": "",
    },
    # Petroleum
    {
        "number": 7,
        "category": "Petroleum",
        "name": "Spot Prices (Brent)",
        "endpoint": "/v2/petroleum/pri/spt",
        "params": "frequency=weekly&data[]=value&facets[product][]=EPCBRENT",
        "color": "#EF4444",
        "y_label": "$/barrel",
        "units": "$",
    },
    {
        "number": 8,
        "category": "Petroleum",
        "name": "Spot Prices (WTI)",
        "endpoint": "/v2/petroleum/pri/spt",
        "params": "frequency=weekly&data[]=value&facets[product][]=EPCWTI",
        "color": "#EF4444",
        "y_label": "$/barrel",
        "units": "$",
    },
    {
        "number": 9,
        "category": "Petroleum",
        "name": "Gasoline Retail",
        "endpoint": "/v2/petroleum/pri/gnd",
        "params": "frequency=weekly&data[]=value",
        "color": "#EF4444",
        "y_label": "$/gal",
        "units": "$",
    },
    {
        "number": 10,
        "category": "Petroleum",
        "name": "Crude Production",
        "endpoint": "/v2/petroleum/crd/crpdn",
        "params": "frequency=monthly&data[]=value",
        "color": "#EF4444",
        "y_label": "bbl/day",
        "units": "",
    },
    {
        "number": 11,
        "category": "Petroleum",
        "name": "Weekly Stocks",
        "endpoint": "/v2/petroleum/stoc/wstk",
        "params": "frequency=weekly&data[]=value",
        "color": "#EF4444",
        "y_label": "barrels",
        "units": "",
    },
    # Coal
    {
        "number": 12,
        "category": "Coal",
        "name": "Production",
        "endpoint": "/v2/coal/production/quarterly",
        "params": "frequency=quarterly&data[]=value",
        "color": "#6B7280",
        "y_label": "short tons",
        "units": "",
    },
    {
        "number": 13,
        "category": "Coal",
        "name": "Prices",
        "endpoint": "/v2/coal/shipments/receipts/quarterly",
        "params": "frequency=quarterly&data[]=value",
        "color": "#6B7280",
        "y_label": "$/short ton",
        "units": "$",
    },
    # Total Energy
    {
        "number": 14,
        "category": "Total Energy",
        "name": "CO2 Emissions",
        "endpoint": "/v2/co2-emissions/co2-emissions-aggregates",
        "params": "frequency=annual&data[]=value",
        "color": "#22C55E",
        "y_label": "MMT CO2",
        "units": "",
    },
]

VALID_RANGES = {"1Y", "3Y", "5Y", "10Y", "Max"}


# ── Wizard helpers ─────────────────────────────────────────────────────────────

def slugify(text):
    """Convert a display name to a lowercase-hyphenated slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def _print_banner():
    print()
    print("\u256d\u2500 EIA Dashboard Builder \u2500\u256e")
    print("\u2502                        \u2502")
    print("\u2502  Build a custom energy  \u2502")
    print("\u2502  data dashboard.        \u2502")
    print("\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f")
    print()


def _print_menu():
    """Print the numbered chart menu grouped by category."""
    current_category = None
    for preset in CHART_PRESETS:
        if preset["category"] != current_category:
            current_category = preset["category"]
            print(f"\n  {current_category}")
        print(f"  {preset['number']:>3}) {preset['name']}")
    print()


def _parse_chart_selection(raw):
    """
    Parse a comma-separated string of chart numbers.

    Returns a list of preset dicts on success, or raises ValueError with a
    human-readable message if the input is invalid.
    """
    preset_by_number = {p["number"]: p for p in CHART_PRESETS}
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if not parts:
        raise ValueError("Please enter at least one chart number.")

    selected = []
    seen = set()
    for part in parts:
        if not part.isdigit():
            raise ValueError(f"'{part}' is not a valid number.")
        num = int(part)
        if num not in preset_by_number:
            raise ValueError(
                f"{num} is out of range. Choose between 1 and {len(CHART_PRESETS)}."
            )
        if num not in seen:
            selected.append(preset_by_number[num])
            seen.add(num)
    return selected


def validate_charts(selected_presets):
    """
    Fetch 1 row per chart in parallel to verify endpoints are reachable.

    Returns a dict mapping preset name -> error string (or None on success).
    """
    results = {}

    def _check(preset):
        try:
            fetch_data_with_meta(preset["endpoint"], preset.get("params", ""), max_rows=1)
            return None
        except Exception as exc:
            return str(exc)

    with ThreadPoolExecutor() as executor:
        future_to_name = {
            executor.submit(_check, preset): preset["name"]
            for preset in selected_presets
        }
        for fut in as_completed(future_to_name):
            name = future_to_name[fut]
            results[name] = fut.result()

    return results


def run_wizard():
    """
    Run the interactive wizard, prompt the user, and return a config dict
    in the same format as the JSON dashboard config files.
    """
    _print_banner()

    # 1. Dashboard name
    raw_name = input("Dashboard name: ").strip()
    if not raw_name:
        raw_name = "Custom Dashboard"

    # 2. Chart selection
    print("\nPick charts (enter numbers, comma-separated):")
    _print_menu()

    while True:
        raw_charts = input("Charts: ").strip()
        try:
            selected_presets = _parse_chart_selection(raw_charts)
            break
        except ValueError as exc:
            print(f"  Invalid selection: {exc} Try again.")

    # 3. Default date range
    raw_range = input(f"\nDefault range (1Y/3Y/5Y/10Y/Max) [5Y]: ").strip().upper()
    if not raw_range:
        raw_range = "5Y"
    while raw_range not in VALID_RANGES:
        raw_range = input(
            f"  Invalid range. Choose from 1Y/3Y/5Y/10Y/Max [5Y]: "
        ).strip().upper()
        if not raw_range:
            raw_range = "5Y"

    # 4. Validate endpoints before building
    print("\nValidating endpoints...")
    validation = validate_charts(selected_presets)
    failed = {name: err for name, err in validation.items() if err is not None}
    passed = [p for p in selected_presets if validation.get(p["name"]) is None]

    for preset in selected_presets:
        name = preset["name"]
        err = validation.get(name)
        if err is None:
            print(f"  \u2713 {name}")
        else:
            print(f"  \u2717 {name} \u2014 {err}")

    if failed:
        print(
            f"\n{len(failed)} chart{'s' if len(failed) != 1 else ''} failed validation. "
            f"Continue anyway? (y/N): ",
            end="",
            flush=True,
        )
        answer = input().strip().lower()
        if answer != "y":
            print("Aborted.")
            sys.exit(0)
        selected_presets = passed  # exclude failed charts
        if not selected_presets:
            print("No charts remaining. Aborted.")
            sys.exit(0)

    # 5. Derive paths
    slug = slugify(raw_name)
    output_path = str(Path.home() / "eia-dashboards" / f"{slug}.html")
    config_save_path = f"eia/dashboards/{slug}.json"

    # 6. Build the config dict (same schema as the JSON files)
    charts = []
    for preset in selected_presets:
        charts.append(
            {
                "name": preset["name"],
                "endpoint": preset["endpoint"],
                "params": preset["params"],
                "color": preset["color"],
                "y_label": preset["y_label"],
                "units": preset["units"],
            }
        )

    cfg = {
        "dashboard": raw_name,
        "output": output_path,
        "default_range": raw_range,
        "charts": charts,
    }

    # 7. Echo build summary
    print(
        f"\nBuilding: {raw_name} ({len(selected_presets)} "
        f"chart{'s' if len(selected_presets) != 1 else ''})"
    )

    # 8. Save config JSON so the user can re-run without the wizard
    cfg_path = Path(config_save_path)
    os.makedirs(cfg_path.parent, exist_ok=True)
    cfg_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")

    print(f"Config saved: {config_save_path}")
    print(
        f"Re-run: python3 eia/scripts/build_dashboard.py {config_save_path} --open"
    )

    return cfg


# ── Main ─────────────────────────────────────────────────────────────────────

def _extract_config_from_html(html_text):
    """Extract and parse the embedded dashboard config from an HTML string.

    Looks for:
        <script id="dashboard-config" type="application/json">
        {...}
        </script>

    Returns the parsed config dict, or raises ValueError if not found/parseable.
    """
    open_tag = '<script id="dashboard-config" type="application/json">'
    close_tag = "</script>"
    start = html_text.find(open_tag)
    if start == -1:
        raise ValueError(
            "No embedded dashboard config found in HTML. "
            "The file may have been built with an older version."
        )
    content_start = start + len(open_tag)
    end = html_text.find(close_tag, content_start)
    if end == -1:
        raise ValueError("Malformed embedded dashboard config: missing closing </script>.")
    json_text = html_text[content_start:end].strip()
    try:
        return json.loads(json_text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse embedded dashboard config JSON: {exc}") from exc


def _resolve_output_path(output_val, config_file_path=None):
    """Resolve an output path string to an absolute Path.

    - Paths starting with '~' are expanded.
    - Absolute paths (starting with '/') are used as-is.
    - Relative paths are resolved relative to the project root (ROOT).
    """
    p = str(output_val)
    if p.startswith("~"):
        return Path(p).expanduser()
    if Path(p).is_absolute():
        return Path(p)
    # Relative: resolve from project root
    return ROOT / p


def _run_build(cfg, do_open, output_override=None):
    """Core build pipeline shared by CLI mode, wizard, and --refresh.

    Args:
        cfg:             Validated config dict.
        do_open:         Whether to open the output in a browser.
        output_override: If set, write to this path instead of cfg["output"].
    """
    title = cfg["dashboard"]
    charts = cfg["charts"]

    # 3. Fetch all chart data in parallel (pass top-level cfg for start/max_rows)
    results = fetch_all_charts(charts, top_level_cfg=cfg)

    # 4. Print fetch summary
    for chart_cfg, result in zip(charts, results):
        print_fetch_result(chart_cfg.get("name", "Unnamed"), result)

    # 5. Render each chart card
    build_ts = datetime.now().strftime("%b %-d, %Y %-I:%M %p")
    chart_html_blocks = []
    default_range = cfg.get("default_range", "5Y")

    for i, (chart_cfg, result) in enumerate(zip(charts, results)):
        name = chart_cfg.get("name", f"Chart {i + 1}")
        chart_id = f"chart{i}"

        if isinstance(result, Exception):
            html = render_error_card(name, result)
        else:
            # Determine if single-series or multi-series
            is_multi = isinstance(result, list) and result and isinstance(result[0], dict)

            try:
                if is_multi:
                    html = render_chart(
                        data=None,
                        title=name,
                        color=chart_cfg.get("color", "#6366f1"),
                        y_label=chart_cfg.get("y_label", ""),
                        units=chart_cfg.get("units", ""),
                        source="EIA API",
                        chart_id=chart_id,
                        default_range=default_range,
                        mode="card",
                        series=result,
                    )
                else:
                    html = render_chart(
                        data=result,
                        title=name,
                        color=chart_cfg.get("color", "#6366f1"),
                        y_label=chart_cfg.get("y_label", ""),
                        units=chart_cfg.get("units", ""),
                        source="EIA API",
                        chart_id=chart_id,
                        default_range=default_range,
                        mode="card",
                        series=None,
                    )
            except Exception as exc:
                html = render_error_card(name, exc)

        chart_html_blocks.append(html)

    # 6. Assemble full dashboard HTML (embed config for --refresh)
    dashboard_html = assemble_dashboard(title, chart_html_blocks, build_ts, cfg=cfg)

    # 7. Determine output path
    if output_override is not None:
        out_path = Path(output_override)
    else:
        out_path = _resolve_output_path(cfg["output"])

    os.makedirs(out_path.parent, exist_ok=True)
    out_path.write_text(dashboard_html, encoding="utf-8")

    print(f"Dashboard: {out_path}")

    # 8. Optionally open in browser (macOS)
    if do_open:
        subprocess.run(["open", str(out_path)], check=False)


def main():
    # ── Wizard mode: no arguments → interactive flow ──────────────────────────
    if len(sys.argv) == 1:
        cfg = run_wizard()
        validate_config(cfg)
        title = cfg["dashboard"]
        charts = cfg["charts"]
        print(f"Building: {title} ({len(charts)} chart{'s' if len(charts) != 1 else ''})")
        _run_build(cfg, do_open=True)
        return

    # ── CLI mode ──────────────────────────────────────────────────────────────
    parser = argparse.ArgumentParser(
        description="Build a multi-chart EIA dashboard from a JSON config."
    )
    # config is optional so --refresh can be used without it
    parser.add_argument(
        "config",
        nargs="?",
        default=None,
        help="Path to the JSON dashboard config file",
    )
    parser.add_argument(
        "--open",
        action="store_true",
        help="Open the output file after building (macOS)",
    )
    parser.add_argument(
        "--refresh",
        metavar="HTML_FILE",
        default=None,
        help=(
            "Re-fetch data for an existing dashboard HTML file. "
            "Extracts the embedded config, re-runs the build, and overwrites the file."
        ),
    )
    args = parser.parse_args()
    do_open = args.open

    # Enforce mutual exclusivity of config and --refresh
    if args.refresh and args.config:
        print("ERROR: --refresh and a config file argument cannot be used together.")
        sys.exit(1)

    if args.refresh:
        # ── --refresh mode ────────────────────────────────────────────────────
        html_path = Path(args.refresh)
        if not html_path.exists():
            print(f"ERROR: HTML file not found: {html_path}")
            sys.exit(1)

        html_text = html_path.read_text(encoding="utf-8")
        try:
            cfg = _extract_config_from_html(html_text)
        except ValueError as exc:
            print(f"ERROR: {exc}")
            sys.exit(1)

        validate_config(cfg)
        title = cfg["dashboard"]
        charts = cfg["charts"]
        print(f"Refreshing: {title} ({len(charts)} chart{'s' if len(charts) != 1 else ''})")
        _run_build(cfg, do_open=do_open, output_override=str(html_path))
        return

    # ── Normal config-file mode ───────────────────────────────────────────────
    if not args.config:
        parser.error("A config file is required unless --refresh is used.")

    config_path = Path(args.config)
    if not config_path.exists():
        print(f"ERROR: Config file not found: {config_path}")
        sys.exit(1)

    with open(config_path) as f:
        try:
            cfg = json.load(f)
        except json.JSONDecodeError as e:
            print(f"ERROR: Failed to parse JSON config: {e}")
            sys.exit(1)

    validate_config(cfg)
    title = cfg["dashboard"]
    charts = cfg["charts"]
    print(f"Building: {title} ({len(charts)} chart{'s' if len(charts) != 1 else ''})")
    _run_build(cfg, do_open=do_open)


if __name__ == "__main__":
    main()
