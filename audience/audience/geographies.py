"""The geographies lookup: every geo_code in norms, named from the Census files already
cached for the ACS and CVAP loaders. python -m audience.geographies rebuilds it; load.py
rebuilds it after every loader run.

Names are the Census NAME / geoname strings, e.g. "Boston city, Suffolk County,
Massachusetts". The CVAP release covers every state, county, county subdivision and block
group in the country, so states other than Massachusetts (the poll and ballot-result rows)
are named from it too; the ACS responses are the fallback.

parent_code: STATE -> US; COUNTY -> its state; TOWN (county subdivision) -> its county;
BLOCKGROUP -> its county (block groups nest in tracts and counties, not always in towns).
"""

from __future__ import annotations

import json
import sys

from . import config
from .db import Store, connect

CVAP_PREFIXES = ("cvap_nation", "cvap_state", "cvap_county", "cvap_mcd", "cvap_blockgr")
COLUMNS = ("geo_code", "name", "level", "parent_code")


def _geo_code(geo_id: str) -> str:
    return geo_id.split("US", 1)[1] or "US"


def census_names() -> dict[str, str]:
    """geo_code -> Census name, from the cached CVAP parquet and ACS responses."""
    import duckdb

    names: dict[str, str] = {}
    for path in sorted((config.RAW / "acs").glob("*/*.json")):
        if path.name == "groups.json":
            continue
        data = json.loads(path.read_text())
        header = data[0]
        i_name, i_geo = header.index("NAME"), header.index("GEO_ID")
        for row in data[1:]:
            names.setdefault(_geo_code(row[i_geo]), row[i_name])
    con = duckdb.connect()
    for prefix in CVAP_PREFIXES:
        files = config.RAW / "cvap" / prefix
        if not any(files.glob("*.parquet")):
            continue
        for geoid, geoname in con.execute(
                f"SELECT DISTINCT geoid, geoname FROM read_parquet('{files}/*.parquet')").fetchall():
            names[_geo_code(geoid)] = geoname   # CVAP wins: it covers every level and state
    con.close()
    return names


def parent(level: str, code: str) -> str | None:
    return {"US": None, "STATE": "US", "COUNTY": code[:2], "TOWN": code[:5],
            "BLOCKGROUP": code[:5]}[level]


def refresh(store: Store, quiet: bool = False) -> tuple[int, list[str]]:
    """Rebuild the table for every geo_code in norms. Returns (rows, codes left unnamed)."""
    pairs = store.query("SELECT DISTINCT geography, geo_code FROM norms")
    levels: dict[str, str] = {}
    for level, code in pairs:
        if levels.setdefault(code, level) != level:
            raise RuntimeError(f"geo_code {code} appears as {levels[code]} and {level}")
    names = census_names() if levels else {}
    rows, unnamed = [], []
    for code, level in sorted(levels.items()):
        name = names.get(code)
        if name is None:
            unnamed.append(code)
            continue
        rows.append((code, name, level, parent(level, code)))
    store.replace_rows("geographies", COLUMNS, rows)
    if not quiet:
        print(f"geographies: {len(rows)} named"
              + (f"; no Census name for {', '.join(unnamed)}" if unnamed else ""))
    return len(rows), unnamed


def main() -> int:
    from . import migrate

    store = connect()
    try:
        migrate.apply(store, quiet=True)
        _, unnamed = refresh(store)
    finally:
        store.close()
    return 1 if unnamed else 0


if __name__ == "__main__":
    sys.exit(main())
