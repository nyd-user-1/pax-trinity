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

Beside the harmonized constructs, the bulk tier (audience/bulk.py) carries every other
categorical variable of the file: construct = the GSS mnemonic lowercased, label and
definition = the Stata variable label (the questionnaire wording is not in the file),
response options = the value labels in coded order. Toplines for every year asked,
breakdowns for the latest year asked. Administrative and paradata variables are skipped
(ADMIN_VARS, admin()). Each bulk row links to the variable's GSS Data Explorer page; the
mnemonic-to-page map is the Explorer's public variable list, cached in raw/gss/.
"""

from __future__ import annotations

import json
import re
import time
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .. import bulk
from .. import categories as cat
from .. import config
from ..constructs import CONSTRUCTS
from ..db import Store, natural_key
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


# -- the bulk tier ---------------------------------------------------------------------------

EXPLORER_API = "https://3ilfsaj2lj.execute-api.us-east-1.amazonaws.com/prod/guest-variable"
EXPLORER_PAGE = "https://gssdataexplorer.norc.org/variables/{id}/vshow"
EXPLORER_SEARCH = "https://gssdataexplorer.norc.org/variables/vfilter"
EXPLORER_CATALOG = "data_explorer_variables.json"
BULK_NOTE = ("GSS bulk tier: the label and definition are the Stata variable label, not the "
             "questionnaire wording (the file does not carry it); the response options are "
             "the file's value labels in coded order.")

# Administrative, technical and paradata variables: ids, ballots, forms and versions,
# weights and design variables, sampling and subsampling flags, interview dates, mode,
# length, fees and language, interviewer characteristics and observations, module
# completion flags, consent and record-linkage flags, the household-enumeration roster's
# bookkeeping, and occupation/industry coding status.
ADMIN_VARS = frozenset({
    "id", "id_", "year", "ballot", "form", "formwt", "version", "fileversion", "creator",
    "batch", "issp", "sample", "sampcode", "oversamp", "phase", "vstrat", "vpsu", "kish",
    "random", "dateintv", "intid", "mode", "feeused", "feelevel", "lngthinv", "easyget",
    "consent", "adminconsent", "death", "found", "spaneng", "spanint", "spanself", "coop",
    "coop2", "comprend", "saqissp", "saqsex", "saqgene", "huadd", "huaddwhy", "kidsinhh",
    "respond", "incuspop", "neisafe", "rlooks", "rgroomed", "rweight", "rhlthend", "hlthstrt",
    "dwellpre", "dwelling", "hhrace", "hefinfo", "respnum", "phone", "res2006", "res2008",
    "res2010", "res2012", "cshutyp06", "cshutyp08", "cshutyp10", "cshutyp12", "cohort",
    "marcohrt", "aneseligible", "anespre_status", "anespost_status", "suitime1", "suitime2",
    "termvig", "vigvermy", "docvig", "sciintro",  # which vignette or version R was shown
    *(f"whoelse{i}" for i in range(1, 7)),
})
# Open answers coded after the fact (the science-literacy explanations).
OPEN_ENDED = frozenset({"scitext", "exptext", "stormtxt", "litmstxt", "fishexp2"})
ADMIN_NAME = re.compile(
    r"^wtss|^int(age|sex|ethn|yrs|hisp|race\d*|id)$|(occ|ind)(status|tag)$|occindv$")
# "interviewer" as a trait or an observation ("Age of interviewer", "R skin tone via
# interviewer"), not an instruction printed in a question ("INTERVIEWER: READ LIST").
ADMIN_LABEL = re.compile(r"interviewer(?!\s*:)|verbatim retrieved|coding (status|tag)|"
                         r"\bweight variable\b", re.I)


def admin(var: str, label: str) -> bool:
    return var in ADMIN_VARS or bool(ADMIN_NAME.search(var)) or bool(ADMIN_LABEL.search(label or ""))


def open_ended(var: str, label: str) -> bool:
    return var in OPEN_ENDED or bool(re.search(r"\(verbatim\)", label or "", re.I))


def explorer_catalog(raw_dir: Path | None = None, refresh: bool = False) -> dict[str, int]:
    """GSS mnemonic -> its Data Explorer page id, from the Explorer's public variable list,
    cached as raw/gss/data_explorer_variables.json (id, name, description, wording)."""
    path = _dirs(raw_dir) / EXPLORER_CATALOG
    if refresh or not path.exists():
        import requests

        found: dict[int, dict] = {}
        headers = {"User-Agent": "Mozilla/5.0 (audience loader)",
                   "Origin": "https://gssdataexplorer.norc.org"}
        page, empty = 1, 0
        try:
            while empty < 3:  # the page size is uneven; read until pages come back empty
                resp = requests.get(EXPLORER_API, params={"page": page, "limit": 100},
                                    headers=headers, timeout=120)
                resp.raise_for_status()
                got = resp.json().get("variables") or []
                empty = 0 if got else empty + 1
                for v in got:
                    found[v["id"]] = {"id": v["id"], "name": v["name"],
                                      "description": v.get("description"),
                                      "surveyQuestion": v.get("surveyQuestion")}
                page += 1
                time.sleep(0.2)
        except Exception as exc:
            print(f"Data Explorer variable list unavailable ({exc}); bulk rows link to "
                  f"{EXPLORER_SEARCH}")
            return {}
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(sorted(found.values(), key=lambda v: v["id"])))
    by_name: dict[str, int] = {}
    for v in json.loads(path.read_text()):
        by_name.setdefault(v["name"].lower(), v["id"])
    return by_name


def explorer_url(var: str, catalog: dict[str, int]) -> str:
    vid = catalog.get(var) or catalog.get(f"{var}_")  # CLASS and UNION are class_, union_
    return EXPLORER_PAGE.format(id=vid) if vid else EXPLORER_SEARCH


@dataclass
class BulkScan:
    """What the bulk tier took and what it skipped, with reasons."""
    taken: list[str] = field(default_factory=list)
    skipped: dict[str, list[str]] = field(default_factory=dict)
    years: dict[str, list[int]] = field(default_factory=dict)  # construct -> years stored
    rows: int = 0

    def skip(self, reason: str, var: str) -> None:
        self.skipped.setdefault(reason, []).append(var)


def bulk_candidates(path: Path, store: Store | None = None,
                    only: list[str] | None = None) -> tuple[list[tuple[str, str]], BulkScan, dict]:
    """(var, verbatim label) for every variable that passes the metadata tests, in file
    order; the scan with the metadata skips; the value labels by variable."""
    import pyreadstat

    _, meta = pyreadstat.read_dta(str(path), metadataonly=True, encoding=ENCODING)
    labels = dict(zip(meta.column_names, meta.column_labels))
    harmonized = {i.var for i in ITEMS}
    taken_elsewhere = _construct_owners(store) if store is not None else {}
    scan = BulkScan()
    out = []
    for var in meta.column_names:
        if only is not None and var not in only:
            continue
        label = labels.get(var) or ""
        construct = var.lower()
        n_labeled = len(bulk.labeled_codes(meta.variable_value_labels.get(var)))
        if var in harmonized:
            scan.skip("already one of the 15 harmonized constructs", var)
        elif admin(var, label):
            scan.skip("administrative, technical or paradata", var)
        elif open_ended(var, label):
            scan.skip("open-ended, coded from verbatims", var)
        elif n_labeled == 0:
            scan.skip("no value labels (continuous, a count or an identifier)", var)
        elif n_labeled == 1:
            scan.skip("one labeled code (a continuous variable's top or bottom code)", var)
        elif n_labeled > bulk.MAX_BANDS:
            scan.skip(f"over {bulk.MAX_BANDS} labeled categories", var)
        elif construct in CONSTRUCTS or construct in taken_elsewhere:
            scan.skip("construct id already taken", var)
        else:
            out.append((var, label))
    return out, scan, meta.variable_value_labels


def _construct_owners(store: Store) -> set[str]:
    """Construct ids already in the concordance that are not this loader's bulk rows."""
    taken = set()
    for construct, gss_var, anes_var, ces_var, wvs_var, acs_table, cps_var, notes in store.query(
            "SELECT construct, gss_var, anes_var, ces_var, wvs_var, acs_table, cps_var, notes "
            "FROM concordance"):
        others = (survey._as_list(anes_var) + survey._as_list(ces_var)
                  + survey._as_list(wvs_var) + [x for x in (acs_table, cps_var) if x])
        mine = (survey._as_list(gss_var) == [construct.upper()] and not others
                and BULK_NOTE in (notes or ""))
        if not mine:
            taken.add(construct)
    return taken


def read_columns(path: Path, cols: list[str]) -> pd.DataFrame:
    import pyreadstat

    df, _ = pyreadstat.read_dta(str(path), usecols=cols, encoding=ENCODING)
    return df


BULK_CHUNK = 400  # columns per read of the 600 MB file: about 240 MB of float64 at a time


def bulk_rows(path: Path, version: str, store: Store | None = None,
              catalog: dict[str, int] | None = None, min_n: int = MIN_CELL_N,
              only: list[str] | None = None, chunk: int = BULK_CHUNK):
    """Yield (rows, concordance entries, option orders) one column chunk at a time; the scan
    (returned by the generator) names what was taken and skipped."""
    candidates, scan, value_labels = bulk_candidates(path, store, only)
    catalog = catalog or {}
    base = prepare(read_frame_base(path))
    cols = ["year", "_wt", *SUBGROUPS.values()]
    for i in range(0, len(candidates), chunk):
        part = candidates[i:i + chunk]
        frame = read_columns(path, [v for v, _ in part])
        rows, entries, orders = [], [], {}
        for var, label in part:
            options, why = bulk.options_for(frame[var], value_labels.get(var))
            if options is None:
                scan.skip(why, var)
                continue
            d = base[cols].assign(**{var: frame[var].to_numpy()})
            cells, skipped, latest = bulk.cells(d, var, "_wt", options, SUBGROUPS,
                                                min_n=min_n)
            if not cells:
                scan.skip(f"no year with an unweighted base of {min_n} or more", var)
                continue
            construct = var.lower()
            note = (f"GSS {var.upper()}, survey year; toplines for every year asked, breakdowns "
                    f"for the latest ({latest}). Weight WTSSNRPS from 2004, WTSSPS before (2024 "
                    f"codebook). race is GSS RACE (Hispanic origin not separated). "
                    f"{survey.BASE_NOTE}")
            rows += survey.norm_rows(
                cells, skipped, source=SOURCE, source_version=version, geography="US",
                geo_code="US", place="United States", construct=construct, item_text=label,
                weight_var=weight_var, provenance_url=explorer_url(construct, catalog),
                note=note, period_dates=survey.year_dates)
            entries.append((construct, bulk.sentence_case(label) or var.upper(),
                            label or var.upper(), var.upper()))
            orders[construct] = list(options.values())
            scan.taken.append(construct)
            scan.years[construct] = sorted({int(c.period) for c in cells})
        del frame
        scan.rows += len(rows)
        yield rows, entries, orders
    return scan


def read_frame_base(path: Path) -> pd.DataFrame:
    return read_columns(path, list(COLUMNS))


def write_bulk_concordance(store: Store, entries) -> None:
    for construct, label, definition, var in entries:
        survey.merge_concordance(store, construct, label, definition, gss_var=[var],
                                 note=BULK_NOTE)


def load_bulk(store: Store, path: Path, version: str, raw_dir: Path | None = None,
              min_n: int = MIN_CELL_N, only: list[str] | None = None) -> tuple[BulkScan, set[str]]:
    """Write the bulk tier chunk by chunk; returns the scan and the natural keys written."""
    catalog = explorer_catalog(raw_dir)
    keys: set[str] = set()
    orders: dict[str, list[str]] = {}
    gen = bulk_rows(path, version, store, catalog, min_n=min_n, only=only)
    while True:
        try:
            rows, entries, part_orders = next(gen)
        except StopIteration as stop:
            scan = stop.value
            break
        write_bulk_concordance(store, entries)
        store.upsert_norms(rows)
        keys.update(natural_key(r) for r in rows)
        orders.update(part_orders)
        print(f"  bulk: {len(orders):,} variables, {len(keys):,} rows", flush=True)
    bulk.write_response_order(store, SOURCE, orders)
    return scan, keys


def write_bulk_report(scan: BulkScan, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "variables": len(scan.taken), "rows": scan.rows,
        "skipped": {k: sorted(v) for k, v in sorted(scan.skipped.items())},
        "years": scan.years,
    }, indent=1))


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        allow_synthetic: bool = False, min_n: int = MIN_CELL_N, bulk_tier: bool = True) -> int:
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
    if not bulk_tier:
        written = store.upsert_norms(rows, prune=(SOURCE, version))
    else:
        written = store.upsert_norms(rows)
        keys = {natural_key(r) for r in rows}
        scan, bulk_keys = load_bulk(store, path, version, raw_dir, min_n=min_n)
        keys |= bulk_keys
        written += len(bulk_keys)
        pruned = bulk.prune_slice(store, SOURCE, version, keys)
        write_bulk_report(scan, config.ROOT / "reports" / "gss_bulk.json")
        print(f"bulk tier: {len(scan.taken):,} variables, {len(bulk_keys):,} rows; "
              f"{sum(len(v) for v in scan.skipped.values()):,} variables skipped; "
              f"{pruned:,} stale rows pruned")
    store.touch_source(SOURCE)
    years = sorted({r["period_start"].year for r in rows})
    print(f"{version}: {written} rows, {len(years)} survey years {years[0]}-{years[-1]}")
    return written
