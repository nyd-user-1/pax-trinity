"""CPS November Voting and Registration Supplement, 2016-2024, read from the Census Bureau's
public-use files: turnout and registration for the US and Massachusetts, overall and by sex,
age bucket, race_eth, education and family income, per election year.

The files need no registration and are cached once under raw/cps/:
  2020, 2022, 2024  nov<yy>pub.csv
  2016, 2018        nov<yy>pub.dat.gz, fixed width; Census publishes no CSV for these years.
Variable names, positions and codes come from each year's technical documentation
(techdocs/cpsnov<yy>.pdf, record layout). The basic-CPS fields sit at the same positions in
every year; only the supplement items PES1 and PES2 move. Every year's documentation says
the supplement has no weight of its own and directs the basic final weight, PWSSWGT
(4 implied decimals), for tallying supplement items.

Rates follow the Census Bureau's P20 convention. The base is every U.S. citizen 18 and over
who is an adult civilian household member (PRTAGE >= 18, PRCITSHP 1-4, PRPERTYP 2) in an
interviewed household. Don't know, refused and no response (PES1 -2, -3, -9) stay in the
base and are reported as their own option, "No response", so "Voted" is the P20 "percent
voted (citizen)". Respondents who voted count as registered (PES2 is asked only of
non-voters). Turnout among those who answered is Voted / (Voted + Did not vote).
"""

from __future__ import annotations

import datetime as dt
import re
from pathlib import Path

import numpy as np
import pandas as pd

from .. import categories as cat
from .. import config
from .. import survey
from ..db import Store
from ..survey import MIN_CELL_N

SOURCE = "CPS"
YEARS = (2016, 2018, 2020, 2022, 2024)
DATASETS = "https://www2.census.gov/programs-surveys/cps/datasets"
TECHDOCS = "https://www2.census.gov/programs-surveys/cps/techdocs"
FILES = {
    2016: "nov16pub.dat.gz",
    2018: "nov18pub.dat.gz",
    2020: "nov20pub.csv",
    2022: "nov22pub.csv",
    2024: "nov24pub.csv",
}
# Fixture and alternate names: nov20pub.csv, nov20pub_SYNTHETIC.csv, nov16pub.dat.gz ...
FILE_NAME = re.compile(r"^nov(\d{2})pub.*\.(csv|dat|dat\.gz)$", re.I)

# Record layout, 1-based inclusive positions, from cpsnov16.pdf and cpsnov18.pdf (identical
# for these fields in 2020-2024 as well).
BASIC_LAYOUT = {
    "HRYEAR4": (18, 21), "HEFAMINC": (39, 40), "HRINTSTA": (57, 58), "GESTFIPS": (93, 94),
    "PRTAGE": (122, 123), "PESEX": (129, 130), "PEEDUCA": (137, 138), "PTDTRACE": (139, 140),
    "PEHSPNON": (157, 158), "PRPERTYP": (161, 162), "PRCITSHP": (172, 173),
    "PWSSWGT": (613, 622),
}
SUPPLEMENT_LAYOUT = {
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
    return f"{DATASETS}/{year}/supp/{FILES[year]}"


def doc_url(year: int) -> str:
    return f"{TECHDOCS}/cpsnov{year % 100:02d}.pdf"


def source_version(year: int) -> str:
    return f"CPS November {year} supplement (Census public-use file)"


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
            if year in YEARS:
                found.setdefault(year, p)
    return found


def fetch(year: int, raw_dir: Path | None = None) -> Path | None:
    """Download one year's public-use file into raw/cps/. None (after printing) on failure."""
    import requests

    target = _dir(raw_dir) / FILES[year]
    target.parent.mkdir(parents=True, exist_ok=True)
    url = data_url(year)
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


def read_file(path: Path, year: int) -> pd.DataFrame:
    """The needed columns of one year's file, as integers, with a year column."""
    name = path.name.lower()
    if name.endswith(".csv"):
        df = pd.read_csv(path, usecols=lambda c: c.upper() in COLUMNS, low_memory=False)
        df = df.rename(columns=str.upper)
    else:
        import gzip

        layout = {**BASIC_LAYOUT, **SUPPLEMENT_LAYOUT[year]}
        opener = gzip.open if name.endswith(".gz") else open
        with opener(path, "rt", encoding="latin-1") as f:
            df = pd.read_fwf(f, colspecs=[(a - 1, b) for a, b in layout.values()],
                             names=list(layout), header=None, dtype=str)
    missing = [c for c in COLUMNS if c not in df]
    if missing:
        raise RuntimeError(f"{path.name}: columns {missing} not found; check cpsnov{year % 100:02d}.pdf")
    df = df[list(COLUMNS)].apply(pd.to_numeric, errors="coerce")
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


INSTRUCTIONS = """\
The CPS November {year} public-use file is not under {raw}/ and could not be downloaded.
It needs no registration:

    {url}

Save it into audience/raw/cps/ under that name, then rerun: python -m audience.load cps"""


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        allow_synthetic: bool = False, min_n: int = MIN_CELL_N, download: bool | None = None,
        years: tuple[int, ...] = YEARS) -> int:
    """download defaults to True for the real raw/cps/ and False when a test passes raw_dir."""
    download = raw_dir is None if download is None else download
    write_concordance(store)
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
        rows = build_rows(read_file(path, year), year, min_n=min_n, file_name=path.name)
        written = store.upsert_norms(rows, prune=(SOURCE, source_version(year)))
        print(f"{source_version(year)}: {written} rows, US and MA")
        total += written
    if total:
        store.touch_source(SOURCE)
    else:
        print("No CPS rows were written.")
    return total
