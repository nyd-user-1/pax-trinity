from audience import db, migrate
from audience.loaders import cvap
from conftest import need


def q(store, sql, params=()):
    return store.query(sql, params)


def cvap_total(store, geo_code):
    return float(q(store,
        "SELECT estimate FROM norms WHERE source = 'CVAP' AND construct = 'cvap' "
        "AND geo_code = ? AND subgroup_dim = 'all' AND estimate_type = 'count'",
        [geo_code])[0][0])


def test_ma_cvap_matches_published(loaded):
    # ACS 2020-2024 5-year, B29001_001E (citizen, voting-age population), Massachusetts:
    # 5,155,254. The special tabulation rounds independently, so it may differ by a person
    # or two from the B-table.
    # https://data.census.gov/table/ACSDT5Y2024.B29001?g=040XX00US25
    # https://api.census.gov/data/2024/acs/acs5?get=NAME,B29001_001E&for=state:25
    store, counts = loaded
    need(counts, "CVAP")
    assert abs(cvap_total(store, "25") - 5_155_254) <= 2


def test_us_cvap_matches_published(loaded):
    # B29001_001E, United States: 240,833,681.
    # https://data.census.gov/table/ACSDT5Y2024.B29001?g=010XX00US
    # https://api.census.gov/data/2024/acs/acs5?get=NAME,B29001_001E&for=us:1
    store, counts = loaded
    need(counts, "CVAP")
    assert abs(cvap_total(store, "US") - 240_833_681) <= 5


def test_cvap_shares_total_100_and_citizen_shares_stay_valid(loaded):
    store, counts = loaded
    need(counts, "CVAP")
    off = q(store, """
        SELECT geo_code, sum(estimate) FROM norms
        WHERE source = 'CVAP' AND construct = 'race_eth' AND estimate_type = 'pct'
        GROUP BY geo_code HAVING abs(sum(estimate) - 100) > 0.0001
    """)
    assert off == []
    assert q(store, "SELECT count(*) FROM norms WHERE source = 'CVAP' AND construct = 'cvap' "
                    "AND estimate_type = 'pct' AND (estimate < 0 OR estimate > 100)")[0][0] == 0


def test_cvap_levels_and_provenance(loaded):
    store, counts = loaded
    need(counts, "CVAP")
    levels = dict(q(store, "SELECT geography, count(DISTINCT geo_code) FROM norms "
                           "WHERE source = 'CVAP' GROUP BY 1"))
    assert set(levels) == {"US", "STATE", "COUNTY", "TOWN", "BLOCKGROUP"}
    assert levels["COUNTY"] == 14 and levels["BLOCKGROUP"] > 5000
    urls = q(store, "SELECT DISTINCT provenance_url FROM norms WHERE source = 'CVAP'")
    assert urls == [(cvap.RELEASE_URL,)]
    assert q(store, "SELECT count(*) FROM norms WHERE source = 'CVAP' "
                    "AND provenance_note NOT LIKE '%' || ? || '%'", [cvap.LAKE])[0][0] == 0


def test_cvap_loader_rerun_does_not_change_the_count(tmp_path, loaded):
    _, counts = loaded
    need(counts, "CVAP")
    s = db.connect(duckdb_path=tmp_path / "rerun.duckdb")
    migrate.apply(s, quiet=True)
    cvap.run(s)
    first = q(s, "SELECT count(*) FROM norms")[0][0]
    cvap.run(s)
    assert q(s, "SELECT count(*) FROM norms")[0][0] == first > 0
    s.close()
