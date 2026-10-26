"""The read-only query layer, over the real store (read-only) and a seeded temp store."""

import datetime as dt

import duckdb
import pytest

from audience import api, config
from conftest import make_row


@pytest.fixture(scope="module")
def real():
    if not config.DEFAULT_DUCKDB.exists():
        pytest.skip("no real store at store/norms.duckdb")
    s = api.open_store()
    yield s
    s.close()


def has(store, where, params=()):
    return store.query(f"SELECT count(*) FROM norms WHERE {where}", params)[0][0] > 0


def test_the_store_is_opened_read_only(real):
    with pytest.raises(duckdb.Error):
        real.execute("DELETE FROM norms WHERE 1 = 0")


def test_get_norm_filters_by_year(real):
    if not has(real, "source = 'GSS'"):
        pytest.skip("GSS not loaded")
    every = api.get_norm("social_trust", "US", "US", "all", store=real)
    one = api.get_norm("social_trust", "US", "US", "all", year=2018, store=real)
    span = api.get_norm("social_trust", "US", "US", "all", year=(2016, 2022), store=real)
    latest = api.get_norm("social_trust", "US", "US", "all", year="latest", store=real)
    assert len(every) > len(span) > len(one) > 0
    assert {r["period_end"].year for r in one} == {2018}
    assert {r["period_end"].year for r in span} <= set(range(2016, 2023))
    assert {(r["source"], r["period_end"].year) for r in latest} == {("GSS", 2024)}
    assert all(isinstance(r["estimate"], float) for r in every)
    assert set(every[0]) == set(api.NORM_FIELDS)


def test_population_targets_sum_to_one(real):
    if not has(real, "source = 'ACS' AND geo_code = '25'"):
        pytest.skip("ACS not loaded")
    targets = api.get_population_targets("25", store=real)
    assert set(targets) == set(api.DEFAULT_DIMS)
    for dim, shares in targets.items():
        assert sum(shares.values()) == pytest.approx(1.0, abs=1e-9), dim
        assert all(0 < v < 1 for v in shares.values())
    assert set(targets["sex"]) == {"Male", "Female"}
    assert len(targets["hh_income_bucket"]) == 6
    with pytest.raises(LookupError):
        api.get_population_targets("25", dims=["no_such_dim"], store=real)


def test_population_targets_take_race_from_cvap(real):
    if not has(real, "source = 'CVAP' AND geo_code = '25'"):
        pytest.skip("CVAP not loaded")
    shares = api.get_population_targets("25", dims=["race_eth"], store=real)["race_eth"]
    cvap = {r["response_option"]: r["estimate"] / 100 for r in api.get_norm(
        "race_eth", "STATE", "25", "all", store=real)
        if r["source"] == "CVAP" and r["estimate_type"] == "pct"}
    assert shares == pytest.approx(cvap, abs=1e-6)


def test_lift_benchmark_and_placement(real):
    if not has(real, "source = 'LIFT_ARCHIVE'"):
        pytest.skip("lift dataset not loaded")
    b = api.get_lift_benchmark("vote_choice", store=real)
    assert b["p10"] < b["p25"] < b["p50"] < b["p75"] < b["p90"]
    assert b["cycles"] == [2018, 2020] and b["n_ads"] >= 575
    placed = api.place_lift(b["p50"], "lift_vote_choice", store=real)
    assert placed["percentile"] == pytest.approx(50, abs=1)
    assert placed["benchmark"] == b
    for phrase in ("2018/2020", "forced exposure", "not a ranking"):
        assert phrase in placed["caveat"]
    assert api.place_lift(-100, "vote_choice", store=real)["percentile"] == 0
    with pytest.raises(LookupError):
        api.get_lift_benchmark("turnout", store=real)
    with pytest.raises(ValueError):
        api.place_lift(float("nan"), "vote_choice", store=real)


def test_topic_series_on_the_real_store(real):
    if not has(real, "source IN ('POLL', 'ELECTION_RESULT')"):
        pytest.skip("no POLL or ELECTION_RESULT rows yet (python -m audience.load polls)")
    construct = real.query("SELECT construct FROM norms WHERE source = 'POLL' LIMIT 1")[0][0]
    series = api.get_topic_series(construct, store=real)
    ends = [r["period_end"] for r in series]
    assert series and ends == sorted(ends)
    assert all(r["provenance_url"] for r in series)


def test_topic_series_orders_polls_and_results(store):
    store.upsert_concordance({"construct": "open_primaries_support", "label": "Open primaries",
                              "definition": "Support for open primaries."})
    rows = [
        make_row(source="POLL", source_version="poll B", construct="open_primaries_support",
                 period_start=dt.date(2023, 9, 1), period_end=dt.date(2023, 9, 30),
                 response_option="Support", estimate_type="pct", estimate=66.0, n=1000,
                 provenance_url="https://example.org/b"),
        make_row(source="POLL", source_version="poll A", construct="open_primaries_support",
                 period_start=dt.date(2016, 5, 12), period_end=dt.date(2016, 5, 15),
                 response_option="Open primary", estimate_type="pct", estimate=69.0,
                 provenance_url="https://example.org/a"),
        make_row(source="ELECTION_RESULT", source_version="result", construct="open_primaries_support",
                 period_start=dt.date(2020, 11, 3), period_end=dt.date(2020, 11, 3),
                 response_option="Yes", estimate_type="pct", estimate=40.9,
                 provenance_url="https://example.org/r"),
        make_row(source="ACS", construct="open_primaries_support", response_option="ignored",
                 estimate_type="pct"),
    ]
    store.upsert_norms(rows)
    series = api.get_topic_series("open_primaries_support", store=store)
    assert [r["response_option"] for r in series] == ["Open primary", "Yes", "Support"]
    assert series[2]["n"] == 1000 and series[0]["provenance_url"] == "https://example.org/a"


def test_lock_is_waited_out(tmp_path, monkeypatch):
    path = tmp_path / "norms.duckdb"
    duckdb.connect(str(path)).close()
    real_connect, calls = duckdb.connect, []

    def flaky(*a, **k):
        calls.append(1)
        if len(calls) < 3:
            raise duckdb.IOException('IO Error: Could not set lock on file "norms.duckdb"')
        return real_connect(*a, **k)

    monkeypatch.setattr(duckdb, "connect", flaky)
    s = api.open_store(duckdb_path=path, wait=0)
    assert len(calls) == 3
    s.close()


def test_a_pax_only_benchmark_gets_its_own_caveat(store):
    store.upsert_concordance({"construct": "lift_support", "label": "Lift: support",
                              "definition": "Effect on support."})
    store.upsert_norms([make_row(source="PAX_TEST", source_version="PAX test waves",
                                 geography="US", geo_code="US", construct="lift_support",
                                 period_start=dt.date(2026, 10, 1), period_end=dt.date(2026, 10, 7),
                                 response_option=f"cut-{i}", estimate_type="lift_pp", estimate=float(i))
                        for i in range(5)])
    placed = api.place_lift(2.0, "support", store=store)
    assert placed["percentile"] == 50.0
    assert "PAX's own earlier message tests" in placed["caveat"] and "2018" not in placed["caveat"]
