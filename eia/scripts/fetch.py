#!/usr/bin/env python3
"""
eia/scripts/fetch.py — EIA API fetch wrapper
Wraps _shared/scripts/fetch.py with EIA-specific auth and normalization.

Usage (CLI):
    python3 scripts/fetch.py --endpoint "/v2/electricity/retail-sales" \
                             --params "frequency=monthly&data[]=price"

Usage (import):
    from eia.scripts.fetch import fetch_data
    data = fetch_data("/v2/electricity/retail-sales", "frequency=monthly&data[]=price")
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]  # eia/scripts → skills/
sys.path.insert(0, str(ROOT))

from _shared.scripts.env import load_env, require_key
from _shared.scripts.fetch import fetch_paginated

BASE_URL = "https://api.eia.gov"
VALUE_FIELDS = ["value", "price", "sales", "generation", "nameplate-capacity-mw"]


def _parse_params(params_str, api_key):
    """Parse a query string into a dict, handling array params."""
    params = {"api_key": api_key}
    if params_str:
        for part in params_str.split("&"):
            if "=" in part:
                k, _, v = part.partition("=")
                if k in params:
                    existing = params[k]
                    params[k] = (existing if isinstance(existing, list) else [existing]) + [v]
                else:
                    params[k] = v
    return params


def fetch_data(endpoint, params_str="", max_rows=5000):
    """
    Fetch and normalize EIA data.

    Args:
        endpoint:    EIA API endpoint (e.g. "/v2/electricity/retail-sales")
        params_str:  Query params as string (e.g. "frequency=monthly&data[]=price")
        max_rows:    Maximum rows to fetch

    Returns:
        List of [date, value] pairs sorted by date.
    """
    load_env()
    api_key = require_key(
        "EIA_API_KEY",
        hint="Get a free key at: https://www.eia.gov/opendata/"
    )

    params = _parse_params(params_str, api_key)

    ep = endpoint.rstrip("/")
    if not ep.endswith("/data"):
        ep += "/data"

    rows = fetch_paginated(
        url=f"{BASE_URL}{ep}",
        params=params,
        data_key="data",
        total_key="total",
        response_wrapper="response",
        max_rows=max_rows,
    )

    normalized = []
    for row in rows:
        period = row.get("period", "")
        value = next((row[f] for f in VALUE_FIELDS if row.get(f) is not None), None)
        if period and value is not None:
            try:
                normalized.append([period, float(value)])
            except (ValueError, TypeError):
                continue

    normalized.sort(key=lambda x: x[0])
    return normalized


def fetch_data_with_meta(endpoint, params_str="", max_rows=5000):
    """Fetch data + metadata. Returns (data, meta) tuple.

    meta = {"units": "cents per kilowatt-hour", "description": "..."}

    The EIA API response includes unit info in each row (e.g.,
    ``"price-units": "cents per kilowatt-hour"``).  This function extracts
    the first ``*-units`` field from the first row and surfaces it in the
    returned meta dict.
    """
    load_env()
    api_key = require_key(
        "EIA_API_KEY",
        hint="Get a free key at: https://www.eia.gov/opendata/"
    )

    params = _parse_params(params_str, api_key)

    ep = endpoint.rstrip("/")
    if not ep.endswith("/data"):
        ep += "/data"

    rows = fetch_paginated(
        url=f"{BASE_URL}{ep}",
        params=params,
        data_key="data",
        total_key="total",
        response_wrapper="response",
        max_rows=max_rows,
    )

    # Extract units from the first row
    meta = {"units": "", "description": ""}
    if rows:
        first_row = rows[0]
        for key, val in first_row.items():
            if key.endswith("-units") and val:
                meta["units"] = str(val)
                break

    normalized = []
    for row in rows:
        period = row.get("period", "")
        value = next((row[f] for f in VALUE_FIELDS if row.get(f) is not None), None)
        if period and value is not None:
            try:
                normalized.append([period, float(value)])
            except (ValueError, TypeError):
                continue

    normalized.sort(key=lambda x: x[0])
    return normalized, meta


def fetch_raw(endpoint, params_str="", max_rows=5000):
    """Fetch raw (un-normalized) rows from the EIA API."""
    load_env()
    api_key = require_key(
        "EIA_API_KEY",
        hint="Get a free key at: https://www.eia.gov/opendata/"
    )

    params = _parse_params(params_str, api_key)

    ep = endpoint.rstrip("/")
    if not ep.endswith("/data"):
        ep += "/data"

    return fetch_paginated(
        url=f"{BASE_URL}{ep}",
        params=params,
        data_key="data",
        total_key="total",
        response_wrapper="response",
        max_rows=max_rows,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--params", default="")
    parser.add_argument("--raw", action="store_true")
    parser.add_argument("--max-rows", type=int, default=5000)
    args = parser.parse_args()

    if args.raw:
        rows = fetch_raw(args.endpoint, args.params, args.max_rows)
        print(json.dumps(rows, indent=2))
        return

    data = fetch_data(args.endpoint, args.params, args.max_rows)
    print(json.dumps({"endpoint": args.endpoint, "total_rows": len(data), "data": data}, indent=2))


if __name__ == "__main__":
    main()
