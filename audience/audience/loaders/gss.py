"""General Social Survey cumulative cross-section, 1972-2024 (NORC at the University of
Chicago): yearly US toplines and subgroup cells for trust, institutional confidence,
ideology, party, national pride, mobility, redistribution and religious attendance.

The Stata file is downloaded once into raw/gss/ (no registration) and read with only the
columns below; the file has about 7,000 variables and is never loaded whole.

Weights follow the 2024 codebook (R3a, "GSS Post-stratification Weights"): WTSSNRPS where
it exists (2004-2024), else WTSSPS (1972-2003). WTSSALL is the historical weight those two
replace; the codebook calls WTSSPS "a parallel weight to WTSSALL" that also folds in the
form, ballot and Black-oversample corrections.

Cells: sex, age bucket, race (GSS RACE: White / Black / Other; Hispanic origin is not
separated), education (4 groups) and party (leaners with their party). A cell with an
unweighted base under 50 is not stored; the year's topline row names it.
"""

from __future__ import annotations

import zipfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .. import categories as cat
from .. import config
from ..constructs import CONSTRUCTS
from ..db import Store
from .. import survey
from ..survey import IDEOLOGY_7, MIN_CELL_N, PARTY_3, PARTY_ID_7

SOURCE = "GSS"
DATA_URL = "https://gss.norc.org/content/dam/gss/get-the-data/documents/stata/GSS_stata.zip"
CODEBOOK_URL = ("https://gss.norc.org/content/dam/gss/get-documentation/pdf/codebook/"
                "GSS%202024%20Codebook%20R3a.pdf")
ENCODING = "cp1252"  # the R3a file's value labels are not valid UTF-8

INSTRUCTIONS = f"""\
The GSS cumulative Stata file is not under raw/gss/ and could not be downloaded.
It needs no registration. Download the cumulative file (Stata) from
https://gss.norc.org/get-the-data/stata.html, i.e.

    {DATA_URL}

save it as audience/raw/gss/GSS_stata.zip (or unzip it there), then rerun:
python -m audience.load gss
No rows were written."""


@dataclass(frozen=True)
class Item:
    construct: str
    var: str
    text: str
    options: dict
    note: str = ""


CONF_STEM = ("I am going to name some institutions in this country. As far as the people "
             "running these institutions are concerned, would you say you have a great deal "
             "of confidence, only some confidence, or hardly any confidence at all in them?")
CONF = {1: "A great deal", 2: "Only some", 3: "Hardly any"}
PRIDE_STEM = "How proud are you of America in each of the following?"
PRIDE = {1: "Very proud", 2: "Somewhat proud", 3: "Not very proud", 4: "Not proud at all"}
AGREE5 = {1: "Agree strongly", 2: "Agree", 3: "Neither agree nor disagree", 4: "Disagree",
          5: "Disagree strongly"}
AGREE5_S = {1: "Strongly agree", 2: "Agree", 3: "Neither agree nor disagree", 4: "Disagree",
            5: "Strongly disagree"}

# Wording is the GSS questionnaire text as printed in the cumulative codebook (1972-2018,
# GSS_Codebook_mainbody.pdf) and the 2024 codebook (R3a).
ITEMS: tuple[Item, ...] = (
    Item("confidence_federal_executive", "confed", f"{CONF_STEM} Executive branch of the federal government", CONF),
    Item("confidence_congress", "conlegis", f"{CONF_STEM} Congress", CONF),
    Item("confidence_press", "conpress", f"{CONF_STEM} Press", CONF),
    Item("social_trust", "trust",
         "Generally speaking, would you say that most people can be trusted or that you can't "
         "be too careful in dealing with people?",
         {1: "Most people can be trusted", 2: "Can't be too careful", 3: "Depends (volunteered)"}),
    Item("people_fair", "fair",
         "Do you think most people would try to take advantage of you if they got a chance, or "
         "would they try to be fair?",
         {1: "Would take advantage of you", 2: "Would try to be fair", 3: "Depends (volunteered)"}),
    Item("people_helpful", "helpful",
         "Would you say that most of the time people try to be helpful, or that they are "
         "mostly just looking out for themselves?",
         {1: "Try to be helpful", 2: "Just look out for themselves", 3: "Depends (volunteered)"}),
    Item("ideology_7", "polviews",
         "We hear a lot of talk these days about liberals and conservatives. I'm going to show "
         "you a seven-point scale on which the political views that people might hold are "
         "arranged from extremely liberal--point 1--to extremely conservative--point 7. Where "
         "would you place yourself on this scale?",
         dict(zip(range(1, 8), IDEOLOGY_7))),
    Item("party_id_7", "partyid",
         "Generally speaking, do you usually think of yourself as a Republican, Democrat, "
         "Independent, or what?",
         {**dict(zip(range(0, 7), PARTY_ID_7)), 7: "Other party"},
         "GSS codes 0-6 map to the harmonized labels: not very strong = Weak, independent "
         "close to a party = Lean."),
    Item("national_pride", "amproud1", "How proud are you of being American?", PRIDE,
         "Code 5 (I am not American) is left out of the base."),
    Item("national_pride_domain", "prouddem", f"{PRIDE_STEM} The way democracy works", PRIDE),
    Item("national_pride_domain", "proudpol", f"{PRIDE_STEM} Its political influence in the world", PRIDE),
    Item("national_pride_domain", "proudeco", f"{PRIDE_STEM} America's economic achievements", PRIDE),
    Item("national_pride_domain", "proudsss", f"{PRIDE_STEM} Its social security system", PRIDE),
    Item("national_pride_domain", "proudsci", f"{PRIDE_STEM} Its scientific and technological achievements", PRIDE),
    Item("national_pride_domain", "proudspt", f"{PRIDE_STEM} Its achievements in sports", PRIDE),
    Item("national_pride_domain", "proudart", f"{PRIDE_STEM} Its achievements in the arts and literature", PRIDE),
    Item("national_pride_domain", "proudmil", f"{PRIDE_STEM} America's armed forces", PRIDE),
    Item("national_pride_domain", "proudhis", f"{PRIDE_STEM} Its history", PRIDE),
    Item("national_pride_domain", "proudgrp", f"{PRIDE_STEM} Its fair and equal treatment of all groups in society", PRIDE),
    Item("nationalism", "amcitizn",
         "How much do you agree or disagree with the following statements? I would rather be a "
         "citizen of America than of any other country in the world", AGREE5),
    Item("nationalism", "ambetter",
         "How much do you agree or disagree with the following statements? Generally "
         "speaking, America is a better country than most other countries", AGREE5),
    Item("get_ahead", "getahead",
         "Some people say that people get ahead by their own hard work; others say that lucky "
         "breaks or help from other people are more important. Which do you think is most "
         "important?",
         {1: "Hard work most important", 2: "Hard work, luck equally important",
          3: "Luck most important"},
         "Code 4 (Other, 1973 only) is left out of the base."),
    Item("gov_reduce_income_diff", "eqwlth",
         "Some people think that the government in Washington ought to reduce the income "
         "differences between the rich and the poor, perhaps by raising the taxes of wealthy "
         "families or by giving income assistance to the poor. Others think that the government "
         "should not concern itself with reducing this income difference between the rich and "
         "the poor. Here is a card with a scale from 1 to 7. Think of a score of 1 as meaning "
         "that the government ought to reduce the income differences between rich and poor, "
         "and a score of 7 meaning that the government should not concern itself with reducing "
         "income differences. What score between 1 and 7 comes closest to the way you feel?",
         {1: "1 (Government should reduce income differences)", 2: "2", 3: "3", 4: "4", 5: "5",
          6: "6", 7: "7 (Government should not concern itself)"}),
    Item("gov_reduce_income_diff", "equalize",
         "On the whole, do you think it should or should not be the government's "
         "responsibility to . . . Reduce income differences between the rich and poor.",
         {1: "Definitely should be", 2: "Probably should be", 3: "Probably should not be",
          4: "Definitely should not be"}),
    Item("gov_reduce_income_diff", "goveqinc",
         "Do you agree or disagree? It is the responsibility of the government to reduce the "
         "differences in income between people with high incomes and those with low incomes.",
         AGREE5_S),
    Item("income_gap_too_large", "incgap",
         "Do you agree or disagree? Differences in income in America are too large.", AGREE5_S),
    Item("religious_attendance", "attend",
         "How often do you attend religious services?",
         {0: "Never", 1: "Less than once a year", 2: "About once or twice a year",
          3: "Several times a year", 4: "About once a month", 5: "2-3 times a month",
          6: "Nearly every week", 7: "Every week", 8: "Several times a week"}),
)

CONCORDANCE_NOTES = {
    "confidence_federal_executive": "GSS CONFED: 3 points (a great deal / only some / hardly any).",
    "confidence_congress": "GSS CONLEGIS: 3 points (a great deal / only some / hardly any).",
    "confidence_press": "GSS CONPRESS: 3 points (a great deal / only some / hardly any).",
    "social_trust": "GSS TRUST: trusted / can't be too careful, plus a volunteered 'depends'.",
    "party_id_7": "GSS PARTYID: 0-6 plus 7 'Other party'; the initial question names Republican first.",
    "ideology_7": "GSS POLVIEWS: no explicit 'haven't thought about it' option.",
    "national_pride": "GSS AMPROUD1 (ISSP 2004, 2014): very / somewhat / not very / not at all proud.",
    "national_pride_domain": "GSS PROUD* (ISSP National Identity 1996, 2004, 2014, 2024): ten domains, 4 points.",
    "nationalism": "GSS AMCITIZN, AMBETTER (ISSP National Identity): 5-point agree-disagree.",
    "gov_reduce_income_diff": "GSS EQWLTH is a 1-7 scale; EQUALIZE (ISSP Role of Government) a 4-point should/should not; GOVEQINC (ISSP Social Inequality) a 5-point agree-disagree. Each wording is its own item_text.",
}


def _dirs(raw_dir: Path | None) -> Path:
    return Path(raw_dir) if raw_dir is not None else config.RAW / "gss"


def locate(raw_dir: Path | None = None) -> Path | None:
    """The cumulative .dta under raw/gss/, unzipping GSS_stata.zip if only the zip is there."""
    d = _dirs(raw_dir)
    found = sorted(d.rglob("gss72*.dta"))
    if found:
        return found[-1]
    for z in sorted(d.glob("*.zip")):
        with zipfile.ZipFile(z) as zf:
            names = [n for n in zf.namelist() if Path(n).name.lower().startswith("gss72")
                     and n.lower().endswith(".dta")]
            if names:
                zf.extract(names[0], d)
                return d / names[0]
    return None


def fetch(raw_dir: Path | None = None) -> Path | None:
    import requests

    d = _dirs(raw_dir)
    d.mkdir(parents=True, exist_ok=True)
    target = d / "GSS_stata.zip"
    print(f"downloading {DATA_URL}")
    try:
        with requests.get(DATA_URL, stream=True, timeout=120,
                          headers={"User-Agent": "Mozilla/5.0 (audience loader)"}) as resp:
            resp.raise_for_status()
            tmp = target.with_suffix(".part")
            with open(tmp, "wb") as f:
                for chunk in resp.iter_content(1 << 20):
                    f.write(chunk)
            tmp.rename(target)
    except Exception as exc:  # network or HTTP failure
        print(f"download failed: {exc}")
        return None
    return locate(raw_dir)


def source_version(path: Path) -> str:
    stem = path.stem.lower()  # gss7224_r3a
    years = stem[3:7]
    release = stem.split("_r", 1)[1].upper() if "_r" in stem else "?"
    return f"GSS 19{years[:2]}-20{years[2:]} cumulative, Release {release}"


COLUMNS = ("year", "wtssps", "wtssnrps", "sex", "age", "race", "degree", "educ", "partyid")


def read_frame(path: Path) -> pd.DataFrame:
    import pyreadstat

    cols = list(dict.fromkeys(COLUMNS + tuple(i.var for i in ITEMS)))
    df, _ = pyreadstat.read_dta(str(path), usecols=cols, encoding=ENCODING)
    return df


# -- recodes ---------------------------------------------------------------------------------

def weight(df: pd.DataFrame) -> pd.Series:
    """WTSSNRPS for 2004 on, WTSSPS before, as the 2024 codebook directs."""
    return pd.Series(np.where(df["year"] >= 2004, df["wtssnrps"], df["wtssps"]), index=df.index)


def weight_var(year) -> str:
    return "WTSSNRPS" if int(year) >= 2004 else "WTSSPS"


def education_4(degree: pd.Series, educ: pd.Series) -> pd.Series:
    """DEGREE 0-1 -> HS or less, except a high-school degree with 13+ years of school (some
    college, no degree) -> Some college; 2 (associate/junior college) -> Some college;
    3 -> BA; 4 -> Grad."""
    out = survey.recode(degree, {0: cat.EDUCATION_4[0], 1: cat.EDUCATION_4[0],
                                 2: cat.EDUCATION_4[1], 3: cat.EDUCATION_4[2],
                                 4: cat.EDUCATION_4[3]})
    out[(degree == 1) & (educ >= 13)] = cat.EDUCATION_4[1]
    return out


def party_3(partyid: pd.Series) -> pd.Series:
    return survey.recode(partyid, {0: PARTY_3[0], 1: PARTY_3[0], 2: PARTY_3[0], 3: PARTY_3[1],
                                   4: PARTY_3[2], 5: PARTY_3[2], 6: PARTY_3[2]})


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["_wt"] = weight(df)
    df["_sex"] = survey.recode(df["sex"], {1: cat.SEX[0], 2: cat.SEX[1]})
    df["_age"] = survey.age_bucket(df["age"])
    df["_race"] = survey.recode(df["race"], {1: "White", 2: "Black", 3: "Other"})
    df["_educ"] = education_4(df["degree"], df["educ"])
    df["_party"] = party_3(df["partyid"])
    return df


SUBGROUPS = {"sex": "_sex", "age": "_age", "race": "_race", "educ": "_educ", "party": "_party"}


def build_rows(df: pd.DataFrame, version: str, min_n: int = MIN_CELL_N) -> list[dict]:
    df = prepare(df)
    rows: list[dict] = []
    for item in ITEMS:
        if item.var not in df:
            continue
        subgroups = {k: v for k, v in SUBGROUPS.items()
                     if not (item.construct == "party_id_7" and k == "party")}
        cells, skipped = survey.shares(df, item.var, "_wt", item.options, subgroups,
                                       period="year", min_n=min_n)
        note = (f"GSS {item.var.upper()}, survey year. Weight WTSSNRPS from 2004, WTSSPS before "
                f"(2024 codebook). {item.note + ' ' if item.note else ''}"
                f"race is GSS RACE (Hispanic origin not separated). {survey.BASE_NOTE}")
        rows += survey.norm_rows(
            cells, skipped, source=SOURCE, source_version=version, geography="US",
            geo_code="US", place="United States", construct=item.construct,
            item_text=item.text, weight_var=weight_var, provenance_url=DATA_URL, note=note,
            period_dates=survey.year_dates)
    return rows


def write_concordance(store: Store) -> None:
    by_construct: dict[str, list[str]] = {}
    for item in ITEMS:
        by_construct.setdefault(item.construct, []).append(item.var.upper())
    for construct, gvars in by_construct.items():
        label, definition = CONSTRUCTS[construct]
        survey.merge_concordance(store, construct, label, definition, gss_var=gvars,
                                 note=CONCORDANCE_NOTES.get(construct))


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        allow_synthetic: bool = False, min_n: int = MIN_CELL_N) -> int:
    write_concordance(store)  # the crosswalk is recorded even before the data arrives
    path = None if refresh else locate(raw_dir)
    if path is None:
        path = fetch(raw_dir)
    if path is None:
        print(INSTRUCTIONS)
        return 0
    survey.refuse_synthetic([path], allow_synthetic)
    version = source_version(path)
    print(f"reading {path.name} ({len(COLUMNS) + len(ITEMS)} of its columns)")
    rows = build_rows(read_frame(path), version, min_n=min_n)
    written = store.upsert_norms(rows, prune=(SOURCE, version))
    store.touch_source(SOURCE)
    years = sorted({r["period_start"].year for r in rows})
    print(f"{version}: {written} rows, {len(years)} survey years {years[0]}-{years[-1]}")
    return written
