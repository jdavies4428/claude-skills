#!/usr/bin/env python3
"""
eia/scripts/render_chart.py — Chart template engine.

Converts [[date, value], ...] data (or multi-series) + config into a
self-contained interactive HTML chart, matching the quality of oil-prices.html.

Usage (import):
    from eia.scripts.render_chart import render_chart
    html = render_chart(data, title="Brent Crude", color="#EF4444", ...)

Usage (CLI):
    python3 eia/scripts/fetch.py --endpoint "..." --params "..." | \\
      python3 eia/scripts/render_chart.py --title "Oil Prices" --color "#EF4444" \\
        --y-label "$/barrel" --units "$" --output eia/output/oil-prices.html
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hex_to_rgb(hex_color: str) -> str:
    """Convert '#RRGGBB' to 'R,G,B' string suitable for use in rgba()."""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r = int(h[0:2], 16)
    g = int(h[2:4], 16)
    b = int(h[4:6], 16)
    return f"{r},{g},{b}"


def _auto_subtitle(data: list) -> str:
    """Build 'N observations - Mon YYYY - Mon YYYY' from [[date, value], ...]."""
    if not data:
        return "No data"
    n = len(data)
    fmt = "%Y-%m-%d"
    try:
        first_dt = datetime.strptime(data[0][0], fmt)
        last_dt = datetime.strptime(data[-1][0], fmt)
        first_str = first_dt.strftime("%b %Y")
        last_str = last_dt.strftime("%b %Y")
    except (ValueError, IndexError):
        return f"{n} observations"
    obs_label = "observation" if n == 1 else "observations"
    return f"{n:,} {obs_label} &bull; {first_str} &ndash; {last_str}"


def _last_date(data: list) -> str:
    """Return the ISO date string of the last data point."""
    if not data:
        return "2020-01-01"
    return data[-1][0]


# ---------------------------------------------------------------------------
# Main template function
# ---------------------------------------------------------------------------

def render_chart(
    data=None,
    title="Chart",
    color="#EF4444",
    y_label="",
    units="$",
    source="EIA API",
    chart_id="chart0",
    default_range="5Y",
    mode="standalone",
    series=None,
) -> str:
    """
    Render an interactive HTML chart from data + config.

    Parameters
    ----------
    data : list of [date_str, numeric_value]
        Single-series data. Ignored when ``series`` is provided.
    title : str
        Chart heading.
    color : str
        Accent hex color for single-series charts.
    y_label : str
        Y-axis title (e.g. "$/barrel").
    units : str
        Value prefix for the fmt() JS helper (e.g. "$", "", "cents ").
    source : str
        Attribution text in the footer.
    chart_id : str
        DOM-ID prefix — every element ID is ``{chart_id}_{name}``.
    default_range : str
        One of "1Y", "3Y", "5Y", "10Y", "Max".
    mode : str
        "standalone" = full HTML page; "card" = bare div + script fragment.
    series : list of dict, optional
        Multi-series: [{"label": "...", "data": [...], "color": "..."}, ...]
        When provided, ``data`` and ``color`` are ignored.

    Returns
    -------
    str
        HTML string.
    """
    # Normalise series
    if series is not None:
        all_series = series
    else:
        if data is None:
            data = []
        all_series = [{"label": title, "data": data, "color": color}]

    # Primary series drives subtitle + last-date reference
    primary_data = all_series[0]["data"] if all_series else []
    subtitle = _auto_subtitle(primary_data)
    last_iso = _last_date(primary_data)

    # Derived accent values (from first / only series color)
    accent_hex = all_series[0]["color"] if all_series else color
    accent_rgb = hex_to_rgb(accent_hex)

    # Multi-series flag
    multi = len(all_series) > 1

    # Serialise all series data to JSON for embedding
    raw_data_js_lines = []
    for s in all_series:
        safe_label = s["label"].replace("\\", "\\\\").replace("`", "\\`")
        js_data = json.dumps(s["data"])
        js_color = json.dumps(s["color"])
        raw_data_js_lines.append(
            f'  {{ label: `{safe_label}`, data: {js_data}, color: {js_color} }}'
        )
    raw_series_js = "[\n" + ",\n".join(raw_data_js_lines) + "\n]"

    # Escape title for HTML
    safe_title = (
        title
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )

    # Build range button HTML — mark default_range active
    def range_btn(label):
        active = ' class="active"' if label == default_range else ""
        return (
            f'      <button id="{chart_id}_range{label}"{active} '
            f"""onclick="document.getElementById('{chart_id}_wrapper').__C.setRange('{label}')">{label}</button>"""
        )

    range_buttons = "\n".join(range_btn(r) for r in ["1Y", "3Y", "5Y", "10Y", "Max"])

    # -----------------------------------------------------------------------
    # CSS block (same as oil-prices.html, with dynamic accent variables)
    # -----------------------------------------------------------------------
    css = f"""\
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

    :root {{
      --bg:          #0f1117;
      --surface:     #1a1d27;
      --border:      #2a2d3e;
      --text:        #e2e8f0;
      --text-muted:  #8892a4;
      --accent:      {accent_hex};
      --accent-glow: rgba({accent_rgb},0.18);
      --btn-bg:      #252838;
      --btn-active:  {accent_hex};
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
      --btn-active:  {accent_hex};
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
      display: flex;
      align-items: stretch;
      justify-content: center;
      padding: 24px 16px;
      transition: background 0.25s, color 0.25s;
    }}

    .wrapper {{
      width: 100%;
      max-width: 1200px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }}

    /* ── Header ── */
    .header {{
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }}

    .title-block h1 {{
      font-size: clamp(1rem, 2.5vw, 1.35rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.3;
    }}

    .title-block .subtitle {{
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 4px;
    }}

    .header-actions {{
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }}

    /* ── Buttons ── */
    .btn-group {{
      display: flex;
      gap: 4px;
      background: var(--btn-bg);
      border-radius: 8px;
      padding: 3px;
    }}

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
      box-shadow: 0 2px 8px rgba({accent_rgb},0.35);
    }}

    button:not(.active):hover {{
      background: var(--border);
      color: var(--text);
    }}

    /* icon buttons */
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

    /* ── Controls row ── */
    .controls {{
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }}

    .controls-label {{
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }}

    /* ── Chart card ── */
    .chart-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px 20px 14px;
      position: relative;
      box-shadow: 0 4px 32px rgba(0,0,0,0.18);
      flex: 1;
    }}

    .chart-wrap {{
      position: relative;
      width: 100%;
    }}

    /* ── Stats row ── */
    .stats {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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

    /* ── Legend ── */
    .legend {{
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
    }}

    .legend-item {{
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: var(--text-muted);
    }}

    .legend-swatch {{
      width: 12px;
      height: 12px;
      border-radius: 3px;
      flex-shrink: 0;
    }}

    /* ── Footer ── */
    footer {{
      text-align: center;
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
    }}

    /* ── Responsive ── */
    @media (max-width: 540px) {{
      .controls {{ gap: 8px; }}
      .stats {{ grid-template-columns: repeat(2, 1fr); }}
    }}"""

    # -----------------------------------------------------------------------
    # Legend HTML (only shown for multi-series)
    # -----------------------------------------------------------------------
    if multi:
        legend_items = "\n".join(
            f'      <div class="legend-item">'
            f'<div class="legend-swatch" style="background:{s["color"]}"></div>'
            f'{s["label"]}</div>'
            for s in all_series
        )
        legend_html = f'    <div class="legend">\n{legend_items}\n    </div>'
    else:
        legend_html = ""

    # -----------------------------------------------------------------------
    # JavaScript block
    # -----------------------------------------------------------------------
    units_js = json.dumps(units)
    y_label_js = json.dumps(y_label)
    safe_title_js = json.dumps(safe_title)
    chart_id_js = json.dumps(chart_id)
    multi_js = "true" if multi else "false"
    default_range_js = json.dumps(default_range)
    accent_hex_js = json.dumps(accent_hex)
    accent_rgb_js = json.dumps(accent_rgb)

    js = f"""\
(function() {{
// ── Embedded data ──────────────────────────────────────────────────────────
const ALL_SERIES = {raw_series_js};

const CHART_ID     = {chart_id_js};
const MULTI        = {multi_js};
const UNITS        = {units_js};
const Y_LABEL      = {y_label_js};
const CHART_TITLE  = {safe_title_js};
const ACCENT_HEX   = {accent_hex_js};
const ACCENT_RGB   = {accent_rgb_js};
const LAST_DATE    = '{last_iso}';

// ── State ──────────────────────────────────────────────────────────────────
let chartType   = 'line';
let activeRange = {default_range_js};
let chartInst   = null;
let isLight     = false;

// ── DOM helpers ────────────────────────────────────────────────────────────
function el(suffix) {{
  return document.getElementById(CHART_ID + '_' + suffix);
}}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(iso) {{
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {{ month: 'short', day: 'numeric', year: 'numeric' }});
}}

function fmt(v) {{
  return UNITS + v.toFixed(2);
}}

function getFilteredData(rawData) {{
  if (activeRange === 'Max') return rawData;
  const now = new Date(LAST_DATE + 'T00:00:00');
  const years = {{ '1Y': 1, '3Y': 3, '5Y': 5, '10Y': 10 }}[activeRange];
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rawData.filter(([d]) => d >= cutoffStr);
}}

function updateStats(data) {{
  if (!data.length) return;
  const vals  = data.map(([, v]) => v);
  const dates = data.map(([d]) => d);
  const last  = vals[vals.length - 1];
  const first = vals[0];
  const max   = Math.max(...vals);
  const min   = Math.min(...vals);
  const avg   = vals.reduce((s, v) => s + v, 0) / vals.length;
  const change    = last - first;
  const changePct = (last - first) / first * 100;

  el('statCurrent').textContent    = fmt(last);
  el('statCurrentDate').textContent = formatDate(dates[dates.length - 1]);

  el('statHigh').textContent     = fmt(max);
  el('statHighDate').textContent = formatDate(dates[vals.indexOf(max)]);

  el('statLow').textContent     = fmt(min);
  el('statLowDate').textContent = formatDate(dates[vals.indexOf(min)]);

  el('statAvg').textContent    = fmt(avg);
  el('statPoints').textContent = vals.length + ' data points';

  const changeEl = el('statChange');
  changeEl.textContent = (change >= 0 ? '+' : '') + fmt(change);
  changeEl.className   = 'stat-value ' + (change >= 0 ? 'up' : 'down');
  el('statChangePct').textContent =
    (changePct >= 0 ? '+' : '') + changePct.toFixed(1) + '% vs. period start';
}}

function buildDataset(filteredData, seriesConf) {{
  const labels = filteredData.map(([d]) => d);
  const values = filteredData.map(([, v]) => v);
  const c      = seriesConf.color;
  const [r, g, b] = c.replace('#', '').match(/../g).map(x => parseInt(x, 16));
  const rgba015  = `rgba(${{r}},${{g}},${{b}},0.15)`;
  const rgba030  = `rgba(${{r}},${{g}},${{b}},0.30)`;
  const rgba001  = `rgba(${{r}},${{g}},${{b}},0.01)`;

  const base = {{
    label: seriesConf.label,
    data: values,
    borderColor: c,
    backgroundColor: chartType === 'bar'  ? c
                   : chartType === 'area' ? rgba015
                   : 'transparent',
    borderWidth: chartType === 'bar' ? 0 : 2,
    fill: chartType === 'area',
    pointRadius: 0,
    pointHoverRadius: 5,
    pointHoverBackgroundColor: c,
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 2,
    tension: 0.3,
  }};

  if (chartType === 'area') {{
    base.backgroundColor = (ctx) => {{
      const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
      gradient.addColorStop(0, rgba030);
      gradient.addColorStop(1, rgba001);
      return gradient;
    }};
  }}

  return {{ labels, dataset: base }};
}}

function getChartJsType() {{
  return chartType === 'bar' ? 'bar' : 'line';
}}

function buildTickLabels(labels) {{
  const n       = labels.length;
  const maxTicks = 12;
  const step    = Math.max(1, Math.floor(n / maxTicks));
  return labels.map((l, i) => {{
    if (i % step !== 0) return '';
    const d = new Date(l + 'T00:00:00');
    return d.toLocaleDateString('en-US', {{ month: 'short', year: '2-digit' }});
  }});
}}

function renderChart() {{
  // Primary series for stats + tick labels
  const primaryFiltered = getFilteredData(ALL_SERIES[0].data);
  updateStats(primaryFiltered);

  const allDatasets = [];
  let sharedLabels  = null;
  let tickLabels    = null;

  ALL_SERIES.forEach((s) => {{
    const filtered = getFilteredData(s.data);
    const {{ labels, dataset }} = buildDataset(filtered, s);
    if (!sharedLabels) {{
      sharedLabels = labels;
      tickLabels   = buildTickLabels(labels);
    }}
    allDatasets.push(dataset);
  }});

  const isDark       = !isLight;
  const gridColor    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor    = isDark ? '#8892a4' : '#64748b';
  const axisLabelColor = isDark ? '#a0aec0' : '#4a5568';

  const config = {{
    type: getChartJsType(),
    data: {{ labels: sharedLabels, datasets: allDatasets }},
    options: {{
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: window.innerWidth < 600 ? 1.4 : 2.4,
      animation: {{ duration: 300, easing: 'easeInOutQuart' }},
      interaction: {{ mode: 'index', intersect: false }},
      plugins: {{
        legend: {{ display: MULTI }},
        tooltip: {{
          enabled: true,
          backgroundColor: isDark ? '#1e2130' : '#ffffff',
          titleColor: isDark ? '#e2e8f0' : '#1e2130',
          bodyColor: isDark ? '#8892a4' : '#64748b',
          borderColor: isDark ? '#2a2d3e' : '#dde2ef',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: MULTI,
          boxWidth: 10,
          boxHeight: 10,
          callbacks: {{
            title(items) {{ return formatDate(items[0].label); }},
            label(item) {{
              const prefix = MULTI ? ' ' + item.dataset.label + ': ' : ' ';
              return prefix + fmt(Number(item.raw));
            }},
          }},
        }},
      }},
      scales: {{
        x: {{
          grid: {{ color: gridColor, drawTicks: false }},
          border: {{ display: false }},
          ticks: {{
            color: textColor,
            maxRotation: 0,
            autoSkip: false,
            callback(val, i) {{ return tickLabels[i]; }},
            font: {{ size: 11 }},
          }},
        }},
        y: {{
          grid: {{ color: gridColor, drawTicks: false }},
          border: {{ display: false }},
          ticks: {{
            color: textColor,
            callback(val) {{ return UNITS + val; }},
            font: {{ size: 11 }},
          }},
          title: {{
            display: !!Y_LABEL,
            text: Y_LABEL,
            color: axisLabelColor,
            font: {{ size: 12, weight: '600' }},
            padding: {{ bottom: 8 }},
          }},
        }},
      }},
    }},
  }};

  const canvas = el('canvas');
  if (chartInst) {{ chartInst.destroy(); }}
  chartInst = new Chart(canvas, config);

}}

// ── Controls ───────────────────────────────────────────────────────────────
const C = {{
  setChartType(type) {{
    chartType = type;
    ['Line', 'Bar', 'Area'].forEach(t =>
      el('type' + t).classList.remove('active')
    );
    el('type' + type.charAt(0).toUpperCase() + type.slice(1)).classList.add('active');
    renderChart();
  }},

  setRange(range) {{
    activeRange = range;
    ['1Y', '3Y', '5Y', '10Y', 'Max'].forEach(r =>
      el('range' + r).classList.remove('active')
    );
    el('range' + range).classList.add('active');
    renderChart();
  }},
}};

// ── Theme toggle ───────────────────────────────────────────────────────────
el('themeToggle').addEventListener('click', () => {{
  isLight = !isLight;
  document.body.classList.toggle('light', isLight);
  el('themeToggle').textContent = isLight ? '\\u2600' : '\\u263E';
  renderChart();
}});

// ── SVG download ───────────────────────────────────────────────────────────
el('downloadBtn').addEventListener('click', () => {{
  if (!chartInst) return;
  const canvas  = el('canvas');
  const w       = canvas.width;
  const h       = canvas.height;
  const dataURL = canvas.toDataURL('image/png');

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${{w}}" height="${{h}}">
  <title>${{CHART_TITLE}}</title>
  <image href="${{dataURL}}" width="${{w}}" height="${{h}}" />
</svg>`;

  const blob = new Blob([svgContent], {{ type: 'image/svg+xml' }});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = CHART_ID + '.svg';
  a.click();
  URL.revokeObjectURL(url);
}});

// ── Copy to clipboard ────────────────────────────────────────────────────
el('copyBtn').addEventListener('click', () => {{
  if (!chartInst) return;
  const canvas = el('canvas');
  canvas.toBlob(function(blob) {{
    if (!blob) return;
    const item = new ClipboardItem({{ 'image/png': blob }});
    navigator.clipboard.write([item]).then(() => {{
      const btn = el('copyBtn');
      btn.textContent = '\\u2713';
      setTimeout(() => {{ btn.textContent = '\\u2388'; }}, 1200);
    }}).catch(() => {{
      const btn = el('copyBtn');
      btn.textContent = '\\u2717';
      setTimeout(() => {{ btn.textContent = '\\u2388'; }}, 1200);
    }});
  }}, 'image/png');
}});

// ── Card mode: register for global theme sync ──────────────────────────────
window.chartCallbacks = window.chartCallbacks || [];
window.chartCallbacks.push(renderChart);

// ── Init ───────────────────────────────────────────────────────────────────
renderChart();
}})();"""

    # -----------------------------------------------------------------------
    # Assemble HTML body fragment (card)
    # -----------------------------------------------------------------------
    card = f"""\
<div class="wrapper" id="{chart_id}_wrapper">
  <!-- Header -->
  <div class="header">
    <div class="title-block">
      <h1>{safe_title}</h1>
      <div class="subtitle">{subtitle}</div>
    </div>
    <div class="header-actions">
      <button class="icon-btn" id="{chart_id}_copyBtn" title="Copy chart" aria-label="Copy chart to clipboard">&#9112;</button>
      <button class="icon-btn" id="{chart_id}_themeToggle" title="Toggle theme" aria-label="Toggle light/dark theme">&#9790;</button>
      <button class="icon-btn" id="{chart_id}_downloadBtn" title="Download as SVG" aria-label="Download chart as SVG">&#8595;</button>
    </div>
  </div>

  <!-- Controls -->
  <div class="controls">
    <span class="controls-label">Chart</span>
    <div class="btn-group" role="group" aria-label="Chart type">
      <button id="{chart_id}_typeLine" class="active" onclick="(function(){{var C=document.getElementById('{chart_id}_wrapper').__C;C&&C.setChartType('line')}})()">Line</button>
      <button id="{chart_id}_typeBar"              onclick="(function(){{var C=document.getElementById('{chart_id}_wrapper').__C;C&&C.setChartType('bar')}})()">Bar</button>
      <button id="{chart_id}_typeArea"             onclick="(function(){{var C=document.getElementById('{chart_id}_wrapper').__C;C&&C.setChartType('area')}})()">Area</button>
    </div>

    <span class="controls-label" style="margin-left:8px">Range</span>
    <div class="btn-group" role="group" aria-label="Date range">
{range_buttons}
    </div>
  </div>

  <!-- Chart -->
  <div class="chart-card">
{legend_html}
    <div class="chart-wrap">
      <canvas id="{chart_id}_canvas" aria-label="{safe_title} chart"></canvas>
    </div>

    <!-- Stats -->
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Current</div>
        <div class="stat-value" id="{chart_id}_statCurrent">&#8212;</div>
        <div class="stat-meta"  id="{chart_id}_statCurrentDate">&#8212;</div>
      </div>
      <div class="stat">
        <div class="stat-label">Period High</div>
        <div class="stat-value up" id="{chart_id}_statHigh">&#8212;</div>
        <div class="stat-meta"     id="{chart_id}_statHighDate">&#8212;</div>
      </div>
      <div class="stat">
        <div class="stat-label">Period Low</div>
        <div class="stat-value down" id="{chart_id}_statLow">&#8212;</div>
        <div class="stat-meta"       id="{chart_id}_statLowDate">&#8212;</div>
      </div>
      <div class="stat">
        <div class="stat-label">Period Avg</div>
        <div class="stat-value" id="{chart_id}_statAvg">&#8212;</div>
        <div class="stat-meta"  id="{chart_id}_statPoints">&#8212;</div>
      </div>
      <div class="stat">
        <div class="stat-label">Change</div>
        <div class="stat-value" id="{chart_id}_statChange">&#8212;</div>
        <div class="stat-meta"  id="{chart_id}_statChangePct">vs. period start</div>
      </div>
    </div>
  </div>

  <footer>Source: {source}</footer>
</div>

<script>
{js}
</script>"""

    # -----------------------------------------------------------------------
    # Rewrite onclick handlers to use the C object stored on wrapper
    # (cleaner approach: in standalone the IIFE exposes C via wrapper.__C)
    # The JS IIFE already wires onclick via the C object; the button onclick
    # attributes in the card above use a closure lookup. For standalone we
    # use a simpler inlined onclick approach via direct global scoping is NOT
    # needed — the IIFE stores C on the wrapper element for access.
    # -----------------------------------------------------------------------
    # Actually let's simplify: expose C on the wrapper element inside the IIFE
    # so onclick attributes work. We inject that one line into the IIFE.
    # We do a targeted replacement in js to add this after C is defined.

    # Insert wrapper.__C = C assignment into the IIFE
    js = js.replace(
        "// ── Copy to clipboard",
        "// ── Expose C on wrapper element for onclick handlers\n"
        "const _w = document.getElementById(CHART_ID + '_wrapper');\n"
        "if (_w) _w.__C = C;\n\n"
        "// ── Copy to clipboard",
    )

    # Rebuild card with the updated js
    card = f"""\
<div class="wrapper" id="{chart_id}_wrapper">
  <!-- Header -->
  <div class="header">
    <div class="title-block">
      <h1>{safe_title}</h1>
      <div class="subtitle">{subtitle}</div>
    </div>
    <div class="header-actions">
      <button class="icon-btn" id="{chart_id}_copyBtn" title="Copy chart" aria-label="Copy chart to clipboard">&#9112;</button>
      <button class="icon-btn" id="{chart_id}_themeToggle" title="Toggle theme" aria-label="Toggle light/dark theme">&#9790;</button>
      <button class="icon-btn" id="{chart_id}_downloadBtn" title="Download as SVG" aria-label="Download chart as SVG">&#8595;</button>
    </div>
  </div>

  <!-- Controls -->
  <div class="controls">
    <span class="controls-label">Chart</span>
    <div class="btn-group" role="group" aria-label="Chart type">
      <button id="{chart_id}_typeLine" class="active" onclick="document.getElementById('{chart_id}_wrapper').__C.setChartType('line')">Line</button>
      <button id="{chart_id}_typeBar"              onclick="document.getElementById('{chart_id}_wrapper').__C.setChartType('bar')">Bar</button>
      <button id="{chart_id}_typeArea"             onclick="document.getElementById('{chart_id}_wrapper').__C.setChartType('area')">Area</button>
    </div>

    <span class="controls-label" style="margin-left:8px">Range</span>
    <div class="btn-group" role="group" aria-label="Date range">
{range_buttons}
    </div>
  </div>

  <!-- Chart -->
  <div class="chart-card">
{legend_html}
    <div class="chart-wrap">
      <canvas id="{chart_id}_canvas" aria-label="{safe_title} chart"></canvas>
    </div>

    <!-- Stats -->
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Current</div>
        <div class="stat-value" id="{chart_id}_statCurrent">&#8212;</div>
        <div class="stat-meta"  id="{chart_id}_statCurrentDate">&#8212;</div>
      </div>
      <div class="stat">
        <div class="stat-label">Period High</div>
        <div class="stat-value up" id="{chart_id}_statHigh">&#8212;</div>
        <div class="stat-meta"     id="{chart_id}_statHighDate">&#8212;</div>
      </div>
      <div class="stat">
        <div class="stat-label">Period Low</div>
        <div class="stat-value down" id="{chart_id}_statLow">&#8212;</div>
        <div class="stat-meta"       id="{chart_id}_statLowDate">&#8212;</div>
      </div>
      <div class="stat">
        <div class="stat-label">Period Avg</div>
        <div class="stat-value" id="{chart_id}_statAvg">&#8212;</div>
        <div class="stat-meta"  id="{chart_id}_statPoints">&#8212;</div>
      </div>
      <div class="stat">
        <div class="stat-label">Change</div>
        <div class="stat-value" id="{chart_id}_statChange">&#8212;</div>
        <div class="stat-meta"  id="{chart_id}_statChangePct">vs. period start</div>
      </div>
    </div>
  </div>

  <footer>Source: {source}</footer>
</div>

<script>
{js}
</script>"""

    # -----------------------------------------------------------------------
    # Wrap in full HTML page for standalone mode
    # -----------------------------------------------------------------------
    if mode == "standalone":
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{safe_title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"><\/script>
  <style>
{css}
  </style>
</head>
<body>
{card}
</body>
</html>"""

    # card mode: just the fragment (no html/head/body wrapper, no CDN script)
    return f"""\
<style>
{css}
</style>
{card}"""


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Render an interactive HTML chart from EIA JSON (stdin).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Example:
  python3 eia/scripts/fetch.py --endpoint "/v2/petroleum/pri/spt/data/" \\
    --params "frequency=weekly&data[]=value&sort[0][column]=period&sort[0][direction]=asc&offset=0&length=5000" | \\
  python3 eia/scripts/render_chart.py \\
    --title "Brent Crude Oil Spot Price" \\
    --color "#EF4444" \\
    --y-label "$/barrel" \\
    --units "$" \\
    --output eia/output/oil-prices.html
""",
    )
    parser.add_argument("--title",   required=True,       help="Chart title")
    parser.add_argument("--color",   default="#EF4444",   help="Accent color hex (default: #EF4444)")
    parser.add_argument("--y-label", default="",          help="Y-axis label (default: '')")
    parser.add_argument("--units",   default="$",         help="Value prefix for formatting (default: '$')")
    parser.add_argument("--source",  default="EIA API",   help="Footer attribution text")
    parser.add_argument("--range",   default="5Y",        choices=["1Y", "3Y", "5Y", "10Y", "Max"],
                        help="Default date range (default: 5Y)")
    parser.add_argument("--chart-id", default="chart0",  help="DOM ID prefix (default: chart0)")
    parser.add_argument("--mode",    default="standalone", choices=["standalone", "card"],
                        help="Output mode (default: standalone)")
    parser.add_argument("--output",  required=True,       help="Output file path")

    args = parser.parse_args()

    # Read JSON from stdin
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"ERROR: Could not parse JSON from stdin: {exc}", file=sys.stderr)
        sys.exit(1)

    # Extract the data key — fetch.py outputs {"data": [[date, value], ...], ...}
    if "data" not in payload:
        print("ERROR: JSON from stdin has no 'data' key.", file=sys.stderr)
        print(f"  Keys found: {list(payload.keys())}", file=sys.stderr)
        sys.exit(1)

    data = payload["data"]

    html = render_chart(
        data=data,
        title=args.title,
        color=args.color,
        y_label=args.y_label,
        units=args.units,
        source=args.source,
        chart_id=args.chart_id,
        default_range=args.range,
        mode=args.mode,
    )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")

    # Summary line
    data_len = len(data) if isinstance(data, list) else "?"
    print(f"Wrote {data_len} observations -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
