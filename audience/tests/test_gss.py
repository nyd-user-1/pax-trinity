"""GSS: recode logic on the synthetic fixture, and a spot-check of the real cumulative file
against the 2024 codebook's published frequencies."""

import pandas as pd
import pytest

from audience import db, migrate, survey
from audience.loaders import gss
from survey_helpers import count, fixture_frame, norm_rows, pct_cells, pick, weighted_share

VERSION = "GSS fixture"


@pytest.fixture
def fx():
    return fixture_frame("gss/gss_SYNTHETIC.csv")


def test_recodes(fx):
    d = gss.prepare(fx).set_index("id")
    assert d.loc[1, "_educ"] == "Some college"   # high school degree, 14 years of school
    assert d.loc[2, "_educ"] == "HS or less"
    assert d.loc[5, "_educ"] == "Grad"
    assert pd.isna(d.loc[3, "_party"])           # PARTYID 7, other party
    assert d.loc[4, "_age"] == "65+"             # 89 or older
    assert set(d["_race"].dropna()) <= {"White", "Black", "Other"}


def test_weight_follows_the_codebook_by_era(fx):
    w = gss.weight(fx)
    early, late = fx["year"] < 2004, fx["year"] >= 2004
    assert (w[early] == fx.loc[early, "wtssps"]).all()
    assert (w[late] == fx.loc[late, "wtssnrps"]).all()
    assert (gss.weight_var(2002), gss.weight_var(2004)) == ("WTSSPS", "WTSSNRPS")


def test_rows_match_an_independent_weighted_share(fx, store):
    gss.write_concordance(store)
    store.upsert_norms(gss.build_rows(fx, VERSION, min_n=5))
    late = fx[fx["year"] == 2010].assign(w=fx["wtssnrps"])
    expected = weighted_share(late, "confed", "w", [1, 2, 3], [3])
    got = pick(norm_rows(store, "construct = 'confidence_federal_executive'"),
               period_start=pd.Timestamp("2010-01-01").date(), subgroup_dim="all",
               response_option="Hardly any")
    assert got["estimate"] == pytest.approx(expected, abs=1e-5)
    assert got["n"] == late["confed"].isin([1, 2, 3]).sum()
    assert got["weight_var"] == "WTSSNRPS"
    for total in pct_cells(norm_rows(store)).values():
        assert total == pytest.approx(100.0, abs=1e-4)


def test_cells_under_the_minimum_are_not_stored(fx):
    rows = gss.build_rows(fx, VERSION, min_n=20)   # 25 respondents a year
    assert rows and all(r["n"] >= 20 for r in rows)
    top = [r for r in rows if r["subgroup_dim"] == "all"]
    assert all("are not stored: " in r["provenance_note"] for r in top)


def test_rerun_on_the_fixture_is_idempotent(fx, store):
    gss.write_concordance(store)
    store.upsert_norms(gss.build_rows(fx, VERSION, min_n=5), prune=("GSS", VERSION))
    first = count(store)
    store.upsert_norms(gss.build_rows(fx, VERSION, min_n=5), prune=("GSS", VERSION))
    assert count(store) == first > 0


# -- real data -------------------------------------------------------------------------------

@pytest.fixture(scope="session")
def gss_real(tmp_path_factory):
    path = gss.locate()
    if path is None or survey.SYNTHETIC_MARK in path.name.upper():
        pytest.skip("GSS cumulative file not under raw/gss/ (python -m audience.load gss fetches it)")
    s = db.connect(duckdb_path=tmp_path_factory.mktemp("gss") / "norms.duckdb")
    migrate.apply(s, quiet=True)
    written = gss.run(s)
    yield s, path, written
    s.close()


def test_spot_check_confed_2024_against_the_codebook(gss_real):
    """GSS 2024 Codebook R3a, CONFED, p. 220 (unweighted, excluding reserve codes):
    A great deal 266 (12.4%), Only some 876 (40.8%), Hardly any 1003 (46.8%), n 2145.
    https://gss.norc.org/content/dam/gss/get-documentation/pdf/codebook/GSS%202024%20Codebook%20R3a.pdf
    """
    store, path, _ = gss_real
    df = gss.read_frame(path)
    df = df[df["year"] == 2024].assign(one=1.0)
    cells, _ = survey.shares(df, "confed", "one", gss.CONF, min_n=1)
    got = {c.option: round(c.estimate, 1) for c in cells}
    assert got == {"A great deal": 12.4, "Only some": 40.8, "Hardly any": 46.8}
    assert {c.n for c in cells} == {2145}
    stored = norm_rows(store, "construct = 'confidence_federal_executive' AND subgroup_dim = 'all' "
                              "AND period_start = DATE '2024-01-01'")
    assert {r["n"] for r in stored} == {2145}
    assert {r["weight_var"] for r in stored} == {"WTSSNRPS"}


def test_real_run_shape(gss_real):
    store, _, written = gss_real
    rows = norm_rows(store)
    assert written == len(rows) > 10_000
    assert min(r["n"] for r in rows) >= survey.MIN_CELL_N
    years = {r["period_start"].year for r in rows}
    assert min(years) == 1972 and max(years) == 2024
    for total in pct_cells(rows).values():
        assert total == pytest.approx(100.0, abs=1e-3)
    assert all(r["provenance_url"] == gss.DATA_URL for r in rows)
