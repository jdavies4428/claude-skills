#!/usr/bin/env python3
"""
eia/scripts/validate_chart.py — Validate generated chart HTML before opening.

Catches common rendering issues: malformed script tags, missing Chart.js CDN,
empty data arrays, missing DOM elements.

Usage:
    python3 scripts/validate_chart.py output/chart.html
    python3 scripts/validate_chart.py output/*.html        # batch validate

Exit code 0 = all checks pass, 1 = one or more failures.
"""

import re
import sys
from pathlib import Path


CHECKS = []


def check(name):
    """Decorator to register a validation check."""
    def decorator(fn):
        CHECKS.append((name, fn))
        return fn
    return decorator


@check("No malformed script closing tags")
def check_script_tags(html):
    bad = re.findall(r'<\\+/script>', html)
    if bad:
        return f"Found malformed </script> tag(s): {bad}"
    return None


@check("Chart.js CDN present and well-formed")
def check_chartjs_cdn(html):
    pattern = r'<script\s+src="https://cdn\.jsdelivr\.net/npm/chart\.js@[^"]+"></script>'
    if not re.search(pattern, html):
        return "Chart.js CDN script tag not found or malformed"
    return None


@check("Embedded data array exists with >0 points")
def check_data_present(html):
    match = re.search(r'const ALL_SERIES\s*=\s*\[', html)
    if not match:
        return "ALL_SERIES data array not found in script"
    # Check it's not empty — look for at least one [date, value] pair
    data_match = re.search(r'const ALL_SERIES\s*=\s*\[(.*?)\];', html, re.DOTALL)
    if data_match and '"data": []' in data_match.group(1):
        return "ALL_SERIES contains an empty data array"
    return None


@check("Canvas element present")
def check_canvas(html):
    if not re.search(r'<canvas\s+id="[^"]*_canvas"', html):
        return "Canvas element with expected ID pattern not found"
    return None


@check("Stats elements present")
def check_stats(html):
    required = ["statCurrent", "statHigh", "statLow", "statAvg", "statChange"]
    missing = [s for s in required if f'_{s}"' not in html]
    if missing:
        return f"Missing stat elements: {missing}"
    return None


@check("Control buttons present")
def check_controls(html):
    required = ["typeLine", "typeBar", "typeArea", "range1Y", "rangeMax"]
    missing = [c for c in required if f'_{c}"' not in html]
    if missing:
        return f"Missing control elements: {missing}"
    return None


@check("No empty script blocks")
def check_empty_scripts(html):
    empty = re.findall(r'<script[^>]*>\s*</script>', html)
    # Filter out external scripts (src=) and config containers (id=)
    bad = [s for s in empty if 'id=' not in s and 'src=' not in s]
    if bad:
        return f"Found {len(bad)} empty <script> block(s) without src or id attributes"
    return None


def validate(filepath):
    """Run all checks on a single HTML file. Returns list of (check_name, error_msg)."""
    html = Path(filepath).read_text(encoding="utf-8")
    failures = []
    for name, fn in CHECKS:
        result = fn(html)
        if result:
            failures.append((name, result))
    return failures


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 validate_chart.py <file.html> [file2.html ...]", file=sys.stderr)
        sys.exit(1)

    files = sys.argv[1:]
    all_passed = True

    for filepath in files:
        path = Path(filepath)
        if not path.exists():
            print(f"SKIP  {filepath} (file not found)")
            continue

        failures = validate(filepath)

        if failures:
            all_passed = False
            print(f"FAIL  {filepath}")
            for name, msg in failures:
                print(f"  ✗ {name}: {msg}")
        else:
            print(f"PASS  {filepath} ({len(CHECKS)} checks)")

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
