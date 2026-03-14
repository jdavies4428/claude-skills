"""
_shared/scripts/viz.py
Visualization helpers — generate Chart.js HTML for inline rendering.
Used by any skill that produces charts.

Usage:
    from _shared.scripts.viz import line_chart, bar_chart, multi_series_chart

    html = line_chart(
        data=[["2020-01", 10.5], ["2020-02", 11.2], ...],
        title="Electricity Prices",
        y_label="cents/kWh",
        source="EIA API",
        theme="dark",
    )
    print(html)  # paste into visualizer or save as .html
"""

import json
from typing import List, Tuple, Optional

# Color palette by energy category
COLORS = {
    "electricity": "#3B82F6",
    "natural_gas":  "#F97316",
    "petroleum":    "#EF4444",
    "coal":         "#6B7280",
    "renewable":    "#22C55E",
    "nuclear":      "#8B5CF6",
    "default":      "#60A5FA",
}

THEME_DARK = {
    "bg": "#0F172A",
    "surface": "#1E293B",
    "border": "#334155",
    "text": "#F1F5F9",
    "muted": "#94A3B8",
    "grid": "#1E293B",
}

THEME_LIGHT = {
    "bg": "#FFFFFF",
    "surface": "#F8FAFC",
    "border": "#E2E8F0",
    "text": "#0F172A",
    "muted": "#64748B",
    "grid": "#F1F5F9",
}


def _theme(name: str) -> dict:
    return THEME_DARK if name == "dark" else THEME_LIGHT


def line_chart(
    data: List[Tuple],
    title: str = "",
    y_label: str = "",
    source: str = "EIA API",
    theme: str = "dark",
    color: str = None,
    series_label: str = "Value",
    show_controls: bool = True,
) -> str:
    """Generate a single-series interactive line chart as HTML."""
    return _base_chart(
        chart_type="line",
        datasets=[{"label": series_label, "data": data, "color": color or COLORS["default"]}],
        title=title,
        y_label=y_label,
        source=source,
        theme=theme,
        show_controls=show_controls,
    )


def bar_chart(
    data: List[Tuple],
    title: str = "",
    y_label: str = "",
    source: str = "EIA API",
    theme: str = "dark",
    color: str = None,
    series_label: str = "Value",
    show_controls: bool = True,
) -> str:
    """Generate a single-series interactive bar chart as HTML."""
    return _base_chart(
        chart_type="bar",
        datasets=[{"label": series_label, "data": data, "color": color or COLORS["default"]}],
        title=title,
        y_label=y_label,
        source=source,
        theme=theme,
        show_controls=show_controls,
    )


def multi_series_chart(
    series: List[dict],
    title: str = "",
    y_label: str = "",
    source: str = "EIA API",
    theme: str = "dark",
    chart_type: str = "line",
    show_controls: bool = True,
) -> str:
    """
    Generate a multi-series chart.

    series: [
        {"label": "Texas", "data": [["2020-01", 10.5], ...], "color": "#3B82F6"},
        {"label": "California", "data": [...], "color": "#F97316"},
    ]
    """
    return _base_chart(
        chart_type=chart_type,
        datasets=series,
        title=title,
        y_label=y_label,
        source=source,
        theme=theme,
        show_controls=show_controls,
    )


def _base_chart(
    chart_type: str,
    datasets: List[dict],
    title: str,
    y_label: str,
    source: str,
    theme: str,
    show_controls: bool,
) -> str:
    """Core chart HTML generator."""
    t = _theme(theme)

    # Build Chart.js datasets
    js_datasets = []
    for ds in datasets:
        labels = [row[0] for row in ds["data"]]
        values = [row[1] for row in ds["data"]]
        color = ds.get("color", COLORS["default"])
        js_datasets.append({
            "label": ds.get("label", "Value"),
            "data": values,
            "borderColor": color,
            "backgroundColor": color + "33",  # 20% opacity fill
            "pointRadius": 2,
            "tension": 0.3,
            "fill": chart_type == "area",
        })

    all_labels = labels if datasets else []
    datasets_json = json.dumps(js_datasets)
    labels_json = json.dumps(all_labels)

    controls_html = ""
    if show_controls:
        controls_html = f"""
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">
      <div style="display:flex;gap:4px;">
        <button onclick="setType('line')" style="{_btn(t)}">Line</button>
        <button onclick="setType('bar')" style="{_btn(t)}">Bar</button>
      </div>
      <div style="display:flex;gap:4px;">
        <button onclick="setRange(12)"  style="{_btn(t)}">1Y</button>
        <button onclick="setRange(36)"  style="{_btn(t)}">3Y</button>
        <button onclick="setRange(60)"  style="{_btn(t)}">5Y</button>
        <button onclick="setRange(120)" style="{_btn(t)}">10Y</button>
        <button onclick="setRange(0)"   style="{_btn(t)}">Max</button>
      </div>
      <button onclick="exportChart()" style="{_btn(t)}">↓ Export</button>
    </div>"""

    return f"""
<div style="background:{t['bg']};padding:20px;border-radius:12px;font-family:system-ui,sans-serif;">
  <div style="color:{t['text']};font-size:16px;font-weight:600;margin-bottom:4px;">{title}</div>
  {controls_html}
  <canvas id="eia-chart" style="width:100%;max-height:400px;"></canvas>
  <div style="color:{t['muted']};font-size:11px;margin-top:8px;text-align:right;">Source: {source}</div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
<script>
const allLabels = {labels_json};
const allDatasets = {datasets_json};
let currentType = "{chart_type}";
let currentRange = 0;

function getSlice(n) {{
  if (!n) return {{ labels: allLabels, datasets: allDatasets }};
  const sl = allLabels.slice(-n);
  const ds = allDatasets.map(d => ({{ ...d, data: d.data.slice(-n) }}));
  return {{ labels: sl, datasets: ds }};
}}

const ctx = document.getElementById("eia-chart").getContext("2d");
let chart = new Chart(ctx, {{
  type: currentType === "area" ? "line" : currentType,
  data: getSlice(currentRange),
  options: {{
    responsive: true,
    animation: {{ duration: 300 }},
    plugins: {{
      legend: {{ labels: {{ color: "{t['text']}" }} }},
      tooltip: {{ mode: "index", intersect: false }},
    }},
    scales: {{
      x: {{ ticks: {{ color: "{t['muted']}", maxTicksLimit: 12 }}, grid: {{ color: "{t['border']}" }} }},
      y: {{
        ticks: {{ color: "{t['muted']}" }},
        grid: {{ color: "{t['border']}" }},
        title: {{ display: true, text: "{y_label}", color: "{t['muted']}" }},
      }},
    }},
  }},
}});

function setType(t) {{ currentType = t; chart.config.type = t; chart.update(); }}
function setRange(n) {{ currentRange = n; const s = getSlice(n); chart.data = s; chart.update(); }}
function exportChart() {{
  const a = document.createElement("a");
  a.href = chart.toBase64Image();
  a.download = "{title.replace(' ', '_') or 'chart'}.png";
  a.click();
}}
</script>
"""


def _btn(t: dict) -> str:
    return (
        f"background:{t['surface']};color:{t['text']};border:1px solid {t['border']};"
        f"border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;"
    )
