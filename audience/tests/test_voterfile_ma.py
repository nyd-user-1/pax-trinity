"""MA voter file: party enrollment over the synthetic 50-row fixture."""

import csv
import datetime as dt

import pytest

from audience import survey
from audience.loaders import voterfile_ma as vf
from conftest import make_row
from survey_helpers import FIXTURES, count, norm_rows, pick

FX_DIR = FIXTURES / "ma_voterfile"
TOWNS = {
    "2502507000": "Boston city, Suffolk County, Massachusetts",
    "2502782000": "Worcester city, Worcester County, Massachusetts",
    "2501711000": "Cambridge city, Middlesex County, Massachusetts",
    "2500937995": "Manchester-by-the-Sea town, Essex County, Massachusetts",
    "2501367000": "Springfield city, Hampden County, Massachusetts",
}


@pytest.fixture
def seeded(store):
    """A store holding ACS-style TOWN rows, as the ACS loader leaves them."""
    store.upsert_norms([
        make_row(geography="TOWN", geo_code=code, provenance_note=f"{name}. B01001 note.")
        for code, name in TOWNS.items()])
    return store


def fixture_counts():
    with open(FX_DIR / "ma_voterfile_20261001_SYNTHETIC.csv", newline="") as f:
        return list(csv.DictReader(f))


def test_town_names_normalize_across_spellings():
    assert vf.norm_town("Manchester-by-the-Sea town, Essex County, Massachusetts") == \
        vf.norm_town("MANCHESTER BY THE SEA")
    assert vf.norm_town("Barnstable Town city, Barnstable County, Massachusetts") == "BARNSTABLE"


def test_fixture_is_refused_without_the_flag(seeded):
    with pytest.raises(survey.SyntheticInput):
        vf.run(seeded, raw_dir=FX_DIR)


def test_statewide_and_town_counts(seeded):
    written = vf.run(seeded, raw_dir=FX_DIR, allow_synthetic=True)
    rows = norm_rows(seeded, "source = 'VOTERFILE_MA'")
    assert written == len(rows)
    records = fixture_counts()
    labels = {"D": "Democratic", "R": "Republican", "U": "Unenrolled", "L": "Libertarian"}
    expected = {}
    for r in records:
        expected[labels[r["Party Affiliation"].strip().upper()]] = \
            expected.get(labels[r["Party Affiliation"].strip().upper()], 0) + 1
    state = {r["response_option"]: r["estimate"] for r in rows
             if r["geo_code"] == "25" and r["estimate_type"] == "count"}
    assert state == {**{k: float(v) for k, v in expected.items()}, "Other designation": 0.0}
    boston = [r for r in rows if r["geo_code"] == "2502507000" and r["estimate_type"] == "pct"]
    assert sum(r["estimate"] for r in boston) == pytest.approx(100.0)
    assert {r["n"] for r in boston} == {sum(1 for r in records if r["City/Town"] == "BOSTON")}
    town_codes = {r["geo_code"] for r in rows if r["geography"] == "TOWN"}
    assert town_codes == set(TOWNS)                        # ATLANTIS matched nothing
    assert {r["period_start"] for r in rows} == {dt.date(2026, 10, 1)}
    assert pick(rows, geo_code="2500937995", estimate_type="count",
                response_option="Unenrolled")["provenance_note"].startswith("Manchester-by-the-Sea town")


def test_rerun_is_idempotent(seeded):
    vf.run(seeded, raw_dir=FX_DIR, allow_synthetic=True)
    first = count(seeded, "source = 'VOTERFILE_MA'")
    vf.run(seeded, raw_dir=FX_DIR, allow_synthetic=True)
    assert count(seeded, "source = 'VOTERFILE_MA'") == first > 0


def test_other_codes_pool_and_missing_columns_fail(tmp_path):
    f = tmp_path / "x.csv"
    f.write_text("Party|Town\nD|Boston\nG|Boston\nZZ|Boston\n")
    state, towns = vf.count_file(f)
    assert state == {"Democratic": 1, "Other designation": 2}
    bad = tmp_path / "y.csv"
    bad.write_text("Name,Address\na,b\n")
    with pytest.raises(ValueError, match="party column"):
        vf.count_file(bad)


def test_absent_file_prints_instructions(store, tmp_path, capsys):
    assert vf.run(store, raw_dir=tmp_path) == 0
    assert "c.51 s.47C" in capsys.readouterr().out
    assert count(store) == 0
