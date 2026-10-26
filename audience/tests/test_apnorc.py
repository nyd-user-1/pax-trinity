"""AP-NORC May 2016 public-use file: Q8 subgroup shares beside the seed's topline."""

import pandas as pd
import pytest

from audience import db, migrate
from audience.loaders import apnorc, polls
from survey_helpers import count, norm_rows, pct_cells


@pytest.fixture(scope="module")
def puf():
    path = apnorc.locate()
    if path is None:
        pytest.skip("AP-NORC zip not cached under raw/apnorc/ (python -m audience.load apnorc)")
    return apnorc.read_file(path)


@pytest.fixture(scope="module")
def topline():
    return apnorc.seed_topline(polls.SEED)


def test_q8_reproduces_the_codebook(puf, topline):
    # AP-NORC Campaign and Election May 2016 Codebook (in the PUF zip), p. 17, Q8 weighted
    # percent: (1) Open primaries and caucuses 68.59, (2) Closed 29.26, skipped 2.15; n 1,060.
    _, labels = topline
    d = apnorc.prepare(puf, labels)
    share = (d.groupby("_q8")["finalwt"].sum() / d["finalwt"].sum() * 100).round(2).to_dict()
    assert share == {"Open primary": 68.59, "Closed primary": 29.26, apnorc.NO_ANSWER: 2.15}
    assert len(d) == 1060


def test_rows_join_the_seed_topline(puf, topline):
    item_text, labels = topline
    rows = apnorc.build_rows(puf, item_text, labels)
    assert len(rows) == 10 * 3          # sex 2, age_5 5, party 3; three options each
    assert {r["subgroup_dim"] for r in rows} == {"sex", "age_5", "party"}
    assert {r["item_text"] for r in rows} == {item_text}
    assert {r["response_option"] for r in rows} == {"Open primary", "Closed primary", apnorc.NO_ANSWER}
    assert all(t == pytest.approx(100, abs=1e-4) for t in pct_cells(rows).values())
    men = next(r for r in rows if r["subgroup_value"] == "Male" and r["response_option"] == "Open primary")
    assert men["n"] == 533 and men["weight_var"] == "finalwt"


def test_run_and_rerun(tmp_path, puf):
    s = db.connect(duckdb_path=tmp_path / "n.duckdb")
    migrate.apply(s, quiet=True)
    n = apnorc.run(s)
    assert n == 30 == apnorc.run(s) == count(s)
    s.close()


def test_party_3_counts_leaners_with_their_party():
    party = pd.Series([1, 2, 3, 3, 3, 4, 4, None])
    indep = pd.Series([None, None, 1, 2, 3, 1, None, None])
    got = apnorc.party_3(party, indep).tolist()
    assert got[:6] == ["Democrat", "Republican", "Democrat", "Republican", "Independent", "Democrat"]
    assert pd.isna(got[6]) and pd.isna(got[7])


def test_absent_zip_writes_nothing(store, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(apnorc, "fetch", lambda raw_dir=None: None)
    assert apnorc.run(store, raw_dir=tmp_path, download=True) == 0
    assert apnorc.ZIP_URL in capsys.readouterr().out
    assert count(store) == 0
