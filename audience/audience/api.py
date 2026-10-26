"""Read-only query layer over the audience store.

Five calls, each returning plain JSON-ready values (dates as datetime.date):

  get_norm(construct, geography, geo_code, subgroup_dim=None, year=None)
  get_population_targets(geo_code, dims=DEFAULT_DIMS)
  get_topic_series(construct)
  get_lift_benchmark(outcome_type)
  place_lift(lift_pp, outcome_type)

Every call takes an optional open Store; without one it opens the store read-only
(open_store) and closes it afterwards. A DuckDB file held by a writer is retried every 30
seconds, up to 20 times.
"""

from __future__ import annotations

import contextlib
import datetime as dt
import math
import time
from decimal import Decimal
from pathlib import Path
from typing import Iterator, Sequence, TypedDict, Union

import numpy as np

from . import config
from .db import Store, connect

LOCK_TRIES = 20
LOCK_WAIT_SECONDS = 30

NORM_FIELDS = (
    "source", "source_version", "geography", "geo_code", "period_start", "period_end",
    "construct", "item_text", "response_option", "subgroup_dim", "subgroup_value",
    "estimate", "estimate_type", "n", "se", "moe", "weight_var", "provenance_url",
    "provenance_note",
)

Year = Union[None, int, str, tuple]


class Norm(TypedDict):
    source: str
    source_version: str
    geography: str
    geo_code: str
    period_start: dt.date
    period_end: dt.date
    construct: str
    item_text: str | None
    response_option: str | None
    subgroup_dim: str
    subgroup_value: str
    estimate: float | None
    estimate_type: str
    n: int | None
    se: float | None
    moe: float | None
    weight_var: str | None
    provenance_url: str
    provenance_note: str | None


class Benchmark(TypedDict):
    p10: float
    p25: float
    p50: float
    p75: float
    p90: float
    n_ads: int
    cycles: list[int]


class Placement(TypedDict):
    lift_pp: float
    outcome_type: str
    percentile: float
    benchmark: Benchmark
    caveat: str


# -- the store -------------------------------------------------------------------------

def open_store(duckdb_path: str | Path | None = None, database_url: str | None = None,
               tries: int = LOCK_TRIES, wait: float = LOCK_WAIT_SECONDS) -> Store:
    """Open the store for reading. Postgres sessions are set read-only; DuckDB is opened
    with read_only=True, retrying while another process holds the file's write lock."""
    url = database_url if database_url is not None else (
        None if duckdb_path is not None else config.env("DATABASE_URL"))
    if url:
        store = connect(database_url=url)
        store.execute("SET default_transaction_read_only = on")
        return store
    import duckdb

    path = Path(duckdb_path) if duckdb_path is not None else config.DEFAULT_DUCKDB
    if not path.exists():
        raise FileNotFoundError(f"no store at {path}; run python -m audience.migrate")
    for attempt in range(tries):
        try:
            return Store("duckdb", duckdb.connect(str(path), read_only=True),
                         label=f"{path} (read-only)")
        except duckdb.IOException as exc:
            if "lock" not in str(exc).lower() or attempt == tries - 1:
                raise
            time.sleep(wait)
    raise RuntimeError("unreachable")


@contextlib.contextmanager
def _using(store: Store | None) -> Iterator[Store]:
    if store is not None:
        yield store
        return
    s = open_store()
    try:
        yield s
    finally:
        s.close()


def _value(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, dt.datetime):
        return v.date()
    return v


def _rows(store: Store, where: str, params: Sequence, order: str) -> list[Norm]:
    sql = f"SELECT {', '.join(NORM_FIELDS)} FROM norms WHERE {where} ORDER BY {order}"
    return [dict(zip(NORM_FIELDS, map(_value, r))) for r in store.query(sql, params)]


def _year_bounds(year: Year) -> tuple[dt.date, dt.date] | None:
    if year is None or year == "latest":
        return None
    if isinstance(year, (tuple, list)):
        a, b = (int(x) for x in year)
    else:
        a = b = int(year)
    if a > b:
        raise ValueError(f"year range {a}-{b} runs backwards")
    return dt.date(a, 1, 1), dt.date(b, 12, 31)


# -- the five calls --------------------------------------------------------------------

def get_norm(construct: str, geography: str, geo_code: str, subgroup_dim: str | None = None,
             year: Year = None, *, store: Store | None = None) -> list[Norm]:
    """Norm rows for one construct at one place.

    year: None for every period; an int for rows whose period overlaps that calendar year;
    (a, b) for rows overlapping a..b; "latest" for each source's most recent period."""
    where = ["construct = ?", "geography = ?", "geo_code = ?"]
    params: list = [construct, geography, geo_code]
    if subgroup_dim is not None:
        where.append("subgroup_dim = ?")
        params.append(subgroup_dim)
    bounds = _year_bounds(year)
    if bounds is not None:
        where += ["period_start <= ?", "period_end >= ?"]
        params += [bounds[1], bounds[0]]
    with _using(store) as s:
        rows = _rows(s, " AND ".join(where), params,
                     "source, period_end, subgroup_dim, subgroup_value, item_text, "
                     "response_option, estimate_type")
    if year == "latest":
        last = {}
        for r in rows:
            last[r["source"]] = max(last.get(r["source"], r["period_end"]), r["period_end"])
        rows = [r for r in rows if r["period_end"] == last[r["source"]]]
    return rows


DEFAULT_DIMS = ("sex", "age_bucket", "race_eth", "education_4", "hh_income_bucket")
# Which source a raking target comes from. race_eth uses CVAP's composition of citizens 18+
# (the electorate-eligible universe); ACS's race_eth is the whole population, children
# included. The other dims come from ACS: sex and age over 18+, education over 25+, income
# over households. A dim missing from its preferred source falls back to the other.
TARGET_SOURCE = {"race_eth": ("CVAP", "ACS")}
TARGET_DEFAULT = ("ACS", "CVAP")


def get_population_targets(geo_code: str, dims: Sequence[str] = DEFAULT_DIMS, *,
                           store: Store | None = None) -> dict[str, dict[str, float]]:
    """Raking targets: for each dim, {category: share} summing to 1, from the latest
    ACS / CVAP pct rows for geo_code (subgroup 'all')."""
    out: dict[str, dict[str, float]] = {}
    with _using(store) as s:
        for dim in dims:
            rows = _rows(s, "construct = ? AND geo_code = ? AND subgroup_dim = 'all' AND "
                            "estimate_type = 'pct' AND source IN ('ACS', 'CVAP')",
                         [dim, geo_code], "period_end DESC, source, response_option")
            if not rows:
                raise LookupError(f"no ACS or CVAP pct rows for {dim} at {geo_code}")
            pick = None
            for source in TARGET_SOURCE.get(dim, TARGET_DEFAULT):
                mine = [r for r in rows if r["source"] == source]
                if mine:
                    latest = max(r["period_end"] for r in mine)
                    version = next(r["source_version"] for r in mine if r["period_end"] == latest)
                    pick = [r for r in mine if r["source_version"] == version]
                    break
            total = sum(r["estimate"] for r in pick)
            if not total or len({r["response_option"] for r in pick}) != len(pick):
                raise ValueError(f"{dim} at {geo_code}: rows do not form one distribution")
            out[dim] = {r["response_option"]: r["estimate"] / total for r in pick}
    return out


TOPIC_SOURCES = ("POLL", "ELECTION_RESULT")


def get_topic_series(construct: str, subgroup_dim: str | None = "all", *,
                     store: Store | None = None) -> list[Norm]:
    """Polls and election results for a topic construct, ordered by period_end. Toplines by
    default; subgroup_dim=None returns every row."""
    where = "construct = ? AND source IN ('POLL', 'ELECTION_RESULT')"
    params: list = [construct]
    if subgroup_dim is not None:
        where += " AND subgroup_dim = ?"
        params.append(subgroup_dim)
    with _using(store) as s:
        return _rows(s, where, params,
                     "period_end, source, source_version, subgroup_dim, subgroup_value, "
                     "response_option")


LIFT_SOURCES = ("LIFT_ARCHIVE", "PAX_TEST")


def lift_construct(outcome_type: str) -> str:
    return outcome_type if outcome_type.startswith("lift_") else f"lift_{outcome_type}"


def _lift_values(store: Store, construct: str) -> tuple[np.ndarray, list[int], list[str]]:
    rows = store.query(
        "SELECT estimate, period_start, source FROM norms WHERE construct = ? AND "
        "estimate_type = 'lift_pp' AND subgroup_dim = 'all' AND source IN ('LIFT_ARCHIVE', "
        "'PAX_TEST') AND estimate IS NOT NULL", [construct])
    values = np.array([float(r[0]) for r in rows])
    cycles = sorted({_value(r[1]).year for r in rows})
    return values, cycles, sorted({r[2] for r in rows})


def get_lift_benchmark(outcome_type: str, *, store: Store | None = None) -> Benchmark:
    """Percentiles of ad-level lifts for one outcome over the lift dataset (and PAX's own
    tests when loaded). n_ads counts ad-level estimates."""
    construct = lift_construct(outcome_type)
    with _using(store) as s:
        values, cycles, _ = _lift_values(s, construct)
    if values.size == 0:
        raise LookupError(f"no lift estimates for {construct}")
    p = np.percentile(values, [10, 25, 50, 75, 90])
    return Benchmark(p10=round(float(p[0]), 4), p25=round(float(p[1]), 4),
                     p50=round(float(p[2]), 4), p75=round(float(p[3]), 4),
                     p90=round(float(p[4]), 4), n_ads=int(values.size), cycles=cycles)


def place_lift(lift_pp: float, outcome_type: str, *, store: Store | None = None) -> Placement:
    """Where lift_pp falls among the benchmark's ad-level lifts: the percent of estimates
    below it, ties counted half."""
    x = float(lift_pp)
    if not math.isfinite(x):
        raise ValueError("lift_pp must be a finite number")
    construct = lift_construct(outcome_type)
    with _using(store) as s:
        values, cycles, sources = _lift_values(s, construct)
        if values.size == 0:
            raise LookupError(f"no lift estimates for {construct}")
        bench = get_lift_benchmark(construct, store=s)
    pct = 100 * (np.sum(values < x) + 0.5 * np.sum(values == x)) / values.size
    pax = " It also includes PAX's own tests." if "PAX_TEST" in sources else ""
    caveat = (
        f"The benchmark is {values.size} ad-level estimates, mostly campaign ads from the "
        f"{'/'.join(map(str, cycles))} cycles, each measured under forced exposure in an "
        f"online survey experiment against a placebo.{pax} The placement is context for the "
        f"result, not a ranking of it.")
    return Placement(lift_pp=x, outcome_type=construct, percentile=round(float(pct), 2),
                     benchmark=bench, caveat=caveat)
