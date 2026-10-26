"""CPS: the P20 rate computation on a synthetic Census-coded fixture, both file formats, the
cache and download path, and a spot-check of every year against Census P20 Table 4b. The bulk
tier: the record-layout parser on a synthetic layout, the split where a dictionary changes,
shares on the fixture; on the real files, every year's parsed positions against the
documentation's own unweighted tallies, and two items against P20 Tables 10 and 12."""

import datetime as dt
import re
import shutil

import pandas as pd
import pytest

from audience import db, migrate, survey
from audience.loaders import cps
from survey_helpers import FIXTURES, count, norm_rows, pct_cells, pick, weighted_share

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


def test_back_years_have_their_own_addresses():
    assert cps.data_url(2008) == "https://api.census.gov/data/2008/cps/voting/nov"
    assert cps.data_url(2014).endswith("/2014/supp/nov14pub.dat.gz")
    assert cps.doc_url(2014).endswith("/cpsnov14r.pdf")
    assert cps.page_url(2024).endswith("/cps-voting.2024.html")
    assert cps.page_url(2008) == cps.data_url(2008)   # Census keeps no 2008 page


# -- the bulk tier, synthetic --------------------------------------------------------------

# The shape of a pdftotext -layout supplement record layout: a location cut short (957-), one
# missing (PRS8 follows PES4), a page footer and repeated header inside a value list, a value
# label wrapped over lines (one after a slash), a curly quote, emphasis capitals, and an item
# past the next attachment that is not part of the layout.
LAYOUT = """\
                                   ATTACHMENT 7
                          SUPPLEMENT RECORD LAYOUT
                       November 2020 Current Population Survey

NAME   SIZE   DESCRIPTION                                        LOCATION

PRSUPINT 2    Supplement Interview Flag                          949-950

PES1   2      Did (you/name) vote in the election held on        951-952
              Tuesday, November 3, 2020?

              EDITED UNIVERSE: PRTAGE >=18 and PRCITSHP = 1, 2, 3, or 4

              VALID ENTRIES:
              1 Yes
              2 No
              -1 Not in Universe

PES4   2      What was the MAIN reason (you/name)                 957-
              did not vote?

              EDITED UNIVERSE:
              PES1 = 2 and PES2 = 1

              VALID ENTRIES:
              1 Illness or disability (own or family’s)
              2 Out of town or away from home
                                         7-2

NAME   SIZE   DESCRIPTION                                        LOCATION

              3 Registration problems (i.e. didn't receive absentee
              ballot, not registered in current location)
              4 Did not meet residency requirements/
                did not live here long enough
              -2 Don't know
              -3 Refused

PRS8   2      How long (have you/has name) lived
              at this address?

              EDITED UNIVERSE:
              PRTAGE >= 18

              VALID ENTRIES:
              1 Less than 1 year
              2 1-2 years
              -1 Not in Universe

PUSCK4   2    INTERVIEWER CHECK ITEM -                           961-962
              Who reported for this person?

              VALID ENTRIES:
              1 Self
              2 Other

                                   ATTACHMENT 8
                          SUPPLEMENT QUESTIONNAIRE
PES9   2      Not part of the layout                              999-1000
"""


def test_the_layout_parser_reads_items_locations_and_valid_entries():
    items = {i.name: i for i in cps.parse_dictionary(LAYOUT)}
    assert list(items) == ["PRSUPINT", "PES1", "PES4", "PRS8", "PUSCK4"]
    pes4 = items["PES4"]
    assert (pes4.start, pes4.end) == (957, 958)
    assert (items["PRS8"].start, items["PRS8"].end) == (959, 960)
    assert pes4.description == "What was the MAIN reason (you/name) did not vote?"
    assert pes4.universe == "PES1 = 2 and PES2 = 1"
    assert pes4.bands == {
        1: "Illness or disability (own or family's)",
        2: "Out of town or away from home",
        3: "Registration problems (i.e. didn't receive absentee ballot, not registered in "
           "current location)",
        4: "Did not meet residency requirements/did not live here long enough",
    }
    assert [c for c, _ in pes4.values] == [1, 2, 3, 4, -2, -3]
    assert items["PRS8"].bands == {1: "Less than 1 year", 2: "1-2 years"}
    assert cps.sentence_case(pes4.description) == "What was the main reason (you/name) did not vote?"
    assert cps.skip_reason(items["PES1"]) == "read by the turnout construct"
    assert cps.skip_reason(items["PRSUPINT"]) == "administrative"
    assert cps.skip_reason(items["PUSCK4"]) == "administrative"
    assert cps.skip_reason(pes4) is None and cps.skip_reason(items["PRS8"]) is None


def test_valid_entries_out_of_order_are_refused():
    broken = LAYOUT.replace("              2 Out of town", "              5 Out of town")
    with pytest.raises(RuntimeError, match="PES4"):
        cps.parse_dictionary(broken)


def _item(name, bands, desc="How did (you/name) register to vote?", negatives=(-2, -3)):
    values = tuple(enumerate(bands, start=1)) + tuple((c, "Don't know") for c in negatives)
    return cps.Item(name=name, start=963, end=964, description=desc, universe="", values=values)


def test_the_plan_splits_an_item_where_its_dictionary_changes():
    pes1 = _item("PES1", ["Yes", "No"], desc="Did (you/name) vote?")
    check = _item("PUSCK4", ["Self", "Other"], desc="INTERVIEWER CHECK ITEM - Who reported?")
    wide = _item("PES9", [f"Option {i}" for i in range(1, 26)], desc="Twenty-five options")
    old = ["At a DMV", "By mail", "Other"]
    new = ["At a DMV", "By mail", "Registered using the {} or online", "Other"]
    lived = ["Under a year", "A year or more"]
    dictionaries = {
        2008: [pes1, check, wide, _item("PES7", old), _item("PES8", lived, desc="How long?")],
        2010: [pes1, _item("PES7", [b.format("Internet") for b in new]),
               _item("PES8", lived, desc="How long?")],
        2012: [pes1, _item("PES7", [b.format("internet") for b in new]),
               _item("PRS8", lived, desc="How long?")],
    }
    plan, skipped = cps.bulk_plan(dictionaries)
    by = {b.construct: b for b in plan}
    assert set(by) == {"pes7_2008", "pes7", "pes8", "prs8"}
    assert by["pes7"].years == (2010, 2012)           # capitals aside, the lists agree
    assert by["pes7"].bands[3] == "Registered using the internet or online"   # latest text
    assert by["pes7"].label == by["pes7"].definition == "How did (you/name) register to vote?"
    assert by["pes7_2008"].years == (2008,) and by["pes7_2008"].label.endswith("vote? (2008)")
    assert by["pes8"].label == "How long? (2008-2010)" and by["pes8"].definition == "How long?"
    assert by["prs8"].label == "How long?"
    assert skipped == {("PES1", "read by the turnout construct"): [2008, 2010, 2012],
                       ("PUSCK4", "administrative"): [2008],
                       ("PES9", "25 labeled categories"): [2008]}


def test_bulk_constructs_register_and_another_sources_id_is_skipped(store):
    plan, _ = cps.bulk_plan({2020: [_item("PES7", ["At a DMV", "Other"]),
                                    _item("PES8", ["Under a year", "Longer"], desc="How long?")]})
    store.upsert_concordance({"construct": "pes8", "label": "Someone else's", "definition": "x"})
    kept, collisions = cps.register_bulk(store, plan)
    assert [b.construct for b in kept] == ["pes7"] and collisions == ["pes8"]
    label, definition, cps_var, notes = store.query(
        "SELECT label, definition, cps_var, notes FROM concordance WHERE construct = 'pes7'")[0]
    assert (label, definition, cps_var) == ("How did (you/name) register to vote?",) * 2 + ("PES7",)
    assert "not the questionnaire's wording" in notes
    assert store.query("SELECT label FROM concordance WHERE construct = 'pes8'")[0][0] == "Someone else's"


REASONS = ["Illness", "Out of town", "Forgot", "Bad weather"]   # nobody picks Bad weather


def _with_pes4(fx):
    codes = [1, 2, -2, 1, 3, -1, 2, 1, -3, 1, 2, 3, 1, -9, 2]
    return fx.assign(PES4=[codes[i % len(codes)] for i in range(len(fx))])


def test_bulk_shares_leave_missing_codes_out_and_break_down_only_the_latest_year(fx):
    df = _with_pes4(fx)
    plan = [cps.Bulk(construct="pes4", name="PES4", label="Why not?", definition="Why not?",
                     bands=dict(enumerate(REASONS, start=1)),
                     items={2018: _item("PES4", REASONS), 2020: _item("PES4", REASONS)})]
    rows = cps.bulk_rows(df, 2020, plan, min_n=5)
    base = cps.prepare(df)
    top = [r for r in rows if r["geo_code"] == "US" and r["subgroup_dim"] == "all"]
    assert [r["response_option"] for r in top] == REASONS          # bands in coded order
    illness = pick(top, response_option="Illness")
    assert illness["estimate"] == pytest.approx(
        weighted_share(base, "PES4", "_w", [1, 2, 3, 4], [1]), abs=1e-5)
    assert illness["n"] == int(base["PES4"].isin([1, 2, 3, 4]).sum())
    assert pick(top, response_option="Bad weather")["estimate"] == 0.0
    assert {r["estimate_type"] for r in rows} == {"pct"}
    assert illness["provenance_url"] == cps.page_url(2020) and illness["weight_var"] == "PWSSWGT"
    assert illness["item_text"] == "How did (you/name) register to vote?"
    assert all(t == pytest.approx(100.0, abs=1e-4) for t in pct_cells(rows).values())
    assert {r["geography"] for r in rows if r["geo_code"] == "25"} == {"STATE"}
    dims = {r["subgroup_dim"] for r in rows}
    assert dims - {"all"} and dims <= {"all", *cps.SUBGROUPS}
    assert all(r["n"] >= 5 for r in rows)
    # 2020 is no longer the latest year once 2022 joins: toplines only.
    plan[0].items[2022] = _item("PES4", REASONS)
    assert {r["subgroup_dim"] for r in cps.bulk_rows(df, 2020, plan, min_n=5)} == {"all"}


def test_run_writes_both_tiers_into_one_slice_and_reruns_idempotently(store, tmp_path):
    raw = pd.read_csv(FX_2020)
    _with_pes4(raw).assign(PRS8=[(i % 2) + 1 for i in range(len(raw))]).to_csv(
        tmp_path / "nov20pub_SYNTHETIC.csv", index=False)
    (tmp_path / "cpsnov20.txt").write_text(LAYOUT, encoding="utf-8")
    written = cps.run(store, raw_dir=tmp_path, allow_synthetic=True, min_n=5, years=(2020,))
    assert written == count(store)
    constructs = {r[0] for r in store.query("SELECT DISTINCT construct FROM norms")}
    assert constructs == {"turnout", "registration", "pes4", "prs8"}
    assert cps.run(store, raw_dir=tmp_path, allow_synthetic=True, min_n=5, years=(2020,)) == written
    assert count(store) == written
    label = store.query("SELECT label FROM concordance WHERE construct = 'pes4'")[0][0]
    assert label == "What was the main reason (you/name) did not vote?"
    if store.table_exists("response_order"):    # migration 007: the export's coded order
        order = store.query("SELECT response_option FROM response_order WHERE source = 'CPS' "
                            "AND construct = 'pes4' ORDER BY ordinal")
        assert [r[0] for r in order] == list(cps.parse_dictionary(LAYOUT)[2].bands.values())
        assert not store.query("SELECT 1 FROM response_order WHERE construct = 'turnout'")


# -- the real files ------------------------------------------------------------------------

@pytest.fixture(scope="session")
def cps_real(tmp_path_factory):
    if not set(cps.YEARS) <= set(cps.locate()):
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


def test_turnout_and_registration_stay_2016_to_2024(cps_real):
    years = {r[0].year for r in cps_real.query(
        "SELECT DISTINCT period_start FROM norms WHERE construct IN ('turnout', 'registration')")}
    assert years == set(cps.YEARS)


# -- the bulk tier, real files --------------------------------------------------------------

def _tally_lines(text: str) -> list[str]:
    lines = text.splitlines()
    marks = [i for i, line in enumerate(lines) if re.match(r"^\s*attachment\s+\d+\s*$", line, re.I)]
    for a, b in zip(marks, [*marks[1:], len(lines)]):
        head = " ".join(lines[a:a + 8]).lower()
        if "unweighted" in head and "tall" in head:
            return lines[a + 1:b]
    return []


def tallies(text: str, names) -> dict[str, dict[int, int]]:
    """The documentation's unweighted tallies, name -> code -> count. A count closes its
    code's line or, where the label wraps, the label's last line."""
    out: dict[str, dict[int, int]] = {}
    current = pending = None
    for line in _tally_lines(text):
        m = re.match(r"^\s*([A-Z][A-Z0-9]{2,})(\s.*|)$", line)
        rest = line
        if m and m.group(1) in names:
            current, pending, rest = m.group(1), None, m.group(2)
            out.setdefault(current, {})
        if current is None:
            continue
        v = re.match(r"^\s*(-?\d{1,2})\s{2,}(\S.*)$", rest)
        if v:
            pending, rest = int(v.group(1)), v.group(2)
        t = re.search(r"\s{2,}([\d,]+)\s*$", rest)
        if t and pending is not None:
            out[current][pending] = int(t.group(1).replace(",", ""))
            pending = None
    return {k: v for k, v in out.items() if v}


# The 2016 documentation prints 667 for PES7 code 2 where the file holds 677; the item's
# other codes match to the person, so a misprint, not a misread position.
TALLY_MISPRINTS = {(2016, "PES7", 2): 677}


def test_every_years_layout_positions_read_the_published_tallies():
    """Each year's documentation tallies its supplement items, unweighted, over interviewed
    adult civilian household members 18+. Reading every item the loader uses at its parsed
    position must give those counts exactly: the check that the layout parse and the
    fixed-width reads are right, back years included (2008 from the Census API). The
    interviewer check item (PUSCK4), which no construct reads, is tallied on another base
    and differs by a few dozen in most years; it is left out."""
    located = cps.locate()
    if not set(cps.ALL_YEARS) <= set(located):
        pytest.skip("not every CPS year 2008-2024 is cached under raw/cps/")
    for year in cps.ALL_YEARS:
        text = cps.dictionary_text(year)
        layout = cps.parse_dictionary(text)
        items = {i.name: i for i in layout if i.name in cps.CORE_ITEMS or cps.skip_reason(i) is None}
        published = {k: v for k, v in tallies(text, {i.name for i in layout}).items() if k in items}
        assert set(published) == set(items), year
        df = cps.read_file(located[year], year, {n: (i.start, i.end) for n, i in items.items()})
        d = df[(df["HRINTSTA"] == 1) & (df["PRPERTYP"] == 2) & (df["PRTAGE"] >= 18)]
        for name, counts in published.items():
            got = d[name].value_counts().to_dict()
            expected = {c: TALLY_MISPRINTS.get((year, name, c), n) for c, n in counts.items()}
            assert {c: int(got.get(c, 0)) for c in counts} == expected, (year, name)


# Census historical Table A-6, citizen percent registered and voted: the back-year files read
# the P20 universe correctly, though turnout and registration are stored for 2016-2024 only.
# https://www2.census.gov/programs-surveys/cps/tables/time-series/voting-historical-time-series/a6.xlsx
A6 = {2008: (71.0, 63.6), 2012: (71.2, 61.8)}


def test_back_year_files_read_the_p20_citizen_rates():
    located = cps.locate()
    for year, (registered, voted) in A6.items():
        if year not in located:
            pytest.skip(f"CPS {year} not cached under raw/cps/")
        d = cps.prepare(cps.read_file(located[year], year))
        share = lambda col, label: 100 * d.loc[d[col] == label, "_w"].sum() / d["_w"].sum()
        assert round(share("_registration", "Registered"), 1) == registered, year
        assert round(share("_turnout", "Voted"), 1) == voted, year


# P20 Table 10, "Reasons For Not Voting", and Table 12, "Method of Registration": the percent
# distribution among registered non-voters (PES4's universe) and among the registered
# (PES7's), Total and Female rows, and the closing "Don't know or refused" share. The bulk
# tier leaves don't know and refused out of its base, so each P20 share is compared after
# dividing by (100 - that share). Columns follow the items' codes in order.
TABLE_10 = {
    # https://www2.census.gov/programs-surveys/cps/tables/p20/587/vote10_2024.xlsx
    2024: {"all": ([12.4, 7.4, 4.1, 19.7, 17.8, 2.2, 14.7, 3.6, 0.3, 2.4, 12.2], 3.1),
           "Female": ([14.8, 6.1, 3.7, 18.4, 17.0, 2.8, 14.2, 3.6, 0.4, 2.5, 13.0], 3.4)},
    # https://www2.census.gov/programs-surveys/cps/tables/p20/568/table10.xls
    2012: {"all": ([14.0, 8.6, 3.9, 15.7, 18.9, 3.3, 12.7, 5.5, 0.8, 2.7, 11.1], 3.0)},
}
TABLE_12 = {
    # https://www2.census.gov/programs-surveys/cps/tables/p20/587/vote12_2024.xlsx
    2024: {"all": ([31.2, 0.9, 10.6, 10.4, 3.4, 12.9, 2.8, 5.1, 3.6], 19.1),
           "Female": ([30.9, 1.2, 10.7, 10.0, 3.4, 13.0, 2.9, 5.0, 3.5], 19.4)},
    # https://www2.census.gov/programs-surveys/cps/tables/p20/568/table12.xls
    2012: {"all": ([24.2, 1.2, 13.1, 2.9, 5.5, 19.1, 5.0, 6.3, 3.7], 19.0)},
}


@pytest.mark.parametrize("construct, table", [("pes4", TABLE_10), ("pes7", TABLE_12)])
def test_bulk_items_match_p20_reasons_and_registration_methods(cps_real, construct, table):
    for year, cells in table.items():
        rows = norm_rows(cps_real, "construct = ? AND geo_code = 'US' AND period_start = ?",
                         [construct, dt.date(year, 11, 1)])
        assert rows, (construct, year)
        bands = [r[0] for r in cps_real.query(
            "SELECT response_option FROM response_order WHERE source = 'CPS' AND construct = ? "
            "ORDER BY ordinal", [construct])]
        for value, (shares, dont_know) in cells.items():
            dim = "all" if value == "all" else "sex"
            got = {r["response_option"]: r["estimate"] for r in rows
                   if r["subgroup_dim"] == dim and r["subgroup_value"] == value}
            assert len(got) == len(shares), (construct, year, value)
            for band, p20 in zip(bands, shares):
                expected = 100 * p20 / (100 - dont_know)
                assert got[band] == pytest.approx(expected, abs=0.15), (construct, year, value, band)


def test_bulk_tier_covers_every_year_and_breaks_down_only_the_latest(cps_real):
    rows = cps_real.query(
        "SELECT construct, year(period_start), subgroup_dim, count(*) FROM norms "
        "WHERE construct NOT IN ('turnout', 'registration') GROUP BY 1, 2, 3")
    years: dict[str, set] = {}
    broken_down: dict[str, set] = {}
    for construct, year, dim, _ in rows:
        years.setdefault(construct, set()).add(year)
        if dim != "all":
            broken_down.setdefault(construct, set()).add(year)
    assert years["pes5"] == years["pes6"] == set(cps.ALL_YEARS)
    assert years["pes7"] == set(cps.ALL_YEARS) - {2008} and years["pes7_2008"] == {2008}
    assert years["pes4_2020"] == {2020} and 2020 not in years["pes4"]
    assert years["pes8"] == {2008, 2010, 2012} and years["prs8"] == set(cps.ALL_YEARS) - years["pes8"]
    assert broken_down == {c: {max(ys)} for c, ys in years.items()}
    assert {r[0] for r in cps_real.query("SELECT DISTINCT estimate_type FROM norms "
                                         "WHERE construct LIKE 'p%'")} == {"pct"}
