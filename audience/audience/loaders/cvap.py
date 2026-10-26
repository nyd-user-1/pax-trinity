"""CVAP 2020-2024 special tabulation for the US and Massachusetts (state, counties, towns,
block groups).

Reads the govblock lake's parquet parse of the Census release (never the Census site
itself), cached once under raw/cvap/<prefix>/. Writes two constructs, each as count and pct:

  cvap      citizens 18+, overall and by race_eth subgroup; pct = share of the group's
            18+ population who are citizens (block groups publish no 18+ count, so they
            get counts only)
  race_eth  composition of the citizen voting-age population; pct = share of all CVAP
"""

from __future__ import annotations

import datetime as dt
import shutil
from collections import Counter
import subprocess

import duckdb

from .. import categories as cat
from .. import config
from ..db import Store
from ..moe import proportion_moe, se, sum_moe

SOURCE = "CVAP"
SOURCE_VERSION = "CVAP 2020-2024 5yr"
PERIOD = (dt.date(2020, 1, 1), dt.date(2024, 12, 31))
RELEASE_URL = (
    "https://www2.census.gov/programs-surveys/decennial/rdo/datasets/2024/2024-cvap/"
    "CVAP_2020-2024_ACS_csv_files.zip"
)
LAKE = "s3://govblock-lake-638175140432/lake/v1/elections"
ITEM_TEXT = "Citizen Voting Age Population by Race and Ethnicity"

# Geography label, lake prefix, GEOID filter (exact for the nation and the state, prefix
# below), and the release file each prefix parses.
LEVELS = (
    ("US", "cvap_nation", "0100000US", "nation"),
    ("STATE", "cvap_state", "0400000US25", "state"),
    ("COUNTY", "cvap_county", "0500000US25", "county"),
    ("TOWN", "cvap_mcd", "0600000US25", "county subdivision (MCD)"),
    ("BLOCKGROUP", "cvap_blockgr", "1500000US25", "block group"),
)

# The release's thirteen lines. Lines 3-12 all sit under line 2 (not Hispanic or Latino).
LINE_TITLES = {
    1: "Total",
    2: "Not Hispanic or Latino",
    3: "American Indian or Alaska Native Alone",
    4: "Asian Alone",
    5: "Black or African American Alone",
    6: "Native Hawaiian or Other Pacific Islander Alone",
    7: "White Alone",
    8: "American Indian or Alaska Native and White",
    9: "Asian and White",
    10: "Black or African American and White",
    11: "American Indian or Alaska Native and Black or African American",
    12: "Remainder of Two or More Race Responses",
    13: "Hispanic or Latino",
}

# Collapse to the harmonized race_eth groups.
RACE_GROUPS = (
    (cat.RACE_ETH[0], (13,)),
    (cat.RACE_ETH[1], (7,)),
    (cat.RACE_ETH[2], (5,)),
    (cat.RACE_ETH[3], (4, 6)),
    (cat.RACE_ETH[4], (3, 8, 9, 10, 11, 12)),
)

MISSING_INSTRUCTIONS = """\
The CVAP parquet is not cached under raw/cvap/ and could not be copied from the lake.
It lives at {lake}/cvap_*/ in the govblock AWS account (638175140432). With credentials
for that account:

    aws s3 cp --recursive {lake}/<prefix>/ audience/raw/cvap/<prefix>/

for each prefix in cvap_nation cvap_state cvap_county cvap_mcd cvap_blockgr, then rerun:
python -m audience.load cvap
No rows were written."""


def _raw_dir(prefix: str):
    return config.RAW / "cvap" / prefix


def _cached(prefix: str) -> bool:
    return any(_raw_dir(prefix).glob("*.parquet"))


def fetch(refresh: bool = False) -> bool:
    """Copy each lake prefix into raw/cvap/ once. Returns False after printing
    instructions if a copy is needed and fails."""
    needed = [p for _, p, _, _ in LEVELS if refresh or not _cached(p)]
    if not needed:
        return True
    aws = shutil.which("aws")
    if not aws:
        print("aws CLI not found.\n" + MISSING_INSTRUCTIONS.format(lake=LAKE))
        return False
    for prefix in needed:
        cmd = [aws, "s3", "sync", "--only-show-errors", "--delete",
               f"{LAKE}/{prefix}/", str(_raw_dir(prefix)) + "/"]
        done = subprocess.run(cmd, capture_output=True, text=True)
        if done.returncode != 0 or not _cached(prefix):
            print(f"copy of {prefix} failed: {done.stderr.strip()}\n"
                  + MISSING_INSTRUCTIONS.format(lake=LAKE))
            return False
        print(f"  cached {LAKE}/{prefix}/")
    return True


def _read(prefix: str, geoid_filter: str, exact: bool) -> list[dict]:
    path = str(_raw_dir(prefix) / "*.parquet")
    con = duckdb.connect()
    cols = {r[0] for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{path}')").fetchall()}
    measures = [c for c in ("tot_est", "tot_moe", "adu_est", "adu_moe",
                            "cit_est", "cit_moe", "cvap_est", "cvap_moe") if c in cols]
    select = ", ".join(f"TRY_CAST({c} AS DOUBLE) AS {c}" for c in measures)
    where = "geoid = ?" if exact else "starts_with(geoid, ?)"
    cur = con.execute(
        f"SELECT geoid, geoname, CAST(lnnumber AS INTEGER) AS line, lntitle, {select} "
        f"FROM read_parquet('{path}') WHERE {where} ORDER BY geoid, line",
        [geoid_filter],
    )
    names = [d[0] for d in cur.description]
    out = [dict(zip(names, row)) for row in cur.fetchall()]
    con.close()
    return out


def geo_code(geoid: str) -> str:
    return geoid.split("US", 1)[1] or "US"


def build_rows() -> tuple[list[dict], Counter]:
    rows: list[dict] = []
    skipped: Counter = Counter()
    start, end = PERIOD
    for geography, prefix, geoid_filter, release_file in LEVELS:
        records = _read(prefix, geoid_filter, exact=geography in ("US", "STATE"))
        by_geo: dict[str, dict[int, dict]] = {}
        for rec in records:
            by_geo.setdefault(rec["geoid"], {})[rec["line"]] = rec
        if not by_geo:
            raise RuntimeError(f"no rows for {geoid_filter} in {prefix}")
        for geoid, lines in by_geo.items():
            code = geo_code(geoid)
            if set(lines) != set(LINE_TITLES):
                raise RuntimeError(f"{geoid}: expected lines 1-13, got {sorted(lines)}")
            for n, title in LINE_TITLES.items():
                if lines[n]["lntitle"].strip().lower() != title.lower():
                    raise RuntimeError(f"{geoid} line {n}: {lines[n]['lntitle']!r} != {title!r}")
            if any(lines[n]["cvap_est"] is None for n in LINE_TITLES):
                skipped["geographies with an unparseable CVAP value"] += 1
                continue
            # Water-only pseudo-towns ("County subdivisions not defined") have no people but
            # carry noise-level CVAP values; skip them, as the ACS loader does.
            if "tot_est" in lines[1] and (lines[1]["tot_est"] or 0) <= 0:
                skipped["geographies with no population"] += 1
                continue
            cvap_total = lines[1]["cvap_est"]
            if cvap_total <= 0:
                skipped["geographies with zero CVAP"] += 1
                continue
            has_adults = "adu_est" in lines[1]
            if not has_adults:
                skipped["block groups with no 18+ count published (cvap pct omitted)"] += 1
            name = lines[1]["geoname"]
            note_src = (
                f"Read from {LAKE}/{prefix}/, the lake's parquet parse of the release's "
                f"{release_file} file."
            )
            base = dict(
                source=SOURCE, source_version=SOURCE_VERSION, geography=geography,
                geo_code=code, period_start=start, period_end=end, item_text=ITEM_TEXT,
                n=None, weight_var=None, provenance_url=RELEASE_URL,
            )

            def emit(construct, option, sub_dim, sub_val, count, count_moe, desc, share=None):
                """Write the count row, and the pct row when share = (den, den_moe, note)."""
                cell = dict(base, construct=construct, response_option=option,
                            subgroup_dim=sub_dim, subgroup_value=sub_val)
                rows.append(dict(
                    cell, estimate_type="count", estimate=count, moe=count_moe,
                    se=se(count_moe),
                    provenance_note=f"{name}. {desc}. 90% MOE; sums use root-sum-of-squares. {note_src}",
                ))
                if share is None:
                    return
                den, den_moe, den_note = share
                p_moe = proportion_moe(count, den, count_moe, den_moe)
                p_moe = None if p_moe is None else round(100 * p_moe, 6)
                rows.append(dict(
                    cell, estimate_type="pct", estimate=round(100 * count / den, 6),
                    moe=p_moe, se=se(p_moe),
                    provenance_note=(
                        f"{name}. {desc}, as a percent of {den_note} MOE in percentage points "
                        f"by the Census proportion formula. {note_src}"
                    ),
                ))

            def citizen_share(count, adults, adults_moe):
                """The share of a group's adults who are citizens. CVAP and the 18+ count are
                estimated separately, so in small places CVAP can exceed the 18+ count; the
                ratio is then not a share, and the pct row is left out."""
                if not has_adults or adults is None or adults <= 0:
                    return None
                if count > adults:
                    skipped["citizen-share cells left out: CVAP above the 18+ estimate"] += 1
                    return None
                return (adults, adults_moe, "the 18+ population (adu_est, same lines).")

            emit("cvap", cat.CVAP, "all", "all", cvap_total, lines[1]["cvap_moe"],
                 "CVAP, line 1 (Total)",
                 citizen_share(cvap_total, lines[1].get("adu_est"), lines[1].get("adu_moe")))

            groups = []
            for label, nums in RACE_GROUPS:
                groups.append((
                    label, nums,
                    sum(lines[n]["cvap_est"] for n in nums),
                    sum_moe(lines[n]["cvap_moe"] for n in nums),
                    sum(lines[n]["adu_est"] for n in nums) if has_adults else None,
                    sum_moe(lines[n]["adu_moe"] for n in nums) if has_adults else None,
                ))
            # The release estimates each line on its own, so above block-group level the
            # lines need not add to line 1. Shares of CVAP use the sum of the five groups
            # as the denominator so they total 100.
            parts = sum(g[2] for g in groups)
            parts_moe = sum_moe(g[3] for g in groups)
            for label, nums, count, count_moe, adults, adults_moe in groups:
                desc = f"CVAP, line{'s' if len(nums) > 1 else ''} {', '.join(map(str, nums))}"
                emit("cvap", cat.CVAP, "race_eth", label, count, count_moe, desc,
                     citizen_share(count, adults, adults_moe))
                emit("race_eth", label, "all", "all", count, count_moe, desc,
                     (parts, parts_moe,
                      "CVAP summed over the five groups (lines 3-13 less line 2); the release "
                      "estimates each line separately, so its line-1 total can differ slightly."
                      ) if parts > 0 else None)
    return rows, skipped


def run(store: Store, refresh: bool = False) -> int:
    if not fetch(refresh=refresh):
        return 0
    rows, skipped = build_rows()
    written = store.upsert_norms(rows, prune=(SOURCE, SOURCE_VERSION))
    store.touch_source(SOURCE)
    geos = {(r["geography"], r["geo_code"]) for r in rows}
    print(f"{SOURCE_VERSION}: {written} rows across {len(geos)} geographies")
    for reason, n in sorted(skipped.items()):
        print(f"  {n:>6,} {reason}")
    return written
