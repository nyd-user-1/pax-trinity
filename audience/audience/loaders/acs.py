"""ACS 5-year population composition for the US, Massachusetts, its counties and its towns.

Pulls five B-tables from the Census Data API, collapses them to the harmonized categories in
audience/categories.py, and stores every cell twice: as a count and as a pct (0-100) of the
universe named in its provenance_note. API responses are cached under raw/acs/<vintage>/.
"""

from __future__ import annotations

import datetime as dt
import json
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

import requests

from .. import categories as cat
from .. import config
from ..db import Store
from ..moe import proportion_moe, se, sum_moe

SOURCE = "ACS"
LATEST_VINTAGE = 2024  # ACS 2020-2024 5-year: the latest on api.census.gov as of 2026-10-25
API = "https://api.census.gov/data"

# Geography label, the API's for= clause, its in= clause. MA towns are county subdivisions.
LEVELS = (
    ("US", "us:1", None),
    ("STATE", "state:25", None),
    ("COUNTY", "county:*", "state:25"),
    ("TOWN", "county subdivision:*", "state:25"),
)

# ACS special values. An estimate below zero means the cell is unavailable; an MOE of
# -555555555 means the estimate is controlled (no sampling error); other negative MOEs
# mean the MOE could not be computed.
CONTROLLED_MOE = -555555555

KEY_INSTRUCTIONS = """\
CENSUS_API_KEY is not set, and the ACS responses are not all cached under raw/acs/.
Get a free key at https://api.census.gov/data/key_signup.html (it arrives by email),
then add this line to audience/.env:

    CENSUS_API_KEY=<your key>

and rerun: python -m audience.load acs
No rows were written."""


def r(a: int, b: int) -> tuple[int, ...]:
    return tuple(range(a, b + 1))


@dataclass(frozen=True)
class Collapse:
    """One construct's collapse of one table for one subgroup.

    groups: (response_option, table line numbers summed into it).
    total_line: the published universe line, or None when the universe is the sum of the
    groups (B01001 has no 18-and-over line, so the adult universe is built from its cells).
    """
    construct: str
    table: str
    universe: str
    groups: tuple[tuple[str, tuple[int, ...]], ...]
    total_line: int | None = None
    subgroup: tuple[str, str] = ("all", "all")


# B01001 Sex by Age. Male lines 3-25, female lines 27-49; the adult cells start at
# 7 (male 18-19) and 31 (female 18-19).
#   18-29: 18-19, 20, 21, 22-24, 25-29   -> male 7-11,  female 31-35
#   30-44: 30-34, 35-39, 40-44           -> male 12-14, female 36-38
#   45-64: 45-49, 50-54, 55-59, 60-61, 62-64 -> male 15-19, female 39-43
#   65+:   65-66 through 85+             -> male 20-25, female 44-49
MALE_AGE = (r(7, 11), r(12, 14), r(15, 19), r(20, 25))
FEMALE_AGE = (r(31, 35), r(36, 38), r(39, 43), r(44, 49))

COLLAPSES = (
    Collapse("sex", "B01001", "population 18 and over",
             ((cat.SEX[0], r(7, 25)), (cat.SEX[1], r(31, 49)))),
    Collapse("age_bucket", "B01001", "population 18 and over",
             tuple((label, m + f) for label, m, f in zip(cat.AGE_BUCKET, MALE_AGE, FEMALE_AGE))),
    Collapse("age_bucket", "B01001", "men 18 and over",
             tuple(zip(cat.AGE_BUCKET, MALE_AGE)), subgroup=("sex", cat.SEX[0])),
    Collapse("age_bucket", "B01001", "women 18 and over",
             tuple(zip(cat.AGE_BUCKET, FEMALE_AGE)), subgroup=("sex", cat.SEX[1])),
    # B03002 Hispanic or Latino Origin by Race. Line 12 is all Hispanic people; lines 3-9
    # split the non-Hispanic (2) into White alone (3), Black alone (4), AIAN alone (5),
    # Asian alone (6), NHPI alone (7), some other race alone (8), two or more races (9).
    Collapse("race_eth", "B03002", "total population",
             ((cat.RACE_ETH[0], (12,)), (cat.RACE_ETH[1], (3,)), (cat.RACE_ETH[2], (4,)),
              (cat.RACE_ETH[3], (6, 7)), (cat.RACE_ETH[4], (5, 8, 9))),
             total_line=1),
    # B15003 Educational Attainment, population 25+.
    #   HS or less: no schooling (2) through 12th grade no diploma (16), diploma (17), GED (18)
    #   Some college: some college <1 yr (19), 1+ yrs no degree (20), associate's (21)
    #   BA: bachelor's (22).  Grad: master's (23), professional (24), doctorate (25)
    Collapse("education_4", "B15003", "population 25 and over",
             ((cat.EDUCATION_4[0], r(2, 18)), (cat.EDUCATION_4[1], r(19, 21)),
              (cat.EDUCATION_4[2], (22,)), (cat.EDUCATION_4[3], r(23, 25))),
             total_line=1),
    # B19001 Household Income in the past 12 months, sixteen bands (2-17) into six:
    #   <25k: 2-5 | 25-50k: 6-10 | 50-75k: 11-12 | 75-100k: 13 | 100-150k: 14-15 | 150k+: 16-17
    Collapse("hh_income_bucket", "B19001", "households",
             ((cat.HH_INCOME_BUCKET[0], r(2, 5)), (cat.HH_INCOME_BUCKET[1], r(6, 10)),
              (cat.HH_INCOME_BUCKET[2], r(11, 12)), (cat.HH_INCOME_BUCKET[3], (13,)),
              (cat.HH_INCOME_BUCKET[4], r(14, 15)), (cat.HH_INCOME_BUCKET[5], r(16, 17))),
             total_line=1),
    # B05001 Nativity and Citizenship Status. Citizen by birth: born in the US (2), in Puerto
    # Rico or the Island Areas (3), abroad to an American parent (4). Naturalized (5). Not a
    # citizen (6).
    Collapse("citizenship", "B05001", "total population",
             ((cat.CITIZENSHIP[0], (2, 3, 4)), (cat.CITIZENSHIP[1], (5,)),
              (cat.CITIZENSHIP[2], (6,))),
             total_line=1),
)

TABLES = tuple(dict.fromkeys(c.table for c in COLLAPSES))


def source_version(vintage: int) -> str:
    return f"ACS {vintage - 4}-{vintage} 5yr"


def var(table: str, line: int, kind: str) -> str:
    return f"{table}_{line:03d}{kind}"


def lines_text(lines: tuple[int, ...]) -> str:
    """(7, 8, 9, 11) -> '7-9, 11'"""
    out, start, prev = [], None, None
    for n in sorted(lines):
        if start is None:
            start = prev = n
        elif n == prev + 1:
            prev = n
        else:
            out.append(f"{start}-{prev}" if prev != start else f"{start}")
            start = prev = n
    out.append(f"{start}-{prev}" if prev != start else f"{start}")
    return ", ".join(out)


def public_url(vintage: int, table: str, geo_for: str, geo_in: str | None) -> str:
    url = f"{API}/{vintage}/acs/acs5?get=NAME,group({table})&for={quote(geo_for, safe=':*')}"
    if geo_in:
        url += f"&in={quote(geo_in, safe=':*')}"
    return url


class CensusError(RuntimeError):
    pass


def _get(url: str, key: str) -> object:
    for attempt in range(4):
        try:
            resp = requests.get(url, params={"key": key}, timeout=60)
        except requests.RequestException as exc:
            # requests puts the full URL, key included, in its messages.
            err = CensusError(str(exc).replace(key, "***"))
        else:
            if resp.status_code == 200:
                try:
                    return resp.json()
                except ValueError:
                    raise CensusError(f"non-JSON reply from {url}: {resp.text[:200]!r}") from None
            if resp.status_code in (400, 401, 403, 404):
                raise CensusError(f"HTTP {resp.status_code} from {url}: {resp.text[:200]!r}")
            err = CensusError(f"HTTP {resp.status_code} from {url}")
        time.sleep(2 ** attempt)
    raise CensusError(f"gave up on {url}: {err}")


def _cache_dir(vintage: int) -> Path:
    return config.RAW / "acs" / str(vintage)


def _plan(vintage: int) -> list[tuple[str, str, str | None, str, Path]]:
    d = _cache_dir(vintage)
    jobs = [("groups", "", None, f"{API}/{vintage}/acs/acs5/groups.json", d / "groups.json")]
    for table in TABLES:
        for level, geo_for, geo_in in LEVELS:
            jobs.append((table, geo_for, geo_in, public_url(vintage, table, geo_for, geo_in),
                         d / f"{table}_{level}.json"))
    return jobs


def fetch(vintage: int, refresh: bool = False) -> bool:
    """Fill the raw cache. Returns False (after printing instructions) if a fetch is needed
    and no key is set."""
    jobs = _plan(vintage)
    needed = [j for j in jobs if refresh or not j[4].exists()]
    if not needed:
        return True
    key = config.env("CENSUS_API_KEY")
    if not key:
        print(KEY_INSTRUCTIONS)
        return False
    for _, _, _, url, path in needed:
        data = _get(url, key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data))
        print(f"  fetched {url}")
    return True


def _num(value) -> float | None:
    if value in (None, ""):
        return None
    return float(value)


def _moe(value) -> float | None:
    v = _num(value)
    if v is None:
        return None
    if v == CONTROLLED_MOE:
        return 0.0
    return None if v < 0 else v


def geo_code(geo_id: str) -> str:
    """'0600000US2502507000' -> '2502507000'; the nation ('0100000US') -> 'US'."""
    return geo_id.split("US", 1)[1] or "US"


def build_rows(vintage: int, records: dict[str, list[dict]], groups_meta: dict) -> tuple[list[dict], list[str]]:
    """records: table -> list of {variable: value} dicts across all levels, each tagged with
    '_geography' and '_url'. Returns (rows, skip notes)."""
    version = source_version(vintage)
    start, end = dt.date(vintage - 4, 1, 1), dt.date(vintage, 12, 31)
    rows: list[dict] = []
    skips: list[str] = []
    for c in COLLAPSES:
        concept = groups_meta[c.table]["description"]
        item_text = f"{c.table}. {concept}"
        all_lines = tuple(n for _, lines in c.groups for n in lines)
        for rec in records[c.table]:
            name, code = rec["NAME"], geo_code(rec["GEO_ID"])
            needed = all_lines + ((c.total_line,) if c.total_line else ())
            est = {n: _num(rec.get(var(c.table, n, "E"))) for n in needed}
            if any(v is None or v < 0 for v in est.values()):
                skips.append(f"{c.construct}/{c.subgroup[1]} {code}: unavailable cell")
                continue
            moe = {n: _moe(rec.get(var(c.table, n, "M"))) for n in needed}
            if c.total_line:
                den, den_moe = est[c.total_line], moe[c.total_line]
                den_desc = f"{c.universe} ({c.table} line {c.total_line})"
            else:
                den = sum(est[n] for n in all_lines)
                den_moe = sum_moe(moe[n] for n in all_lines)
                den_desc = f"{c.universe} ({c.table} lines {lines_text(all_lines)})"
            if den <= 0:
                skips.append(f"{c.construct}/{c.subgroup[1]} {code}: universe is zero")
                continue
            base = dict(
                source=SOURCE, source_version=version, geography=rec["_geography"],
                geo_code=code, period_start=start, period_end=end, construct=c.construct,
                item_text=item_text, subgroup_dim=c.subgroup[0], subgroup_value=c.subgroup[1],
                n=None, weight_var=None, provenance_url=rec["_url"],
            )
            for label, lines in c.groups:
                count = sum(est[n] for n in lines)
                count_moe = sum_moe(moe[n] for n in lines)
                summed = f"{c.table} line{'s' if len(lines) > 1 else ''} {lines_text(lines)}"
                rows.append(dict(
                    base, response_option=label, estimate_type="count", estimate=count,
                    moe=count_moe, se=se(count_moe),
                    provenance_note=(
                        f"{name}. {summed}{' summed' if len(lines) > 1 else ''}; universe "
                        f"{c.universe}. 90% MOE; sums use root-sum-of-squares."
                    ),
                ))
                p_moe = proportion_moe(count, den, count_moe, den_moe)
                p_moe = None if p_moe is None else 100 * p_moe
                rows.append(dict(
                    base, response_option=label, estimate_type="pct",
                    estimate=round(100 * count / den, 6),
                    moe=None if p_moe is None else round(p_moe, 6), se=se(p_moe),
                    provenance_note=(
                        f"{name}. Percent of {den_desc}: {summed} over the universe. "
                        f"MOE in percentage points by the Census proportion formula."
                    ),
                ))
    return rows, skips


def read_cache(vintage: int) -> tuple[dict[str, list[dict]], dict]:
    d = _cache_dir(vintage)
    meta = json.loads((d / "groups.json").read_text())
    groups_meta = {g["name"]: g for g in meta["groups"] if g["name"] in TABLES}
    records: dict[str, list[dict]] = {t: [] for t in TABLES}
    for table, geo_for, geo_in, url, path in _plan(vintage)[1:]:
        level = path.stem.split("_", 1)[1]
        data = json.loads(path.read_text())
        header = data[0]
        for raw in data[1:]:
            rec = {}
            for h, v in zip(header, raw):
                rec.setdefault(h, v)  # NAME appears twice in group() replies; keep the first
            rec["_geography"] = level
            rec["_url"] = url
            records[table].append(rec)
    return records, groups_meta


def run(store: Store, vintage: int = LATEST_VINTAGE, refresh: bool = False) -> int:
    if not fetch(vintage, refresh=refresh):
        return 0
    records, groups_meta = read_cache(vintage)
    rows, skips = build_rows(vintage, records, groups_meta)
    written = store.upsert_norms(rows, prune=(SOURCE, source_version(vintage)))
    store.touch_source(SOURCE)
    geos = {(r["geography"], r["geo_code"]) for r in rows}
    print(f"{source_version(vintage)}: {written} rows across {len(geos)} geographies")
    zero = sorted({s.split(" ")[1].rstrip(":") for s in skips if s.endswith("universe is zero")})
    if zero:
        print(f"  skipped {len(zero)} geographies with no population: {', '.join(zero)}")
    for s in skips:
        if not s.endswith("universe is zero"):
            print(f"  skipped {s}")
    return written
