"""CPS: the P20 rate computation on the synthetic fixture, the asynchronous IPUMS flow against
a fake API, and a spot-check against Census P20 when a real extract is cached."""

import json

import pandas as pd
import pytest

from audience import config, db, migrate, survey
from audience.loaders import cps
from survey_helpers import FIXTURES, count, fixture_frame, norm_rows, pct_cells, pick

FX_FILE = FIXTURES / "cps" / "cps_ipums_SYNTHETIC.csv"


@pytest.fixture
def fx():
    return fixture_frame("cps/cps_ipums_SYNTHETIC.csv")


def test_the_universe_is_civilian_citizens_18_and_over(fx):
    d = cps.prepare(fx).set_index("SERIAL")
    for serial in (1005, 1006, 1007):   # non-citizen, minor, armed forces
        assert serial not in d.index
    assert d.loc[1000, "_turnout"] == "Voted" and d.loc[1000, "_registration"] == "Registered"
    assert d.loc[1001, "_turnout"] == "Did not vote" and d.loc[1001, "_registration"] == "Registered"
    assert d.loc[1002, "_registration"] == "Not registered"
    assert d.loc[1003, "_turnout"] == "No response" == d.loc[1003, "_registration"]
    assert d.loc[1004, "_turnout"] == "No response"    # supplement non-interview stays in the base
    assert d.loc[1008, "_race_eth"] == "Hispanic or Latino"
    assert d.loc[1009, "_educ"] == "Some college" and d.loc[1009, "_income"] == "$75,000-$99,999"
    assert pd.isna(d.loc[1010, "_income"])            # FAMINC 800 straddles a band edge


def test_voted_is_the_p20_share_of_all_citizens(fx):
    rows = cps.build_rows(fx, "fixture", min_n=5)
    base = cps.prepare(fx)
    us20 = base[base["year"] == 2020]
    expected = 100 * us20.loc[us20["VOTED"] == 2, "VOSUPPWT"].sum() / us20["VOSUPPWT"].sum()
    got = pick(rows, geo_code="US", construct="turnout", subgroup_dim="all", estimate_type="pct",
               response_option="Voted", period_start=pd.Timestamp("2020-11-01").date())
    assert got["estimate"] == pytest.approx(expected, abs=1e-5)
    assert got["n"] == len(us20)
    counts = [r for r in rows if r["geo_code"] == "US" and r["construct"] == "turnout"
              and r["subgroup_dim"] == "all" and r["estimate_type"] == "count"
              and r["period_start"].year == 2020]
    assert sum(r["estimate"] for r in counts) == pytest.approx(us20["VOSUPPWT"].sum(), abs=0.01)
    totals = pct_cells([dict(r, source_version="v") for r in rows])
    assert all(t == pytest.approx(100.0, abs=1e-4) for t in totals.values())
    ma = [r for r in rows if r["geo_code"] == "25"]
    assert ma and {r["geography"] for r in ma} == {"STATE"}


def test_extract_definition_and_cache_key():
    assert set(cps.EXTRACT["samples"]) == {f"cps{y}_11s" for y in (2016, 2018, 2020, 2022, 2024)}
    assert {"VOSUPPWT", "VOTED", "VOREG", "AGE", "SEX", "RACE", "HISPAN", "EDUC", "FAMINC",
            "STATEFIP"} <= set(cps.EXTRACT["variables"])
    assert cps.extract_hash() == cps.extract_hash(json.loads(json.dumps(cps.EXTRACT)))
    assert cps.extract_hash() != cps.extract_hash(dict(cps.EXTRACT, dataFormat="stata"))


def test_a_cached_extract_is_used_without_a_key_or_network(store, tmp_path, monkeypatch):
    monkeypatch.setenv("IPUMS_API_KEY", "")
    monkeypatch.setattr(cps, "submit", lambda *a, **k: pytest.fail("submitted"))
    monkeypatch.setattr(cps, "status", lambda *a, **k: pytest.fail("polled"))
    d = cps.cache_dir(tmp_path)
    d.mkdir(parents=True)
    (d / FX_FILE.name).write_bytes(FX_FILE.read_bytes())
    with pytest.raises(survey.SyntheticInput):
        cps.run(store, raw_dir=tmp_path)
    written = cps.run(store, raw_dir=tmp_path, allow_synthetic=True, min_n=5)
    assert written == count(store) > 0
    assert cps.run(store, raw_dir=tmp_path, allow_synthetic=True, min_n=5) == written
    assert count(store) == written


def test_no_key_and_no_cache_prints_instructions(store, tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("IPUMS_API_KEY", "")
    assert cps.run(store, raw_dir=tmp_path) == 0
    assert "account.ipums.org/api_keys" in capsys.readouterr().out
    assert count(store) == 0


class FakeIPUMS:
    """Stands in for requests: one submit, two polls, then a download."""

    def __init__(self, payload: bytes):
        self.payload, self.calls, self.polls = payload, [], 0

    def post(self, url, headers, data, timeout):
        self.calls.append("submit")
        assert json.loads(data) == cps.EXTRACT and headers["Authorization"] == "k"
        return Resp({"number": 42})

    def get(self, url, headers, timeout, stream=False):
        if "/extracts/42" in url:
            self.calls.append("status")
            self.polls += 1
            done = self.polls >= 2
            return Resp({"status": "completed" if done else "started",
                         "downloadLinks": {"data": {"url": "https://api.ipums.org/x.csv.gz"}} if done else {}})
        self.calls.append("download")
        return Resp(None, self.payload)


class Resp:
    def __init__(self, body, content=b""):
        self.body, self.content = body, content

    def raise_for_status(self):
        pass

    def json(self):
        return self.body

    def iter_content(self, n):
        yield self.content

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_fetch_submits_once_polls_and_resumes(tmp_path):
    api = FakeIPUMS(b"YEAR,AGE\n")
    path = cps.fetch("k", tmp_path, poll_seconds=0, session=api)
    assert api.calls == ["submit", "status", "status", "download"]
    assert path.read_bytes() == b"YEAR,AGE\n"
    assert json.loads((cps.cache_dir(tmp_path) / "submitted.json").read_text())["number"] == 42
    path.unlink()
    again = FakeIPUMS(b"YEAR,AGE\n")
    again.polls = 1
    cps.fetch("k", tmp_path, poll_seconds=0, session=again)
    assert "submit" not in again.calls               # resumed extract 42, never resubmitted


@pytest.fixture(scope="session")
def cps_real(tmp_path_factory):
    path = cps.cached_file()
    if path is None or survey.SYNTHETIC_MARK in path.name.upper():
        pytest.skip("no IPUMS CPS extract cached under raw/ipums/ (needs IPUMS_API_KEY)")
    s = db.connect(duckdb_path=tmp_path_factory.mktemp("cps") / "norms.duckdb")
    migrate.apply(s, quiet=True)
    cps.run(s)
    yield s
    s.close()


def test_spot_check_2020_turnout_against_census_p20(cps_real):
    """Census P20, Voting and Registration in the Election of November 2020, Table 4b:
    percent voted (citizen) 66.8 for the US and 66.3 for Massachusetts.
    https://www2.census.gov/programs-surveys/cps/tables/p20/585/table04b.xlsx
    """
    rows = norm_rows(cps_real, "construct = 'turnout' AND subgroup_dim = 'all' AND "
                               "estimate_type = 'pct' AND response_option = 'Voted' AND "
                               "period_start = DATE '2020-11-01'")
    got = {r["geo_code"]: r["estimate"] for r in rows}
    assert got["US"] == pytest.approx(66.8, abs=0.1)
    assert got["25"] == pytest.approx(66.3, abs=0.1)
