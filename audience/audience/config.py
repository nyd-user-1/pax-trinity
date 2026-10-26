"""Paths and environment. Everything resolves relative to the audience/ directory."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]  # audience/
RAW = ROOT / "raw"
STORE_DIR = ROOT / "store"
DEFAULT_DUCKDB = STORE_DIR / "norms.duckdb"
MIGRATIONS = Path(__file__).resolve().parent / "migrations"

# Values already in the process environment win over audience/.env.
load_dotenv(ROOT / ".env", override=False)


def env(name: str) -> str | None:
    value = os.environ.get(name, "").strip().strip('"').strip("'")
    return value or None
