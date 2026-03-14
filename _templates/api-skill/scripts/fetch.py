#!/usr/bin/env python3
"""
scripts/fetch.py — API-specific fetch wrapper
Wraps _shared/scripts/fetch.py with this skill's auth and URL patterns.

Usage:
    python3 scripts/fetch.py --endpoint "/endpoint" --params "key=value"
"""

import argparse
import json
import sys
from pathlib import Path

# Wire in shared utilities from project root
ROOT = Path(__file__).parents[3]  # skills/_templates/api-skill/scripts → skills/
sys.path.insert(0, str(ROOT))

from _shared.scripts.env import load_env, require_key
from _shared.scripts.fetch import fetch_paginated, fetch_json

# ── Configure for your API ─────────────────────────────────────
BASE_URL      = "https://api.example.com"
KEY_ENV_VAR   = "MY_API_KEY"          # key name in .env
KEY_PARAM     = "api_key"             # how the key is passed (param or header)
KEY_IN_HEADER = False                 # True if key goes in Authorization header
DATA_KEY      = "data"                # key in response holding rows
TOTAL_KEY     = "total"               # key in response holding total count
# ──────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--params", default="")
    parser.add_argument("--raw", action="store_true")
    parser.add_argument("--max-rows", type=int, default=5000)
    args = parser.parse_args()

    load_env()
    api_key = require_key(
        KEY_ENV_VAR,
        hint="Get a key at https://api.example.com/register"
    )

    # Build params
    params = {}
    if args.params:
        for part in args.params.split("&"):
            if "=" in part:
                k, _, v = part.partition("=")
                if k in params:
                    existing = params[k]
                    params[k] = (existing if isinstance(existing, list) else [existing]) + [v]
                else:
                    params[k] = v

    # Inject auth
    headers = {}
    if KEY_IN_HEADER:
        headers["Authorization"] = f"Bearer {api_key}"
    else:
        params[KEY_PARAM] = api_key

    url = f"{BASE_URL}{args.endpoint}"

    rows = fetch_paginated(
        url=url,
        params=params,
        headers=headers,
        data_key=DATA_KEY,
        total_key=TOTAL_KEY,
        max_rows=args.max_rows,
    )

    if args.raw:
        print(json.dumps(rows, indent=2))
        return

    # Normalize to [[label, value], ...] — adapt field names for your API
    normalized = []
    for row in rows:
        label = row.get("period") or row.get("date") or row.get("name", "")
        value = row.get("value") or row.get("data") or None
        if label and value is not None:
            try:
                normalized.append([label, float(value)])
            except (ValueError, TypeError):
                continue

    normalized.sort(key=lambda x: x[0])

    output = {
        "endpoint": args.endpoint,
        "total_rows": len(normalized),
        "data": normalized,
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
