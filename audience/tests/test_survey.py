"""The shared survey machinery: weighted shares and means, the cell rule, concordance merging,
the synthetic-fixture guard."""

import datetime as dt
import json
import math

import pandas as pd
import pytest

from audience import survey


def frame():
    # year 2020: codes 1,1,2,9 (9 outside the base); weights 1,3,4,10.
    return pd.DataFrame({
        "year": [2020, 2020, 2020, 2020, 2022, 2022],
        "x": [1, 1, 2, 9, 2, 3],
        "w": [1.0, 3.0, 4.0, 10.0, 2.0, 2.0],
        "g": ["a", "b", "a", "a", "a", None],
    })


def test_shares_weights_pools_and_excludes():
    cells, skipped = survey.shares(frame(), "x", "w", {1: "One", 2: "Two or three", 3: "Two or three"},
                                   {"grp": "g"}, min_n=1)
    top = {(c.period, c.option): c for c in cells if c.dim == "all"}
    assert top[(2020, "One")].estimate == pytest.approx(50.0)       # 4 / 8
    assert top[(2020, "Two or three")].estimate == pytest.approx(50.0)
    assert top[(2020, "One")].n == 3                               # code 9 out of the base
    assert top[(2022, "Two or three")].estimate == pytest.approx(100.0)
    neff = 8 ** 2 / (1 + 9 + 16)
    assert top[(2020, "One")].se == pytest.approx(100 * math.sqrt(0.25 / neff), abs=1e-6)
    grp = {(c.period, c.value, c.option): c.estimate for c in cells if c.dim == "grp"}
    assert grp[(2020, "a", "One")] == pytest.approx(20.0)          # 1 / 5
    assert grp[(2020, "b", "One")] == pytest.approx(100.0)
    assert skipped == {}


def test_cells_under_min_n_are_skipped_and_named():
    cells, skipped = survey.shares(frame(), "x", "w", {1: "One", 2: "Two"}, {"grp": "g"}, min_n=2)
    assert {(c.period, c.dim, c.value) for c in cells} == {(2020, "all", "all"), (2020, "grp", "a")}
    assert skipped[2020] == ["grp=b (n=1)"]
    assert "all=all (n=1)" in skipped[2022]


def test_counts_are_weighted_persons():
    cells, _ = survey.shares(frame(), "x", "w", {1: "One", 2: "Two"}, min_n=1, with_counts=True)
    assert {c.option: c.count for c in cells if c.period == 2020} == {"One": 4.0, "Two": 4.0}


def test_means_respect_the_valid_range():
    df = pd.DataFrame({"year": [2024] * 4, "t": [0, 50, 100, 98], "w": [1.0, 1.0, 2.0, 5.0]})
    cells, _ = survey.means(df, "t", "w", (0, 97), min_n=1)
    assert cells[0].estimate == pytest.approx(25.0)   # 98 (DK) and 100 are out of 0-97
    assert cells[0].n == 2


def test_age_bucket_edges():
    vals = survey.age_bucket(pd.Series([17, 18, 29, 30, 44, 45, 64, 65, 89, None])).tolist()
    assert pd.isna(vals[0]) and pd.isna(vals[9])
    assert vals[1:9] == ["18-29", "18-29", "30-44", "30-44", "45-64", "45-64", "65+", "65+"]


def test_norm_rows_name_skipped_cells_on_the_topline():
    cells, skipped = survey.shares(frame(), "x", "w", {1: "One", 2: "Two"}, {"grp": "g"}, min_n=2)
    rows = survey.norm_rows(
        cells, skipped, source="GSS", source_version="v", geography="US", geo_code="US",
        place="United States", construct="social_trust", item_text="q", weight_var="w",
        provenance_url="https://example.org", note="Note.", period_dates=survey.year_dates)
    top = [r for r in rows if r["subgroup_dim"] == "all"]
    assert all("grp=b (n=1)" in r["provenance_note"] for r in top)
    assert all(r["provenance_note"].startswith("United States. Note.") for r in rows)
    assert all(r["moe"] == pytest.approx(1.645 * r["se"], abs=1e-6) for r in rows)
    assert top[0]["period_start"] == dt.date(2020, 1, 1)


def _concordance(store, construct):
    cols = ["label", "definition", "anes_var", "gss_var", "cps_var", "notes"]
    row = store.query(f"SELECT {', '.join(cols)} FROM concordance WHERE construct = ?", [construct])[0]
    out = dict(zip(cols, row))
    for k in ("anes_var", "gss_var"):
        v = out[k]
        out[k] = json.loads(v) if isinstance(v, str) else v
    return out


def test_merge_concordance_creates_then_unions(store):
    survey.merge_concordance(store, "social_trust", "Trust", "Def.", gss_var=["TRUST"], note="GSS note.")
    survey.merge_concordance(store, "social_trust", "Other label", "Other def.",
                             anes_var=["VCF0619"], gss_var=["TRUST"], note="GSS note.")
    survey.merge_concordance(store, "social_trust", "x", "y", anes_var=["VCF0619"], note="ANES note.")
    row = _concordance(store, "social_trust")
    assert row["label"] == "Trust" and row["definition"] == "Def."
    assert row["gss_var"] == ["TRUST"] and row["anes_var"] == ["VCF0619"]
    assert row["notes"] == "GSS note. ANES note."


def test_merge_concordance_keeps_seeded_population_rows(store):
    before = _concordance(store, "turnout")
    survey.merge_concordance(store, "turnout", "x", "y", cps_var="VOTED", note="CPS note.")
    after = _concordance(store, "turnout")
    assert (after["label"], after["definition"]) == (before["label"], before["definition"])
    assert after["cps_var"] == "VOTED" and after["notes"].endswith("CPS note.")


def test_synthetic_files_are_refused(tmp_path):
    f = tmp_path / "CES22_Common_SYNTHETIC.csv"
    with pytest.raises(survey.SyntheticInput):
        survey.refuse_synthetic([f])
    survey.refuse_synthetic([f], allow_synthetic=True)
    survey.refuse_synthetic([tmp_path / "CES22_Common_OUTPUT.csv"])
