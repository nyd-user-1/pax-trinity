"""Massachusetts registered voters and party enrollment, by city and town and statewide, from
the Secretary of the Commonwealth's published enrollment breakdowns.

Each vintage is one PDF from the Registration Statistics page: the state-election breakdowns
for 2008-2024 and the latest, February 1, 2025. Page 1 is "Enrollment Breakdown as of <date>",
a county table with a Statewide Totals row; the pages after it are "Registered Voters and Party
Enrollment as of <date>", each county's aggregate row followed by its towns. The parties
printed change by vintage (Libertarian, Green-Rainbow, United Independent Party, Working
Families come and go); the loader reads them from each file's header.

The PDFs set each town's figures among dot leaders, and some digits interleave with the dots,
so the reader drops every "." character from those pages and groups the remaining words into
rows by their position on the page. Counts never carry decimals there. Every file is checked
before anything is written: 351 towns, each county's towns summing to its aggregate row and
to page 1, and page 1's counties summing to its statewide row.

Town tables do not print Political Designations; the loader stores it as the town's
registered voters less the printed columns. That identity holds exactly for every county on
page 1 of every vintage, so the town figures sum to the published column.

Towns get their GEOID from the geographies table (ACS/CVAP town names), matched by county
and name. A town that does not match is listed and not stored.
"""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass, field
from pathlib import Path

from .. import config
from ..db import Store

SOURCE = "MA_ENROLLMENT"
CONSTRUCT = "registration_by_party"
SITE = "https://www.sec.state.ma.us"
PD = "Political Designations"

# as-of date (read back from each file's title and checked) -> path on the site
VINTAGES = {
    "2025-02-01": "/divisions/elections/download/research-and-statistics/enrollment_count_20250201.pdf",
    "2024-10-26": "/divisions/elections/download/research-and-statistics/enrollment_count_20241105.pdf",
    "2022-10-29": "/divisions/elections/download/research-and-statistics/enrollment_count_20221029.pdf",
    "2020-10-24": "/divisions/elections/download/registration/enrollment_count_20201024.pdf",
    "2018-10-17": "/divisions/elections/download/registration/enrollment_count_20181017.pdf",
    "2016-10-19": "/divisions/elections/download/registration/enrollment_counts_20161019.pdf",
    "2014-10-15": "/divisions/elections/download/registration/enrollment_counts_20141015.pdf",
    "2012-10-17": "/divisions/elections/download/registration/06NOV2012_ST_Party_Enrollment_Stats_3.pdf",
    "2010-10-13": "/divisions/elections/download/registration/enrollment_count_regdt_10132010.pdf",
    "2008-10-15": "/divisions/elections/download/registration/st_county_town_enroll_breakdown_08.pdf",
}

COUNTIES = ("BARNSTABLE", "BERKSHIRE", "BRISTOL", "DUKES", "ESSEX", "FRANKLIN", "HAMPDEN",
            "HAMPSHIRE", "MIDDLESEX", "NANTUCKET", "NORFOLK", "PLYMOUTH", "SUFFOLK", "WORCESTER")
N_TOWNS = 351
LABELS = {"Green Rainbow": "Green-Rainbow"}   # 2008 prints the party's name unhyphenated
HEADER_SKIP = {"Total", "No.", "No", "Registered", "Voters", "Aggregate", "Totals", "County"}
NUM = re.compile(r"^\d{1,3}(,\d{3})*$")


def url(as_of: str) -> str:
    return SITE + VINTAGES[as_of]


def source_version(as_of: str) -> str:
    return f"MA enrollment as of {as_of}"


# -- reading the PDF -------------------------------------------------------------------------

def _rows(page, drop_dots: bool, tol: float = 2.5) -> list[list[dict]]:
    if drop_dots:
        page = page.filter(lambda o: not (o.get("object_type") == "char" and o.get("text") == "."))
    words = sorted(page.extract_words(), key=lambda w: (w["top"], w["x0"]))
    rows: list[list] = []
    for w in words:
        if rows and abs(w["top"] - rows[-1][0]) <= tol:
            rows[-1][1].append(w)
        else:
            rows.append([w["top"], [w]])
    return [sorted(ws, key=lambda w: w["x0"]) for _, ws in rows]


def _text(ws) -> str:
    return " ".join(w["text"] for w in ws)


def _data_row(ws) -> tuple[str, list[int]] | None:
    """A town or county row: name words at the left margin, then counts."""
    name = [w["text"] for w in ws if not NUM.match(w["text"])]
    nums = [int(w["text"].replace(",", "")) for w in ws if NUM.match(w["text"])]
    if not name or not nums or ws[0]["x0"] > 60 or NUM.match(ws[0]["text"]):
        return None
    if not re.match(r"^[A-Z][A-Za-z'\-]*$", name[0]):
        return None
    return " ".join(name), nums


def _header_labels(rows, title_i: int) -> list[str]:
    """Party columns from the header block, multi-line labels merged by x-position."""
    first = next(i for i, ws in enumerate(rows) if i > title_i and _data_row(ws))
    words = [w for ws in rows[title_i + 1:first] for w in ws
             if w["text"] not in HEADER_SKIP and w["x0"] > 200]
    clusters: list[dict] = []
    for w in sorted(words, key=lambda w: w["x0"]):
        cx = (w["x0"] + w["x1"]) / 2
        for c in clusters:
            if c["x0"] - 8 <= cx <= c["x1"] + 8:
                c["words"].append(w)
                c["x0"], c["x1"] = min(c["x0"], w["x0"]), max(c["x1"], w["x1"])
                break
        else:
            clusters.append({"x0": w["x0"], "x1": w["x1"], "words": [w]})
    labels = []
    for c in sorted(clusters, key=lambda c: c["x0"]):
        text = " ".join(w["text"] for w in sorted(c["words"], key=lambda w: (w["top"], w["x0"])))
        labels.append(LABELS.get(text, text))
    return labels


@dataclass
class Breakdown:
    as_of: dt.date
    page1_title: str          # "Enrollment Breakdown as of 10/26/2024"
    town_title: str           # "Registered Voters and Party Enrollment as of October 26, 2024"
    parties: list[str]        # the printed columns after the total, in order
    statewide: dict[str, int]                 # total + parties + Political Designations
    towns: list[tuple[str, str, dict[str, int]]] = field(default_factory=list)  # county, name, counts


class LayoutError(RuntimeError):
    pass


def read_pdf(path: Path) -> Breakdown:
    import pdfplumber

    with pdfplumber.open(path) as pdf:
        page1_title, county1, state1 = None, {}, None
        for ws in _rows(pdf.pages[0], drop_dots=False):
            t = _text(ws)
            if "Enrollment Breakdown as of" in t:
                page1_title = t.strip()
            toks = t.split()
            counts = [int(x.replace(",", "")) for x in toks if NUM.match(x)]
            if toks and toks[0].upper() in COUNTIES and counts:
                county1[toks[0].upper()] = counts
            if t.startswith("Statewide"):
                state1 = counts
        town_title, parties = None, None
        aggs: dict[str, list[int]] = {}
        towns: list[tuple[str, str, list[int]]] = []
        county = None
        for page in pdf.pages[1:]:
            rows = _rows(page, drop_dots=True)
            for i, ws in enumerate(rows):
                t = _text(ws)
                if "Party Enrollment as of" in t:
                    town_title = town_title or t.strip()
                    if parties is None:
                        parties = _header_labels(rows, i)
                    continue
                row = _data_row(ws)
                if row is None:
                    continue
                name, nums = row
                up = name.upper()
                if up.startswith(("TOTAL", "STATEWIDE")):
                    continue
                if up in COUNTIES and up not in aggs and county1.get(up, [None])[0] == nums[0]:
                    aggs[up], county = nums, up
                    continue
                if up in aggs and nums == aggs[up] and any(c == up for c, _, _ in towns):
                    continue   # the county row, repeated at the top of a continuation page
                towns.append((county, name, nums))
    if not (page1_title and town_title and parties and state1):
        raise LayoutError(f"{path.name}: titles, header or statewide row not found")
    m = re.search(r"as of (\d{2})/(\d{2})/(\d{4})", page1_title)
    as_of = dt.date(int(m.group(3)), int(m.group(1)), int(m.group(2)))
    _check(path.name, parties, county1, state1, aggs, towns)
    cols = ["Total", *parties]
    b = Breakdown(as_of=as_of, page1_title=page1_title, town_title=town_title, parties=parties,
                  statewide=dict(zip(cols + [PD], state1)))
    for c, name, nums in towns:
        counts = dict(zip(cols, nums))
        counts[PD] = nums[0] - sum(nums[1:])
        b.towns.append((c, name, counts))
    return b


def _check(name, parties, county1, state1, aggs, towns) -> None:
    k = len(parties) + 1
    problems = []
    if len(towns) != N_TOWNS:
        problems.append(f"{len(towns)} towns, expected {N_TOWNS}")
    if set(aggs) != set(COUNTIES):
        problems.append(f"county rows found: {sorted(aggs)}")
    if any(len(n) != k for _, _, n in towns):
        problems.append("a town row does not have one count per printed column")
    for c, agg in aggs.items():
        sums = [sum(col) for col in zip(*[n for cc, _, n in towns if cc == c])]
        if sums != agg:
            problems.append(f"{c}: towns sum to {sums}, county row reads {agg}")
        p1 = county1.get(c, [])
        if p1[:k] != agg or len(p1) != k + 1 or p1[-1] != agg[0] - sum(agg[1:]):
            problems.append(f"{c}: page 1 reads {p1}, county row {agg}")
    if [sum(col) for col in zip(*[county1[c] for c in COUNTIES if c in county1])] != state1:
        problems.append("page 1's counties do not sum to its statewide row")
    if problems:
        raise LayoutError(f"{name}: " + "; ".join(problems))


# -- matching towns to GEOIDs ----------------------------------------------------------------

def _norm(name: str) -> str:
    return re.sub(r"\s+", " ", name.upper().replace("-", " ").replace(".", "")).strip()


def census_key(census_name: str) -> tuple[str, str]:
    """'North Attleborough Town city, Bristol County, Massachusetts' -> ('BRISTOL', 'NORTH ATTLEBOROUGH')"""
    place, county = census_name.split(", ")[:2]
    place = re.sub(r" (Town city|city|town)$", "", place)
    return county.removesuffix(" County").upper(), _norm(place)


def match_towns(towns, geos) -> tuple[dict[tuple[str, str], tuple[str, str]], list[str]]:
    """towns: (county, printed name) pairs; geos: (geo_code, Census name) pairs.
    Returns {(county, printed name): (geo_code, Census name)} and the unmatched, as printed."""
    index: dict[tuple[str, str], list[tuple[str, str]]] = {}
    for code, cname in geos:
        index.setdefault(census_key(cname), []).append((code, cname))
    matched, unmatched = {}, []
    for county, name in towns:
        hits = index.get((county, _norm(name)), [])
        if len(hits) == 1:
            matched[(county, name)] = hits[0]
        else:
            unmatched.append(f"{name} ({county.title()} County)")
    return matched, unmatched


def town_geographies(store: Store) -> list[tuple[str, str]]:
    return store.query("SELECT geo_code, name FROM geographies WHERE level = 'TOWN' "
                       "AND geo_code LIKE '25%'")


# -- rows ------------------------------------------------------------------------------------

def build_rows(b: Breakdown, file_url: str, geos) -> tuple[list[dict], list[str]]:
    matched, unmatched = match_towns([(c, n) for c, n, _ in b.towns], geos)
    version = source_version(b.as_of.isoformat())
    options = [*b.parties, PD]
    file_name = file_url.rsplit("/", 1)[1]
    rows: list[dict] = []

    def emit(geography, geo_code, place, item_text, counts, where):
        total = counts["Total"]
        base = dict(source=SOURCE, source_version=version, geography=geography,
                    geo_code=geo_code, period_start=b.as_of, period_end=b.as_of,
                    construct=CONSTRUCT, item_text=item_text, subgroup_dim="all",
                    subgroup_value="all", se=None, moe=None, weight_var=None,
                    provenance_url=file_url)
        for option in options:
            derived = option == PD and where == "town"
            note = (f"{place}. {where.capitalize()} row of the Secretary of the Commonwealth's "
                    f"\"{item_text}\" ({file_name}). pct is the share of the "
                    f"{total:,} registered voters (n).")
            if derived:
                note += (" The town table prints no Political Designations column; this is the "
                         "town's registered voters less the printed parties and Unenrolled, and "
                         "summed by county and statewide it equals the published column.")
            rows.append(dict(base, response_option=option, estimate_type="count",
                             estimate=float(counts[option]), n=None, provenance_note=note))
            rows.append(dict(base, response_option=option, estimate_type="pct",
                             estimate=round(100 * counts[option] / total, 6) if total else 0.0,
                             n=total, provenance_note=note))

    for county, name, counts in b.towns:
        hit = matched.get((county, name))
        if hit is None:
            continue
        code, cname = hit
        emit("TOWN", code, f"{cname} (printed {name})", b.town_title, counts, "town")
    emit("STATE", "25", "Massachusetts", b.page1_title, b.statewide, "statewide totals")
    return rows, unmatched


# -- fetching and running ----------------------------------------------------------------------

def _dir(raw_dir: Path | None) -> Path:
    return Path(raw_dir) if raw_dir is not None else config.RAW / "ma_enrollment"


def locate(as_of: str, raw_dir: Path | None = None) -> Path | None:
    p = _dir(raw_dir) / VINTAGES[as_of].rsplit("/", 1)[1]
    return p if p.exists() else None


def fetch(as_of: str, raw_dir: Path | None = None) -> Path | None:
    """Download one vintage (the site refuses plain HTTP clients). None after printing on failure."""
    target = _dir(raw_dir) / VINTAGES[as_of].rsplit("/", 1)[1]
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {url(as_of)}")
    try:
        from curl_cffi import requests as creq

        resp = creq.get(url(as_of), impersonate="chrome", timeout=120)
        resp.raise_for_status()
        if not resp.content.startswith(b"%PDF"):
            print("the reply is not a PDF (the site may be challenging the client)")
            return None
        target.write_bytes(resp.content)
    except Exception as exc:  # network, HTTP, or curl_cffi missing
        print(f"download failed: {exc}")
        return None
    return target


INSTRUCTIONS = """\
The {as_of} enrollment breakdown is not under {raw}/ and could not be downloaded:

    {url}

Save it into audience/raw/ma_enrollment/ under that name, then rerun:
python -m audience.load ma_enrollment"""


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        download: bool | None = None, vintages=None) -> int:
    """download defaults to True for the real raw/ma_enrollment/ and False when a test passes raw_dir."""
    download = raw_dir is None if download is None else download
    geos = town_geographies(store)
    if not geos:
        print("The geographies table has no Massachusetts towns to match against; load acs "
              "(or cvap) first. No rows were written.")
        return 0
    total = 0
    for as_of in vintages or VINTAGES:
        path = None if refresh else locate(as_of, raw_dir)
        if path is None and download:
            path = fetch(as_of, raw_dir)
        if path is None:
            print(INSTRUCTIONS.format(as_of=as_of, raw=_dir(raw_dir), url=url(as_of)))
            continue
        b = read_pdf(path)
        if b.as_of.isoformat() != as_of:
            raise LayoutError(f"{path.name} reads as of {b.as_of}, expected {as_of}")
        rows, unmatched = build_rows(b, url(as_of), geos)
        written = store.upsert_norms(rows, prune=(SOURCE, source_version(as_of)))
        total += written
        print(f"{source_version(as_of)}: {written} rows, {len(b.towns) - len(unmatched)} towns "
              f"and the statewide totals; columns {', '.join(b.parties)}, {PD}")
        for u in unmatched:
            print(f"  no GEOID match, not stored: {u}")
    if total:
        store.touch_source(SOURCE)
    return total
