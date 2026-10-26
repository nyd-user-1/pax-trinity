"""Cooperative Election Study common content, 2020 / 2022 / 2024 (Harvard Dataverse): US and
Massachusetts toplines and subgroup cells for party identification, ideology, presidential
approval, trust in the federal government, election fairness, and validated primary turnout
and party.

The loader parses whatever common-content files sit in raw/ces/ (CSV or Stata; the year is
read from the file name, e.g. CES20_Common_OUTPUT_vv.csv). The files are CC0 and need no
login; when none is present the loader prints where to get them and writes nothing.

Weights follow the CES guide: commonweight for pre-election items, commonpostweight for
post-election items, vvweight for validated-voter analyses (party of the primary ballot).
Validated primary turnout is over all adults with commonweight, counting respondents with
no voter-file record as non-voters (the guide's first turnout specification).

Not in the 2020-2024 common content, so not stored: efficacy items and trust in the media.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from .. import categories as cat
from .. import config
from ..constructs import CONSTRUCTS
from ..db import Store
from .. import survey
from ..survey import MIN_CELL_N, PARTY_3, PARTY_ID_7

SOURCE = "CES"
DATAVERSE = {
    2020: "https://doi.org/10.7910/DVN/E9N6PH",
    2022: "https://doi.org/10.7910/DVN/PR4L8P",
    2024: "https://doi.org/10.7910/DVN/X11EP6",
}
FILES = {
    2020: ("CES20_Common_OUTPUT_vv.csv", 4949558),
    2022: ("CCES22_Common_OUTPUT_vv_topost.csv", 10140882),
    2024: ("CCES24_Common_OUTPUT_vv_topost_final.csv", 12050325),
}
YEAR_IN_NAME = re.compile(r"C?CES(\d{2})_Common", re.I)


def instructions(raw: Path) -> str:
    lines = "\n".join(
        f"    {y}: {DATAVERSE[y]}\n"
        f"          https://dataverse.harvard.edu/api/access/datafile/{fid}?format=original  -> {name}"
        for y, (name, fid) in FILES.items())
    return f"""\
No CES common-content file is under {raw}/.
The files are CC0 on Harvard Dataverse and need no login (about 190 MB each as CSV):

{lines}

Save any of them into audience/raw/ces/ under the names shown, then rerun:
python -m audience.load ces
No rows were written."""


@dataclass(frozen=True)
class Item:
    construct: str
    var: str            # source column, or a derived column built in prepare()
    text: str
    options: dict
    weight: str
    note: str = ""
    universe: str = "adults"
    raw: str = ""       # the source column a derived column is built from
    only_geo: str | None = None  # write this item for one geo_code only

    @property
    def source_var(self) -> str:
        return self.raw or self.var


PID7 = {**dict(zip(range(1, 8), PARTY_ID_7)), 8: "Not sure"}
PID_TEXT = ("Generally speaking, do you think of yourself as a ...? [pid7: pid3 with its "
            "strength or closer-to follow-up, $pid7text]")
IDEO5 = {1: "Very liberal", 2: "Liberal", 3: "Moderate", 4: "Conservative",
         5: "Very conservative", 6: "Not sure"}
IDEO_TEXT = "In general, how would you describe your own political viewpoint?"
APPROVE = {1: "Strongly approve", 2: "Somewhat approve", 3: "Somewhat disapprove",
           4: "Strongly disapprove", 5: "Not sure"}
TRUST = {1: "A great deal", 2: "A fair amount", 3: "Not very much", 8: "None at all"}
TRUST_TEXT = ("How much trust do you have in the federal government in Washington when it "
              "comes to handling the nation's problems?")
AGREE = {1: "Strongly agree", 2: "Somewhat agree", 3: "Neither agree nor disagree",
         4: "Somewhat disagree", 5: "Strongly disagree"}
VOTED = {1: "Voted (validated record)", 0: "No record of voting"}
PARTY_BALLOT = {"Democratic": "Democratic", "Republican": "Republican", "Other": "Other or nonpartisan"}


def items_for(year: int) -> list[Item]:
    yy = str(year)[2:]
    approve_var, president = {2020: ("CC20_320a", "Trump"), 2022: ("CC22_320a", "Biden"),
                              2024: ("CC24_312a", "Biden")}[year]
    stem = ("Do you approve of the way each is doing their job..." if year == 2020
            else "Do you approve of the way each is doing their job?")
    out = [
        Item("party_id_7", "pid7", PID_TEXT, PID7, "commonweight",
             "pid7 codes map to the harmonized labels: not very strong = Weak, closer to a party = Lean, neither = Independent."),
        Item("ideology_5", "ideo5", IDEO_TEXT, IDEO5, "commonweight"),
        Item("pres_approval", approve_var, f"{stem} President {president}", APPROVE, "commonweight"),
    ]
    if year in (2022, 2024):
        out.append(Item("trust_gov", f"CC{yy}_423", TRUST_TEXT, TRUST, "commonpostweight",
                        "Post-election wave."))
    if year == 2024:
        stem = "Do you agree or disagree with the following statements?"
        out += [
            Item("elections_fair", "CC24_421_1", f"{stem} Elections in the U.S. are fair", AGREE,
                 "commonpostweight", "Post-election wave."),
            Item("elections_fair", "CC24_421_2", f"{stem} Your state or local government conducted a fair and accurate election in 2024",
                 AGREE, "commonpostweight", "Post-election wave."),
        ]
    # Validated primary participation (vote-file match; Catalist in 2020, TargetSmart after).
    prim = {
        2020: [("_prim_state", "_party_state", "CL_2020pvm", "CL_2020pep",
                "Validated vote record in the 2020 state/federal primary (Catalist match, CL_2020pvm non-missing)")],
        2022: [("_prim_state", "_party_state", "TS_p2022", "TS_p2022_party",
                "Validated vote record in the 2022 primary (TargetSmart match, TS_p2022 codes 1-6)")],
        2024: [("_prim_state", "_party_state", "TS_p2024", "TS_p2024_party",
                "Validated vote record in the 2024 state primary (TargetSmart match, TS_p2024 codes 1-6)"),
               ("_prim_pres", "_party_pres", "TS_pp2024", "TS_pp2024_party",
                "Validated vote record in the 2024 presidential primary (TargetSmart match, TS_pp2024 codes 1-6)")],
    }[year]
    for turnout_col, party_col, raw_var, party_var, text in prim:
        pres = turnout_col == "_prim_pres"
        # Where a state held its presidential and state primaries on one day, TargetSmart
        # records the vote under TS_p2024 and codes TS_pp2024 as did-not-vote (California:
        # 48% and 0%), so a national presidential-primary share undercounts. Massachusetts
        # held a separate presidential primary (March 5, 2024).
        only = "25" if pres else None
        extra = (" Stored for Massachusetts only: states that combined their presidential "
                 "and state primaries record the vote under TS_p2024." if pres else "")
        out.append(Item("primary_turnout_validated", turnout_col, text, VOTED, "commonweight",
                        "Respondents with no record, or unmatched to the voter file, count as "
                        "non-voters." + extra, raw=raw_var, only_geo=only))
        out.append(Item("primary_party_validated", party_col, text, PARTY_BALLOT, "vvweight",
                        "Party of the primary ballot among validated primary voters; green, "
                        "independent, libertarian, nonpartisan and other ballots are pooled." + extra,
                        universe="validated primary voters", raw=party_var, only_geo=only))
    return out


RAW_COLUMNS = {
    2020: ("commonweight", "commonpostweight", "vvweight", "birthyr", "gender", "educ", "race",
           "hispanic", "inputstate", "pid7", "ideo5", "CC20_320a", "CL_2020pvm", "CL_2020pep"),
    2022: ("commonweight", "commonpostweight", "vvweight", "birthyr", "gender4", "educ", "race",
           "hispanic", "inputstate", "pid7", "ideo5", "CC22_320a", "CC22_423", "TS_p2022",
           "TS_p2022_party"),
    2024: ("commonweight", "commonpostweight", "vvweight", "birthyr", "gender4", "educ", "race",
           "hispanic", "inputstate", "pid7", "ideo5", "CC24_312a", "CC24_423", "CC24_421_1",
           "CC24_421_2", "TS_p2024", "TS_p2024_party", "TS_pp2024", "TS_pp2024_party"),
}

CONCORDANCE_NOTES = {
    "party_id_7": "CES pid7 offers 'Not sure' after pid3, kept as its own option; pid3 names Democrat first.",
    "ideology_5": "CES ideo5: very liberal to very conservative plus an offered 'Not sure'.",
    "pres_approval": "CES CC20_320a (Trump), CC22_320a and CC24_312a (Biden): 4-point approval plus 'Not sure'.",
    "trust_gov": "CES CC22_423, CC24_423 ask about trust in the federal government 'when it comes to handling the nation's problems' (great deal / fair amount / not very much / none at all), a different item from ANES VCF0604.",
    "elections_fair": "CES CC24_421_1 (U.S. elections) and CC24_421_2 (own state or local government, 2024), 5-point agree-disagree.",
    "primary_turnout_validated": "CES vote validation: Catalist (CL_2020pvm) in 2020, TargetSmart (TS_p2022, TS_p2024, TS_pp2024) after; the vendors' match rules differ.",
}


def _dir(raw_dir: Path | None) -> Path:
    return Path(raw_dir) if raw_dir is not None else config.RAW / "ces"


def locate(raw_dir: Path | None = None) -> dict[int, Path]:
    found: dict[int, Path] = {}
    d = _dir(raw_dir)
    if not d.exists():
        return found
    for p in sorted(d.iterdir()):
        if p.suffix.lower() not in (".csv", ".dta", ".tab"):
            continue
        m = YEAR_IN_NAME.search(p.name)
        if m:
            year = 2000 + int(m.group(1))
            if year in RAW_COLUMNS:
                # Prefer CSV (smaller, faster) when both forms are present.
                if year not in found or p.suffix.lower() == ".csv":
                    found[year] = p
    return found


def read_file(path: Path, columns) -> pd.DataFrame:
    wanted = set(columns)
    if path.suffix.lower() == ".dta":
        import pyreadstat

        _, meta = pyreadstat.read_dta(str(path), metadataonly=True)
        present = [c for c in meta.column_names if c in wanted]
        df, _ = pyreadstat.read_dta(str(path), usecols=present)
        return df
    sep = "\t" if path.suffix.lower() == ".tab" else ","
    return pd.read_csv(path, usecols=lambda c: c in wanted, sep=sep, low_memory=False)


# -- recodes ---------------------------------------------------------------------------------

def race_eth(race: pd.Series, hispanic: pd.Series) -> pd.Series:
    """Hispanic if race is 3 or the follow-up says Hispanic; else White (1, and 8 Middle
    Eastern, which the Census counts as White), Black (2), Asian or Pacific Islander (4),
    Other or multiracial (5 Native American, 6 two or more, 7 other)."""
    out = survey.recode(race, {1: cat.RACE_ETH[1], 8: cat.RACE_ETH[1], 2: cat.RACE_ETH[2],
                               4: cat.RACE_ETH[3], 5: cat.RACE_ETH[4], 6: cat.RACE_ETH[4],
                               7: cat.RACE_ETH[4]})
    out[(race == 3) | (hispanic == 1)] = cat.RACE_ETH[0]
    return out


EDUC = {1: cat.EDUCATION_4[0], 2: cat.EDUCATION_4[0], 3: cat.EDUCATION_4[1],
        4: cat.EDUCATION_4[1], 5: cat.EDUCATION_4[2], 6: cat.EDUCATION_4[3]}
PARTY_FROM_PID7 = {1: PARTY_3[0], 2: PARTY_3[0], 3: PARTY_3[0], 4: PARTY_3[1],
                   5: PARTY_3[2], 6: PARTY_3[2], 7: PARTY_3[2]}


def _ballot(series: pd.Series, dem: int, rep: int, others) -> pd.Series:
    return survey.recode(series, {dem: "Democratic", rep: "Republican",
                                  **{o: "Other" for o in others}})


def prepare(df: pd.DataFrame, year: int) -> pd.DataFrame:
    df = df.copy()
    df["year"] = year
    if "gender4" in df:
        df["_sex"] = survey.recode(df["gender4"], {1: cat.SEX[0], 2: cat.SEX[1]})
    else:
        df["_sex"] = survey.recode(df["gender"], {1: cat.SEX[0], 2: cat.SEX[1]})
    df["_age"] = survey.age_bucket(year - df["birthyr"])
    df["_race_eth"] = race_eth(df["race"], df.get("hispanic", pd.Series(np.nan, index=df.index)))
    df["_educ"] = survey.recode(df["educ"], EDUC)
    df["_party"] = survey.recode(df["pid7"], PARTY_FROM_PID7)
    if year == 2020:
        df["_prim_state"] = df["CL_2020pvm"].notna().astype(int)
        df["_party_state"] = _ballot(df["CL_2020pep"], 1, 7, (2, 3, 4, 5, 6))
    else:
        yy = str(year)[2:]
        df["_prim_state"] = df[f"TS_p20{yy}"].between(1, 6).astype(int)
        others = (2, 3, 4, 5) if year == 2022 else (3, 4, 5)
        df["_party_state"] = _ballot(df[f"TS_p20{yy}_party"], 1, 6, others)
        df.loc[df["_prim_state"] == 0, "_party_state"] = np.nan
    if year == 2024:
        df["_prim_pres"] = df["TS_pp2024"].between(1, 6).astype(int)
        df["_party_pres"] = _ballot(df["TS_pp2024_party"], 1, 5, (3,))
        df.loc[df["_prim_pres"] == 0, "_party_pres"] = np.nan
    for w in ("commonweight", "commonpostweight", "vvweight"):
        df[w] = pd.to_numeric(df[w], errors="coerce").fillna(0.0)
    return df


SUBGROUPS = {"sex": "_sex", "age": "_age", "race_eth": "_race_eth", "educ": "_educ",
             "party": "_party"}
SUBGROUP_NOTE = ("Subgroups: sex from gender (2020) or gender4 (2022 on; non-binary and other "
                 "are in the topline only); age = year minus birthyr; race_eth puts Hispanic "
                 "first and Middle Eastern with White, as the Census does; educ 1-2 HS or "
                 "less, 3-4 Some college, 5 BA, 6 Grad; party from pid7 with leaners.")

GEOS = (("US", "US", "United States", None), ("STATE", "25", "Massachusetts", 25))


def source_version(year: int) -> str:
    return f"CES {year} Common Content"


def build_rows(df: pd.DataFrame, year: int, min_n: int = MIN_CELL_N) -> list[dict]:
    df = prepare(df, year)
    version = source_version(year)
    rows: list[dict] = []
    for geography, geo_code, place, fips in GEOS:
        sub = df if fips is None else df[df["inputstate"] == fips]
        for item in items_for(year):
            if item.var not in sub or (item.only_geo and item.only_geo != geo_code):
                continue
            subgroups = {k: v for k, v in SUBGROUPS.items()
                         if not (item.construct == "party_id_7" and k == "party")}
            cells, skipped = survey.shares(sub, item.var, item.weight, item.options,
                                           subgroups, min_n=min_n)
            note = (f"CES {year} common content, {item.source_var}; universe: "
                    f"{item.universe}. Weight {item.weight}. "
                    f"{item.note + ' ' if item.note else ''}{SUBGROUP_NOTE} {survey.BASE_NOTE}")
            rows += survey.norm_rows(
                cells, skipped, source=SOURCE, source_version=version,
                geography=geography, geo_code=geo_code, place=place,
                construct=item.construct, item_text=item.text, weight_var=item.weight,
                provenance_url=DATAVERSE[year], note=note, period_dates=survey.year_dates)
    return rows


def write_concordance(store: Store, years) -> None:
    by_construct: dict[str, list[str]] = {}
    for year in sorted(years):
        for item in items_for(year):
            by_construct.setdefault(item.construct, []).append(item.source_var)
    for construct, cvars in by_construct.items():
        label, definition = CONSTRUCTS[construct]
        survey.merge_concordance(store, construct, label, definition,
                                 ces_var=list(dict.fromkeys(cvars)),
                                 note=CONCORDANCE_NOTES.get(construct))


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        allow_synthetic: bool = False, min_n: int = MIN_CELL_N) -> int:
    write_concordance(store, RAW_COLUMNS)  # the crosswalk is recorded even before the data arrives
    files = locate(raw_dir)
    if not files:
        print(instructions(_dir(raw_dir)))
        return 0
    survey.refuse_synthetic(files.values(), allow_synthetic)
    total = 0
    for year, path in sorted(files.items()):
        print(f"reading {path.name}")
        rows = build_rows(read_file(path, RAW_COLUMNS[year]), year, min_n=min_n)
        written = store.upsert_norms(rows, prune=(SOURCE, source_version(year)))
        print(f"{source_version(year)}: {written} rows (US and MA)")
        total += written
    store.touch_source(SOURCE)
    return total
