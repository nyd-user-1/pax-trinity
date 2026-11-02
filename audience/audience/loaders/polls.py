"""Poll toplines and ballot-measure results from audience/seed/open_primary_polls.csv.

The seed is the lead's: its values are loaded as given, never re-derived. Its columns map
1:1 onto norms. An empty n or moe stays NULL; se = moe / 1.645 when moe is present; an empty
subgroup_value on a subgroup_dim 'all' row is the store's 'all'. A row missing
provenance_url, or with any other required field empty, is rejected and named; the rest load.

Each (source, source_version) in the seed is one slice, pruned on rerun. A slice that leaves
the seed is deleted too, except slices other loaders own: the AP-NORC microdata, the MA town
returns (loaders/ma_results.py), every VoteHub poll (loaders/votehub.py), Pew's series
(loaders/pew.py) and the pollsters' repeated questions (loaders/releases.py).
"""

from __future__ import annotations

import csv
import datetime as dt
from pathlib import Path

from .. import config
from ..db import Store
from ..moe import Z90

SOURCE = "POLL"  # the audit's loader map; this loader also writes ELECTION_RESULT
SOURCES = ("POLL", "ELECTION_RESULT")
SEED = config.ROOT / "seed" / "open_primary_polls.csv"
COLUMNS = (
    "source", "source_version", "geography", "geo_code", "period_start", "period_end",
    "construct", "item_text", "response_option", "subgroup_dim", "subgroup_value", "estimate",
    "estimate_type", "n", "moe", "provenance_url", "provenance_note",
)
REQUIRED = ("source", "source_version", "geography", "geo_code", "period_start", "period_end",
            "construct", "response_option", "subgroup_dim", "estimate", "estimate_type",
            "provenance_url")


def owned_elsewhere(source: str, version: str) -> bool:
    """A POLL slice another loader writes, which this one never prunes."""
    from . import apnorc, ma_results, votehub

    from . import pew, releases

    return ((source, version) == (apnorc.SOURCE, apnorc.SOURCE_VERSION)
            or (source == ma_results.SOURCE
                and version in {ma_results.source_version(e) for e in ma_results.ELECTIONS})
            or (source == votehub.SOURCE and votehub.owns(version))
            or (source == pew.SOURCE and pew.owns(version))
            or (source == releases.SOURCE and releases.owns(version)))


# The POLL source's description, one text for every loader that writes POLL rows.
POLL_SOURCE = dict(
    name="Published public-opinion polls: toplines and crosstabs from pollsters' releases, every "
         "public poll VoteHub compiles, Pew Research Center's published trends, and the AP-NORC "
         "May 2016 public-use file",
    url="https://votehub.com/polls/api/",
    license="Toplines are quoted from each publisher's release, and rights stay with the publisher. "
            "VoteHub's compilation is CC BY 4.0 (credit: VoteHub, https://votehub.com/polls/). "
            "Pew Research Center's figures are used under its terms of use, with credit. "
            "The AP-NORC public-use file is posted for public use; its codebook states no license.",
    access_notes="The open-primaries toplines from audience/seed/open_primary_polls.csv; VoteHub's "
                 "public API (no key), cached in raw/votehub/; Pew's pages and topline PDFs, cached in "
                 "raw/pew/; pollsters' releases as govblock's release reader parsed them (2026-09-25), "
                 "copied to s3://pax-trinity-audience-613473203863/raw/polls/releases/; "
                 "the AP-NORC zip, downloaded once into "
                 "raw/apnorc/. Every row carries its publisher's URL in provenance_url.",
)


def prune_owned(store: Store, source: str, prefix: str, rows: list[dict]) -> int:
    """Delete the rows of a loader's slices (source_version starting with prefix) that its
    latest batch did not write, so a changed or vanished poll leaves nothing stale. Returns
    the rows deleted."""
    from ..db import natural_key

    keep = {natural_key(r) for r in rows}
    stale = [k for (k,) in store.query(
        "SELECT natural_key FROM norms WHERE source = ? AND source_version LIKE ?",
        [source, f"{prefix}%"]) if k not in keep]
    with store.transaction():
        for i in range(0, len(stale), 500):
            part = stale[i:i + 500]
            store.execute(f"DELETE FROM norms WHERE natural_key IN ({', '.join('?' for _ in part)})",
                          part)
    return len(stale)


def describe(store: Store) -> None:
    store.execute("UPDATE sources SET name = ?, url = ?, license = ?, access_notes = ? "
                  "WHERE source = 'POLL'",
                  [POLL_SOURCE[k] for k in ("name", "url", "license", "access_notes")])


def read_seed(path: Path = SEED) -> tuple[list[dict], list[str]]:
    """Rows mapped onto norms, and a message for each rejected CSV line."""
    rows, rejected = [], []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if tuple(reader.fieldnames or ()) != COLUMNS:
            raise ValueError(f"{path.name}: header {reader.fieldnames} != {list(COLUMNS)}")
        for line, raw in enumerate(reader, start=2):
            r = {k: (v.strip() if isinstance(v, str) else v) for k, v in raw.items()}
            empty = [c for c in REQUIRED if not r.get(c)]
            if r.get("subgroup_dim") and r["subgroup_dim"] != "all" and not r.get("subgroup_value"):
                empty.append("subgroup_value")
            if r.get("source") and r["source"] not in SOURCES:
                rejected.append(f"line {line}: source {r['source']!r} is not one of {SOURCES}")
                continue
            if empty:
                rejected.append(f"line {line}: empty {', '.join(empty)}")
                continue
            moe = float(r["moe"]) if r["moe"] else None
            rows.append(dict(
                source=r["source"], source_version=r["source_version"],
                geography=r["geography"], geo_code=r["geo_code"],
                period_start=dt.date.fromisoformat(r["period_start"]),
                period_end=dt.date.fromisoformat(r["period_end"]),
                construct=r["construct"], item_text=r["item_text"] or None,
                response_option=r["response_option"], subgroup_dim=r["subgroup_dim"],
                subgroup_value=r["subgroup_value"] or "all",
                estimate=float(r["estimate"]), estimate_type=r["estimate_type"],
                n=int(r["n"]) if r["n"] else None,
                moe=moe, se=None if moe is None else moe / Z90,
                weight_var=None, provenance_url=r["provenance_url"],
                provenance_note=r["provenance_note"] or None,
            ))
    return rows, rejected


def run(store: Store, refresh: bool = False, seed: Path | None = None) -> int:
    path = Path(seed) if seed is not None else SEED
    if not path.exists():
        print(f"No seed at {path}; nothing to load.")
        return 0
    rows, rejected = read_seed(path)
    for msg in rejected:
        print(f"  rejected {msg}")
    slices: dict[tuple[str, str], list[dict]] = {}
    for r in rows:
        slices.setdefault((r["source"], r["source_version"]), []).append(r)
    total = 0
    for key, batch in sorted(slices.items()):
        total += store.upsert_norms(batch, prune=key)
    keep = set(slices)
    stale = [(s, v) for s, v in store.query(
        "SELECT DISTINCT source, source_version FROM norms WHERE source IN (?, ?)", list(SOURCES))
        if (s, v) not in keep and not owned_elsewhere(s, v)]
    for s, v in stale:
        store.execute("DELETE FROM norms WHERE source = ? AND source_version = ?", [s, v])
        print(f"  removed {s} / {v}: no longer in the seed")
    for source in {k[0] for k in slices}:
        store.touch_source(source)
    describe(store)
    by_source = {s: sum(len(b) for k, b in slices.items() if k[0] == s) for s in SOURCES}
    print(f"{path.name}: {total} rows ({', '.join(f'{s} {n}' for s, n in by_source.items())}) "
          f"in {len(slices)} polls and results; {len(rejected)} rejected")
    return total
