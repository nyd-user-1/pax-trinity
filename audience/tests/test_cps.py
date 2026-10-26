"""CPS: the P20 rate computation on a synthetic Census-coded fixture, both file formats, the
cache and download path, and a spot-check of every year against Census P20 Table 4b."""

import shutil

import pandas as pd
import pytest

from audience import db, migrate, survey
from audience.loaders import cps
from survey_helpers import FIXTURES, count, norm_rows, pct_cells, pick

FX_DIR = FIXTURES / "cps"
FX_2020 = FX_DIR / "nov20pub_SYNTHETIC.csv"


@pytest.fixture
def fx():
    return cps.read_file(FX_2020, 2020)


def test_the_universe_is_civilian_citizens_18_and_over(fx):
    raw = pd.read_csv(FX_2020)
    d = cps.prepare(fx.assign(HRHHID=raw["HRHHID"])).set_index("HRHHID")
    for hhid in (1005, 1006, 1007):   # non-citizen, minor, armed forces
        assert hhid not in d.index
    assert d.loc[1000, "_turnout"] == "Voted" and d.loc[1000, "_registration"] == "Registered"
    assert d.loc[1001, "_turnout"] == "Did not vote" and d.loc[1001, "_registration"] == "Registered"
    assert d.loc[1002, "_registration"] == "Not registered"
    assert d.loc[1003, "_turnout"] == "No response" == d.loc[1003, "_registration"]
    assert d.loc[1004, "_turnout"] == "No response"    # supplement no response stays in the base
    assert d.loc[1008, "_turnout"] == "No response"    # refused
    assert d.loc[1008, "_race_eth"] == "Hispanic or Latino"
    assert d.loc[1009, "_educ"] == "Some college" and d.loc[1009, "_income"] == "$75,000-$99,999"
    assert pd.isna(d.loc[1010, "_income"])            # HEFAMINC refused
    assert d.loc[1000, "_w"] == pytest.approx(raw.loc[0, "PWSSWGT"] / 10_000)


def test_voted_is_the_p20_share_of_all_citizens(fx):
    rows = cps.build_rows(fx, 2020, min_n=5)
    base = cps.prepare(fx)
    expected = 100 * base.loc[base["PES1"] == 1, "_w"].sum() / base["_w"].sum()
    got = pick(rows, geo_code="US", construct="turnout", subgroup_dim="all", estimate_type="pct",
               response_option="Voted")
    assert got["estimate"] == pytest.approx(expected, abs=1e-5)
    assert got["n"] == len(base)
    assert got["weight_var"] == "PWSSWGT" and got["provenance_url"] == cps.data_url(2020)
    assert "November 3, 2020" in got["item_text"]
    counts = [r for r in rows if r["geo_code"] == "US" and r["construct"] == "turnout"
              and r["subgroup_dim"] == "all" and r["estimate_type"] == "count"]
    assert sum(r["estimate"] for r in counts) == pytest.approx(base["_w"].sum(), abs=0.01)
    totals = pct_cells(rows)
    assert all(t == pytest.approx(100.0, abs=1e-4) for t in totals.values())
    ma = [r for r in rows if r["geo_code"] == "25"]
    assert ma and {r["geography"] for r in ma} == {"STATE"}


def _write_fixed_width(df: pd.DataFrame, path, year: int) -> None:
    layout = {**cps.BASIC_LAYOUT, **cps.SUPPLEMENT_LAYOUT[year]}
    width = max(b for _, b in layout.values())
    with open(path, "w", encoding="latin-1") as f:
        for _, row in df.iterrows():
            line = [" "] * width
            for col, (a, b) in layout.items():
                text = str(int(row[col])).rjust(b - a + 1)
                line[a - 1:b] = list(text)
            f.write("".join(line) + "\n")


def test_fixed_width_reads_the_same_as_csv(fx, tmp_path):
    as_2016 = fx.assign(HRYEAR4=2016)
    path = tmp_path / "nov16pub_SYNTHETIC.dat"
    _write_fixed_width(as_2016, path, 2016)
    back = cps.read_file(path, 2016)
    cols = list(cps.COLUMNS)
    assert back[cols].reset_index(drop=True).equals(as_2016[cols].reset_index(drop=True))


def test_layout_drift_is_caught(tmp_path):
    shutil.copy(FX_2020, tmp_path / "nov22pub_SYNTHETIC.csv")
    with pytest.raises(RuntimeError, match="HRYEAR4"):
        cps.read_file(tmp_path / "nov22pub_SYNTHETIC.csv", 2022)


def test_cached_files_load_without_network_and_rerun_idempotently(store, tmp_path, monkeypatch):
    monkeypatch.setattr(cps, "fetch", lambda *a, **k: pytest.fail("downloaded"))
    for p in FX_DIR.glob("*.csv"):
        shutil.copy(p, tmp_path / p.name)
    with pytest.raises(survey.SyntheticInput):
        cps.run(store, raw_dir=tmp_path, years=(2020,))
    written = cps.run(store, raw_dir=tmp_path, allow_synthetic=True, min_n=5, years=(2020, 2022))
    assert written == count(store) > 0
    assert {r[0] for r in store.query("SELECT DISTINCT source_version FROM norms")} == {
        cps.source_version(2020), cps.source_version(2022)}
    assert cps.run(store, raw_dir=tmp_path, allow_synthetic=True, min_n=5,
                   years=(2020, 2022)) == written
    assert count(store) == written


def test_missing_file_and_failed_download_print_instructions(store, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cps, "fetch", lambda *a, **k: None)
    assert cps.run(store, raw_dir=tmp_path) == 0
    out = capsys.readouterr().out
    assert cps.data_url(2016) in out and cps.data_url(2024) in out
    assert count(store) == 0


def test_fetch_writes_the_file_into_raw(tmp_path, monkeypatch):
    import requests

    class Resp:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def raise_for_status(self):
            pass

        def iter_content(self, n):
            yield b"HRYEAR4\n"

    seen = []
    monkeypatch.setattr(requests, "get", lambda url, **k: seen.append(url) or Resp())
    path = cps.fetch(2024, tmp_path)
    assert seen == [cps.data_url(2024)] and path == tmp_path / "nov24pub.csv"
    assert path.read_bytes() == b"HRYEAR4\n" and cps.locate(tmp_path) == {2024: path}


# -- the real files ------------------------------------------------------------------------

@pytest.fixture(scope="session")
def cps_real(tmp_path_factory):
    if set(cps.locate()) != set(cps.YEARS):
        pytest.skip("CPS public-use files not all cached under raw/cps/ (python -m audience.load cps)")
    s = db.connect(duckdb_path=tmp_path_factory.mktemp("cps") / "norms.duckdb")
    migrate.apply(s, quiet=True)
    cps.run(s, download=False)
    yield s
    s.close()


# Census P20, "Voting and Registration in the Election of November <year>", Table 4b: percent
# voted (citizen) and percent registered (citizen), US and Massachusetts.
P20 = {
    # https://www2.census.gov/programs-surveys/cps/tables/p20/580/table04b.xlsx
    2016: {"US": (61.4, 70.3), "25": (66.7, 73.7)},
    # https://www2.census.gov/programs-surveys/cps/tables/p20/583/table04b.xlsx
    2018: {"US": (53.4, 66.9), "25": (55.5, 68.0)},
    # https://www2.census.gov/programs-surveys/cps/tables/p20/585/table04b.xlsx
    2020: {"US": (66.8, 72.7), "25": (66.3, 72.4)},
    # https://www2.census.gov/programs-surveys/cps/tables/p20/586/vote04b_2022.xlsx
    2022: {"US": (52.2, 69.1), "25": (56.7, 74.0)},
    # https://www2.census.gov/programs-surveys/cps/tables/p20/587/vote04b_2024.xlsx
    2024: {"US": (65.3, 73.6), "25": (68.9, 75.4)},
}


def test_every_year_matches_census_p20_table_4b(cps_real):
    rows = norm_rows(cps_real, "subgroup_dim = 'all' AND estimate_type = 'pct' AND "
                               "response_option IN ('Voted', 'Registered')")
    got = {(r["period_start"].year, r["geo_code"], r["response_option"]): r["estimate"] for r in rows}
    for year, geos in P20.items():
        for geo, (voted, registered) in geos.items():
            assert round(got[(year, geo, "Voted")], 1) == voted, (year, geo)
            assert round(got[(year, geo, "Registered")], 1) == registered, (year, geo)


def test_2020_counts_match_p20_thousands(cps_real):
    # Table 4b, 2020, US: 231,593 thousand citizens, 154,628 thousand voted.
    rows = norm_rows(cps_real, "geo_code = 'US' AND construct = 'turnout' AND subgroup_dim = 'all' "
                               "AND estimate_type = 'count' AND period_start = DATE '2020-11-01'")
    by = {r["response_option"]: r["estimate"] for r in rows}
    assert round(sum(by.values()) / 1000) == 231_593
    assert round(by["Voted"] / 1000) == 154_628
