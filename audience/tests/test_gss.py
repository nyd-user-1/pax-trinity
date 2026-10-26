"""GSS: recode logic on the synthetic fixture, a spot-check of the real cumulative file
against the 2024 codebook's published frequencies, and two bulk-tier variables against the
GSS Data Explorer's published 2024 counts."""

import json

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
    written = gss.run(s, bulk_tier=False)   # the harmonized constructs; the bulk tier below
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


# -- the bulk tier, real data ------------------------------------------------------------------

SPOT = ("abany", "cappun")


@pytest.fixture(scope="session")
def gss_bulk(tmp_path_factory):
    path = gss.locate()
    if path is None or survey.SYNTHETIC_MARK in path.name.upper():
        pytest.skip("GSS cumulative file not under raw/gss/ (python -m audience.load gss fetches it)")
    s = db.connect(duckdb_path=tmp_path_factory.mktemp("gss_bulk") / "norms.duckdb")
    migrate.apply(s, quiet=True)
    version = gss.source_version(path)
    scan, keys = gss.load_bulk(s, path, version, only=list(SPOT) + ["sex", "wtssnrps", "age"])
    yield s, path, scan
    s.close()


@pytest.mark.parametrize("var, counts", [
    # GSS Data Explorer, ABANY (https://gssdataexplorer.norc.org/variables/607/vshow), 2024:
    # YES 1281, NO 859; .i 1067, .n 18, .d 65, .s 19 left out.
    ("abany", {"Yes": 1281, "No": 859}),
    # GSS Data Explorer, CAPPUN (https://gssdataexplorer.norc.org/variables/268/vshow), 2024:
    # FAVOR 1243, OPPOSE 824; .i 1116, .n 14, .d 83, .s 29 left out.
    ("cappun", {"Favor": 1243, "Oppose": 824}),
])
def test_spot_check_bulk_2024_against_data_explorer(gss_bulk, var, counts):
    store, path, _ = gss_bulk
    n = sum(counts.values())
    df = gss.read_columns(path, ["year", var])
    df = df[df["year"] == 2024].assign(one=1.0)
    import pyreadstat

    _, meta = pyreadstat.read_dta(str(path), metadataonly=True, encoding=gss.ENCODING)
    options, _ = gss.bulk.options_for(df[var], meta.variable_value_labels[var])
    cells, _ = survey.shares(df, var, "one", options, min_n=1)
    got = {c.option: round(c.estimate, 1) for c in cells}
    assert got == {k: round(100 * v / n, 1) for k, v in counts.items()}
    assert {c.n for c in cells} == {n}
    stored = norm_rows(store, f"construct = '{var}' AND period_start = DATE '2024-01-01'")
    top = [r for r in stored if r["subgroup_dim"] == "all"]
    assert {r["n"] for r in top} == {n} and {r["response_option"] for r in top} == set(counts)
    assert {r["weight_var"] for r in stored} == {"WTSSNRPS"}
    assert {r["subgroup_dim"] for r in stored} == {"all", "sex", "age", "race", "educ", "party"}
    assert {r["provenance_url"] for r in stored} == {gss.explorer_url(var, gss.explorer_catalog())}
    for total in pct_cells(stored).values():
        assert total == pytest.approx(100.0, abs=1e-3)


def test_bulk_years_carry_toplines_only_before_the_latest(gss_bulk):
    store, _, scan = gss_bulk
    rows = norm_rows(store, "construct = 'abany'")
    years = sorted({r["period_start"].year for r in rows})
    assert years == scan.years["abany"] and years[0] == 1977 and years[-1] == 2024
    assert {r["subgroup_dim"] for r in rows if r["period_start"].year < 2024} == {"all"}
    assert min(r["n"] for r in rows) >= survey.MIN_CELL_N


def test_bulk_skips_collisions_and_admin(gss_bulk):
    store, _, scan = gss_bulk
    assert sorted(scan.taken) == sorted(SPOT)
    assert scan.skipped["construct id already taken"] == ["sex"]          # the ACS construct
    assert scan.skipped["administrative, technical or paradata"] == ["wtssnrps"]
    label, definition, gvars, notes = store.query(
        "SELECT label, definition, gss_var, notes FROM concordance WHERE construct = 'abany'")[0]
    assert label == definition == "Abortion if woman wants for any reason"
    assert gss.BULK_NOTE in notes and json.loads(gvars) == ["ABANY"]
    order = store.query("SELECT response_option FROM response_order WHERE construct = 'abany' "
                        "ORDER BY ordinal")
    assert [r[0] for r in order] == ["Yes", "No"]
