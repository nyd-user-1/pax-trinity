"""ANES Time Series Cumulative Data File, 1948-2024 (American National Election Studies):
yearly US toplines and subgroup cells for party identification, ideology, trust in
government, efficacy, party thermometers, presidential-candidate traits and the
egalitarianism battery.

The Stata release is downloaded once into raw/anes/ (no login). electionstudies.org
answers plain HTTP clients with 403, so the download goes through curl_cffi impersonating
a browser. Only the columns below are read.

Weight VCF0009z (full-sample weight, all years). Cells: sex, age bucket, race_eth (VCF0105b,
4 groups), education (VCF0140a, 4 groups) and party (VCF0303, leaners with their party).
A cell with an unweighted base under 50 is not stored; the year's topline row names it.

Two places where this file differs from the variable names in the brief:
- VCF0613 is "People like me don't have any say about what the government does", the
  second external-efficacy item (ANES builds its External Efficacy Index, VCF0648, from
  VCF0609 and VCF0613), so it is stored under efficacy_external. parties_care is VCF0611,
  "Parties are only interested in people's votes but not in their opinions" (1968-1980).
- The CDF carries no national-pride item.
"""

from __future__ import annotations

import zipfile
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .. import categories as cat
from .. import config
from ..constructs import CONSTRUCTS
from ..db import Store
from .. import survey
from ..survey import IDEOLOGY_7, MIN_CELL_N, PARTY_3, PARTY_ID_7

SOURCE = "ANES"
RELEASE = "20260205"
DATA_URL = f"https://electionstudies.org/anes_timeseries_cdf_stata_{RELEASE}/"
CODEBOOK_URL = "https://electionstudies.org/data-center/anes-time-series-cumulative-data-file/"
WEIGHT = "VCF0009z"

INSTRUCTIONS = f"""\
The ANES cumulative Stata file is not under raw/anes/ and could not be downloaded.
No login is needed, but electionstudies.org refuses plain HTTP clients; the loader uses
curl_cffi (pip install curl_cffi). To fetch it by hand, open

    {DATA_URL}

in a browser, save the zip as audience/raw/anes/anes_timeseries_cdf_stata_{RELEASE}.zip
(or unzip it there), then rerun: python -m audience.load anes
No rows were written."""


@dataclass(frozen=True)
class Item:
    construct: str
    var: str
    text: str
    options: dict | None = None      # code -> label for pct rows
    mean_range: tuple | None = None  # (lo, hi) for mean rows
    note: str = ""


AGREE3 = {1: "Agree", 2: "Disagree", 3: "Neither agree nor disagree"}
TRAIT4 = {1: "Extremely well", 2: "Quite well", 3: "Not too well", 4: "Not well at all"}
TRAIT5 = {1: "Extremely well", 2: "Very well", 3: "Moderately well", 4: "Slightly well",
          5: "Not well at all"}
AGREE_SOMEWHAT = {1: "Agree strongly", 2: "Agree somewhat", 3: "Neither agree nor disagree",
                  4: "Disagree somewhat", 5: "Disagree strongly"}


def _trait5(party: str, phrase: str, short: str) -> str:
    return (f"[Think about -{party} Presidential candidate name-. In your opinion, does the "
            f"phrase '{phrase}' describe -name- extremely well, very well, moderately well, "
            f"slightly well, or not well at all? / (What about) '{short}'? (Does this phrase "
            f"describe -{party} Presidential candidate name- extremely well, very well, "
            f"moderately well, slightly well, or not well at all?)]")


EGAL_STEM = ("1988 AND LATER: Using page [page] for our choice of answers, I would like you to "
             "tell me how much you agree or disagree with each statement. (RESPONDENT BOOKLET "
             "SHOWN TO R) 1984,1986,1990,1996: I am going to read several statements. After each "
             "one, I would like you to tell me whether you agree strongly, agree somewhat, "
             "neither agree nor disagree, disagree somewhat, or disagree strongly. (RESPONDENT "
             "BOOKLET SHOWN TO R) 2004: Pleae look at page [page] of the booklet. I am going to "
             "read several more statements. After each one, I would like you to tell me how "
             "strongly you agree or disagree. ALL YEARS: ")

# Wording is the "Question" text of each variable in the CDF variable codebook
# (anes_timeseries_cdf_codebook_var_20260205.pdf), year variants in parentheses as printed.
ITEMS: tuple[Item, ...] = (
    Item("party_id_7", "VCF0301",
         "Generally speaking, do you usually think of yourself as a Republican, a Democrat, an "
         "Independent, or what? (IF REPUBLICAN OR DEMOCRAT) Would you call yourself a strong "
         "(REP/DEM) or a not very strong (REP/DEM)? (IF INDEPENDENT, OTHER [1966 AND LATER:] OR "
         "NO PREFERENCE; 2008: OR DK) Do you think of yourself as closer to the Republican or "
         "Democratic party?",
         dict(zip(range(1, 8), PARTY_ID_7)),
         note="ANES codes 1-7 map to the harmonized labels: Independent-Democrat = Lean Democrat."),
    Item("ideology_7", "VCF0803",
         "ALL YEARS EXC. 2000 TELEPHONE,2002: We hear a lot of talk these days about liberals "
         "and conservatives. Here is (1972,1974: I'm going to show you) a 7-point scale on which "
         "the political views that people might hold are arranged from extremely liberal to "
         "extremely conservative. Where would you place yourself on this scale, or haven't you "
         "thought much about this? (7-POINT SCALE SHOWN TO R) 2000 TELEPHONE: When it comes to "
         "politics, do you usually think of yourself as extremely liberal, liberal, slightly "
         "liberal, moderate or middle of the road, slightly conservative, extremely "
         "conservative, or haven't you thought much about this? 2002: We hear a lot of talk "
         "these days about liberals and conservatives. When it comes to politics, do you "
         "usually think of yourself as extremely liberal, liberal, slightly liberal, moderate "
         "or middle of the road, slightly conservative, extremely conservative, or haven't you "
         "thought much about this?",
         {**dict(zip(range(1, 8), IDEOLOGY_7)), 9: "Haven't thought much about it (incl. don't know)"},
         note="Code 9 (don't know; haven't thought much about it) is an offered answer and stays in the base."),
    Item("trust_gov", "VCF0604",
         "People have (1958,1964: I'd like to talk about some of the) different ideas about the "
         "government in Washington. These ideas don't refer to Democrats or Republicans in "
         "particular, but just to government in general. We want to see how you feel about "
         "these ideas. (1996 and later: For example:) How much of the time do you think you can "
         "trust the government in Washington to do what is right - just about always, most of "
         "the time (not 1966: or) only some of the time (1996: or almost never)?",
         {1: "None of the time or almost never", 2: "Some of the time", 3: "Most of the time",
          4: "Just about always"},
         note="Code 1 is a volunteered 'none of the time' (offered 'almost never' in 1966 and 1996 on). The CDF carries this item through 2012."),
    Item("efficacy_external", "VCF0609",
         "1952-1980,1982,1992: Now I'd like to read some of the kinds of things people tell us "
         "when we interview them. Please tell me whether (1992: and ask you whether) "
         "(1966,1988,1990,1994-LATER: how much) you agree or disagree with these statements "
         "(1992: with them) (2002: about the government.) (1988,1990: You can just give me the "
         "number of your choice.) (1992: I'll read them one at a time and you just tell me "
         "whether you agree or disagree) (1996 and later: The first is:) 1952-1988,1992: 'I "
         "don't think public officials care much what people like me think.' 1990,1994-LATER: "
         "'Public officials don't care much what people like me think.' 2000 TELEPHONE,2002: Do "
         "you agree, neither agree nor disagree, or disagree with this statement?",
         AGREE3, note="Agreeing is the low-efficacy answer. 'Neither' was offered from 1988."),
    Item("efficacy_external", "VCF0613",
         "'People like me don't have any say about what the government does.'",
         AGREE3, note="Agreeing is the low-efficacy answer. 'Neither' was offered from 1988."),
    Item("efficacy_internal", "VCF0614",
         "'Sometimes politics and government seem so complicated that a person like me can't "
         "really understand what's going on.'",
         AGREE3, note="Agreeing is the low-efficacy answer. The CDF carries this version through 2012."),
    Item("efficacy_internal", "VCF9252",
         "How often do politics and government seem so complicated that you can't really "
         "understand what's going on? All the time, most of the time, about half the time, some "
         "of the time, or never?",
         {1: "All the time", 2: "Most of the time", 3: "About half the time",
          4: "Some of the time", 5: "Never"},
         note="The 2008-on frequency version of the complexity item."),
    Item("parties_care", "VCF0611",
         "'Parties are only interested in people's votes but not in their opinions.'",
         {1: "Agree", 2: "Disagree"}, note="Agreeing says parties do not care (1968-1980)."),
    Item("thermometer_dem", "VCF0218", "The Democratic Party - feeling thermometer",
         mean_range=(0, 97), note="Code 97 is 97-100 degrees and counts as 97."),
    Item("thermometer_rep", "VCF0224", "The Republican Party - feeling thermometer",
         mean_range=(0, 97), note="Code 97 is 97-100 degrees and counts as 97."),
    Item("cand_trait_knowledgeable", "VCF0354", "Democratic Presidential candidate trait - knowledgeable", TRAIT4),
    Item("cand_trait_strong_leader", "VCF0356", "Democratic Presidential candidate trait - provides strong leadership", TRAIT4),
    Item("cand_trait_cares", "VCF0357", "Democratic Presidential candidate trait - really cares about people like you", TRAIT4),
    Item("cand_trait_knowledgeable", "VCF0366", "Republican Presidential candidate trait - knowledgeable", TRAIT4),
    Item("cand_trait_strong_leader", "VCF0368", "Republican Presidential candidate trait - provides strong leadership", TRAIT4),
    Item("cand_trait_cares", "VCF0369", "Republican Presidential candidate trait - really cares about people like you", TRAIT4),
    Item("cand_trait_strong_leader", "VCF9209", _trait5("Democratic", "he provides strong leadership", "provides strong leadership"), TRAIT5),
    Item("cand_trait_cares", "VCF9210", _trait5("Democratic", "he really cares about people like you", "really cares about people like you"), TRAIT5),
    Item("cand_trait_knowledgeable", "VCF9211", _trait5("Democratic", "he is knowledgeable", "knowledgeable"), TRAIT5),
    Item("cand_trait_honest", "VCF9212", _trait5("Democratic", "he is honest", "honest"), TRAIT5),
    Item("cand_trait_strong_leader", "VCF9213", _trait5("Republican", "he provides strong leadership", "provides strong leadership"), TRAIT5),
    Item("cand_trait_cares", "VCF9214", _trait5("Republican", "he really cares about people like you", "really cares about people like you"), TRAIT5),
    Item("cand_trait_knowledgeable", "VCF9215", _trait5("Republican", "he is knowledgeable", "knowledgeable"), TRAIT5),
    Item("cand_trait_honest", "VCF9216", _trait5("Republican", "he is honest", "honest"), TRAIT5),
    Item("egalitarianism", "VCF9013", EGAL_STEM + "'Our society should do whatever is necessary to make sure that everyone has an equal opportunity to succeed.'", AGREE_SOMEWHAT),
    Item("egalitarianism", "VCF9014", "'We have gone too far in pushing equal rights in this country.'", AGREE_SOMEWHAT, note="Agreeing is the anti-egalitarian answer."),
    Item("egalitarianism", "VCF9015", "ALL YEARS: 'One of the big problems in this country is that we don't give everyone an equal chance.'", AGREE_SOMEWHAT),
    Item("egalitarianism", "VCF9016", "ALL YEARS: 'It is not really that big a problem if some people have more of a chance in life than others.'", AGREE_SOMEWHAT, note="Agreeing is the anti-egalitarian answer."),
    Item("egalitarianism", "VCF9017", "ALL YEARS: 'The (2004: This_ country would be better off if we worried less about how equal people are.'", AGREE_SOMEWHAT, note="Agreeing is the anti-egalitarian answer."),
    Item("egalitarianism", "VCF9018", "ALL YEARS: 'If people were treated more equally in this country we would have many fewer problems.'", AGREE_SOMEWHAT),
)

CONCORDANCE_NOTES = {
    "party_id_7": "ANES VCF0301: the initial question names Republican first; no 'other party' code.",
    "ideology_7": "ANES VCF0803 offers 'or haven't you thought much about this?', kept as its own option.",
    "trust_gov": "ANES VCF0604: how much of the time the government in Washington can be trusted to do what is right (4 points, through 2012 in the CDF).",
    "efficacy_external": "ANES VCF0609 (officials don't care) and VCF0613 (no say), the two items of ANES's External Efficacy Index VCF0648.",
    "efficacy_internal": "ANES VCF0614 is agree/disagree (1952-2012); VCF9252 asks how often (2008-2024).",
    "cand_trait_honest": "ANES carries 'honest' only in the 5-point 2008-2024 series (VCF9212, VCF9216).",
    "cand_trait_cares": "ANES 4-point series VCF0357/VCF0369 (1984-2008) and 5-point series VCF9210/VCF9214 (2008-2024) are separate item_texts.",
    "cand_trait_strong_leader": "ANES 4-point series VCF0356/VCF0368 (1980-2008) and 5-point series VCF9209/VCF9213 (2008-2024) are separate item_texts.",
    "cand_trait_knowledgeable": "ANES 4-point series VCF0354/VCF0366 (1980-2008) and 5-point series VCF9211/VCF9215 (2008-2024) are separate item_texts.",
    "egalitarianism": "ANES VCF9013-VCF9018, 5-point agree-disagree; VCF9014, VCF9016 and VCF9017 are worded against equality.",
}

COLUMNS = ("VCF0004", WEIGHT, "VCF0101", "VCF0104", "VCF0105b", "VCF0140a", "VCF0303")


def _dir(raw_dir: Path | None) -> Path:
    return Path(raw_dir) if raw_dir is not None else config.RAW / "anes"


def locate(raw_dir: Path | None = None) -> Path | None:
    d = _dir(raw_dir)
    found = sorted(d.rglob("anes_timeseries_cdf*.dta"))
    if found:
        return found[-1]
    for z in sorted(d.glob("anes_timeseries_cdf*.zip")):
        with zipfile.ZipFile(z) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith(".dta")]
            if names:
                zf.extract(names[0], d)
                return d / names[0]
    return None


def fetch(raw_dir: Path | None = None) -> Path | None:
    try:
        from curl_cffi import requests as creq
    except ImportError:
        print("curl_cffi is not installed (pip install curl_cffi)")
        return None
    d = _dir(raw_dir)
    d.mkdir(parents=True, exist_ok=True)
    target = d / f"anes_timeseries_cdf_stata_{RELEASE}.zip"
    print(f"downloading {DATA_URL}")
    try:
        resp = creq.get(DATA_URL, impersonate="chrome", timeout=600)
        resp.raise_for_status()
        if not resp.content.startswith(b"PK"):
            raise RuntimeError(f"not a zip ({resp.headers.get('content-type')})")
        target.write_bytes(resp.content)
    except Exception as exc:
        print(f"download failed: {exc}")
        return None
    return locate(raw_dir)


def source_version(path: Path) -> str:
    release = path.stem.rsplit("_", 1)[-1]
    return f"ANES Time Series CDF 1948-2024, release {release}"


def read_frame(path: Path) -> pd.DataFrame:
    import pyreadstat

    cols = list(dict.fromkeys(COLUMNS + tuple(i.var for i in ITEMS)))
    df, _ = pyreadstat.read_dta(str(path), usecols=cols)
    return df


# -- recodes ---------------------------------------------------------------------------------

RACE_ETH_4 = {1: cat.RACE_ETH[1], 2: cat.RACE_ETH[2], 3: cat.RACE_ETH[0],
              4: "Asian, other or multiracial"}
EDUC_7_TO_4 = {1: cat.EDUCATION_4[0], 2: cat.EDUCATION_4[0], 3: cat.EDUCATION_4[0],
               4: cat.EDUCATION_4[0], 5: cat.EDUCATION_4[1], 6: cat.EDUCATION_4[2],
               7: cat.EDUCATION_4[3]}


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["year"] = df["VCF0004"].astype(int)
    df["_sex"] = survey.recode(df["VCF0104"], {1: cat.SEX[0], 2: cat.SEX[1]})
    df["_age"] = survey.age_bucket(df["VCF0101"].where(df["VCF0101"] > 0))
    df["_race_eth"] = survey.recode(df["VCF0105b"], RACE_ETH_4)
    df["_educ"] = survey.recode(df["VCF0140a"], EDUC_7_TO_4)
    df["_party"] = survey.recode(df["VCF0303"], {1: PARTY_3[0], 2: PARTY_3[1], 3: PARTY_3[2]})
    return df


SUBGROUPS = {"sex": "_sex", "age": "_age", "race_eth": "_race_eth", "educ": "_educ",
             "party": "_party"}

SUBGROUP_NOTE = ("race_eth is VCF0105b (Hispanic; White, Black, and Asian, other or "
                 "multiracial, all non-Hispanic); educ is VCF0140a (1-4 HS or less, 5 Some "
                 "college, 6 BA, 7 Grad); party is VCF0303.")


def build_rows(df: pd.DataFrame, version: str, min_n: int = MIN_CELL_N) -> list[dict]:
    df = prepare(df)
    rows: list[dict] = []
    for item in ITEMS:
        if item.var not in df:
            continue
        subgroups = {k: v for k, v in SUBGROUPS.items()
                     if not (item.construct == "party_id_7" and k == "party")}
        extra = f"{item.note} " if item.note else ""
        if item.mean_range:
            cells, skipped = survey.means(df, item.var, WEIGHT, item.mean_range, subgroups,
                                          min_n=min_n, label="Mean (0-100)")
            note = f"ANES {item.var}, study year. Weight {WEIGHT}. {extra}{SUBGROUP_NOTE} {survey.MEAN_NOTE}"
            etype = "mean"
        else:
            cells, skipped = survey.shares(df, item.var, WEIGHT, item.options, subgroups,
                                           min_n=min_n)
            note = f"ANES {item.var}, study year. Weight {WEIGHT}. {extra}{SUBGROUP_NOTE} {survey.BASE_NOTE}"
            etype = "pct"
        rows += survey.norm_rows(
            cells, skipped, source=SOURCE, source_version=version, geography="US",
            geo_code="US", place="United States", construct=item.construct,
            item_text=item.text, weight_var=WEIGHT, provenance_url=DATA_URL, note=note,
            period_dates=survey.year_dates, estimate_type=etype)
    return rows


def write_concordance(store: Store) -> None:
    by_construct: dict[str, list[str]] = {}
    for item in ITEMS:
        by_construct.setdefault(item.construct, []).append(item.var)
    for construct, avars in by_construct.items():
        label, definition = CONSTRUCTS[construct]
        survey.merge_concordance(store, construct, label, definition, anes_var=avars,
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
    print(f"{version}: {written} rows, {len(years)} study years {years[0]}-{years[-1]}")
    return written
