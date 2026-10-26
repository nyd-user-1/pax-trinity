import pytest

from audience import db, migrate
from audience.loaders import acs
from conftest import need


def q(store, sql, params=()):
    return store.query(sql, params)


def ma_sum(store, construct):
    return float(q(store,
        "SELECT sum(estimate) FROM norms WHERE source = 'ACS' AND geo_code = '25' "
        "AND construct = ? AND subgroup_dim = 'all' AND estimate_type = 'count'",
        [construct])[0][0])


def test_no_line_is_counted_twice_within_a_collapse():
    for c in acs.COLLAPSES:
        lines = [n for _, group in c.groups for n in group]
        assert len(lines) == len(set(lines)), c


def test_collapses_exhaust_their_published_totals():
    """Every collapse with a published total line must add back up to it, exactly, in
    every cached geography (ACS B-tables are additive)."""
    try:
        records, _ = acs.read_cache(acs.LATEST_VINTAGE)
    except FileNotFoundError:
        pytest.skip("ACS raw cache absent")
    for c in acs.COLLAPSES:
        if not c.total_line:
            continue
        for rec in records[c.table]:
            total = float(rec[acs.var(c.table, c.total_line, "E")])
            parts = sum(float(rec[acs.var(c.table, n, "E")])
                        for _, group in c.groups for n in group)
            assert parts == total, (c.construct, rec["NAME"])


def test_ma_total_population_matches_published(loaded):
    # ACS 2020-2024 5-year, B01001_001E, Massachusetts: 7,044,056.
    # https://data.census.gov/table/ACSDT5Y2024.B01001?g=040XX00US25
    # https://api.census.gov/data/2024/acs/acs5?get=NAME,B01001_001E&for=state:25
    store, counts = loaded
    need(counts, "ACS")
    assert ma_sum(store, "race_eth") == 7_044_056
    assert ma_sum(store, "citizenship") == 7_044_056


def test_ma_adult_population_matches_published(loaded):
    # ACS 2020-2024 5-year, DP05_0021E (18 years and over), Massachusetts: 5,679,875.
    # https://data.census.gov/table/ACSDP5Y2024.DP05?g=040XX00US25
    # https://api.census.gov/data/2024/acs/acs5/profile?get=NAME,DP05_0021E&for=state:25
    store, counts = loaded
    need(counts, "ACS")
    assert ma_sum(store, "sex") == 5_679_875
    assert ma_sum(store, "age_bucket") == 5_679_875


def test_every_count_has_a_pct_twin_and_shares_total_100(loaded):
    store, counts = loaded
    need(counts, "ACS")
    by_type = dict(q(store, "SELECT estimate_type, count(*) FROM norms WHERE source = 'ACS' GROUP BY 1"))
    assert by_type["count"] == by_type["pct"]
    off = q(store, """
        SELECT geo_code, construct, subgroup_value, sum(estimate) AS s FROM norms
        WHERE source = 'ACS' AND estimate_type = 'pct'
        GROUP BY geo_code, construct, subgroup_value HAVING abs(sum(estimate) - 100) > 0.0001
    """)
    assert off == []


def test_geographies_cover_us_ma_counties_and_towns(loaded):
    store, counts = loaded
    need(counts, "ACS")
    levels = dict(q(store, "SELECT geography, count(DISTINCT geo_code) FROM norms "
                           "WHERE source = 'ACS' GROUP BY 1"))
    assert levels["US"] == 1 and levels["STATE"] == 1 and levels["COUNTY"] == 14
    assert levels["TOWN"] == 351  # 357 county subdivisions less 6 with no population


def test_acs_loader_rerun_does_not_change_the_count(tmp_path, loaded):
    _, counts = loaded
    need(counts, "ACS")
    s = db.connect(duckdb_path=tmp_path / "rerun.duckdb")
    migrate.apply(s, quiet=True)
    acs.run(s)
    first = q(s, "SELECT count(*) FROM norms")[0][0]
    acs.run(s)
    assert q(s, "SELECT count(*) FROM norms")[0][0] == first > 0
    assert q(s, "SELECT count(DISTINCT natural_key) FROM norms")[0][0] == first
    s.close()
