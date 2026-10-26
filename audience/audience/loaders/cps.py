"""CPS November Voting and Registration Supplement, read from the Census Bureau's public-use
files, for the US and Massachusetts.

Two harmonized constructs, 2016-2024: turnout and registration, overall and by sex, age
bucket, race_eth, education and family income, per election year. Beside them the bulk tier,
2008-2024: every other supplement item the data dictionaries carry with 2 to 24 labeled
categories (reasons for not registering and not voting, method and timing of the vote, how
the respondent registered, time at the address), one construct per item, named for it.

The files need no registration and are cached once under raw/cps/:
  2020, 2022, 2024        nov<yy>pub.csv
  2010 to 2018            nov<yy>pub.dat.gz, fixed width; Census publishes no CSV for these
                          years.
  2008                    nov08pub_api.csv, from the Census microdata API: the datasets tree
                          holds no 2008 supplement file (see API_COLUMNS).
  every year              cpsnov<yy>.pdf, the technical documentation (cpsnov14r.pdf, the
                          revised edition, for 2014), and cpsnov<yy>.txt, its pdftotext -layout
                          text, which the bulk tier parses.
Variable names, positions and codes come from each year's documentation. The basic-CPS
fields sit at the same positions in every year 2008-2024 (2008 and 2010 call the age PEAGE,
2008 calls family income HUFAMINC; same positions, same codes); the supplement items move.
Every year's documentation says the supplement has no weight of its own and directs the
basic final weight, PWSSWGT (4 implied decimals), for tallying supplement items.

Turnout and registration follow the Census Bureau's P20 convention. The base is every U.S.
citizen 18 and over who is an adult civilian household member (PRTAGE >= 18, PRCITSHP 1-4,
PRPERTYP 2) in an interviewed household. Don't know, refused and no response (PES1 -2, -3,
-9) stay in the base and are reported as their own option, "No response", so "Voted" is the
P20 "percent voted (citizen)". Respondents who voted count as registered (PES2 is asked only
of non-voters). Turnout among those who answered is Voted / (Voted + Did not vote).

The bulk tier reads the supplement record layout (the attachment titled Supplement Record
Layout) of each year's documentation: an item's label and definition are its DESCRIPTION,
sentence-cased (data-dictionary text, not the questionnaire's wording), its bands the VALID
ENTRIES in order. Shares are over the same P20 universe inside the item's own universe, of
substantive answers only: not in universe, don't know, refused and no response (the negative
codes) are out of the base, the house survey convention. P20 tables keep don't know and
refused in their base, so a P20 share is this share times (1 - the P20 don't-know share).
Toplines for every year the item was asked; the five breakdowns for the latest year. An item
whose description or value list changes between years is split where it changes: the span
reaching the latest year keeps the plain name, an earlier span is named for its years (pes7
is 2010-2024, pes7_2008 the 2008 list, which has no online registration).
"""

from __future__ import annotations

import datetime as dt
import re
import shutil
import subprocess
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence

import numpy as np
import pandas as pd

from .. import categories as cat
from .. import config
from .. import survey
from ..db import Store
from ..survey import MIN_CELL_N

SOURCE = "CPS"
YEARS = (2016, 2018, 2020, 2022, 2024)        # turnout and registration
BACK_YEARS = (2008, 2010, 2012, 2014)         # the bulk tier only
ALL_YEARS = (*BACK_YEARS, *YEARS)
DATASETS = "https://www2.census.gov/programs-surveys/cps/datasets"
TECHDOCS = "https://www2.census.gov/programs-surveys/cps/techdocs"
FILES = {
    2008: "nov08pub_api.csv",
    2010: "nov10pub.dat.gz",
    2012: "nov12pub.dat.gz",
    2014: "nov14pub.dat.gz",
    2016: "nov16pub.dat.gz",
    2018: "nov18pub.dat.gz",
    2020: "nov20pub.csv",
    2022: "nov22pub.csv",
    2024: "nov24pub.csv",
}
DOCS = {2014: "cpsnov14r.pdf"}                # the revised edition the 2014 page links
# November 2008: the datasets tree holds only the basic monthly file (datasets/2008/basic/
# nov08pub, 950-character records, no supplement). The Census microdata API serves the
# supplement's records, so 2008 is fetched from it, the variables the loader reads, and
# cached as nov08pub_api.csv in the public-use form: PWSSWGT back to an integer with 4
# implied decimals (the API applies them) and HUFAMINC, the 2008 name, as HEFAMINC.
API = "https://api.census.gov/data/{year}/cps/voting/nov"
API_COLUMNS = {
    2008: ("HRYEAR4", "HUFAMINC", "HRINTSTA", "GESTFIPS", "PRTAGE", "PESEX", "PEEDUCA",
           "PTDTRACE", "PEHSPNON", "PRPERTYP", "PRCITSHP", "PWSSWGT", "PES1", "PES2", "PES3",
           "PES4", "PES5", "PES6", "PES7", "PES8", "PUSCK4"),
}
API_RENAME = {"HUFAMINC": "HEFAMINC"}
# The year's page under Census's CPS voting supplement datasets. Census keeps none for 2008
# (the address answers with the current year's page), so 2008 cites its data file.
PAGE = ("https://www.census.gov/data/datasets/time-series/demo/cps/cps-supp_cps-repwgt/"
        "cps-voting.{year}.html")
NO_PAGE = (2008,)
# Fixture and alternate names: nov20pub.csv, nov20pub_SYNTHETIC.csv, nov16pub.dat.gz ...
FILE_NAME = re.compile(r"^nov(\d{2})pub.*\.(csv|dat|dat\.gz)$", re.I)

# Record layout, 1-based inclusive positions, from cpsnov16.pdf and cpsnov18.pdf (identical
# for these fields in 2008-2014 and 2020-2024 as well).
BASIC_LAYOUT = {
    "HRYEAR4": (18, 21), "HEFAMINC": (39, 40), "HRINTSTA": (57, 58), "GESTFIPS": (93, 94),
    "PRTAGE": (122, 123), "PESEX": (129, 130), "PEEDUCA": (137, 138), "PTDTRACE": (139, 140),
    "PEHSPNON": (157, 158), "PRPERTYP": (161, 162), "PRCITSHP": (172, 173),
    "PWSSWGT": (613, 622),
}
SUPPLEMENT_LAYOUT = {
    2008: {"PES1": (951, 952), "PES2": (953, 954)},
    2010: {"PES1": (951, 952), "PES2": (953, 954)},
    2012: {"PES1": (951, 952), "PES2": (953, 954)},
    2014: {"PES1": (951, 952), "PES2": (953, 954)},
    2016: {"PES1": (951, 952), "PES2": (953, 954)},
    2018: {"PES1": (1001, 1002), "PES2": (1003, 1004)},
}
COLUMNS = (*BASIC_LAYOUT, "PES1", "PES2")
WEIGHT_DECIMALS = 10_000

# PES1 and PES2 as printed in each year's technical documentation. 2016 and 2018 print the
# date as "November X, XXXX".
_PES1 = ("In any election, some people are not able to vote because they are sick or busy or "
         "have some other reason, and others do not want to vote. Did (you/name) vote in the "
         "election held on Tuesday, {date}?")
_PES2 = "(Were you/Was name) registered to vote in the {date} election?"
ELECTION_DATE = {
    2016: "November X, XXXX", 2018: "November X, XXXX", 2020: "November 3, 2020",
    2022: "November 8, 2022", 2024: "November 5, 2024",
}


def item_text(construct: str, year: int) -> str:
    template = _PES1 if construct == "turnout" else _PES2
    return template.format(date=ELECTION_DATE[year])


def data_url(year: int) -> str:
    if year in API_COLUMNS:
        return API.format(year=year)
    return f"{DATASETS}/{year}/supp/{FILES[year]}"


def doc_name(year: int) -> str:
    return DOCS.get(year, f"cpsnov{year % 100:02d}.pdf")


def doc_url(year: int) -> str:
    return f"{TECHDOCS}/{doc_name(year)}"


def page_url(year: int) -> str:
    """The year's Census supplement page, the bulk tier's provenance_url."""
    return data_url(year) if year in NO_PAGE else PAGE.format(year=year)


def source_version(year: int) -> str:
    return f"CPS November {year} supplement ({origin(year)})"


def origin(year: int) -> str:
    return "Census microdata API" if year in API_COLUMNS else "Census public-use file"


def _dir(raw_dir: Path | None) -> Path:
    return Path(raw_dir) if raw_dir is not None else config.RAW / "cps"


def locate(raw_dir: Path | None = None) -> dict[int, Path]:
    found: dict[int, Path] = {}
    d = _dir(raw_dir)
    if not d.exists():
        return found
    for p in sorted(d.iterdir()):
        m = FILE_NAME.match(p.name)
        if m and not p.name.endswith(".part"):
            year = 2000 + int(m.group(1))
            if year in ALL_YEARS:
                found.setdefault(year, p)
    return found


def fetch(year: int, raw_dir: Path | None = None) -> Path | None:
    """Download one year's public-use file into raw/cps/. None (after printing) on failure."""
    if year in API_COLUMNS:
        return fetch_api(year, raw_dir)
    return _download(data_url(year), _dir(raw_dir) / FILES[year])


def fetch_api(year: int, raw_dir: Path | None = None) -> Path | None:
    """The year's supplement records from the Census microdata API, every state, written in
    the public-use form (see API_COLUMNS). Needs CENSUS_API_KEY, as the ACS loader does."""
    import requests

    key = config.env("CENSUS_API_KEY")
    if not key:
        print("CENSUS_API_KEY is not set (audience/.env); the CPS 2008 records come from the "
              "Census microdata API, which needs it")
        return None
    target = _dir(raw_dir) / FILES[year]
    target.parent.mkdir(parents=True, exist_ok=True)
    url = data_url(year)
    print(f"downloading {url} ({len(API_COLUMNS[year])} variables, every state)")
    try:
        resp = requests.get(url, params={"get": ",".join(API_COLUMNS[year]), "for": "state:*",
                                         "key": key}, timeout=600)
        resp.raise_for_status()
        rows = resp.json()
    except Exception as exc:  # network, HTTP or a non-JSON refusal
        print(f"download failed: {exc}")
        return None
    df = pd.DataFrame(rows[1:], columns=rows[0])[list(API_COLUMNS[year])]
    df = df.apply(pd.to_numeric, errors="coerce")
    df["PWSSWGT"] = (df["PWSSWGT"] * WEIGHT_DECIMALS).round().astype("int64")
    tmp = target.with_name(target.name + ".part")
    df.rename(columns=API_RENAME).to_csv(tmp, index=False)
    tmp.rename(target)
    return target


def _download(url: str, target: Path) -> Path | None:
    import requests

    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {url}")
    try:
        with requests.get(url, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            tmp = target.with_name(target.name + ".part")
            with open(tmp, "wb") as f:
                for chunk in resp.iter_content(1 << 20):
                    f.write(chunk)
        tmp.rename(target)
    except Exception as exc:  # network or HTTP failure
        print(f"download failed: {exc}")
        return None
    return target


def read_file(path: Path, year: int,
              items: Mapping[str, tuple[int, int]] | None = None) -> pd.DataFrame:
    """The needed columns of one year's file, as integers, with a year column. items adds
    supplement items, name -> 1-based inclusive (start, end) from the year's record layout
    (positions are used only for the fixed-width files)."""
    items = dict(items or {})
    columns = (*COLUMNS, *(c for c in items if c not in COLUMNS))
    name = path.name.lower()
    if name.endswith(".csv"):
        df = pd.read_csv(path, usecols=lambda c: c.upper() in columns, low_memory=False)
        df = df.rename(columns=str.upper)
    else:
        import gzip

        layout = {**BASIC_LAYOUT, **SUPPLEMENT_LAYOUT[year], **items}
        opener = gzip.open if name.endswith(".gz") else open
        with opener(path, "rt", encoding="latin-1") as f:
            df = pd.read_fwf(f, colspecs=[(a - 1, b) for a, b in layout.values()],
                             names=list(layout), header=None, dtype=str)
    missing = [c for c in columns if c not in df]
    if missing:
        raise RuntimeError(f"{path.name}: columns {missing} not found; check {doc_name(year)}")
    df = df[list(columns)].apply(pd.to_numeric, errors="coerce")
    years = set(df["HRYEAR4"].dropna().astype(int))
    if years != {year}:
        raise RuntimeError(f"{path.name}: HRYEAR4 reads {sorted(years)}, expected {year}; "
                           "the record layout has drifted")
    df["year"] = year
    return df


# -- recodes and rates ---------------------------------------------------------------------

def race_eth(ptdtrace: pd.Series, pehspnon: pd.Series) -> pd.Series:
    """PEHSPNON 1 -> Hispanic; else PTDTRACE 1 White only, 2 Black only, 4 Asian only or
    5 Hawaiian/Pacific Islander only -> Asian or Pacific Islander, 3 AIAN only and 6-26 (two
    or more races) -> Other or multiracial."""
    out = pd.Series(np.nan, index=ptdtrace.index, dtype=object)
    out[ptdtrace == 1] = cat.RACE_ETH[1]
    out[ptdtrace == 2] = cat.RACE_ETH[2]
    out[ptdtrace.isin([4, 5])] = cat.RACE_ETH[3]
    out[(ptdtrace == 3) | ptdtrace.between(6, 26)] = cat.RACE_ETH[4]
    out[pehspnon == 1] = cat.RACE_ETH[0]
    return out


def education_4(peeduca: pd.Series) -> pd.Series:
    """PEEDUCA 31-39 (less than 1st grade through high school diploma or GED) HS or less;
    40-42 (some college, associate's) Some college; 43 BA; 44-46 (master's, professional,
    doctorate) Grad."""
    out = pd.Series(np.nan, index=peeduca.index, dtype=object)
    out[peeduca.between(31, 39)] = cat.EDUCATION_4[0]
    out[peeduca.between(40, 42)] = cat.EDUCATION_4[1]
    out[peeduca == 43] = cat.EDUCATION_4[2]
    out[peeduca.between(44, 46)] = cat.EDUCATION_4[3]
    return out


def income_bucket(hefaminc: pd.Series) -> pd.Series:
    """HEFAMINC's sixteen bands into six: 1-7 under $25,000; 8-11 $25,000-$49,999; 12-13
    $50,000-$74,999; 14 $75,000-$99,999; 15 $100,000-$149,999; 16 $150,000 or more.
    Negative codes (not in universe, refused, don't know) -> NaN."""
    b = cat.HH_INCOME_BUCKET
    out = pd.Series(np.nan, index=hefaminc.index, dtype=object)
    out[hefaminc.between(1, 7)] = b[0]
    out[hefaminc.between(8, 11)] = b[1]
    out[hefaminc.between(12, 13)] = b[2]
    out[hefaminc == 14] = b[3]
    out[hefaminc == 15] = b[4]
    out[hefaminc == 16] = b[5]
    return out


TURNOUT = {"Voted": "Voted", "Did not vote": "Did not vote", "No response": "No response"}
REGISTRATION = {"Registered": "Registered", "Not registered": "Not registered",
                "No response": "No response"}


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    """Restrict to the P20 universe and build the weight, status and subgroup columns."""
    universe = ((df["PRTAGE"] >= 18) & df["PRCITSHP"].isin([1, 2, 3, 4])
                & (df["PRPERTYP"] == 2) & (df["HRINTSTA"] == 1) & (df["PWSSWGT"] > 0))
    d = df[universe].copy()
    d["_w"] = d["PWSSWGT"] / WEIGHT_DECIMALS
    voted = d["PES1"] == 1
    d["_turnout"] = np.select([voted, d["PES1"] == 2], ["Voted", "Did not vote"], "No response")
    d["_registration"] = np.select([voted | (d["PES2"] == 1), d["PES2"] == 2],
                                   ["Registered", "Not registered"], "No response")
    d["_sex"] = survey.recode(d["PESEX"], {1: cat.SEX[0], 2: cat.SEX[1]})
    d["_age"] = survey.age_bucket(d["PRTAGE"])
    d["_race_eth"] = race_eth(d["PTDTRACE"], d["PEHSPNON"])
    d["_educ"] = education_4(d["PEEDUCA"])
    d["_income"] = income_bucket(d["HEFAMINC"])
    return d


SUBGROUPS = {"sex": "_sex", "age": "_age", "race_eth": "_race_eth", "educ": "_educ",
             "income": "_income"}
GEOS = (("US", "US", "United States", None), ("STATE", "25", "Massachusetts", 25))

NOTE = ("CPS November {year} supplement, Census public-use file {file}; layout and weight "
        "from {doc}. Census P20 convention: the base is citizens 18+ who are adult civilian "
        "household members, weighted by PWSSWGT (no supplement weight is published); don't "
        "know, refused and no response stay in the base as 'No response', so 'Voted' matches "
        "the P20 percent voted (citizen). Those who voted count as registered. count rows are "
        "weighted persons. n is the unweighted base. se uses the Kish effective n (the CPS "
        "design effect is ignored); moe is 1.645 x se. income is family income (HEFAMINC); "
        "race_eth puts Hispanic first.")


def period_dates(year) -> tuple[dt.date, dt.date]:
    y = int(year)
    return dt.date(y, 11, 1), dt.date(y, 11, 30)


def build_rows(df: pd.DataFrame, year: int, min_n: int = MIN_CELL_N,
               file_name: str | None = None) -> list[dict]:
    d = prepare(df)
    note = NOTE.format(year=year, file=file_name or FILES[year], doc=doc_url(year))
    rows: list[dict] = []
    for geography, geo_code, place, fips in GEOS:
        sub = d if fips is None else d[d["GESTFIPS"] == fips]
        for construct, col, options in (("turnout", "_turnout", TURNOUT),
                                        ("registration", "_registration", REGISTRATION)):
            cells, skipped = survey.shares(sub, col, "_w", options, SUBGROUPS,
                                           min_n=min_n, with_counts=True)
            rows += survey.norm_rows(
                cells, skipped, source=SOURCE, source_version=source_version(year),
                geography=geography, geo_code=geo_code, place=place, construct=construct,
                item_text=item_text(construct, year), weight_var="PWSSWGT",
                provenance_url=data_url(year), note=note, period_dates=period_dates,
                with_counts=True)
    return rows


CONCORDANCE = {
    "turnout": ("PES1", "CPS PES1 (Census public-use files), P20 base: citizens 18+, with "
                        "don't know, refused and no response kept as 'No response'."),
    "registration": ("PES1, PES2", "CPS PES2 is asked only of non-voters (PES1 not 1); voters "
                                   "count as registered."),
}


def write_concordance(store: Store) -> None:
    """Set the CPS variable names and note on the turnout and registration rows. CPS is the
    only source writing these two, so its fields are replaced, not merged."""
    for construct, (cps_var, note) in CONCORDANCE.items():
        found = store.query("SELECT label, definition, acs_table FROM concordance "
                            "WHERE construct = ?", [construct])
        label, definition, acs_table = found[0]
        store.upsert_concordance({"construct": construct, "label": label,
                                  "definition": definition, "acs_table": acs_table,
                                  "cps_var": cps_var, "notes": note})


# -- the bulk tier: every other supplement item ----------------------------------------------

@dataclass(frozen=True)
class Item:
    """One item of a year's supplement record layout."""
    name: str
    start: int                       # 1-based inclusive positions
    end: int
    description: str                 # the DESCRIPTION column, whitespace collapsed
    universe: str                    # the EDITED UNIVERSE text
    values: tuple[tuple[int, str], ...]  # VALID ENTRIES in printed order, every code

    @property
    def bands(self) -> dict[int, str]:
        """Substantive codes: not in universe, don't know, refused and no response are the
        negative codes in every year's layout."""
        return {code: label for code, label in self.values if code > 0}


@dataclass(frozen=True)
class Bulk:
    """A bulk construct: one supplement item over the years its dictionary entry agrees."""
    construct: str
    name: str
    label: str
    definition: str
    bands: dict[int, str]
    items: dict[int, Item]           # year -> that year's layout entry

    @property
    def years(self) -> tuple[int, ...]:
        return tuple(sorted(self.items))


# The two items the harmonized constructs already read.
CORE_ITEMS = {"PES1": "turnout", "PES2": "registration"}
# Administrative: interview flags, interviewer check items (who answered for the person).
ADMIN = re.compile(r"\bflag\b|interviewer check|line number|weight|identifier", re.I)
MAX_BANDS = 24

_ATTACHMENT = re.compile(r"^\s*attachment\s+\d+\s*$", re.I)
_ITEM = re.compile(r"^\s*([A-Z][A-Z0-9]{2,})\s+(\d{1,2})\s+(\S.*)$")
_LOCATION = re.compile(r"^(.*?)\s*(\d{3,4})\s*[-–]\s*(\d{0,4})\s*$")
_VALUE = re.compile(r"^\s*(-?\d+)\s+(\S.*)$")
_FOOTER = re.compile(r"^\s*\d+\s*-\s*\d+\s*$")
_HEADER = re.compile(r"^\s*NAME\s+SIZE\b")


def dictionary_path(year: int, raw_dir: Path | None = None) -> Path:
    return _dir(raw_dir) / doc_name(year).replace(".pdf", ".txt")


def dictionary_text(year: int, raw_dir: Path | None = None,
                    download: bool = False) -> str | None:
    """The year's documentation as pdftotext -layout text, made from the PDF (downloaded
    first when download is set) if the text is not cached. None when neither is at hand."""
    txt = dictionary_path(year, raw_dir)
    pdf = txt.with_suffix(".pdf")
    if not txt.exists():
        if not pdf.exists() and download:
            _download(doc_url(year), pdf)
        if pdf.exists() and shutil.which("pdftotext"):
            subprocess.run(["pdftotext", "-layout", str(pdf), str(txt)], check=True)
    return txt.read_text(encoding="utf-8", errors="replace") if txt.exists() else None


def clean(text: str) -> str:
    """Collapse whitespace, straighten quotes, close a line break after a slash."""
    text = text.translate({0x2018: "'", 0x2019: "'", 0x201C: '"', 0x201D: '"'})
    return re.sub(r"/\s+", "/", re.sub(r"\s+", " ", text)).strip()


def sentence_case(text: str) -> str:
    """The layout's emphasis capitals (MAIN) lowered; the first letter raised."""
    words = [w.lower() if sum(ch.isalpha() for ch in w) > 1 and w.isupper() else w
             for w in text.split(" ")]
    out = " ".join(words)
    return out[:1].upper() + out[1:]


def _layout_lines(text: str) -> list[str]:
    """The supplement record layout attachment: from its ATTACHMENT line to the next one."""
    lines = text.splitlines()
    marks = [i for i, line in enumerate(lines) if _ATTACHMENT.match(line)]
    for a, b in zip(marks, [*marks[1:], len(lines)]):
        if "supplement record layout" in " ".join(lines[a:a + 8]).lower():
            return lines[a + 1:b]
    raise RuntimeError("no Supplement Record Layout attachment in the documentation")


def parse_dictionary(text: str) -> list[Item]:
    """Every item of the supplement record layout, in layout order. A location the text cuts
    short ("955-") is completed from the item's size; a missing one follows the item before."""
    raw: list[dict] = []
    state = None
    for line in _layout_lines(text):
        s = line.strip()
        if not s or _FOOTER.match(line) or _HEADER.match(line):
            continue
        m = _ITEM.match(line)
        if m and not _VALUE.match(line):
            name, size, rest = m.group(1), int(m.group(2)), m.group(3)
            start = end = None
            loc = _LOCATION.match(rest)
            if loc:
                rest, start = loc.group(1), int(loc.group(2))
                end = int(loc.group(3)) if loc.group(3) else start + size - 1
            raw.append({"name": name, "size": size, "start": start, "end": end,
                        "desc": [rest], "universe": [], "values": []})
            state = "desc"
            continue
        if not raw:
            continue                 # the attachment's title lines
        cur = raw[-1]
        if state in ("desc", "universe") and s.upper().startswith("VALID ENTRIES"):
            state = "values"
        elif state == "desc" and "UNIVERSE" in s.upper():
            state = "universe"
            cur["universe"].append(s.split(":", 1)[1] if ":" in s else "")
        elif state == "desc":
            cur["desc"].append(s)
        elif state == "universe":
            cur["universe"].append(s)
        elif state == "values":
            v = _VALUE.match(line)
            if v:
                cur["values"].append([int(v.group(1)), v.group(2)])
            elif cur["values"]:
                cur["values"][-1][1] += " " + s
    items: list[Item] = []
    for r in raw:
        if r["start"] is None:
            if not items:
                raise RuntimeError(f"{r['name']}: no location in the record layout")
            r["start"] = items[-1].end + 1
            r["end"] = r["start"] + r["size"] - 1
        values = tuple((code, clean(label)) for code, label in r["values"])
        positive = [code for code, _ in values if code > 0]
        if positive != list(range(1, len(positive) + 1)):
            raise RuntimeError(f"{r['name']}: valid entries read {positive}, not 1..k in order; "
                               "the layout text has drifted")
        items.append(Item(name=r["name"], start=r["start"], end=r["end"],
                          description=clean(" ".join(r["desc"])),
                          universe=clean(" ".join(r["universe"])), values=values))
    return items


def skip_reason(item: Item) -> str | None:
    """Why an item is not a bulk construct, or None when it is one."""
    if item.name in CORE_ITEMS:
        return f"read by the {CORE_ITEMS[item.name]} construct"
    if ADMIN.search(item.description) or item.name == "PRSUPINT":
        return "administrative"
    k = len(item.bands)
    if not 2 <= k <= MAX_BANDS:
        return f"{k} labeled categories"
    return None


def _signature(item: Item) -> tuple:
    return (item.description.lower(),
            tuple((code, label.lower()) for code, label in item.bands.items()))


def _span(years: Sequence[int], every: Sequence[int]) -> str:
    """Years as runs over the survey's own sequence: 2008-2012, or 2008, 2012."""
    order = sorted(every)
    runs: list[list[int]] = []
    for y in sorted(years):
        if runs and order.index(y) == order.index(runs[-1][-1]) + 1:
            runs[-1].append(y)
        else:
            runs.append([y])
    return ", ".join(str(r[0]) if len(r) == 1 else f"{r[0]}-{r[-1]}" for r in runs)


def bulk_plan(dictionaries: Mapping[int, Sequence[Item]]
              ) -> tuple[list[Bulk], dict[tuple[str, str], list[int]]]:
    """The bulk constructs from every year's parsed layout, and the skipped items as
    (name, reason) -> years. An item's years join under one construct where its description
    and value list agree, compared without case; where they part, each span is its own
    construct. The span reaching the item's last year keeps the plain lowercased name, an
    earlier span takes its years (pes7_2008), and a construct that stops before the survey's
    latest year carries its span in the label so two of one name read apart."""
    every = sorted(dictionaries)
    skipped: dict[tuple[str, str], list[int]] = defaultdict(list)
    by_name: dict[str, dict[int, Item]] = defaultdict(dict)
    for year in every:
        for item in dictionaries[year]:
            reason = skip_reason(item)
            if reason:
                skipped[(item.name, reason)].append(year)
            else:
                by_name[item.name][year] = item
    plan: list[Bulk] = []
    for name, per_year in by_name.items():
        spans: dict[tuple, dict[int, Item]] = {}
        for year in sorted(per_year):
            spans.setdefault(_signature(per_year[year]), {})[year] = per_year[year]
        last = max(per_year)
        for items in spans.values():
            years = sorted(items)
            ref = items[years[-1]]
            construct = name.lower()
            if years[-1] != last:
                construct += f"_{years[0]}" if len(years) == 1 else f"_{years[0]}_{years[-1]}"
            definition = sentence_case(ref.description)
            label = definition
            if years[-1] != every[-1]:
                label += f" ({_span(years, every)})"
            plan.append(Bulk(construct=construct, name=name, label=label,
                             definition=definition, bands=ref.bands, items=items))
    plan.sort(key=lambda b: (b.name, b.years[0]))
    return plan, dict(skipped)


BULK_CONCORDANCE_NOTE = (
    "CPS bulk tier: {name}, {span}. Label and definition are the description in the "
    "supplement record layout of the technical documentation ({doc}), sentence-cased: "
    "data-dictionary text, not the questionnaire's wording. Bands are the layout's valid "
    "entries in order, negative codes (not in universe, don't know, refused, no response) "
    "left out.")


def register_bulk(store: Store, plan: Sequence[Bulk]) -> tuple[list[Bulk], list[str]]:
    """Write each bulk construct's concordance row, so its label and definition reach the
    export's index. A construct id another source already holds is skipped and named."""
    every = sorted({y for b in plan for y in b.years})
    kept, collisions = [], []
    for b in plan:
        held = store.query("SELECT cps_var FROM concordance WHERE construct = ?", [b.construct])
        if held and held[0][0] != b.name:
            collisions.append(b.construct)
            continue
        store.upsert_concordance({
            "construct": b.construct, "label": b.label, "definition": b.definition,
            "acs_table": None, "cps_var": b.name,
            "notes": BULK_CONCORDANCE_NOTE.format(name=b.name, span=_span(b.years, every),
                                                  doc=doc_url(b.years[-1]))})
        kept.append(b)
    return kept, collisions


def write_order(store: Store, plan: Sequence[Bulk]) -> int:
    """Record each bulk construct's bands in the dictionary's coded order in response_order
    (migration 007), which the export follows in place of the alphabet. Turnout and
    registration get none and keep the order they had."""
    if not store.table_exists("response_order"):
        return 0
    rows = [(SOURCE, b.construct, label, i) for b in plan
            for i, label in enumerate(dict.fromkeys(b.bands.values()))]
    with store.transaction():
        for b in plan:
            store.execute("DELETE FROM response_order WHERE source = ? AND construct = ?",
                          [SOURCE, b.construct])
        for row in rows:
            store.execute("INSERT INTO response_order (source, construct, response_option, "
                          "ordinal) VALUES (?, ?, ?, ?)", list(row))
    return len(rows)


BULK_NOTE = (
    "CPS November {year} supplement item {name}, {origin} {file}; layout, value "
    "labels and weight from {doc}. The item's label and bands are the data dictionary's (the "
    "supplement record layout), not the questionnaire's wording. Base: citizens 18+ who are "
    "adult civilian household members (the P20 universe), within the item's own universe "
    "({universe}), weighted by PWSSWGT (no supplement weight is published). Not in universe, "
    "don't know, refused and no response are left out, so shares are of substantive "
    "answers; P20 tables keep don't know and refused in their base. n is the unweighted base. "
    "se uses the Kish effective n (the CPS design effect is ignored); moe is 1.645 x se. "
    "Breakdowns are for the item's latest year only. income is family income (HEFAMINC); "
    "race_eth puts Hispanic first.")


def bulk_columns(plan: Sequence[Bulk], year: int) -> dict[str, tuple[int, int]]:
    return {b.name: (b.items[year].start, b.items[year].end) for b in plan if year in b.items}


def bulk_rows(df: pd.DataFrame, year: int, plan: Sequence[Bulk], min_n: int = MIN_CELL_N,
              file_name: str | None = None) -> list[dict]:
    """Weighted shares of every bulk construct asked this year, US and MA; the breakdowns
    only in a construct's latest year."""
    d = prepare(df)
    rows: list[dict] = []
    for b in plan:
        item = b.items.get(year)
        if item is None:
            continue
        note = BULK_NOTE.format(year=year, name=b.name, file=file_name or FILES[year],
                                origin=origin(year),
                                doc=doc_url(year), universe=item.universe or "as printed")
        subgroups = SUBGROUPS if year == b.years[-1] else {}
        for geography, geo_code, place, fips in GEOS:
            sub = d if fips is None else d[d["GESTFIPS"] == fips]
            cells, skipped = survey.shares(sub, b.name, "_w", b.bands, subgroups, min_n=min_n)
            rows += survey.norm_rows(
                cells, skipped, source=SOURCE, source_version=source_version(year),
                geography=geography, geo_code=geo_code, place=place, construct=b.construct,
                item_text=item.description, weight_var="PWSSWGT",
                provenance_url=page_url(year), note=note, period_dates=period_dates)
    return rows


INSTRUCTIONS = """\
The CPS November {year} public-use file is not under {raw}/ and could not be downloaded.
It needs no registration:

    {url}

Save it into audience/raw/cps/ under that name, then rerun: python -m audience.load cps"""

DOC_INSTRUCTIONS = """\
The CPS November {year} technical documentation is not under {raw}/ as text, so the year's
bulk tier is skipped. Download {url} into audience/raw/cps/ and run
pdftotext -layout on it (poppler), or rerun python -m audience.load cps, which does both."""


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        allow_synthetic: bool = False, min_n: int = MIN_CELL_N, download: bool | None = None,
        years: tuple[int, ...] = ALL_YEARS) -> int:
    """download defaults to True for the real raw/cps/ and False when a test passes raw_dir.
    Turnout and registration are written for the years in YEARS, the bulk tier for every
    year whose documentation is at hand; each year's slice is written whole, so a rerun
    prunes what the loader no longer produces."""
    download = raw_dir is None if download is None else download
    write_concordance(store)
    dictionaries: dict[int, list[Item]] = {}
    for year in years:
        text = dictionary_text(year, raw_dir, download)
        if text is None:
            print(DOC_INSTRUCTIONS.format(year=year, raw=_dir(raw_dir), url=doc_url(year)))
        else:
            dictionaries[year] = parse_dictionary(text)
    plan, skipped = bulk_plan(dictionaries)
    plan, collisions = register_bulk(store, plan)
    write_order(store, plan)
    if dictionaries:
        print(f"CPS bulk tier: {len(plan)} constructs from {len(dictionaries)} years' layouts")
        for (name, reason), ys in sorted(skipped.items()):
            print(f"  skipped {name} ({_span(ys, ALL_YEARS)}): {reason}")
        for c in collisions:
            print(f"  skipped {c}: the construct id is another source's")
    found = {} if refresh else locate(raw_dir)
    total = 0
    for year in years:
        path = found.get(year)
        if path is None and download:
            path = fetch(year, raw_dir)
        if path is None:
            print(INSTRUCTIONS.format(year=year, raw=_dir(raw_dir), url=data_url(year)))
            continue
        survey.refuse_synthetic([path], allow_synthetic)
        df = read_file(path, year, bulk_columns(plan, year))
        core = build_rows(df, year, min_n=min_n, file_name=path.name) if year in YEARS else []
        bulk = bulk_rows(df, year, plan, min_n=min_n, file_name=path.name)
        del df
        written = store.upsert_norms(core + bulk, prune=(SOURCE, source_version(year)))
        print(f"{source_version(year)}: {written} rows ({len(core)} turnout and registration, "
              f"{len(bulk)} bulk), US and MA")
        total += written
    if total:
        store.touch_source(SOURCE)
    else:
        print("No CPS rows were written.")
    return total
