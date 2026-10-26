"""Official Massachusetts election returns from the Secretary of the Commonwealth's election
statistics (PD43+, electionstats.state.ma.us): votes by ticket, statewide and by town.

One election so far, the 2024 President General Election (PD43+ id 165300). Its town-level
CSV is downloaded once into raw/ma_results/ and parsed: every ticket's votes, All Others, Blanks
and Total Votes Cast, as counts, plus each ticket's share of the votes cast. Towns get their
county-subdivision GEOID through the geographies table (load acs or cvap first).

PD43+ prints each town once, without its county; Massachusetts town names are unique, so a
town is matched by name alone to the geographies table's Census names.

These counts feed the 2024-vote raking target (api.get_population_targets, dim vote_2024):
votes by party over the citizen voting-age population, the rest not voting.
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import re
from pathlib import Path

from .. import config
from ..constructs import CONSTRUCTS
from ..db import Store
from .. import survey
from .ma_enrollment import census_key, town_geographies

SOURCE = "ELECTION_RESULT"
ELECTIONS = {
    165300: dict(name="2024 President General Election", date=dt.date(2024, 11, 5),
                 construct="presidential_vote"),
}
VIEW_URL = "https://electionstats.state.ma.us/elections/view/{id}/"
CSV_URL = "https://electionstats.state.ma.us/elections/download/{id}/precincts_include:0/"


def source_version(election_id: int) -> str:
    return f"MA {ELECTIONS[election_id]['name']} (PD43+ {election_id})"


def _dir(raw_dir: Path | None) -> Path:
    return Path(raw_dir) if raw_dir is not None else config.RAW / "ma_results"


def fetch(election_id: int, raw_dir: Path | None = None, refresh: bool = False) -> Path | None:
    import requests

    path = _dir(raw_dir) / f"pd43_{election_id}_towns.csv"
    if path.exists() and not refresh:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = requests.get(CSV_URL.format(id=election_id), timeout=120,
                         headers={"User-Agent": "Mozilla/5.0 (audience loader)"})
        r.raise_for_status()
        if "TOTALS" not in r.text:
            raise RuntimeError("the download has no TOTALS row")
        path.write_text(r.text)
    except Exception as exc:
        print(f"download failed: {exc}")
        return None
    return path


COMPASS = {"E": "EAST", "N": "NORTH", "S": "SOUTH", "W": "WEST"}


def norm_name(name: str) -> str:
    """The town-name form census_key produces: upper case, hyphens as spaces, no dots. PD43+
    abbreviates a leading compass word ('W. Springfield'), which is spelled out."""
    m = re.match(r"^([ENSW])\.\s+(.*)$", name.strip())
    if m:
        name = f"{COMPASS[m.group(1)]} {m.group(2)}"
    return re.sub(r"\s+", " ", name.upper().replace("-", " ").replace(".", "")).strip()


def town_geoids(store: Store) -> dict[str, tuple[str, str]]:
    """normalized town name -> (GEOID, Census name)."""
    return {census_key(name)[1]: (code, name) for code, name in town_geographies(store)}


def _int(v: str) -> int:
    v = v.strip().replace(",", "")
    return int(v) if v else 0


def parse(text: str) -> tuple[list[str], dict[str, dict[str, int]]]:
    """(ticket labels, place -> {label: votes}). Labels carry the party, e.g. 'Harris/Walz
    (Democratic)'; 'All Others', 'Blanks' and 'Total Votes Cast' keep their names."""
    rows = list(csv.reader(io.StringIO(text)))
    header, parties = rows[0], rows[1]
    labels = []
    for i, name in enumerate(header):
        if i < 3:
            continue
        name = re.sub(r"\s*/\s*", "/", name.strip())
        party = parties[i].strip() if i < len(parties) else ""
        labels.append(f"{name} ({party})" if party else name)
    places = {}
    for row in rows[2:]:
        if not row or not row[0].strip():
            continue
        places[row[0].strip()] = {lab: _int(row[3 + j]) for j, lab in enumerate(labels)}
    return labels, places


def build_rows(election_id: int, text: str, geoids: dict) -> tuple[list[dict], list[str]]:
    e = ELECTIONS[election_id]
    labels, places = parse(text)
    total_label = next(lab for lab in labels if lab.lower().startswith("total votes"))
    version = source_version(election_id)
    url = VIEW_URL.format(id=election_id)
    rows, unmatched = [], []
    for place, votes in places.items():
        if place == "TOTALS":
            geography, geo_code, name = "STATE", "25", "Massachusetts"
        else:
            hit = geoids.get(norm_name(place))
            if hit is None:
                unmatched.append(place)
                continue
            geography, geo_code, name = "TOWN", hit[0], hit[1]
        total = votes[total_label]
        note = (f"{name}. Official return, {e['name']}, Massachusetts Secretary of the "
                f"Commonwealth (PD43+ election {election_id}). pct is the share of Total Votes Cast, "
                f"which includes Blanks. A full count, so no se or moe.")
        base = dict(source=SOURCE, source_version=version, geography=geography, geo_code=geo_code,
                    period_start=e["date"], period_end=e["date"], construct=e["construct"],
                    item_text=f"{e['name']}: votes by ticket", subgroup_dim="all",
                    subgroup_value="all", n=total, se=None, moe=None, weight_var=None,
                    provenance_url=url, provenance_note=note)
        for lab in labels:
            rows.append(dict(base, response_option=lab, estimate_type="count", estimate=float(votes[lab])))
            if lab != total_label and total:
                rows.append(dict(base, response_option=lab, estimate_type="pct",
                                 estimate=round(100 * votes[lab] / total, 6)))
    return rows, sorted(unmatched)


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None) -> int:
    label, definition = CONSTRUCTS["presidential_vote"]
    survey.merge_concordance(store, "presidential_vote", label, definition,
                             note="ELECTION_RESULT (MA): official PD43+ returns, statewide and by town.")
    geoids = town_geoids(store)
    total = 0
    for election_id in ELECTIONS:
        path = fetch(election_id, raw_dir, refresh)
        if path is None:
            print(f"The PD43+ return for election {election_id} is not cached and could not be "
                  f"downloaded. Get it from {VIEW_URL.format(id=election_id)} (Download, towns "
                  f"only) into {_dir(raw_dir)}/pd43_{election_id}_towns.csv. No rows were written.")
            continue
        rows, unmatched = build_rows(election_id, path.read_text(), geoids)
        written = store.upsert_norms(rows, prune=(SOURCE, source_version(election_id)))
        total += written
        towns = len({r["geo_code"] for r in rows if r["geography"] == "TOWN"})
        print(f"{source_version(election_id)}: {written} rows, statewide and {towns} towns"
              + (f"; unmatched: {', '.join(unmatched)}" if unmatched else ""))
    if total:
        store.touch_source(SOURCE)
    return total
