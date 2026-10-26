"""Export the store for the Next app: python -m audience.export

Writes public/audience-data/ at the repo root, committed with the app:

  index.json   {sources: [{source, label, rows, file}],
                constructs: [{construct, label, definition}],
                geographies: [{code, name, level, parent}]}
  <source>.json   one per source (lowercased): an array of rows
                  [construct, geo_code, period_start, period_end, response_option,
                   subgroup_dim, subgroup_value, estimate, estimate_type, moe, item_text,
                   n, provenance_url]

The contract is fixed: the app's /audience page reads exactly this. BLOCKGROUP rows are left
out everywhere. Estimates and moe are rounded to 1 decimal, counts to whole numbers. item_text
is carried for POLL and ELECTION_RESULT rows only (null elsewhere). A topline row's
subgroup_dim and subgroup_value (the store's "all") are null, which the page shows as All.
Dates are ISO strings. n is the unweighted base (or the registered-voter base) where the store
has one, else null. Within a cell, response options run in the coded order response_order
records (the bulk tier's constructs), else alphabetically. A source file over
MAX_BYTES is split into <source>-2.json, <source>-3.json, ..., each listed in index.json as
its own entry. constructs lists those with exported rows; geographies lists US, STATE,
COUNTY and TOWN.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from . import config
from .db import Store, connect

OUT = config.ROOT.parent / "public" / "audience-data"
MAX_BYTES = 4_000_000
ITEM_TEXT_SOURCES = ("POLL", "ELECTION_RESULT")
LEVELS = ("US", "STATE", "COUNTY", "TOWN")
ROW_FIELDS = ("construct", "geo_code", "period_start", "period_end", "response_option",
              "subgroup_dim", "subgroup_value", "estimate", "estimate_type", "moe", "item_text",
              "n", "provenance_url")


def _round(value, estimate_type: str):
    if value is None:
        return None
    v = float(value)
    if estimate_type == "count":
        return int(round(v))
    r = round(v, 1)
    return 0.0 if r == 0 else r   # no -0.0


def source_rows(store: Store, source: str) -> list[list]:
    # A construct's response options follow their coded order where response_order records
    # one (the bulk tier), else the alphabet.
    ordered = store.table_exists("response_order")
    join = ("LEFT JOIN response_order o ON o.source = n.source AND o.construct = n.construct "
            "AND o.response_option = n.response_option " if ordered else "")
    rows = store.query(
        "SELECT n.construct, n.geo_code, n.period_start, n.period_end, n.response_option, "
        "n.subgroup_dim, n.subgroup_value, n.estimate, n.estimate_type, n.moe, n.item_text, n.n, "
        f"n.provenance_url FROM norms n {join}"
        "WHERE n.source = ? AND n.geography <> 'BLOCKGROUP' "
        "ORDER BY n.construct, n.geo_code, n.period_start, n.period_end, n.item_text, "
        "n.subgroup_dim, n.subgroup_value, "
        f"{'o.ordinal NULLS LAST, ' if ordered else ''}n.response_option, n.estimate_type",
        [source])
    keep_text = source in ITEM_TEXT_SOURCES
    out = []
    for (construct, geo, start, end, option, dim, value, est, etype, moe, text, n, url) in rows:
        if dim == "all":
            dim = value = None
        out.append([construct, geo, start.isoformat(), end.isoformat(), option, dim, value,
                    _round(est, etype), etype, _round(moe, etype),
                    text if keep_text else None, None if n is None else int(n), url])
    return out


def _chunks(lines: list[str]) -> list[list[str]]:
    """Split serialized rows so no file passes MAX_BYTES."""
    chunks, current, size = [], [], 4  # "[\n" + "\n]"
    for line in lines:
        n = len(line.encode("utf-8")) + 2
        if current and size + n > MAX_BYTES:
            chunks.append(current)
            current, size = [], 4
        current.append(line)
        size += n
    chunks.append(current)
    return chunks


def _write_array(path: Path, lines: list[str]) -> None:
    path.write_text("[\n" + ",\n".join(lines) + "\n]\n", encoding="utf-8")


def export(store: Store, out: Path = OUT) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    labels = dict(store.query("SELECT source, name FROM sources"))
    sources = [r[0] for r in store.query(
        "SELECT DISTINCT source FROM norms WHERE geography <> 'BLOCKGROUP' ORDER BY 1")]
    written: set[str] = {"index.json"}
    index_sources = []
    for source in sources:
        rows = source_rows(store, source)
        lines = [json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows]
        stem = source.lower()
        for i, chunk in enumerate(_chunks(lines), start=1):
            name = f"{stem}.json" if i == 1 else f"{stem}-{i}.json"
            _write_array(out / name, chunk)
            written.add(name)
            index_sources.append({"source": source, "label": labels.get(source, source),
                                  "rows": len(chunk), "file": name})
    constructs = [
        {"construct": c, "label": label, "definition": definition}
        for c, label, definition in store.query(
            "SELECT construct, label, definition FROM concordance WHERE construct IN "
            "(SELECT DISTINCT construct FROM norms WHERE geography <> 'BLOCKGROUP') ORDER BY 1")]
    placeholders = ", ".join("?" for _ in LEVELS)
    level_order = {lvl: i for i, lvl in enumerate(LEVELS)}
    geos = sorted(
        ({"code": code, "name": name, "level": level, "parent": parent}
         for code, name, level, parent in store.query(
             f"SELECT geo_code, name, level, parent_code FROM geographies "
             f"WHERE level IN ({placeholders})", list(LEVELS))),
        key=lambda g: (level_order[g["level"]], g["code"]))
    index = {"sources": index_sources, "constructs": constructs, "geographies": geos}
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n",
                                    encoding="utf-8")
    for stale in out.glob("*.json"):
        if stale.name not in written:
            stale.unlink()
    return index


def main() -> int:
    store = connect()
    try:
        index = export(store)
    finally:
        store.close()
    for s in index["sources"]:
        size = (OUT / s["file"]).stat().st_size
        print(f"  {s['file']:<24}{s['rows']:>8,} rows  {size / 1e6:6.2f} MB")
    print(f"index.json: {len(index['sources'])} files, {len(index['constructs'])} constructs, "
          f"{len(index['geographies'])} geographies -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
