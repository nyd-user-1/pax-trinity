"""CES: the full loader over the synthetic 2022 fixture (fixture-first), and the real files
when they are under raw/ces/."""

import pandas as pd
import pytest

from audience import db, migrate, survey
from audience.loaders import ces
from survey_helpers import FIXTURES, count, fixture_frame, norm_rows, pct_cells, pick, weighted_share

FX_DIR = FIXTURES / "ces"


@pytest.fixture
def fx():
    return fixture_frame("ces/CES22_Common_SYNTHETIC.csv")


def test_fixture_is_refused_without_the_flag(store):
    with pytest.raises(survey.SyntheticInput):
        ces.run(store, raw_dir=FX_DIR)
    assert count(store) == 0


def test_recodes(fx):
    d = ces.prepare(fx, 2022).set_index("caseid")
    assert d.loc[1, "_race_eth"] == "Hispanic or Latino"   # race 3
    assert d.loc[2, "_race_eth"] == "Hispanic or Latino"   # white, Hispanic by the follow-up
    assert d.loc[3, "_race_eth"] == "White"                # Middle Eastern
    assert pd.isna(d.loc[3, "_sex"])                       # non-binary: topline only
    assert d.loc[3, "_educ"] == "Some college"             # 2-year degree
    assert d.loc[1, "_age"] == "30-44"                     # 2022 - 1980
    assert d.loc[4, "_prim_state"] == 0                    # unmatched counts as non-voter
    assert d.loc[3, "_prim_state"] == 0 and pd.isna(d.loc[3, "_party_state"])
    assert d.loc[2, "_party_state"] == "Republican"


def test_run_writes_us_and_ma(fx, store):
    written = ces.run(store, raw_dir=FX_DIR, allow_synthetic=True, min_n=5)
    rows = norm_rows(store)
    assert written == len(rows) > 0
    assert {(r["geography"], r["geo_code"]) for r in rows} == {("US", "US"), ("STATE", "25")}
    assert {r["source_version"] for r in rows} == {"CES 2022 Common Content"}
    ma = fx[fx["inputstate"] == 25]
    got = pick(rows, geo_code="25", construct="party_id_7", subgroup_dim="all",
               response_option="Strong Democrat")
    assert got["estimate"] == pytest.approx(
        weighted_share(ma, "pid7", "commonweight", range(1, 9), [1]), abs=1e-5)
    for total in pct_cells(rows).values():
        assert total == pytest.approx(100.0, abs=1e-4)


def test_post_wave_items_use_the_post_weight(fx, store):
    ces.run(store, raw_dir=FX_DIR, allow_synthetic=True, min_n=5)
    got = pick(norm_rows(store, "construct = 'trust_gov'"), geo_code="US", subgroup_dim="all",
               response_option="None at all")
    assert got["weight_var"] == "commonpostweight"
    post = fx.assign(commonpostweight=fx["commonpostweight"].fillna(0))
    assert got["estimate"] == pytest.approx(
        weighted_share(post, "CC22_423", "commonpostweight", [1, 2, 3, 8], [8]), abs=1e-5)
    assert got["n"] == (post["CC22_423"].isin([1, 2, 3, 8]) & (post["commonpostweight"] > 0)).sum()


def test_validated_primary_turnout_counts_unmatched_as_non_voters(fx, store):
    ces.run(store, raw_dir=FX_DIR, allow_synthetic=True, min_n=5)
    got = pick(norm_rows(store, "construct = 'primary_turnout_validated'"), geo_code="US",
               subgroup_dim="all", response_option="Voted (validated record)")
    voted = fx["TS_p2022"].between(1, 6)
    assert got["n"] == len(fx)
    assert got["estimate"] == pytest.approx(
        100 * fx.loc[voted, "commonweight"].sum() / fx["commonweight"].sum(), abs=1e-5)


def test_rerun_is_idempotent_and_concordance_is_written(store):
    ces.run(store, raw_dir=FX_DIR, allow_synthetic=True, min_n=5)
    first = count(store)
    ces.run(store, raw_dir=FX_DIR, allow_synthetic=True, min_n=5)
    assert count(store) == first
    got = dict(store.query("SELECT construct, ces_var FROM concordance WHERE ces_var IS NOT NULL"))
    assert "pid7" in got["party_id_7"] and "TS_p2022" in got["primary_turnout_validated"]


def test_absent_files_print_the_dataverse_links(store, tmp_path, capsys):
    assert ces.run(store, raw_dir=tmp_path) == 0
    out = capsys.readouterr().out
    assert "dataverse.harvard.edu/api/access/datafile/10140882" in out
    assert count(store) == 0


@pytest.fixture(scope="session")
def ces_real(tmp_path_factory):
    files = ces.locate()
    if not files or any(survey.SYNTHETIC_MARK in p.name.upper() for p in files.values()):
        pytest.skip("no real CES common-content file under raw/ces/")
    s = db.connect(duckdb_path=tmp_path_factory.mktemp("ces") / "norms.duckdb")
    migrate.apply(s, quiet=True)
    written = ces.run(s, bulk=False)   # the 7 alone; test_ces_bulk covers the bulk tier
    yield s, files, written
    s.close()


def test_real_run_shape(ces_real):
    store, files, written = ces_real
    rows = norm_rows(store)
    assert written == len(rows) > 0
    assert {r["source_version"] for r in rows} == {ces.source_version(y) for y in files}
    assert min(r["n"] for r in rows) >= survey.MIN_CELL_N
    for total in pct_cells(rows).values():
        assert total == pytest.approx(100.0, abs=1e-3)
    pres = {r["geo_code"] for r in rows if "presidential primary" in r["item_text"]}
    assert pres <= {"25"}   # combined-primary states make a national figure undercount
