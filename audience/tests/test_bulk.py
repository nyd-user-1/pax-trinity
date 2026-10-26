"""The bulk tier's shared machinery: which variables qualify and with what options, toplines
for every year with breakdowns for the latest, the coded option order through the export,
and the multi-batch prune."""

import datetime as dt
import json

import pandas as pd
import pytest

from audience import bulk, export, geographies, survey
from audience.loaders import gss
from conftest import make_row
from survey_helpers import count, fixture_frame

YESNO = {1: "yes", 2: "no", "d": "don't know", "i": "iap", "n": "no answer"}


def opts(values, labels):
    return bulk.options_for(pd.Series(values, dtype=float), labels)


def test_fully_labeled_codes_are_the_options_in_coded_order():
    got, why = opts([2, 1, 1, None], {2: "too much", 1: "too little", 3: "about right"})
    assert why == "" and list(got.items()) == [(1.0, "Too little"), (2.0, "Too much"),
                                               (3.0, "About right")]


def test_non_answer_codes_leave_the_base():
    got, _ = opts([1, 2, 7, 7], {1: "especially close", 2: "not esp. close", 7: "refused"})
    assert got == {1.0: "Especially close", 2.0: "Not esp. close"}
    got, _ = opts([1, 2], YESNO)                   # Stata's extended missing codes
    assert got == {1.0: "Yes", 2.0: "No"}
    got, _ = opts([1, 8], {1: "too harsh", 8: "cant say"})
    assert got == {1.0: "Too harsh", 8.0: "Cant say"}  # an offered answer stays


def test_a_scale_labeled_at_its_ends_keeps_every_point():
    got, _ = opts([1, 3, 7, 5], {1: "complete confidence", 7: "no confidence"})
    assert list(got.values()) == ["1 (Complete confidence)", "2", "3", "4", "5", "6",
                                  "7 (No confidence)"]
    got, _ = opts([0, 4, 10], {0: "0 - no trust", 10: "10 - complete trust"})
    assert got[0.0] == "0 - no trust" and got[4.0] == "4" and len(got) == 11


def test_continuous_variables_are_skipped():
    assert opts([0, 5, 24], {0: "0 hours", 24: "24 hours"}) == (
        None, "continuous (25-point range labeled only in part)")
    assert opts([1, 2, 40], {1: "yes", 2: "no"})[0] is None      # unlabeled, outside
    assert opts([1.5, 2], {1: "a", 2: "b"})[0] is None            # not integers
    assert opts([8], {8: "8 or more"})[1] == "1 labeled code"
    assert opts([None], {1: "yes", 2: "no"})[1] == "no answers in the file"
    many = {i: f"code {i}" for i in range(30)}
    assert opts([1], many)[1] == "30 labeled codes (over 24)"


def test_sentence_case():
    assert bulk.sentence_case("VOTE CLINTON OR TRUMP") == "Vote clinton or trump"
    assert bulk.sentence_case("can people be trusted") == "Can people be trusted"
    assert bulk.sentence_case("R's  highest degree ") == "R's highest degree"


def test_toplines_every_year_breakdowns_the_latest_only():
    df = gss.prepare(fixture_frame("gss/gss_SYNTHETIC.csv"))
    cells, skipped, latest = bulk.cells(df, "confed", "_wt", gss.CONF, gss.SUBGROUPS, min_n=5)
    years = sorted({int(c.period) for c in cells})
    assert latest == max(years) and len(years) > 1
    assert {c.dim for c in cells if c.period != latest} == {"all"}
    assert {c.dim for c in cells if c.period == latest} > {"all"}
    full, _ = survey.shares(df[df["year"] == latest], "confed", "_wt", gss.CONF,
                            gss.SUBGROUPS, min_n=5)
    assert sorted((c.dim, c.value, c.option, c.estimate) for c in cells if c.period == latest) \
        == sorted((c.dim, c.value, c.option, c.estimate) for c in full)


def test_admin_and_open_ended_variables_are_recognized():
    for var, label in (("wtssnrps", "Person weight"), ("ballot", "Ballot used"),
                       ("intage", "Age of interviewer"), ("occstatus", "OCC10 coding status"),
                       ("neisafe", "How safe interviewer thinks neighborhood is"),
                       ("paoccindv", "Father's occ/ind verbatim retrieved")):
        assert gss.admin(var, label), var
    assert not gss.admin("abany", "Abortion if woman wants for any reason")
    assert not gss.admin("region", "Region of interview")
    assert not gss.admin("wtrpollu", "Neighborhood affected by water pollution")
    assert not gss.admin("dofirst", "Things X should do... INTERVIEWER: READ LIST")
    assert gss.open_ended("adhdknw", "What Does R know about ADHD (verbatim)")
    assert gss.open_ended("scitext", "What it means to R to study scientifically")


def test_export_lists_options_in_their_recorded_order(store, tmp_path):
    survey.merge_concordance(store, "zz_scale", "A scale", "A scale.", gss_var=["ZZ_SCALE"])
    labels = ["Too little", "About right", "Too much"]   # not alphabetical
    rows = [make_row(source="GSS", source_version="v", geography="US", geo_code="US",
                     construct="zz_scale", item_text=None, response_option=label,
                     estimate_type="pct", estimate=float(i)) for i, label in enumerate(labels)]
    store.upsert_norms(rows)
    geographies.refresh(store, quiet=True)
    out = tmp_path / "out"
    export.export(store, out)
    read = lambda: [r[4] for r in json.loads((out / "gss.json").read_text())]
    assert read() == sorted(labels)                       # no recorded order: alphabetical
    assert bulk.write_response_order(store, "GSS", {"zz_scale": labels}) == 3
    export.export(store, out)
    assert read() == labels
    assert bulk.write_response_order(store, "GSS", {"zz_scale": labels}) == 3  # replaces


def test_prune_slice_keeps_only_the_named_keys(store):
    from audience.db import natural_key

    rows = [make_row(geo_code=c, period_start=dt.date(2020, 1, 1)) for c in ("25", "US")]
    store.upsert_norms(rows)
    assert count(store) == 2
    assert bulk.prune_slice(store, "ACS", "ACS 2020-2024 5yr", {natural_key(rows[0])}) == 1
    assert [r[0] for r in store.query("SELECT geo_code FROM norms")] == ["25"]
