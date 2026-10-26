"""WVS wave 7: the full loader over the synthetic fixture (fixture-first)."""

import pandas as pd
import pytest

from audience import survey
from audience.loaders import wvs
from survey_helpers import FIXTURES, count, fixture_frame, norm_rows, pct_cells, pick, weighted_share

FX_DIR = FIXTURES / "wvs"


@pytest.fixture
def us():
    df = fixture_frame("wvs/WVS7_USA_SYNTHETIC.csv")
    return df[df["B_COUNTRY"] == 840]


def test_fixture_is_refused_without_the_flag(store):
    with pytest.raises(survey.SyntheticInput):
        wvs.run(store, raw_dir=FX_DIR)


def test_only_us_rows_are_used(us, store):
    wvs.run(store, raw_dir=FX_DIR, allow_synthetic=True, min_n=5)
    rows = norm_rows(store)
    assert {r["period_start"].year for r in rows} == {2017}   # the GB rows are 2022
    trust = pick(rows, construct="social_trust", subgroup_dim="all",
                 response_option="Most people can be trusted")
    assert trust["n"] == us["Q57"].isin([1, 2]).sum()
    assert trust["estimate"] == pytest.approx(weighted_share(us, "Q57", "W_WEIGHT", [1, 2], [1]), abs=1e-5)


def test_negative_codes_are_out_of_the_base_and_means_are_weighted(us, store):
    wvs.run(store, raw_dir=FX_DIR, allow_synthetic=True, min_n=5)
    rows = norm_rows(store)
    pride = pick(rows, construct="national_pride", subgroup_dim="all", response_option="Very proud")
    assert pride["n"] == us["Q254"].between(1, 4).sum()
    valid = us[us["Q250"].between(1, 10)]
    mean = pick(rows, construct="democracy_importance", subgroup_dim="all")
    assert mean["estimate_type"] == "mean"
    assert mean["estimate"] == pytest.approx(
        (valid["Q250"] * valid["W_WEIGHT"]).sum() / valid["W_WEIGHT"].sum(), abs=1e-5)
    for total in pct_cells(rows).values():
        assert total == pytest.approx(100.0, abs=1e-4)
    assert all("codebook variable label" in r["provenance_note"] for r in rows)


def test_education_recode_uses_isced():
    d = wvs.prepare(fixture_frame("wvs/WVS7_USA_SYNTHETIC.csv")).set_index("D_INTERVIEW")
    assert d.loc[840001, "_educ"] == "Some college"   # ISCED 5
    assert d.loc[840002, "_educ"] == "Grad"           # ISCED 7
    assert pd.isna(d.loc[840000, "_age"])            # 17


def test_rerun_is_idempotent_and_concordance_is_written(store):
    wvs.run(store, raw_dir=FX_DIR, allow_synthetic=True, min_n=5)
    first = count(store)
    wvs.run(store, raw_dir=FX_DIR, allow_synthetic=True, min_n=5)
    assert count(store) == first > 0
    got = dict(store.query("SELECT construct, wvs_var FROM concordance WHERE wvs_var IS NOT NULL"))
    assert "Q73" in got["confidence_congress"] and "Q1" in got["life_importance"]


def test_absent_file_prints_instructions(store, tmp_path, capsys):
    assert wvs.run(store, raw_dir=tmp_path) == 0
    assert "WVSDocumentationWV7" in capsys.readouterr().out
    assert count(store) == 0
