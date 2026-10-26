"""The lift dataset: row building on synthetic frames, and spot-checks of the real archive
against its own files."""

import datetime as dt

import pandas as pd
import pytest

from audience import db, migrate
from audience.loaders import lift_archive as la
from survey_helpers import count, norm_rows


def synthetic_frames():
    """Two studies, three effects, in the archive's own column names (values invented)."""
    ates = pd.DataFrame({
        "study_id": ["S1", "S1", "S2"], "term": ["content_idA1", "content_idA1", "content_idB1"],
        "estimate": [2.5, 3.0, -1.0], "std.error": [1.0, 1.2, 0.8], "statistic": [2.5, 2.5, -1.25],
        "p.value": [0.01, 0.02, 0.21], "conf.low": [0.5, 0.6, -2.6], "conf.high": [4.5, 5.4, 0.6],
        "df": [100.0, 100.0, 80.0], "outcome": ["favorability", "votechoice_dichotomized", "votechoice"],
        "outcome_name": ["Favorability", "Vote choice (dichotomized)", "Vote choice"],
        "content_id": ["A1", "A1", "B1"], "n_obs": [120, 120, 95]})
    studies = pd.DataFrame({
        "study_id": ["S1", "S2"], "dataset_year": [2018.0, 2020.0], "race_level": [None, "Presidential"],
        "states": ["AZ", None], "n_states": [1.0, 50.0], "date": ["2018-10-01", "2020-09-01"],
        "dataset": ["2018", "2020 Presidential"], "days_until_election": [36.0, 63.0],
        "n_responses_study": [600, 4000], "n_treatments": [2, 5]})
    tag18 = pd.DataFrame({"content_id": ["A1"], "tone_positive": [0.1], "tone_negative": [0.9],
                          "tone_contrast": [0.0], "primary_focus_candidate": [0.7],
                          "primary_focus_issues": [0.3], "race_level": ["Congress"]})
    tag20 = pd.DataFrame({"content_id": ["B1"], "tone_positive": [0.4], "tone_negative": [0.3],
                          "tone_contrast": [0.3], "primary_focus_candidate": [0.2],
                          "primary_focus_issues": [0.6], "primary_focus_neither": [0.2]})
    return {"regression_ates": ates, "studies": studies, "tagging_2018": tag18, "tagging_2020": tag20}


def test_rows_follow_the_archive():
    rows = la.build_rows(synthetic_frames())
    by = {(r["construct"], r["response_option"]): r for r in rows}
    fav = by[("lift_favorability", "A1 (study S1)")]
    assert fav["estimate"] == 2.5 and fav["se"] == 1.0 and fav["n"] == 120
    assert fav["estimate_type"] == "lift_pp" and fav["geo_code"] == "US"
    assert (fav["period_start"], fav["period_end"]) == (dt.date(2018, 1, 1), dt.date(2018, 12, 31))
    assert fav["moe"] == pytest.approx(1.645)
    assert "race level Congress, tone negative, focus candidate" in fav["provenance_note"]
    assert "states AZ" in fav["provenance_note"] and "95% CI [0.50, 4.50]" in fav["provenance_note"]
    vc = by[("lift_vote_choice", "B1 (study S2)")]
    assert vc["period_start"].year == 2020 and "national (50 states)" in vc["provenance_note"]
    assert "tone" not in vc["provenance_note"].split("Coded features:")[-1]   # no rating reaches 0.5
    assert "percentage points" in by[("lift_vote_choice_dichotomized", "A1 (study S1)")]["provenance_note"]
    assert all(r["provenance_url"] == la.DOI_URL for r in rows)


def test_an_unknown_outcome_stops_the_load():
    frames = synthetic_frames()
    frames["regression_ates"].loc[0, "outcome"] = "turnout"
    with pytest.raises(RuntimeError, match="not mapped"):
        la.build_rows(frames)


def test_absent_archive_prints_instructions(store, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(la, "fetch", lambda raw_dir=None: None)
    assert la.run(store, raw_dir=tmp_path) == 0
    assert "datafile/7609590" in capsys.readouterr().out
    assert count(store) == 0


@pytest.fixture(scope="session")
def lift_real(tmp_path_factory):
    pdir = la.processed_dir()
    if pdir is None:
        pytest.skip("lift archive not under raw/lift_archive/ (python -m audience.load lift_archive)")
    s = db.connect(duckdb_path=tmp_path_factory.mktemp("lift") / "norms.duckdb")
    migrate.apply(s, quiet=True)
    written = la.run(s)
    yield s, pdir, written
    s.close()


def test_spot_check_ad_and_study_counts(lift_real):
    """The Dataverse dataset description (https://doi.org/10.7910/DVN/LBPSSV) reports 617
    advertisements in 146 experiments. The archive's Dataverse appendix
    (hewitt_etal_2023_dataverse_appendix.pdf, Tables DA1-DA3) lists the 146 studies; their
    'N treatments' column sums to 618, because one ad was tested in two studies."""
    store, _, written = lift_real
    rows = norm_rows(store)
    pairs = {r["response_option"] for r in rows}
    ads = {p.split(" (study ")[0] for p in pairs}
    studies = {p.split(" (study ")[1].rstrip(")") for p in pairs}
    assert (len(ads), len(pairs), len(studies)) == (617, 618, 146)
    assert written == len(rows) == 1583
    assert {r["period_start"].year for r in rows} == {2018, 2020}


def test_spot_check_one_effect_against_the_response_level_file(lift_real):
    """Study X495cbb4fe018 (2018) was fit without covariates, so its published effect for
    ad X968edf32f1b4 is the ad arm's mean favorability minus the placebo arm's. Recomputed
    here from the archive's response-level file, output/processed_data/responses.RDS."""
    import pyreadr

    store, pdir, _ = lift_real
    got = norm_rows(store, "construct = 'lift_favorability' AND response_option = ?",
                    ["X968edf32f1b4 (study X495cbb4fe018)"])
    assert len(got) == 1 and got[0]["estimate"] == pytest.approx(8.769841, abs=1e-6)
    resp = pyreadr.read_r(str(pdir / "responses.RDS"))[None]
    s = resp[(resp["study_id"] == "X495cbb4fe018") & (resp["drop"] == 0)]
    diff = (s.loc[s["content_id"] == "X968edf32f1b4", "favorability"].mean()
            - s.loc[s["treat"] == 0, "favorability"].mean())
    assert got[0]["estimate"] == pytest.approx(diff, abs=1e-6)


def test_real_rerun_leaves_the_count_unchanged_and_concordance_is_written(lift_real):
    store, _, written = lift_real
    assert la.run(store) == written == count(store)
    notes = dict(store.query("SELECT construct, notes FROM concordance WHERE construct LIKE 'lift_%'"))
    assert set(notes) >= {"lift_favorability", "lift_vote_choice", "lift_vote_choice_dichotomized"}
    assert all("forced-exposure" in n and "2018 and 2020" in n for n in notes.values())
