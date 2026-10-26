"""ANES: recode logic on the synthetic fixture, and the real cumulative file end to end."""

import pandas as pd
import pytest

from audience import db, migrate, survey
from audience.loaders import anes
from survey_helpers import count, fixture_frame, norm_rows, pct_cells, pick, weighted_share

VERSION = "ANES fixture"


@pytest.fixture
def fx():
    return fixture_frame("anes/anes_cdf_SYNTHETIC.csv")


def test_recodes(fx):
    d = anes.prepare(fx).set_index("VCF0006")
    assert pd.isna(d.loc[1, "_age"]) and pd.isna(d.loc[2, "_age"])   # 17, and 0 = NA
    assert d.loc[3, "_race_eth"] == "Hispanic or Latino"
    assert d.loc[4, "_educ"] == "BA"
    assert set(d["_party"].dropna()) <= {"Democrat", "Independent", "Republican"}


def test_offered_answers_stay_and_dont_knows_go(fx, store):
    anes.write_concordance(store)
    store.upsert_norms(anes.build_rows(fx, VERSION, min_n=5))
    ideo = norm_rows(store, "construct = 'ideology_7' AND subgroup_dim = 'all'")
    assert "Haven't thought much about it (incl. don't know)" in {r["response_option"] for r in ideo}
    honest = norm_rows(store, "construct = 'cand_trait_honest' AND subgroup_dim = 'all'")
    for year in (2016, 2020):
        yr = fx[fx["VCF0004"] == year]
        assert {r["n"] for r in honest if r["period_start"].year == year} == {yr["VCF9212"].between(1, 5).sum()}
    egal = pick(norm_rows(store, "construct = 'egalitarianism'"), subgroup_dim="all",
                period_start=pd.Timestamp("2020-01-01").date(), response_option="Agree strongly")
    yr = fx[fx["VCF0004"] == 2020]
    assert egal["estimate"] == pytest.approx(
        weighted_share(yr, "VCF9013", "VCF0009z", [1, 2, 3, 4, 5], [1]), abs=1e-5)
    for total in pct_cells(norm_rows(store)).values():
        assert total == pytest.approx(100.0, abs=1e-4)


def test_thermometer_mean_drops_dk_and_na(fx, store):
    anes.write_concordance(store)
    store.upsert_norms(anes.build_rows(fx, VERSION, min_n=5))
    yr = fx[(fx["VCF0004"] == 2016) & fx["VCF0218"].between(0, 97)]
    expected = (yr["VCF0218"] * yr["VCF0009z"]).sum() / yr["VCF0009z"].sum()
    got = pick(norm_rows(store, "construct = 'thermometer_dem'"), subgroup_dim="all",
               period_start=pd.Timestamp("2016-01-01").date())
    assert got["estimate_type"] == "mean"
    assert got["estimate"] == pytest.approx(expected, abs=1e-5)
    assert got["n"] == len(yr)


def test_rerun_on_the_fixture_is_idempotent(fx, store):
    anes.write_concordance(store)
    store.upsert_norms(anes.build_rows(fx, VERSION, min_n=5), prune=("ANES", VERSION))
    first = count(store)
    store.upsert_norms(anes.build_rows(fx, VERSION, min_n=5), prune=("ANES", VERSION))
    assert count(store) == first > 0


def test_concordance_names_the_brief_variables(store):
    anes.write_concordance(store)
    got = dict(store.query("SELECT construct, anes_var FROM concordance WHERE anes_var IS NOT NULL"))
    assert "VCF0604" in got["trust_gov"] and "VCF0609" in got["efficacy_external"]
    assert "VCF0613" in got["efficacy_external"] and "VCF0611" in got["parties_care"]


@pytest.fixture(scope="session")
def anes_real(tmp_path_factory):
    path = anes.locate()
    if path is None or survey.SYNTHETIC_MARK in path.name.upper():
        pytest.skip("ANES CDF not under raw/anes/ (python -m audience.load anes fetches it)")
    s = db.connect(duckdb_path=tmp_path_factory.mktemp("anes") / "norms.duckdb")
    migrate.apply(s, quiet=True)
    written = anes.run(s)
    yield s, written
    s.close()


def test_real_run_shape(anes_real):
    store, written = anes_real
    rows = norm_rows(store)
    assert written == len(rows) > 10_000
    assert min(r["n"] for r in rows) >= survey.MIN_CELL_N
    years = {r["period_start"].year for r in rows}
    assert min(years) == 1952 and max(years) == 2024
    for total in pct_cells(rows).values():
        assert total == pytest.approx(100.0, abs=1e-3)
    trust = {r["period_start"].year for r in rows if r["construct"] == "trust_gov"}
    assert min(trust) == 1958 and max(trust) == 2012


def test_real_rerun_leaves_the_count_unchanged(anes_real):
    store, written = anes_real
    assert anes.run(store) == written
    assert count(store) == written
