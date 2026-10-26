"""PAX's own message-test waves, from audience/seed/pax_waves.csv (supplied by the lead).

Expected columns (header names compared after lowercasing and dropping non-letters):
  arm             the tested cut (the response_option of its rows)
  outcome         the outcome measured, e.g. support, comprehension, vote_choice
  subgroup        "all", or "<dim>=<value>" / "<dim>: <value>", or a bare value (dim "subgroup")
  level           the arm's outcome level, percent
  lift            the arm's lift over placebo, percentage points
  sig             the significance flag as the readout states it (kept in the note)
  weighted_n      the arm's weighted n
  placebo_level   the placebo's level of the same outcome and subgroup, percent
Optional: wave, period_start, period_end (or date), geo_code, se, provenance_url, note.

Each CSV row writes a lift row (estimate_type lift_pp) and a level row (pct) under
lift_<outcome>, with response_option = arm; each outcome x subgroup also gets one level row
for "Placebo". Outcomes named like the lift dataset's (favorability, vote_choice) share its
constructs, so get_lift_benchmark pools them; any other outcome gets its own lift_<outcome>
construct and concordance row. Without period columns the period is the file's modification
date, and the note says so. No seed file: a note, exit 0, nothing written.
"""

from __future__ import annotations

import csv
import datetime as dt
import re
from pathlib import Path

from .. import config
from ..constructs import CONSTRUCTS
from ..db import Store
from .. import survey

SOURCE = "PAX_TEST"
SOURCE_VERSION = "PAX test waves (seed/pax_waves.csv)"
SEED_URL = "https://github.com/nyd-user-1/pax-trinity/blob/main/audience/seed/pax_waves.csv"
REQUIRED = ("arm", "outcome", "subgroup", "level", "lift", "sig", "weightedn", "placebolevel")
OUTCOME_ALIASES = {"votechoice": "vote_choice", "vote": "vote_choice", "favorable": "favorability"}


def seed_path(seed: Path | None = None) -> Path:
    return Path(seed) if seed is not None else config.ROOT / "seed" / "pax_waves.csv"


def _key(h: str) -> str:
    return re.sub(r"[^a-z]", "", h.lower())


def _slug(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", s.strip().lower()).strip("_")
    return OUTCOME_ALIASES.get(s.replace("_", ""), s)


def construct_for(outcome: str) -> str:
    return f"lift_{_slug(outcome)}"


def split_subgroup(raw: str) -> tuple[str, str]:
    raw = (raw or "").strip()
    if raw.lower() in ("", "all", "overall", "total"):
        return "all", "all"
    m = re.match(r"^\s*([^=:]+?)\s*[=:]\s*(.+?)\s*$", raw)
    if m:
        return m.group(1).strip().lower().replace(" ", "_"), m.group(2).strip()
    return "subgroup", raw


def _num(v: str) -> float | None:
    v = (v or "").strip().replace("%", "").replace("+", "")
    if v == "":
        return None
    return float(v)


def _date(v: str) -> dt.date | None:
    v = (v or "").strip()
    return dt.date.fromisoformat(v[:10]) if v else None


def read_seed(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        header = {_key(h): h for h in reader.fieldnames or []}
        missing = [c for c in REQUIRED if c not in header]
        if missing:
            raise ValueError(f"{path.name}: missing columns {missing}; found {reader.fieldnames}")
        return [{k: rec.get(orig, "") for k, orig in header.items()} for rec in reader]


def geography_of(geo_code: str) -> str:
    return {2: "STATE", 5: "COUNTY", 10: "TOWN", 12: "BLOCKGROUP"}.get(len(geo_code), "US") \
        if geo_code != "US" else "US"


def _period(rec: dict, fallback: dt.date) -> tuple[dt.date, dt.date, bool]:
    start = _date(rec.get("periodstart") or rec.get("date") or "")
    end = _date(rec.get("periodend") or rec.get("date") or "") or start
    if start is None:
        return fallback, fallback, False
    return start, end, True


def _cell(rec: dict, fallback: dt.date) -> tuple:
    start, end, _ = _period(rec, fallback)
    return (construct_for(rec["outcome"]), (rec.get("geocode") or "US").strip() or "US",
            rec["subgroup"].strip().lower(), start, end)


def build_rows(records: list[dict], path: Path) -> tuple[list[dict], set[str]]:
    mtime = dt.date.fromtimestamp(path.stat().st_mtime)
    rows: list[dict] = []
    constructs: set[str] = set()
    # An arm named "placebo" carries its own level row; don't add a second one for it.
    placebo_done: set[tuple] = {_cell(r, mtime) for r in records
                                 if r["arm"].strip().lower() == "placebo"}
    for rec in records:
        lift = _num(rec["lift"])
        if lift is None:
            raise ValueError(f"row without a lift value: {rec}")
        start, end, dated = _period(rec, mtime)
        construct = construct_for(rec["outcome"])
        constructs.add(construct)
        dim, value = split_subgroup(rec["subgroup"])
        wn = _num(rec["weightedn"])
        se = _num(rec.get("se", ""))
        wave = (rec.get("wave") or "").strip()
        note = (f"United States. PAX message test{f' wave {wave}' if wave else ''}: arm "
                f"{rec['arm']}, outcome {rec['outcome']}, subgroup {rec['subgroup'] or 'all'}; "
                f"lift is the arm's level minus the placebo's, in percentage points; "
                f"significance as read out: {rec['sig'] or 'not stated'}. n is the weighted n"
                + ("" if dated else f"; no fielding date in the seed, so the period is the "
                                    f"file's modification date {mtime.isoformat()}")
                + (f". {rec['note'].strip()}" if (rec.get("note") or "").strip() else "") + ".")
        geo_code = (rec.get("geocode") or "US").strip() or "US"
        base = dict(
            source=SOURCE, source_version=SOURCE_VERSION, geography=geography_of(geo_code),
            geo_code=geo_code,
            period_start=start, period_end=end, construct=construct,
            item_text=f"PAX test outcome: {rec['outcome'].strip()}",
            subgroup_dim=dim, subgroup_value=value, weight_var="weighted",
            provenance_url=(rec.get("provenanceurl") or "").strip() or SEED_URL,
            provenance_note=note, n=None if wn is None else int(round(wn)),
        )
        rows.append(dict(base, response_option=rec["arm"].strip(), estimate=lift,
                         estimate_type="lift_pp", se=se,
                         moe=None if se is None else round(1.645 * se, 6)))
        level = _num(rec["level"])
        if level is not None:
            rows.append(dict(base, response_option=rec["arm"].strip(), estimate=level,
                             estimate_type="pct", se=None, moe=None))
        placebo = _num(rec["placebolevel"])
        key = _cell(rec, mtime)
        if placebo is not None and key not in placebo_done:
            placebo_done.add(key)
            rows.append(dict(base, response_option="Placebo", estimate=placebo,
                             estimate_type="pct", se=None, moe=None, n=None))
    return rows, constructs


def write_concordance(store: Store, constructs: set[str]) -> None:
    for construct in sorted(constructs):
        if construct in CONSTRUCTS:
            label, definition = CONSTRUCTS[construct]
        else:
            outcome = construct.removeprefix("lift_").replace("_", " ")
            label = f"Lift: {outcome}"
            definition = (f"Effect of a tested cut on {outcome}, arm minus placebo, in "
                          f"percentage points.")
        survey.merge_concordance(
            store, construct, label, definition,
            note="PAX_TEST: PAX's own randomized message tests, each arm against its placebo.")


def run(store: Store, refresh: bool = False, seed: Path | None = None,
        allow_synthetic: bool = False) -> int:
    path = seed_path(seed)
    if not path.exists():
        print(f"No PAX waves seed at {path}; the lead supplies it. Nothing to load, no rows "
              f"were written.")
        return 0
    survey.refuse_synthetic([path], allow_synthetic)
    rows, constructs = build_rows(read_seed(path), path)
    write_concordance(store, constructs)
    written = store.upsert_norms(rows, prune=(SOURCE, SOURCE_VERSION))
    store.touch_source(SOURCE)
    print(f"{SOURCE_VERSION}: {written} rows, constructs {', '.join(sorted(constructs))}")
    return written
