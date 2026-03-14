# Source Type Detection

How source-skill classifies URLs and handles each type.

---

## Classification Cascade

Detection runs in order — first match wins:

1. **Direct file** — URL path ends in a known file extension (`.xls`, `.xlsx`, `.csv`, `.pdf`, `.json`, `.zip`)
2. **Docs site** — URL matches known doc platform patterns:
   - Subdomains: `docs.*`, `developer.*`, `devdocs.*`
   - Paths: `/docs/`, `/documentation/`, `/guide/`, `/reference/`
   - Platforms: ReadTheDocs, GitBook, Mintlify, Docusaurus, Stripe docs
3. **API endpoint** — URL contains `/api/`, `/v1/`, `/v2/`, `/v3/`, or HTTP HEAD returns `application/json`
4. **Page with links** — HTML page containing download links (anchors with file-extension hrefs)
5. **Unknown** — none of the above matched

Override detection with `--type <type>` on the CLI.

---

## Per-Type Handling

### docs-site

Delegates to `doc-to-skill` for the full crawl/preprocess/generate pipeline. source-skill prints delegation instructions and exits — doc-to-skill handles everything including its own state file.

**Monitor strategy**: `docs-crawl` (via doc-to-skill's `modifiedSince` crawl)

### page-with-links

The core source-skill use case. Fetches the HTML page, extracts all download links, downloads the target file, converts it to text, and generates a skill.

**Example**: EIA 860M page → find XLS link → download → parse spreadsheet → generate dashboard skill

**Monitor strategy**: `page-diff` — re-fetch the page, compare link URLs against stored baseline. When a new file appears (e.g., `january_generator2027.xlsx` replaces `december_generator2026.xlsx`), the skill is flagged for refresh.

**CLI options**:
- `--link-pattern <regex>` — filter download links (e.g., `\.xlsx?$` for Excel only)

### direct-file

URL points directly to a downloadable file. Download it, convert to text, generate skill.

**Monitor strategy**: `http-head` — check `ETag` and `Last-Modified` headers. Cheap (no download needed for change detection).

### api-endpoint

URL returns JSON data. Fetch the response, generate a skill that knows how to query and process this API.

**Monitor strategy**: `api-hash` — fetch response, compare SHA-256 hash of content.

### unknown

Source type could not be determined. Build will fail unless `--type` is specified manually.

---

## Change Detection Cost

| Strategy | Network cost | When to use |
|---|---|---|
| `http-head` | 1 HEAD request | Direct files with ETag/Last-Modified support |
| `page-diff` | 1 GET request | Pages where link URLs change with updates |
| `api-hash` | 1 GET request | API endpoints with changing response data |
| `docs-crawl` | Cloudflare crawl | Large docs sites (delegates to doc-to-skill) |

All strategies except `docs-crawl` are free (no external service costs).
