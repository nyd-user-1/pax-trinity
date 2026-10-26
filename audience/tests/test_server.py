"""The read-only JSON router, end to end with FastAPI's TestClient over the real store."""

import pytest

from audience import config


def test_the_five_routes():
    if not config.DEFAULT_DUCKDB.exists():
        pytest.skip("no real store at store/norms.duckdb")
    from fastapi.testclient import TestClient

    from audience.server import app

    client = TestClient(app)

    r = client.get("/norms", params={"construct": "sex", "geography": "STATE", "geo_code": "25",
                                     "subgroup_dim": "all", "year": "latest"})
    assert r.status_code == 200
    rows = r.json()
    assert rows and {row["source"] for row in rows} == {"ACS"}
    assert rows[0]["period_end"] == "2024-12-31"
    assert client.get("/norms", params={"construct": "sex", "geography": "STATE",
                                        "geo_code": "25", "year": "soon"}).status_code == 422

    r = client.get("/population-targets", params=[("geo_code", "25"), ("dims", "sex"), ("dims", "age_bucket")])
    assert r.status_code == 200
    assert set(r.json()) == {"sex", "age_bucket"}
    assert sum(r.json()["sex"].values()) == pytest.approx(1.0)

    r = client.get("/topic-series/open_primaries_support")
    assert r.status_code == 200 and isinstance(r.json(), list)

    r = client.get("/lift-benchmark/vote_choice")
    assert r.status_code == 200
    bench = r.json()
    assert set(bench) == {"p10", "p25", "p50", "p75", "p90", "n_ads", "cycles"}

    r = client.get("/place-lift/vote_choice", params={"lift_pp": 2.0})
    assert r.status_code == 200
    placed = r.json()
    assert 0 <= placed["percentile"] <= 100 and "not a ranking" in placed["caveat"]
    assert client.get("/lift-benchmark/turnout").status_code == 404

    assert client.post("/norms").status_code == 405   # read-only: GET only
