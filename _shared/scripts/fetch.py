"""
_shared/scripts/fetch.py
Base HTTP fetch utility with pagination, retries, and error handling.
Used by all API-connected skills.

Usage:
    from _shared.scripts.fetch import fetch_json, fetch_paginated

    # Single request
    data = fetch_json("https://api.example.com/data", params={"key": "value"})

    # Paginated (auto-fetches all pages)
    rows = fetch_paginated(
        url="https://api.eia.gov/v2/electricity/retail-sales",
        params={"api_key": key, "data[]": "price"},
        data_key="data",        # key in response that holds rows
        offset_param="offset",  # pagination param name
        length_param="length",  # page size param name
        page_size=500,
        max_rows=5000,
    )
"""

import json
import time
import urllib.request
import urllib.parse
import urllib.error
from typing import Any, Optional


def build_url(base_url: str, params: dict) -> str:
    """
    Build a URL with query params, handling list values (array-style params).
    e.g. {"data[]": ["price", "sales"]} → ?data[]=price&data[]=sales
    """
    parts = []
    for k, v in params.items():
        if isinstance(v, list):
            for item in v:
                parts.append(
                    f"{urllib.parse.quote(str(k))}={urllib.parse.quote(str(item))}"
                )
        else:
            parts.append(
                f"{urllib.parse.quote(str(k))}={urllib.parse.quote(str(v))}"
            )
    query = "&".join(parts)
    return f"{base_url}?{query}" if query else base_url


def fetch_json(
    url: str,
    params: dict = None,
    headers: dict = None,
    timeout: int = 15,
    retries: int = 3,
    retry_delay: float = 1.5,
) -> Any:
    """
    Fetch a URL and return parsed JSON. Retries on transient errors.
    """
    full_url = build_url(url, params or {})
    req = urllib.request.Request(full_url, headers=headers or {})

    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(retry_delay * (attempt + 1))
                continue
            body = ""
            try:
                body = e.read().decode("utf-8")[:300]
            except Exception:
                pass
            raise RuntimeError(
                f"HTTP {e.code} from {url}\n{body}"
            ) from e
        except urllib.error.URLError as e:
            if attempt < retries - 1:
                time.sleep(retry_delay)
                continue
            raise RuntimeError(f"Network error: {e.reason}") from e

    raise RuntimeError(f"Failed after {retries} retries: {url}")


def fetch_paginated(
    url: str,
    params: dict = None,
    data_key: str = "data",
    total_key: str = "total",
    offset_param: str = "offset",
    length_param: str = "length",
    page_size: int = 500,
    max_rows: int = 5000,
    response_wrapper: str = "response",
    headers: dict = None,
) -> list:
    """
    Fetch all pages of a paginated API and return combined rows.

    Args:
        url:              Base endpoint URL
        params:           Query params (without pagination params)
        data_key:         Key in response body that holds the row array
        total_key:        Key that holds total record count
        offset_param:     Param name for page offset
        length_param:     Param name for page size
        page_size:        Records per request
        max_rows:         Hard limit on total rows fetched
        response_wrapper: Top-level key wrapping the response (or None)
        headers:          Optional request headers
    """
    all_rows = []
    offset = 0
    total = None
    base_params = dict(params or {})

    while True:
        page_params = {
            **base_params,
            offset_param: offset,
            length_param: page_size,
        }

        raw = fetch_json(url, params=page_params, headers=headers)

        # Unwrap response if needed
        body = raw.get(response_wrapper, raw) if response_wrapper else raw

        if total is None:
            total = int(body.get(total_key, 0))

        rows = body.get(data_key, [])
        if not rows:
            break

        all_rows.extend(rows)
        offset += page_size

        if offset >= total or len(all_rows) >= max_rows:
            break

    return all_rows[:max_rows]


def post_json(
    url: str,
    payload: dict,
    headers: dict = None,
    timeout: int = 30,
) -> Any:
    """
    POST JSON to a URL and return parsed JSON response.
    """
    body = json.dumps(payload).encode("utf-8")
    default_headers = {"Content-Type": "application/json"}
    if headers:
        default_headers.update(headers)

    req = urllib.request.Request(
        url, data=body, headers=default_headers, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))
