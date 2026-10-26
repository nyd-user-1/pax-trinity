"""Read-only JSON API over audience.api: uvicorn audience.server:app

Five GET routes, one per api call. Each request opens the store read-only and closes it.
"""

from __future__ import annotations

import re
from typing import Iterator

from fastapi import Depends, FastAPI, HTTPException, Query

from . import api
from .db import Store

app = FastAPI(title="audience", description="Read-only query layer over the audience store.",
              version="0.1.0")


def get_store() -> Iterator[Store]:
    store = api.open_store()
    try:
        yield store
    finally:
        store.close()


def parse_year(year: str | None):
    """'latest', '2020', or '2016-2020'."""
    if year is None or year == "latest":
        return year
    if re.fullmatch(r"\d{4}", year):
        return int(year)
    m = re.fullmatch(r"(\d{4})-(\d{4})", year)
    if m:
        return int(m.group(1)), int(m.group(2))
    raise HTTPException(422, "year must be 'latest', YYYY, or YYYY-YYYY")


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.get("/norms")
def norms(construct: str, geography: str, geo_code: str, subgroup_dim: str | None = None,
          year: str | None = None, store: Store = Depends(get_store)) -> list[dict]:
    return _call(api.get_norm, construct, geography, geo_code, subgroup_dim, parse_year(year),
                 store=store)


@app.get("/population-targets")
def population_targets(geo_code: str, dims: list[str] = Query(list(api.DEFAULT_DIMS)),
                       store: Store = Depends(get_store)) -> dict[str, dict[str, float]]:
    return _call(api.get_population_targets, geo_code, dims, store=store)


@app.get("/topic-series/{construct}")
def topic_series(construct: str, subgroup_dim: str | None = "all",
                 store: Store = Depends(get_store)) -> list[dict]:
    return _call(api.get_topic_series, construct, subgroup_dim, store=store)


@app.get("/lift-benchmark/{outcome_type}")
def lift_benchmark(outcome_type: str, store: Store = Depends(get_store)) -> dict:
    return _call(api.get_lift_benchmark, outcome_type, store=store)


@app.get("/place-lift/{outcome_type}")
def place_lift(outcome_type: str, lift_pp: float, store: Store = Depends(get_store)) -> dict:
    return _call(api.place_lift, lift_pp, outcome_type, store=store)
