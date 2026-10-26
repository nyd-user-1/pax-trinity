"""Shared helpers for the survey-loader tests."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path

import pandas as pd

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def fixture_frame(name: str) -> pd.DataFrame:
    return pd.read_csv(FIXTURES / name)


def norm_rows(store, where: str = "1=1", params=()) -> list[dict]:
    cur_cols = ["source", "source_version", "geography", "geo_code", "period_start", "period_end",
                "construct", "item_text", "response_option", "subgroup_dim", "subgroup_value",
                "estimate", "estimate_type", "n", "se", "moe", "weight_var",
                "provenance_url", "provenance_note"]
    rows = store.query(f"SELECT {', '.join(cur_cols)} FROM norms WHERE {where}", params)
    out = []
    for r in rows:
        d = dict(zip(cur_cols, r))
        for k in ("estimate", "se", "moe"):
            d[k] = None if d[k] is None else float(d[k])
        out.append(d)
    return out


def count(store, where: str = "1=1", params=()) -> int:
    return store.query(f"SELECT count(*) FROM norms WHERE {where}", params)[0][0]


def pct_cells(rows: list[dict]) -> dict[tuple, float]:
    """Sum of pct estimates per cell (everything but the response option)."""
    sums: dict[tuple, float] = defaultdict(float)
    for r in rows:
        if r["estimate_type"] == "pct":
            key = (r["source_version"], r["geo_code"], r["period_start"], r["construct"],
                   r["item_text"], r["subgroup_dim"], r["subgroup_value"])
            sums[key] += r["estimate"]
    return sums


def weighted_share(df: pd.DataFrame, item: str, weight: str, base_codes, codes) -> float:
    """Independent check: 100 * weight of codes / weight of base_codes."""
    base = df[df[item].isin(list(base_codes)) & (df[weight] > 0)]
    return 100 * base.loc[base[item].isin(list(codes)), weight].sum() / base[weight].sum()


def pick(rows: list[dict], **match) -> dict:
    found = [r for r in rows if all(r.get(k) == v for k, v in match.items())]
    assert len(found) == 1, f"{len(found)} rows match {match}"
    return found[0]
