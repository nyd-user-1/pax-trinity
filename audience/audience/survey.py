"""Shared machinery for the respondent-level survey loaders (CPS, GSS, ANES, CES, WVS).

Each of those loaders reads microdata, recodes it, and stores weighted shares (pct, 0-100)
or weighted means per period, overall and by subgroup. What they share lives here:

- shares() and means(): the weighted cell computation and the n >= 50 cell rule
- the harmonized subgroup recodes (age bucket, party with leaners)
- norm_rows(): cells to norm rows, with the skipped cells named in the topline's note
- merge_concordance(): add a source's variable names to a construct without clobbering
  what other loaders wrote
- refuse_synthetic(): test fixtures carry SYNTHETIC in their file name and are never loaded
  into a real store

Standard errors use Kish's effective sample size, n_eff = (sum w)^2 / sum w^2, and ignore
clustering and stratification, so they understate design-based errors. moe follows the
store's convention: the 90% margin, 1.645 x se, in percentage points for pct rows.
"""

from __future__ import annotations

import datetime as dt
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import numpy as np
import pandas as pd

from . import categories as cat
from .db import ARRAY_COLUMNS, Store
from .moe import Z90

MIN_CELL_N = 50
SYNTHETIC_MARK = "SYNTHETIC"

# Harmonized response labels for attitude constructs several sources share. A source's
# extra options (GSS "Other party", CES "Not sure") keep their own labels.
PARTY_ID_7 = (
    "Strong Democrat", "Weak Democrat", "Lean Democrat", "Independent",
    "Lean Republican", "Weak Republican", "Strong Republican",
)
IDEOLOGY_7 = (
    "Extremely liberal", "Liberal", "Slightly liberal", "Moderate, middle of the road",
    "Slightly conservative", "Conservative", "Extremely conservative",
)
PARTY_3 = ("Democrat", "Independent", "Republican")  # leaners counted with their party

BASE_NOTE = (
    "Weighted percent of respondents giving a substantive answer; don't know, no answer, "
    "refused, skipped and not asked are left out of the base. n is the unweighted base. "
    "se uses the Kish effective n (design effects from clustering are ignored); moe is "
    "1.645 x se, in percentage points."
)
MEAN_NOTE = (
    "Weighted mean over respondents with a valid answer. n is the unweighted base. se uses "
    "the Kish effective n (design effects from clustering are ignored); moe is 1.645 x se."
)


class SyntheticInput(RuntimeError):
    """A synthetic test fixture was offered to a real load."""


def refuse_synthetic(paths: Iterable[Path], allow_synthetic: bool = False) -> None:
    for p in paths:
        if SYNTHETIC_MARK in Path(p).name.upper() and not allow_synthetic:
            raise SyntheticInput(
                f"{p} is a synthetic test fixture (its name carries {SYNTHETIC_MARK}); "
                "fixtures are never loaded into a real store"
            )


@dataclass(frozen=True)
class Cell:
    period: object          # the period key, usually the survey year
    dim: str                # subgroup_dim: all | sex | age | ...
    value: str              # subgroup_value
    option: str | None      # response option label (None for a mean)
    estimate: float         # pct (0-100) or mean
    se: float | None
    n: int                  # unweighted base of the cell
    count: float | None = None  # weighted count, when the weights are population weights


def _key(k) -> tuple:
    return k if isinstance(k, tuple) else (k,)


def _cell_groups(d: pd.DataFrame, subgroups: Mapping[str, str]):
    """Yield (dim, value column or None, rows) for the topline and each subgroup dimension."""
    yield "all", None, d
    for dim, col in subgroups.items():
        yield dim, col, d[d[col].notna()]


def shares(
    df: pd.DataFrame,
    item: str,
    weight: str,
    options: Mapping[object, str],
    subgroups: Mapping[str, str] | None = None,
    period: str = "year",
    min_n: int = MIN_CELL_N,
    with_counts: bool = False,
) -> tuple[list[Cell], dict[object, list[str]]]:
    """Weighted share of each response option, per period, overall and by subgroup.

    options maps raw codes to labels; several codes may share a label (they are pooled).
    Rows whose code is not in options are outside the base. A cell whose unweighted base
    is under min_n is skipped and named in the returned skipped map, keyed by period.
    """
    subgroups = dict(subgroups or {})
    labels = list(dict.fromkeys(options.values()))
    d = df.loc[df[item].isin(list(options)) & (df[weight] > 0)].copy()
    d["_opt"] = d[item].map(options)
    d["_w"] = d[weight].astype(float)
    d["_w2"] = d["_w"] ** 2
    cells: list[Cell] = []
    skipped: dict[object, list[str]] = {}
    for dim, col, sub in _cell_groups(d, subgroups):
        if sub.empty:
            continue
        keys = [period] if col is None else [period, col]
        tot = sub.groupby(keys, observed=True).agg(
            n=("_w", "size"), sw=("_w", "sum"), sw2=("_w2", "sum"))
        by_opt = sub.groupby(keys + ["_opt"], observed=True)["_w"].sum().to_dict()
        for k, row in tot.iterrows():
            k = _key(k)
            per = k[0]
            value = "all" if col is None else str(k[1])
            n = int(row["n"])
            if n < min_n:
                skipped.setdefault(per, []).append(f"{dim}={value} (n={n})")
                continue
            sw, sw2 = float(row["sw"]), float(row["sw2"])
            neff = sw * sw / sw2
            for label in labels:
                w = float(by_opt.get(k + (label,), 0.0))
                p = w / sw
                cells.append(Cell(
                    period=per, dim=dim, value=value, option=label,
                    estimate=round(100 * p, 6),
                    # max(): a lone option's p can land a hair over 1 in floating point
                    se=round(100 * math.sqrt(max(p * (1 - p), 0.0) / neff), 6),
                    n=n, count=round(w, 3) if with_counts else None,
                ))
    return cells, skipped


def means(
    df: pd.DataFrame,
    item: str,
    weight: str,
    valid: tuple[float, float],
    subgroups: Mapping[str, str] | None = None,
    period: str = "year",
    min_n: int = MIN_CELL_N,
    label: str = "Mean",
) -> tuple[list[Cell], dict[object, list[str]]]:
    """Weighted mean of item over values within valid=(lo, hi), inclusive."""
    subgroups = dict(subgroups or {})
    lo, hi = valid
    d = df.loc[df[item].between(lo, hi) & (df[weight] > 0)].copy()
    d["_x"] = d[item].astype(float)
    d["_w"] = d[weight].astype(float)
    d["_w2"] = d["_w"] ** 2
    d["_wx"] = d["_w"] * d["_x"]
    d["_wxx"] = d["_w"] * d["_x"] ** 2
    cells: list[Cell] = []
    skipped: dict[object, list[str]] = {}
    for dim, col, sub in _cell_groups(d, subgroups):
        if sub.empty:
            continue
        keys = [period] if col is None else [period, col]
        g = sub.groupby(keys, observed=True).agg(
            n=("_w", "size"), sw=("_w", "sum"), sw2=("_w2", "sum"),
            swx=("_wx", "sum"), swxx=("_wxx", "sum"))
        for k, row in g.iterrows():
            k = _key(k)
            per = k[0]
            value = "all" if col is None else str(k[1])
            n = int(row["n"])
            if n < min_n:
                skipped.setdefault(per, []).append(f"{dim}={value} (n={n})")
                continue
            sw = float(row["sw"])
            m = float(row["swx"]) / sw
            var = max(float(row["swxx"]) / sw - m * m, 0.0)
            neff = sw * sw / float(row["sw2"])
            cells.append(Cell(period=per, dim=dim, value=value, option=label,
                              estimate=round(m, 6), se=round(math.sqrt(var / neff), 6), n=n))
    return cells, skipped


def norm_rows(
    cells: Sequence[Cell],
    skipped: Mapping[object, list[str]],
    *,
    source: str,
    source_version: str,
    geography: str,
    geo_code: str,
    place: str,
    construct: str,
    item_text: str,
    weight_var,
    provenance_url: str,
    note: str,
    period_dates,
    estimate_type: str = "pct",
    with_counts: bool = False,
) -> list[dict]:
    """Turn cells into norm rows. weight_var and period_dates are callables of the period
    key (or a plain string for weight_var). The topline row of each period names the
    subgroup cells skipped for size. With with_counts, a count row (weighted persons) is
    written beside each pct row."""
    rows = []
    for c in cells:
        start, end = period_dates(c.period)
        wv = weight_var(c.period) if callable(weight_var) else weight_var
        text = f"{place}. {note}"
        if c.dim == "all" and skipped.get(c.period):
            text += (f" Subgroup cells with an unweighted base under {MIN_CELL_N} are not "
                     f"stored: {', '.join(skipped[c.period])}.")
        base = dict(
            source=source, source_version=source_version, geography=geography,
            geo_code=geo_code, period_start=start, period_end=end, construct=construct,
            item_text=item_text, response_option=c.option, subgroup_dim=c.dim,
            subgroup_value=c.value, n=c.n, weight_var=wv, provenance_url=provenance_url,
            provenance_note=text,
        )
        rows.append(dict(base, estimate_type=estimate_type, estimate=c.estimate, se=c.se,
                         moe=None if c.se is None else round(Z90 * c.se, 6)))
        if with_counts and c.count is not None:
            rows.append(dict(base, estimate_type="count", estimate=c.count, se=None, moe=None))
    return rows


def year_dates(year) -> tuple[dt.date, dt.date]:
    y = int(year)
    return dt.date(y, 1, 1), dt.date(y, 12, 31)


# -- harmonized recodes --------------------------------------------------------------------

def age_bucket(age: pd.Series) -> pd.Series:
    """18-29 / 30-44 / 45-64 / 65+; under 18 or missing -> NaN. Top-coded ages (89+, 80+)
    land in 65+."""
    a = pd.to_numeric(age, errors="coerce")
    out = pd.Series(np.nan, index=a.index, dtype=object)
    out[(a >= 18) & (a <= 29)] = cat.AGE_BUCKET[0]
    out[(a >= 30) & (a <= 44)] = cat.AGE_BUCKET[1]
    out[(a >= 45) & (a <= 64)] = cat.AGE_BUCKET[2]
    out[a >= 65] = cat.AGE_BUCKET[3]
    return out


def recode(series: pd.Series, mapping: Mapping[object, str]) -> pd.Series:
    """Map codes to labels; anything unmapped becomes NaN."""
    return series.map(mapping).astype(object).where(series.isin(list(mapping)), np.nan)


# -- concordance -------------------------------------------------------------------------

def _as_list(v) -> list:
    if v is None:
        return []
    if isinstance(v, str):
        return list(json.loads(v))
    return list(v)


def merge_concordance(
    store: Store,
    construct: str,
    label: str,
    definition: str,
    *,
    anes_var: Sequence[str] = (),
    gss_var: Sequence[str] = (),
    ces_var: Sequence[str] = (),
    wvs_var: Sequence[str] = (),
    cps_var: str | None = None,
    note: str | None = None,
) -> None:
    """Create the construct's row if missing, else add this source's variable names to it.
    An existing label and definition are kept. note is appended once."""
    found = store.query(
        "SELECT label, definition, anes_var, gss_var, ces_var, wvs_var, acs_table, cps_var, "
        "notes FROM concordance WHERE construct = ?", [construct])
    add = {"anes_var": anes_var, "gss_var": gss_var, "ces_var": ces_var, "wvs_var": wvs_var}
    if found:
        old_label, old_def, a, g, c, w, acs_table, old_cps, notes = found[0]
        row = {"construct": construct, "label": old_label, "definition": old_def,
               "acs_table": acs_table}
        for col, old in zip(ARRAY_COLUMNS_ORDER, (a, g, c, w)):
            merged = list(dict.fromkeys(_as_list(old) + list(add[col])))
            row[col] = merged or None
        cps = [x for x in (old_cps or "").split(", ") if x]
        if cps_var:
            cps = list(dict.fromkeys(cps + [s.strip() for s in cps_var.split(",")]))
        row["cps_var"] = ", ".join(cps) or None
    else:
        notes = None
        row = {"construct": construct, "label": label, "definition": definition,
               "acs_table": None, "cps_var": cps_var}
        for col in ARRAY_COLUMNS_ORDER:
            row[col] = list(add[col]) or None
    if note and note not in (notes or ""):
        notes = f"{notes} {note}".strip() if notes else note
    row["notes"] = notes
    store.upsert_concordance(row)


ARRAY_COLUMNS_ORDER = ("anes_var", "gss_var", "ces_var", "wvs_var")
assert set(ARRAY_COLUMNS_ORDER) == set(ARRAY_COLUMNS)
