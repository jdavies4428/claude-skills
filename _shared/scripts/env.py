"""
_shared/scripts/env.py
Shared .env loader and API key validator for all skills.

Usage:
    from pathlib import Path
    import sys
    sys.path.insert(0, str(Path(__file__).parents[2]))  # project root
    from _shared.scripts.env import require_key, load_env

    load_env()
    api_key = require_key("EIA_API_KEY", hint="Get one at https://www.eia.gov/opendata/")
"""

import os
import sys
from pathlib import Path


def load_env(env_file: str = None):
    """
    Load .env from the skills root directory.
    Walks up from the calling script to find the root .env file.
    """
    if env_file:
        env_path = Path(env_file)
    else:
        # Find .env by walking up to skills root
        current = Path(__file__).resolve()
        env_path = None
        for parent in current.parents:
            candidate = parent / ".env"
            if candidate.exists():
                env_path = candidate
                break

    if not env_path or not env_path.exists():
        return  # No .env found — rely on system env vars

    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def require_key(key_name: str, hint: str = "") -> str:
    """
    Get an env var or exit with a clear error message.

    Args:
        key_name: The environment variable name e.g. "EIA_API_KEY"
        hint:     Optional URL or instruction for getting the key

    Returns:
        The key value as a string
    """
    value = os.environ.get(key_name)
    if not value:
        lines = [
            f"",
            f"  ERROR: {key_name} is not set.",
            f"",
            f"  Set it in your .env file:",
            f"    {key_name}=your_key_here",
            f"",
            f"  Or export it in your shell:",
            f"    export {key_name}=your_key_here",
        ]
        if hint:
            lines.append(f"")
            lines.append(f"  {hint}")
        lines.append(f"")
        print("\n".join(lines))
        sys.exit(1)
    return value


def get_key(key_name: str, default: str = None) -> str:
    """
    Get an env var with an optional default. Does not exit on missing.
    """
    return os.environ.get(key_name, default)
