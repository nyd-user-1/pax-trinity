"""World Values Survey wave 7 (2017-2022), United States: toplines and subgroup cells for
social trust, institutional confidence, national pride, importance of life domains, freedom
versus security, and democracy items.

The data files sit behind the WVS Association's registration form, so the loader parses
what it finds in raw/wvs/: the US national file or the cross-national pooled file (filtered
to B_COUNTRY 840), as Stata (.dta), SPSS (.sav) or CSV. When none is present it prints
where to get one and writes nothing.

Variable names and response codes are those of the WVS-7 codebook (Variables report V6.0;
the same harmonized Q-numbers in every national file). item_text holds the codebook's
variable label: the master questionnaire's wording could not be retrieved without the
site's form, and each row's provenance_note says so.

Wave 7 carries no Schwartz value battery (the "important to this person" portraits were
fielded in waves 5 and 6). The nearest wave-7 items are stored under their own constructs:
importance of family, friends, leisure, politics, work and religion (life_importance), and
freedom versus security (freedom_vs_security).

Weight W_WEIGHT. Cells: sex (Q260), age bucket (Q262), education (Q275, ISCED 2011: 0-3 HS
or less, 4-5 Some college, 6 BA, 7-8 Grad).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .. import categories as cat
from .. import config
from ..constructs import CONSTRUCTS
from ..db import Store
from .. import survey
from ..survey import MIN_CELL_N

SOURCE = "WVS"
DOC_URL = "https://www.worldvaluessurvey.org/WVSDocumentationWV7.jsp"
DATA_URL = "https://www.worldvaluessurvey.org/WVSDocumentationWV7.jsp"
US = 840
WEIGHT = "W_WEIGHT"

INSTRUCTIONS = f"""\
No WVS wave 7 file is under {{raw}}/.
The data need the WVS Association's short registration form (name, email, purpose). At

    {DOC_URL}

choose United States 2017 (or the cross-national "WVS Cross-National Wave 7" file) and
download the Stata, SPSS or CSV version. Unzip it into audience/raw/wvs/, then rerun:
python -m audience.load wvs
No rows were written."""


@dataclass(frozen=True)
class Item:
    construct: str
    var: str
    label: str
    options: dict | None = None
    mean_range: tuple | None = None


CONF = {1: "A great deal", 2: "Quite a lot", 3: "Not very much", 4: "None at all"}
IMPORTANT = {1: "Very important", 2: "Rather important", 3: "Not very important",
             4: "Not at all important"}
SYSTEM = {1: "Very good", 2: "Fairly good", 3: "Fairly bad", 4: "Very bad"}

ITEMS: tuple[Item, ...] = (
    Item("social_trust", "Q57", "Most people can be trusted",
         {1: "Most people can be trusted", 2: "Need to be very careful"}),
    Item("confidence_press", "Q66", "Confidence: The Press", CONF),
    Item("confidence_government", "Q71", "Confidence: The Government", CONF),
    Item("confidence_congress", "Q73", "Confidence: Parliament", CONF),
    *(Item("confidence_institutions", q, f"Confidence: {name}", CONF) for q, name in (
        ("Q64", "Churches"), ("Q65", "Armed Forces"), ("Q67", "Television"),
        ("Q68", "Labor Unions"), ("Q69", "The Police"), ("Q70", "Justice System/Courts"),
        ("Q72", "The Political Parties"), ("Q74", "The Civil Services"),
        ("Q75", "Universities"), ("Q76", "Elections"), ("Q77", "Major Companies"),
        ("Q78", "Banks"), ("Q79", "The Environmental Protection Movement"),
        ("Q80", "The Women's Movement"), ("Q81", "Charitable or humanitarian organizations"))),
    Item("national_pride", "Q254", "National pride",
         {1: "Very proud", 2: "Quite proud", 3: "Not very proud", 4: "Not at all proud"}),
    *(Item("life_importance", q, f"Important in life: {name}", IMPORTANT) for q, name in (
        ("Q1", "Family"), ("Q2", "Friends"), ("Q3", "Leisure time"), ("Q4", "Politics"),
        ("Q5", "Work"), ("Q6", "Religion"))),
    Item("freedom_vs_security", "Q150", "Freedom and security - Which more important",
         {1: "Freedom", 2: "Security"}),
    *(Item("political_system_eval", q, f"Political system: {name}", SYSTEM) for q, name in (
        ("Q235", "Having a strong leader who does not have to bother with parliament and elections"),
        ("Q236", "Having experts, not government, make decisions according to what they think is best for the country"),
        ("Q237", "Having the army rule"),
        ("Q238", "Having a democratic political system"))),
    Item("democracy_importance", "Q250", "Importance of democracy", mean_range=(1, 10)),
    Item("democracy_rating", "Q251", "How democratically is this country being governed today",
         mean_range=(1, 10)),
)

CONCORDANCE_NOTES = {
    "social_trust": "WVS Q57: trusted / need to be very careful, no 'depends' option.",
    "confidence_press": "WVS Q66: 4 points (a great deal / quite a lot / not very much / none at all).",
    "confidence_congress": "WVS Q73 asks about 'Parliament' (Congress in the US file), 4 points.",
    "confidence_government": "WVS Q71: 'The Government', no branch named, 4 points.",
    "national_pride": "WVS Q254: very / quite / not very / not at all proud; code 5 (not a national) left out of the base.",
    "life_importance": "WVS Q1-Q6. Wave 7 has no Schwartz value battery; these are the nearest value items.",
    "freedom_vs_security": "WVS Q150 (forced choice).",
}

COLUMNS = ("B_COUNTRY", "A_YEAR", WEIGHT, "Q260", "Q262", "Q275")


def _dir(raw_dir: Path | None) -> Path:
    return Path(raw_dir) if raw_dir is not None else config.RAW / "wvs"


def locate(raw_dir: Path | None = None) -> Path | None:
    d = _dir(raw_dir)
    if not d.exists():
        return None
    files = [p for p in sorted(d.rglob("*")) if p.suffix.lower() in (".dta", ".sav", ".csv")
             and "docs" not in p.parts]
    return files[0] if files else None


def read_file(path: Path) -> pd.DataFrame:
    wanted = set(COLUMNS) | {i.var for i in ITEMS}
    suffix = path.suffix.lower()
    if suffix in (".dta", ".sav"):
        import pyreadstat

        reader = pyreadstat.read_dta if suffix == ".dta" else pyreadstat.read_sav
        _, meta = reader(str(path), metadataonly=True)
        present = [c for c in meta.column_names if c in wanted]
        df, _ = reader(str(path), usecols=present)
    else:
        df = pd.read_csv(path, usecols=lambda c: c in wanted, low_memory=False)
    if "B_COUNTRY" in df:
        df = df[pd.to_numeric(df["B_COUNTRY"], errors="coerce") == US]
    return df


EDUC = {0: cat.EDUCATION_4[0], 1: cat.EDUCATION_4[0], 2: cat.EDUCATION_4[0],
        3: cat.EDUCATION_4[0], 4: cat.EDUCATION_4[1], 5: cat.EDUCATION_4[1],
        6: cat.EDUCATION_4[2], 7: cat.EDUCATION_4[3], 8: cat.EDUCATION_4[3]}


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for c in df.columns:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["year"] = df["A_YEAR"].astype(int)
    df["_sex"] = survey.recode(df["Q260"], {1: cat.SEX[0], 2: cat.SEX[1]})
    df["_age"] = survey.age_bucket(df["Q262"].where(df["Q262"] > 0))
    df["_educ"] = survey.recode(df["Q275"], EDUC)
    df[WEIGHT] = df[WEIGHT].fillna(0.0)
    return df


SUBGROUPS = {"sex": "_sex", "age": "_age", "educ": "_educ"}
NOTE_TAIL = ("item_text is the WVS-7 codebook variable label, not the questionnaire wording "
             "(the codebook cuts the Q235 and Q236 labels at 80 characters; they are completed). "
             "Subgroups: sex Q260, age Q262, educ Q275 (ISCED 0-3 HS or less, 4-5 Some "
             "college, 6 BA, 7-8 Grad).")


def source_version(path: Path) -> str:
    return "WVS wave 7 (2017-2022), United States"


def build_rows(df: pd.DataFrame, version: str, min_n: int = MIN_CELL_N) -> list[dict]:
    df = prepare(df)
    rows: list[dict] = []
    for item in ITEMS:
        if item.var not in df:
            continue
        if item.mean_range:
            cells, skipped = survey.means(df, item.var, WEIGHT, item.mean_range, SUBGROUPS,
                                          min_n=min_n, label="Mean (1-10)")
            base, etype = survey.MEAN_NOTE, "mean"
        else:
            cells, skipped = survey.shares(df, item.var, WEIGHT, item.options, SUBGROUPS,
                                           min_n=min_n)
            base, etype = survey.BASE_NOTE, "pct"
        note = f"WVS wave 7 {item.var}, survey year A_YEAR. Weight {WEIGHT}. {NOTE_TAIL} {base}"
        rows += survey.norm_rows(
            cells, skipped, source=SOURCE, source_version=version, geography="US",
            geo_code="US", place="United States", construct=item.construct,
            item_text=item.label, weight_var=WEIGHT, provenance_url=DATA_URL, note=note,
            period_dates=survey.year_dates, estimate_type=etype)
    return rows


def write_concordance(store: Store) -> None:
    by_construct: dict[str, list[str]] = {}
    for item in ITEMS:
        by_construct.setdefault(item.construct, []).append(item.var)
    for construct, wvars in by_construct.items():
        label, definition = CONSTRUCTS[construct]
        survey.merge_concordance(store, construct, label, definition, wvs_var=wvars,
                                 note=CONCORDANCE_NOTES.get(construct))


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        allow_synthetic: bool = False, min_n: int = MIN_CELL_N) -> int:
    write_concordance(store)  # the crosswalk is recorded even before the data arrives
    path = locate(raw_dir)
    if path is None:
        print(INSTRUCTIONS.format(raw=_dir(raw_dir)))
        return 0
    survey.refuse_synthetic([path], allow_synthetic)
    df = read_file(path)
    if df.empty:
        print(f"{path.name} has no United States (B_COUNTRY {US}) rows. No rows were written.")
        return 0
    version = source_version(path)
    rows = build_rows(df, version, min_n=min_n)
    written = store.upsert_norms(rows, prune=(SOURCE, version))
    store.touch_source(SOURCE)
    print(f"{version}: {written} rows from {path.name}")
    return written
