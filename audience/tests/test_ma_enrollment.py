"""MA party enrollment: name-to-GEOID matching, the PDF reader against the published tables,
and reruns."""

import html
import re

import pytest

from audience import config, db, geographies, migrate
from audience.loaders import ma_enrollment as m
from survey_helpers import count, norm_rows

# A synthetic slice of the geographies table: Census names as the ACS/CVAP files print them.
GEOS = [
    ("2500502190", "Attleboro city, Bristol County, Massachusetts"),
    ("2500545385", "North Attleborough Town city, Bristol County, Massachusetts"),
    ("2500938400", "Manchester-by-the-Sea town, Essex County, Massachusetts"),
    ("2500921850", "Essex town, Essex County, Massachusetts"),
    ("2502507000", "Boston city, Suffolk County, Massachusetts"),
    ("2500103690", "Barnstable Town city, Barnstable County, Massachusetts"),
    ("2500308645", "Bourne town, Barnstable County, Massachusetts"),
]


def test_names_match_by_county_and_name_and_never_guess():
    towns = [
        ("BRISTOL", "NORTH ATTLEBOROUGH"),        # Census adds "Town city"
        ("BRISTOL", "ATTLEBORO"),
        ("ESSEX", "MANCHESTER-BY-THE-SEA"),
        ("ESSEX", "ESSEX"),                       # a town named for its county
        ("SUFFOLK", "BOSTON"),
        ("BARNSTABLE", "BARNSTABLE"),
        ("BARNSTABLE", "BOURNE"),
        ("ESSEX", "MANCHESTER"),                  # the pre-1989 name: not guessed
        ("BRISTOL", "NORTH ATTLEBORO"),           # an abbreviation: not guessed
        ("BARNSTABLE", "HYANNIS"),                # a village, not a town
        ("NORFOLK", "BOSTON"),                    # right name, wrong county
    ]
    matched, unmatched = m.match_towns(towns, GEOS)
    assert matched[("BRISTOL", "NORTH ATTLEBOROUGH")][0] == "2500545385"
    assert matched[("ESSEX", "MANCHESTER-BY-THE-SEA")][0] == "2500938400"
    assert matched[("ESSEX", "ESSEX")][0] == "2500921850"
    assert matched[("BARNSTABLE", "BARNSTABLE")][0] == "2500103690"
    assert len(matched) == 7
    assert unmatched == ["MANCHESTER (Essex County)", "NORTH ATTLEBORO (Bristol County)",
                         "HYANNIS (Barnstable County)", "BOSTON (Norfolk County)"]


def test_a_file_that_does_not_add_up_is_refused():
    parties = ["Democrat", "Republican", "Unenrolled"]
    county1 = {c: [10, 4, 1, 5, 0] for c in m.COUNTIES}
    aggs = {c: [10, 4, 1, 5] for c in m.COUNTIES}
    towns = [(c, f"T{i}", [10, 4, 1, 4]) for i, c in enumerate(m.COUNTIES)]   # one short
    with pytest.raises(m.LayoutError, match="towns sum to"):
        m._check("x.pdf", parties, county1, [140, 56, 14, 70, 0], aggs, towns)


def need_file(as_of):
    path = m.locate(as_of)
    if path is None:
        pytest.skip(f"{as_of} breakdown not cached under raw/ma_enrollment/")
    return path


@pytest.fixture(scope="module")
def b2024():
    return m.read_pdf(need_file("2024-10-26"))


def test_2024_statewide_totals_match_the_printed_row(b2024):
    # enrollment_count_20241105.pdf, page 1, "Enrollment Breakdown as of 10/26/2024",
    # Statewide Totals: 5,142,343 registered; Democrat 1,352,937 (26.31%); Republican 434,887
    # (8.46%); Libertarian 16,467 (0.32%); Unenrolled 3,302,493 (64.22%); Political
    # Designations 35,559 (0.69%).
    # https://www.sec.state.ma.us/divisions/elections/download/research-and-statistics/enrollment_count_20241105.pdf
    rows, unmatched = m.build_rows(b2024, m.url("2024-10-26"), GEOS)
    state = {(r["response_option"], r["estimate_type"]): r for r in rows if r["geo_code"] == "25"}
    printed = {"Democrat": (1_352_937, 26.31), "Republican": (434_887, 8.46),
               "Libertarian": (16_467, 0.32), "Unenrolled": (3_302_493, 64.22),
               m.PD: (35_559, 0.69)}
    for option, (n, pct) in printed.items():
        assert state[(option, "count")]["estimate"] == n
        assert round(state[(option, "pct")]["estimate"], 2) == pct
        assert state[(option, "pct")]["n"] == 5_142_343
    assert state[("Democrat", "pct")]["item_text"] == "Enrollment Breakdown as of 10/26/2024"
    assert len(b2024.towns) == m.N_TOWNS


def _accessible_table(path):
    """Town rows of the Secretary's accessible HTML table: name -> [total, D, R, U, PD]."""
    text = path.read_text(encoding="utf-8", errors="replace")
    out = {}
    for table in re.findall(r"<table.*?</table>", text, re.S)[1:]:
        for tr in re.findall(r"<tr.*?</tr>", table, re.S)[2:]:      # header, county row
            cells = [re.sub(r"<[^>]+>|\s+", " ", html.unescape(c)).strip()
                     for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)]
            if cells[0].upper() != "TOTALS":                              # the table's last row
                out[cells[0].upper()] = [int(c.replace(",", "")) for c in cells[1:]]
    return out


def test_2025_pdf_and_derived_designations_match_the_accessible_table():
    """The accessible HTML version of the 2025 breakdown prints Political Designations per
    town; the PDF's town tables don't. Both readings must agree, town by town."""
    page = config.RAW / "ma_enrollment" / "enrollment-breakdown-2025.htm"
    if not page.exists():
        pytest.skip("accessible table not cached")
    b = m.read_pdf(need_file("2025-02-01"))
    published = _accessible_table(page)
    assert len(published) == m.N_TOWNS
    for _, name, counts in b.towns:
        got = [counts["Total"], counts["Democrat"], counts["Republican"], counts["Unenrolled"],
               counts[m.PD]]
        assert got == published[name.upper()], name


@pytest.fixture
def town_store(tmp_path):
    names = geographies.census_names()
    towns = [(c, n, "TOWN", c[:5]) for c, n in names.items()
             if len(c) == 10 and c.startswith("25") and not c.endswith("00000")]
    if len(towns) != m.N_TOWNS:
        pytest.skip("Census name caches (raw/cvap/, raw/acs/) absent")
    s = db.connect(duckdb_path=tmp_path / "n.duckdb")
    migrate.apply(s, quiet=True)
    s.replace_rows("geographies", geographies.COLUMNS, towns)
    yield s
    s.close()


def test_load_and_rerun_leave_the_count_unchanged(town_store):
    need_file("2025-02-01")
    need_file("2024-10-26")
    vintages = ("2025-02-01", "2024-10-26")
    n = m.run(town_store, vintages=vintages, download=False)
    # 352 places (351 towns, the state) x options x (count, pct); 2025 has 4, 2024 has 5
    assert n == 352 * 2 * (4 + 5) == count(town_store)
    assert m.run(town_store, vintages=vintages, download=False) == n == count(town_store)
    sums = town_store.query(
        "SELECT source_version, geo_code, sum(estimate) FROM norms WHERE estimate_type = 'pct' "
        "GROUP BY 1, 2 HAVING abs(sum(estimate) - 100) > 1e-4")
    assert sums == []
    boston = norm_rows(town_store, "geo_code = '2502507000' AND response_option = 'Democrat' "
                                   "AND estimate_type = 'count' AND source_version = ?",
                       [m.source_version("2024-10-26")])
    assert boston[0]["estimate"] == 174_046 and boston[0]["geography"] == "TOWN"


def test_without_towns_or_files_nothing_is_written(store, tmp_path, capsys):
    assert m.run(store, raw_dir=tmp_path) == 0
    assert "load acs" in capsys.readouterr().out
    store.replace_rows("geographies", geographies.COLUMNS, [(c, n, "TOWN", c[:5]) for c, n in GEOS])
    assert m.run(store, raw_dir=tmp_path) == 0      # a test's raw_dir never downloads
    assert m.url("2025-02-01") in capsys.readouterr().out
    assert count(store) == 0
