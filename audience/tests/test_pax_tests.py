"""PAX test waves over the 10-row synthetic fixture."""

import datetime as dt

import pytest

from audience import survey
from audience.loaders import pax_tests as pax
from survey_helpers import FIXTURES, count, norm_rows, pick

SEED = FIXTURES / "pax" / "pax_waves_SYNTHETIC.csv"


def test_fixture_is_refused_without_the_flag(store):
    with pytest.raises(survey.SyntheticInput):
        pax.run(store, seed=SEED)


def test_rows_from_the_fixture(store):
    written = pax.run(store, seed=SEED, allow_synthetic=True)
    rows = norm_rows(store, "source = 'PAX_TEST'")
    # 10 lift rows, 10 arm levels, one placebo level per outcome x subgroup x wave, except
    # wave 3 support, whose placebo is its own arm.
    assert written == len(rows) == 10 + 10 + 4
    assert {r["construct"] for r in rows} == {"lift_support", "lift_comprehension", "lift_vote_choice"}
    a = pick(rows, construct="lift_support", response_option="synthetic_cut_a",
             estimate_type="lift_pp", subgroup_dim="all")
    assert a["estimate"] == 9.0 and a["n"] == 480
    assert (a["period_start"], a["period_end"]) == (dt.date(2026, 10, 1), dt.date(2026, 10, 7))
    assert "significance as read out: yes" in a["provenance_note"]
    dem = pick(rows, construct="lift_support", response_option="synthetic_cut_a",
               estimate_type="lift_pp", subgroup_dim="party")
    assert dem["subgroup_value"] == "Democrat"
    placebo = pick(rows, construct="lift_support", response_option="Placebo", subgroup_dim="all",
                   period_start=dt.date(2026, 10, 1))
    assert placebo["estimate"] == 48.0 and placebo["estimate_type"] == "pct"
    assert {r["response_option"] for r in rows if r["construct"] == "lift_vote_choice"} >= {
        "synthetic_cut_a", "synthetic_cut_b"}   # 'vote_choice' and 'Vote Choice' pool


def test_rerun_is_idempotent_and_concordance_is_written(store):
    pax.run(store, seed=SEED, allow_synthetic=True)
    first = count(store)
    pax.run(store, seed=SEED, allow_synthetic=True)
    assert count(store) == first
    labels = dict(store.query("SELECT construct, label FROM concordance WHERE construct LIKE 'lift_%'"))
    assert labels["lift_support"] == "Lift: support"
    assert labels["lift_vote_choice"] == "Lift: vote choice"   # shared with the lift dataset


def test_absent_seed_writes_nothing(store, tmp_path, capsys):
    assert pax.run(store, seed=tmp_path / "pax_waves.csv") == 0
    assert "the lead supplies it" in capsys.readouterr().out
    assert count(store) == 0


def test_missing_columns_fail(store, tmp_path):
    bad = tmp_path / "pax_waves.csv"
    bad.write_text("arm,outcome,lift\na,support,3\n")
    with pytest.raises(ValueError, match="missing columns"):
        pax.run(store, seed=bad)


def test_subgroup_forms():
    assert pax.split_subgroup("all") == ("all", "all")
    assert pax.split_subgroup("party=Democrat") == ("party", "Democrat")
    assert pax.split_subgroup("Age: 18-29") == ("age", "18-29")
    assert pax.split_subgroup("Women") == ("subgroup", "Women")
