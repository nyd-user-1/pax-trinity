"""Massachusetts voter file: registered voters by party enrollment, statewide and by town.

Reads every *.csv under raw/ma_voterfile/ (comma, pipe or tab delimited; one statewide
file or one file per town). The party and town columns are found by name (PARTY_COLUMNS,
TOWN_COLUMNS below). Party codes: D Democratic, R Republican, U Unenrolled, L Libertarian;
any other code is a political designation and is pooled as "Other designation".

Towns are matched to their county-subdivision GEOID through the TOWN rows the ACS or CVAP
loader already wrote (the place name is the first sentence of their provenance_note), so
run one of those first. A town that matches nothing is counted statewide only and named
in the printed summary.

The snapshot date is read from the file name (YYYYMMDD or YYYY-MM-DD), else the file's
modification date. Each snapshot is its own source_version.

The file is not public: MGL c.51 s.47C limits the statewide list to candidates, committees
and other eligible requesters. When no file is present the loader prints how to request it.
"""

from __future__ import annotations

import csv
import datetime as dt
import re
from collections import Counter
from pathlib import Path

from .. import config
from ..constructs import CONSTRUCTS
from ..db import Store
from .. import survey

SOURCE = "VOTERFILE_MA"
ELECTIONS_URL = "https://www.sec.state.ma.us/divisions/elections/"
LAW_URL = "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVIII/Chapter51/Section47C"

PARTIES = {"D": "Democratic", "R": "Republican", "U": "Unenrolled", "L": "Libertarian"}
OTHER = "Other designation"
OPTIONS = (*PARTIES.values(), OTHER)

# Header names seen in MA voter-list layouts, compared after lowercasing and dropping
# everything but letters and digits.
PARTY_COLUMNS = ("party", "partyaffiliation", "partycode", "partyenrollment", "enrollment",
                 "partydesignation", "politicalparty")
TOWN_COLUMNS = ("town", "citytown", "citytownname", "towncity", "townname", "city",
                "municipality", "residentialcity", "rescity", "residentialtown",
                "residencecitytown")

INSTRUCTIONS = f"""\
No voter file is under {{raw}}/.
The Massachusetts statewide voter list is not a public record. Under MGL c.51 s.47C
the Elections Division of the Secretary of the Commonwealth provides it to candidates,
political committees and other eligible requesters, on written request and for a fee:

    {ELECTIONS_URL}
    {LAW_URL}

Save the file (or the per-town files) as CSV under audience/raw/ma_voterfile/, with a
party-enrollment column and a city/town column, then rerun:
python -m audience.load voterfile_ma
No rows were written."""


def _norm_header(h: str) -> str:
    return re.sub(r"[^a-z0-9]", "", h.lower())


def norm_town(name: str) -> str:
    """'Manchester-by-the-Sea town, Essex County, Massachusetts' and 'MANCHESTER BY THE
    SEA' both -> 'MANCHESTERBYTHESEA'."""
    name = name.split(",", 1)[0].strip()
    name = re.sub(r"\s+(Town city|city|town)$", "", name, flags=re.I)
    return re.sub(r"[^A-Z0-9]", "", name.upper())


def town_geoids(store: Store) -> dict[str, tuple[str, str]]:
    """normalized town name -> (GEOID, Census name), from the store's TOWN rows."""
    rows = store.query(
        "SELECT DISTINCT geo_code, provenance_note FROM norms "
        "WHERE geography = 'TOWN' AND source IN ('ACS', 'CVAP')")
    out: dict[str, tuple[str, str]] = {}
    for geo_code, note in rows:
        name = (note or "").split(". ", 1)[0]
        if name:
            out[norm_town(name)] = (geo_code, name)
    return out


def snapshot_date(path: Path) -> dt.date:
    m = re.search(r"(20\d\d)-?(\d\d)-?(\d\d)", path.name)
    if m:
        try:
            return dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass
    return dt.date.fromtimestamp(path.stat().st_mtime)


def _find(header: list[str], candidates) -> int | None:
    normed = [_norm_header(h) for h in header]
    for cand in candidates:
        if cand in normed:
            return normed.index(cand)
    return None


def count_file(path: Path) -> tuple[Counter, Counter]:
    """(statewide party counts, (town, party) counts) for one file."""
    with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
        sample = f.read(65536)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",|\t")
        except csv.Error:
            dialect = csv.excel
        reader = csv.reader(f, dialect)
        header = next(reader)
        p_idx, t_idx = _find(header, PARTY_COLUMNS), _find(header, TOWN_COLUMNS)
        if p_idx is None or t_idx is None:
            raise ValueError(
                f"{path.name}: need a party column (one of {PARTY_COLUMNS}) and a town column "
                f"(one of {TOWN_COLUMNS}) after normalizing headers; found {header}")
        state: Counter = Counter()
        towns: Counter = Counter()
        for rec in reader:
            if len(rec) <= max(p_idx, t_idx):
                continue
            party = PARTIES.get(rec[p_idx].strip().upper(), OTHER)
            town = rec[t_idx].strip()
            state[party] += 1
            towns[(town, party)] += 1
    return state, towns


def build_rows(state: Counter, towns: Counter, geoids: dict, snapshot: dt.date,
               files: list[Path]) -> tuple[list[dict], list[str]]:
    version = f"MA voter file {snapshot.isoformat()}"
    note = (f"Registered voters in the Massachusetts voter file ({', '.join(f.name for f in files)}), "
            f"snapshot {snapshot.isoformat()}. Party codes D, R, U, L; every other political "
            f"designation pooled as '{OTHER}'. pct is the share of the place's registered "
            f"voters. A full count, so no se or moe.")
    base = dict(source=SOURCE, source_version=version, period_start=snapshot,
                period_end=snapshot, construct="party_registration",
                item_text="Party enrollment or political designation on the voter record",
                subgroup_dim="all", subgroup_value="all", weight_var=None,
                provenance_url=ELECTIONS_URL, se=None, moe=None)

    def place_rows(geography, geo_code, place, counts: Counter):
        total = sum(counts.values())
        out = []
        for option in OPTIONS:
            c = counts.get(option, 0)
            cell = dict(base, geography=geography, geo_code=geo_code, response_option=option,
                        n=total, provenance_note=f"{place}. {note}")
            out.append(dict(cell, estimate_type="count", estimate=float(c)))
            out.append(dict(cell, estimate_type="pct", estimate=round(100 * c / total, 6)))
        return out

    rows = place_rows("STATE", "25", "Massachusetts", state)
    by_town: dict[str, Counter] = {}
    for (town, party), c in towns.items():
        by_town.setdefault(town, Counter())[party] += c
    merged: dict[str, Counter] = {}
    names: dict[str, str] = {}
    unmatched: list[str] = []
    for town, counts in by_town.items():
        hit = geoids.get(norm_town(town))
        if hit is None:
            unmatched.append(town)
            continue
        geo_code, census_name = hit
        merged.setdefault(geo_code, Counter()).update(counts)
        names[geo_code] = census_name
    for geo_code, counts in sorted(merged.items()):
        rows += place_rows("TOWN", geo_code, names[geo_code], counts)
    return rows, sorted(unmatched)


def locate(raw_dir: Path | None = None) -> list[Path]:
    d = Path(raw_dir) if raw_dir is not None else config.RAW / "ma_voterfile"
    return sorted(d.glob("*.csv")) if d.exists() else []


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        allow_synthetic: bool = False) -> int:
    label, definition = CONSTRUCTS["party_registration"]
    survey.merge_concordance(store, "party_registration", label, definition,
                             note="VOTERFILE_MA: full count of the statewide voter list by party code.")
    files = locate(raw_dir)
    if not files:
        d = Path(raw_dir) if raw_dir is not None else config.RAW / "ma_voterfile"
        print(INSTRUCTIONS.format(raw=d))
        return 0
    survey.refuse_synthetic(files, allow_synthetic)
    geoids = town_geoids(store)
    if not geoids:
        print("No MA TOWN rows in the store to match town names to GEOIDs; run "
              "python -m audience.load acs (or cvap) first. Loading the statewide count only.")
    state: Counter = Counter()
    towns: Counter = Counter()
    for f in files:
        s, t = count_file(f)
        state.update(s)
        towns.update(t)
    snapshot = max(snapshot_date(f) for f in files)
    rows, unmatched = build_rows(state, towns, geoids, snapshot, files)
    version = rows[0]["source_version"]
    written = store.upsert_norms(rows, prune=(SOURCE, version))
    store.touch_source(SOURCE)
    print(f"{version}: {written} rows, {sum(state.values()):,} voters, "
          f"{len({r['geo_code'] for r in rows if r['geography'] == 'TOWN'})} towns")
    if unmatched:
        print(f"  {len(unmatched)} town names matched no GEOID (statewide only): {', '.join(unmatched[:20])}")
    return written
