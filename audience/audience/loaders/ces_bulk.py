"""CES bulk tier: every qualifying common-content variable beside the 7 harmonized
constructs, from each year's file on disk and from the Kuriwaki cumulative common content
(2006 onward). ces.run calls run() after the 7.

A variable qualifies when it is categorical with 2 to 24 labeled categories (after the
missing codes below come out), is not administrative (ids, weights, consent, device and
module, zip, county, district and state codes, timings and dates, open text), is not one of
the 7 or a variable they are built from, and its categories are fixed answers rather than
per-respondent lookups (the $SenCand1Name slots of the candidate-vote items).

Value labels: the yearly CSVs carry codes only. The labels are in the Stata release of the
same file, so the loader range-reads that file's header and its value-label block (about
half a megabyte of the 1 GB file) and keeps them as raw/ces/labels/CESyy_labels.json; the
data still come from the CSV. The cumulative file is fetched whole (Stata, about 700 MB) and
read for both.

Per variable: construct id = the variable name lowercased; label = the file's variable
label, sentence-cased, with piped names shown in brackets ($CurrentGovName -> [governor]);
definition = the variable label verbatim. These are the files' labels, not question
wordings. Bands = the value labels in coded order, without skipped, not asked, don't know,
prefer not to say and NA; "Not sure" stays a band, as it does in the 7. Codes sharing a
label are pooled.

Rows: weighted toplines for every year the variable was asked, US and Massachusetts; the
five standard breakdowns (sex, age, race_eth, educ, party) for the latest year it was asked.
Shares, Kish-effective-n margins and the n<50 rule come from survey.py. Weights: the yearly
files use commonweight, or commonpostweight for an item only post-election respondents
answered; the cumulative uses weight, or weight_post for post-election items in the years
that carry it (2012, 2016-2022) and weight otherwise, as its guide advises.

A yearly variable whose name the cumulative also qualifies (newsint, educ, union, ...) is
served from the cumulative alone, which carries the same years and more. A construct id
another source or the store's seed already holds (sex) is skipped and named.
"""

from __future__ import annotations

import json
import re
import struct
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .. import bulk
from .. import categories as cat
from .. import config
from .. import survey
from ..constructs import CONSTRUCTS
from ..db import Store
from ..survey import MIN_CELL_N
from . import ces

STATA = {
    2020: ("CES20_Common_OUTPUT_vv.dta", 4949545),
    2022: ("CCES22_Common_OUTPUT_vv_topost.dta", 10140881),
    2024: ("CCES24_Common_OUTPUT_vv_topost_final.dta", 12050327),
}
CUMULATIVE = ("cumulative_2006-2025.dta", 14076515)
CUMULATIVE_GUIDE = ("guide_cumulative_2006-2025.pdf", 14076560)
CUMULATIVE_DOI = "https://doi.org/10.7910/DVN/II2DB6"
CUMULATIVE_NAME = re.compile(r"cumulative_(\d{4})-(\d{4}).*\.dta$", re.I)
MAX_BANDS = 24
UNLABELED_LIMIT = 0.01   # share of answers outside the labels past which a variable is continuous

MISSING_BAND = re.compile(
    r"(skipped|not asked|na|n/a|missing|refused|no answer|(i )?don'?t know|"
    r"prefer not to (say|answer))", re.I)
ADMIN_NAME = re.compile(
    r"(caseid|case_id|sourcevar|tookpost|ccestake|add_confirm|comptype|ccesmodule|year|"
    r".*weight.*|.*zip.*|countyfips|countyname|county_fips|cdid\d+(_post)?|"
    r"inputstate(_post)?|region(_post)?|state(_post)?|st(_post)?|cong(_up)?|"
    r"dist(_up)?(_post)?|cd(_up)?(_post)?|.*_confirm(_post)?|page_.*|.*_timing|"
    r"starttime.*|endtime.*|ts_state|vv_state|.*_t)", re.I)
ADMIN_LABEL = re.compile(r"consent|timing|zip code|device type|team module|case id|fips", re.I)
PIPED = re.compile(r"\$[A-Za-z]")

SKIP_REASONS = {
    "admin": "administrative (ids, weights, consent, device, module, geography codes, timings, open text)",
    "unlabeled": "no value labels (continuous, counts or open text)",
    "few": "fewer than 2 labeled categories once missing codes are out",
    "many": f"more than {MAX_BANDS} labeled categories",
    "the7": "one of the 7 harmonized constructs or a variable they are built from",
    "piped": "categories are per-respondent lookups ($SenCand1Name slots), not fixed answers",
    "cumulative": "served by the cumulative file under the same name",
    "taken": "construct id already held by another source or the store's seed",
    "partial": "codes outside the value labels (partially labeled numbers)",
    "absent": "in the Stata labels but not in the CSV",
    "empty": f"no cell with an unweighted base of {MIN_CELL_N} or more, so no rows",
}


@dataclass(frozen=True)
class BulkVar:
    var: str          # source column
    construct: str    # var lowercased
    label: str        # sentence-cased variable label
    definition: str   # the variable label verbatim
    options: dict     # code -> band, coded order, missing codes out


@dataclass
class Report:
    years: dict = field(default_factory=dict)
    skipped: dict = field(default_factory=dict)   # reason -> sorted names
    cumulative: dict = field(default_factory=dict)

    def skip(self, reason: str, name: str) -> None:
        self.skipped.setdefault(reason, set()).add(name)

    def as_json(self) -> dict:
        return {"years": self.years, "cumulative": self.cumulative,
                "skipped": {SKIP_REASONS[k]: sorted(v) for k, v in sorted(self.skipped.items())}}


# -- labels ----------------------------------------------------------------------------------

def stata_meta(path: Path) -> dict:
    """{var: {"label": str, "values": [[code, band], ...]}} from a Stata file's metadata."""
    import pyreadstat

    _, meta = pyreadstat.read_dta(str(path), metadataonly=True)
    out = {}
    for v in meta.column_names:
        vl = meta.variable_value_labels.get(v) or {}
        out[v] = {"label": meta.column_names_to_labels.get(v) or "",
                  "type": meta.readstat_variable_types.get(v),
                  "values": [[_num(k), str(l)] for k, l in sorted(vl.items())]}
    return out


def _num(code):
    f = float(code)
    return int(f) if f.is_integer() else f


def labels_path(year: int, raw_dir: Path) -> Path:
    return raw_dir / "labels" / f"CES{str(year)[2:]}_labels.json"


def fetch_labels(year: int, raw_dir: Path) -> Path | None:
    """Range-read the Stata release's header and value-label block, write the labels JSON.
    The Stata 118 map gives the offsets: [0, data) holds the variable names, types and
    labels; [strls, end) the long strings and the value labels. The data between are never
    fetched; pyreadstat reads metadata from a sparse file holding only the two ends."""
    import requests

    name, fid = STATA[year]
    url = f"https://dataverse.harvard.edu/api/access/datafile/{fid}"
    print(f"reading the value labels of {name} (two byte ranges from {url})")
    try:
        s = requests.Session()
        r = s.get(url, headers={"Range": "bytes=0-4095"}, timeout=120)
        r.raise_for_status()
        head = r.content
        total = int(r.headers["Content-Range"].split("/")[1])
        if not head.startswith(b"<stata_dta>"):
            raise ValueError("not a Stata 117+ file")
        i = head.index(b"<map>") + 5
        offsets = struct.unpack("<14Q", head[i:i + 112])
        data_at, strls_at = offsets[9], offsets[10]
        front = s.get(url, headers={"Range": f"bytes=0-{data_at - 1}"}, timeout=300).content
        back = s.get(url, headers={"Range": f"bytes={strls_at}-{total - 1}"}, timeout=300).content
        if len(front) != data_at or len(back) != total - strls_at:
            raise ValueError("short range read")
        with tempfile.TemporaryDirectory() as tmp:
            sparse = Path(tmp) / name
            with open(sparse, "wb") as f:
                f.write(front)
                f.seek(strls_at)
                f.write(back)
                f.truncate(total)
            meta = stata_meta(sparse)
    except Exception as exc:  # network, HTTP or format failure
        print(f"label read failed: {exc}")
        return None
    out = labels_path(year, raw_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"file": name, "dataverse_file_id": fid, "variables": meta},
                              ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    return out


def load_labels(year: int, raw_dir: Path, download: bool) -> dict | None:
    path = labels_path(year, raw_dir)
    if not path.exists() and download:
        fetch_labels(year, raw_dir)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))["variables"]


# -- the cumulative file -------------------------------------------------------------------

def locate_cumulative(raw_dir: Path) -> Path | None:
    if not raw_dir.exists():
        return None
    found = sorted(p for p in raw_dir.iterdir() if CUMULATIVE_NAME.search(p.name))
    return found[-1] if found else None


def fetch_cumulative(raw_dir: Path) -> Path | None:
    import requests

    raw_dir.mkdir(parents=True, exist_ok=True)
    for name, fid in (CUMULATIVE_GUIDE, CUMULATIVE):
        target = (raw_dir / "docs" / name) if name.endswith(".pdf") else raw_dir / name
        target.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://dataverse.harvard.edu/api/access/datafile/{fid}"
        print(f"downloading {name} from {url}")
        try:
            with requests.get(url, stream=True, timeout=300) as resp:
                resp.raise_for_status()
                tmp = target.with_name(target.name + ".part")
                with open(tmp, "wb") as f:
                    for chunk in resp.iter_content(1 << 20):
                        f.write(chunk)
            tmp.rename(target)
        except Exception as exc:
            print(f"download failed: {exc}")
            if not name.endswith(".pdf"):
                return None
    return raw_dir / CUMULATIVE[0]


def cumulative_version(path: Path) -> str:
    m = CUMULATIVE_NAME.search(path.name)
    return f"CES Cumulative Common Content {m.group(1)}-{m.group(2)}"


# -- classification ------------------------------------------------------------------------

PLACEHOLDERS = {
    "$inputstate": "[state]", "$CurrentGovName": "[governor]",
    "$CurrentHouseName": "[U.S. House member]", "$CurrentSen1Name": "[senator 1]",
    "$CurrentSen2Name": "[senator 2]", "$LegName": "[state legislature]",
    "$LowerChamberName": "[state lower chamber]", "$UpperChamberName": "[state upper chamber]",
}
CAND_OFFICE = {"House": "House", "Sen": "Senate", "Gov": "governor", "Att": "attorney general",
               "Sec": "secretary of state"}
CAND = re.compile(r"\$(House|Sen|Gov|Att|Sec)Cand(\d+)(Name|Party)(2?)")

# Kept capitalized inside a label: proper names, places, nationalities, faiths, parties,
# institutions, months, and abbreviations a reader expects capitalized.
PROPER = set("""
Act Act's Act’s Affordable Afghan African America American Americans Amy Asian Atheist
Baptist Barrett Biden Black Blacks Brett Brown Buddhist Cambodia Caribbean Catholic Central
China Christian Christians Clinton Coney Congregational Congres Congress Constitution COVID
Cuba Dem Democrat Democratic Democrats Dominican Donald Dreamers Eastern Egyptian Episcopal
European Evangelical Fox Gaza Greek Hamas Harris Hindu Hispanic Hmong House India Iran
Iranian Iraqi Irish Israel Israeli Italians Jackson Japan Jewish Joe Kamala Kavanaugh Ketanji
Korea Kurdish Latin Latino Latinos Lebanese Loeffler Lutheran March May Medicaid Medicare
Methodist Mexican Mexico Middle Mormon Moroccan Muslim Native Navy Nazarene North Northern
Obama Orthodox Ossoff Pakistan Palestinian Paris Pentecostal Perdue Pew Philippines
Phillipines Pres President Presbyterian Protestant Protestantism Puerto Qasem Republic
Rep Republican Republicans Rico Roe Romney Russia Russian Senate September Soleimani Somali South
Spain Spanish Supreme Syrian Taiwan Thailand Trump Turkish Ukraine United Vietnam Wade
Warnock White Whites
""".split())
# Multiword names kept whole.
PHRASES = (
    "Affordable Care Act", "Clean Air Act", "Clean Water Act", "Clean Power Plan",
    "Clean Power Plant Rules", "Department of Defense", "Election Day", "Environmental Protection Agency",
    "Equal Protection", "Fox News", "House of Representatives", "Iran Nuclear Accord",
    "Paris Climate Agreement", "Supreme Court", "Trans-Pacific", "United Nations", "United States",
    "Vice President", "World Health Organization",
)
PHRASES = tuple(sorted(PHRASES, key=len, reverse=True))   # "Clean Power Plant Rules" before "Clean Power Plan"
SEGMENT = re.compile(r"(\s+--\s+|\s+-\s+|:\s+)")


def render_piped(text: str) -> str:
    for k, v in PLACEHOLDERS.items():
        text = text.replace(k, v)

    def cand(m):
        office = CAND_OFFICE[m.group(1)]
        what = "candidate" if m.group(3) == "Name" else "candidate party"
        second = ", 2nd race" if m.group(4) else ""
        return f"[{office} {what} {m.group(2)}{second}]"
    return CAND.sub(cand, text)


def _case_word(word: str, first: bool) -> str:
    parts = word.split("/")
    out = []
    for i, part in enumerate(parts):
        if first and i == 0:
            out.append(part[:1].upper() + part[1:])
            continue
        core = part.strip("()[]\"',.:;?!")
        head = core.split("-")[0]
        if (core[:1].isupper() and core[1:].replace("-", "").replace("’", "").replace("'", "").islower()
                and head not in PROPER and core not in PROPER):
            part = part.replace(core, core.lower(), 1)
        out.append(part)
    return "/".join(out)


def sentence_case(label: str) -> str:
    """Sentence case a variable label: the first word of the label and of each segment after
    ' -- ', ' - ' or ': ' keeps its capital; other Title-case words are lowercased unless they
    are proper names (PROPER, PHRASES). ALL-CAPS, mixed-case and numbered words are kept.
    A label written as one SHOUTED_SNAKE token (CL_ fields) reads as plain words."""
    s = render_piped(" ".join(label.split()))
    if re.fullmatch(r"[A-Z0-9_]+", s) and "_" in s:
        s = s.replace("_", " ").lower()
    keep = {}
    for i, phrase in enumerate(PHRASES):
        if phrase in s:
            token = f"\x00{i}\x00"
            keep[token] = phrase
            s = s.replace(phrase, token)
    out = []
    for j, piece in enumerate(SEGMENT.split(s)):
        if j % 2:
            out.append(piece)
            continue
        words = piece.split(" ")
        out.append(" ".join(_case_word(w, first=(k == 0 and bool(w)))
                            for k, w in enumerate(words)))
    s = "".join(out)
    for token, phrase in keep.items():
        s = s.replace(token, phrase)
    return s[:1].upper() + s[1:]


def bands(values) -> dict:
    """code -> band in coded order, missing codes out; a band's first letter is raised
    ("selected" -> "Selected"), the rest kept as labeled."""
    out = {}
    for code, band in sorted(values, key=lambda cv: cv[0]):
        b = " ".join(band.replace("’", "'").split())
        if MISSING_BAND.fullmatch(b):
            continue
        out[code] = b[:1].upper() + b[1:]
    return out


def classify(meta: dict, report: Report, skip_names=(), tag: str = "") -> dict[str, BulkVar]:
    """The qualifying variables of one file, keyed by source column."""
    out: dict[str, BulkVar] = {}
    for var, m in meta.items():
        name = f"{tag}{var}"
        label = m.get("label") or ""
        if ADMIN_NAME.fullmatch(var) or ADMIN_LABEL.search(label) or m.get("type") == "string":
            report.skip("admin", name)
            continue
        if var in skip_names:
            report.skip("the7", name)
            continue
        if not m["values"]:
            report.skip("unlabeled", name)
            continue
        options = bands(m["values"])
        n_bands = len(set(options.values()))
        if n_bands < 2:
            report.skip("few", name)
            continue
        if n_bands > MAX_BANDS:
            report.skip("many", name)
            continue
        if any(PIPED.search(b) for b in options.values()):
            report.skip("piped", name)
            continue
        verbatim = " ".join(label.split()) or var
        out[var] = BulkVar(var=var, construct=var.lower(), label=sentence_case(verbatim),
                           definition=verbatim, options=options)
    return out


def the7_vars(year: int) -> set[str]:
    return {item.source_var for item in ces.items_for(year)}


def taken_elsewhere(store: Store, construct: str, var: str) -> bool:
    """True when the id belongs to someone else: a hand-kept harmonized construct, or a
    concordance row (another source's, or the seed's) that does not already carry this CES
    variable."""
    if construct in CONSTRUCTS:
        return True
    found = store.query("SELECT ces_var FROM concordance WHERE construct = ?", [construct])
    if not found:
        return False
    return var not in survey._as_list(found[0][0])


# -- rows ------------------------------------------------------------------------------------

def _post_code(meta_values) -> object | None:
    for code, band in meta_values:
        if band.strip().lower() in ("yes", "took post-election survey"):
            return code
    return None


def _is_post(df: pd.DataFrame, var: str, options: dict, took_post) -> bool:
    """An item only post-election respondents answered."""
    if took_post is None or "tookpost" not in df:
        return False
    answered = df[var].isin(list(options)) & df["tookpost"].notna()
    return bool(answered.any()) and bool((df.loc[answered, "tookpost"] == took_post).all())


def _unlabeled_share(col: pd.Series, meta_values) -> float:
    known = {c for c, _ in meta_values}
    vals = col.dropna()
    if vals.empty:
        return 0.0
    return float((~vals.isin(list(known))).mean())


def var_rows(df: pd.DataFrame, bv: BulkVar, *, weight, latest, version: str, provenance: str,
             note: str, item_text: str, min_n: int, geos=ces.GEOS) -> tuple[list[dict], int]:
    """Toplines for every year in df, breakdowns for the latest year; US and MA. A year
    lists only the bands someone in the national sample gave that year, so a band the
    cumulative file offers in one year (2007's "Neither approve nor disapprove") is not a
    0% in the others. weight is a column name or {year: column}. Returns the rows and the
    count of geography-year toplines dropped under min_n."""
    subgroups = {k: v for k, v in ces.SUBGROUPS.items() if not (bv.var == "pid7" and k == "party")}
    wcols = sorted(set(weight.values())) if isinstance(weight, dict) else [weight]
    narrow = df.loc[df[bv.var].isin(list(bv.options)),
                    [bv.var, "year", "_fips", *wcols, *subgroups.values()]]
    if isinstance(weight, dict):
        narrow = narrow.assign(_wt=_period_weight(narrow, weight))
        wcol, wvar = "_wt", (lambda p, _w=weight: _w[int(p)])
    else:
        wcol, wvar = weight, weight
    given = narrow.groupby("year")[bv.var].unique()
    rows, dropped = [], 0
    for geography, geo_code, place, fips in geos:
        sub = narrow if fips is None else narrow[narrow["_fips"] == fips]
        cells, skipped = [], {}
        for year, ysub in sub.groupby("year"):
            seen = set(given[year])
            options = {c: band for c, band in bv.options.items() if c in seen}
            got, skip = survey.shares(ysub, bv.var, wcol, options,
                                      subgroups if year == latest else {}, min_n=min_n)
            cells += got
            for period, names in skip.items():
                skipped.setdefault(period, []).extend(names)
                dropped += sum(1 for n in names if n.startswith("all="))
        rows += survey.norm_rows(
            cells, skipped, source=ces.SOURCE, source_version=version, geography=geography,
            geo_code=geo_code, place=place, construct=bv.construct, item_text=item_text,
            weight_var=wvar, provenance_url=provenance, note=note,
            period_dates=survey.year_dates)
    return rows, dropped


def _period_weight(df: pd.DataFrame, weight: dict) -> pd.Series:
    out = pd.Series(0.0, index=df.index)
    for period, col in weight.items():
        mask = df["year"] == period
        out[mask] = pd.to_numeric(df.loc[mask, col], errors="coerce").fillna(0.0)
    return out


BULK_NOTE = ("Bulk tier: the label is the file's variable label, not the question wording; "
             "bands are its value labels.")
CUM_SUBGROUP_NOTE = ("Subgroups: sex from gender (standardized); age as given; race_eth puts "
                     "Hispanic first and Middle Eastern with White, as the Census does; educ 1-2 "
                     "HS or less, 3-4 Some college, 5 BA, 6 Grad; party from pid7 with leaners.")


def bulk_version(year: int) -> str:
    return f"CES {year} Common Content, bulk tier"


def year_frame(path: Path, year: int, columns) -> pd.DataFrame:
    base = ["commonweight", "commonpostweight", "vvweight", "tookpost", "birthyr", "gender",
            "gender4", "educ", "race", "hispanic", "inputstate", "pid7"]
    df = ces.read_file(path, list(dict.fromkeys(base + list(columns)))).copy()  # one block per dtype
    df["year"] = year
    ces.add_subgroups(df, year)
    df["_fips"] = df["inputstate"]
    for w in ("commonweight", "commonpostweight", "vvweight"):
        if w in df:
            df[w] = pd.to_numeric(df[w], errors="coerce").fillna(0.0)
    return df


def cumulative_frame(path: Path, columns) -> pd.DataFrame:
    import pyreadstat

    base = ["year", "state", "tookpost", "weight", "weight_post", "gender", "age", "race",
            "hispanic", "educ", "pid7"]
    df, _ = pyreadstat.read_dta(str(path), usecols=list(dict.fromkeys(base + list(columns))))
    df["year"] = df["year"].astype(int)
    df["_sex"] = survey.recode(df["gender"], {1: cat.SEX[0], 2: cat.SEX[1]})
    df["_age"] = survey.age_bucket(df["age"])
    df["_race_eth"] = ces.race_eth(df["race"], df["hispanic"])
    df["_educ"] = survey.recode(df["educ"], ces.EDUC)
    df["_party"] = survey.recode(df["pid7"], ces.PARTY_FROM_PID7)
    df["_fips"] = df["state"]
    for w in ("weight", "weight_post"):
        df[w] = pd.to_numeric(df[w], errors="coerce").fillna(0.0)
    return df


# -- run -------------------------------------------------------------------------------------

def register(store: Store, bv: BulkVar, note: str) -> None:
    store.upsert_concordance({"construct": bv.construct, "label": bv.label,
                              "definition": bv.definition, "ces_var": [bv.var], "notes": note})


def _header(path: Path) -> set[str]:
    if path.suffix.lower() == ".dta":
        import pyreadstat

        _, meta = pyreadstat.read_dta(str(path), metadataonly=True)
        return set(meta.column_names)
    sep = "\t" if path.suffix.lower() == ".tab" else ","
    return set(pd.read_csv(path, nrows=0, sep=sep).columns)


BULK_CONCORDANCE_NOTE = ("CES bulk tier: label and definition are the file's variable label, "
                         "not the question wording.")
CUM_CONCORDANCE_NOTE = ("CES cumulative common content (Kuriwaki, Harvard Dataverse II2DB6), "
                        "harmonized across years; label and definition are the file's variable "
                        "label, not the question wording.")


def run(store: Store, files: dict[int, Path], raw_dir: Path | None = None, download: bool = True,
        min_n: int = MIN_CELL_N, allow_synthetic: bool = False,
        report_path: Path | None = None) -> int:
    d = ces._dir(raw_dir)
    report = Report()
    total = 0

    # The cumulative first: names it serves are not read again from the yearly files.
    cum_path = locate_cumulative(d)
    if cum_path is None and download:
        cum_path = fetch_cumulative(d)
    cum_vars: dict[str, BulkVar] = {}
    cum_meta: dict = {}
    if cum_path is not None:
        survey.refuse_synthetic([cum_path], allow_synthetic)
        cum_meta = stata_meta(cum_path)
        cum_vars = classify(cum_meta, report, tag="cumulative:")
        for v in list(cum_vars):
            if taken_elsewhere(store, cum_vars[v].construct, v):
                report.skip("taken", f"cumulative:{v}")
                del cum_vars[v]
    else:
        report.cumulative = {"status": "not on disk and not fetched"}
    served = {bv.construct for bv in cum_vars.values()}

    # Yearly: labels, qualification, and the latest year each name was asked.
    per_year: dict[int, dict[str, BulkVar]] = {}
    year_meta: dict[int, dict] = {}
    for year in sorted(files):
        meta = load_labels(year, d, download)
        if meta is None:
            report.years[year] = {"status": "no value labels (Stata release not read)"}
            continue
        year_meta[year] = meta
        header = _header(files[year])
        found = classify(meta, report, skip_names=the7_vars(year), tag=f"{year}:")
        for v in list(found):
            reason = ("cumulative" if v.lower() in served else
                      "absent" if v not in header else
                      "taken" if taken_elsewhere(store, found[v].construct, v) else None)
            if reason:
                report.skip(reason, f"{year}:{v}")
                del found[v]
        per_year[year] = found
    latest: dict[str, int] = {}
    for year, found in per_year.items():
        for v in found:
            latest[v] = max(latest.get(v, 0), year)
    orders: dict[str, list[str]] = {}   # latest year's coded order, then bands only earlier years used
    for year, found in sorted(per_year.items(), reverse=True):
        for bv in found.values():
            orders.setdefault(bv.construct, []).extend(bv.options.values())
    for bv in cum_vars.values():
        orders[bv.construct] = list(bv.options.values())

    for year, found in sorted(per_year.items()):
        path = files[year]
        print(f"CES {year} bulk tier: reading {len(found)} variables from {path.name}")
        df = year_frame(path, year, found)
        took = _post_code(year_meta[year].get("tookpost", {}).get("values", []))
        rows: list[dict] = []
        n_vars = n_post = dropped = 0
        for v, bv in found.items():
            if _unlabeled_share(df[v], year_meta[year][v]["values"]) > UNLABELED_LIMIT:
                report.skip("partial", f"{year}:{v}")
                continue
            post = _is_post(df, v, bv.options, took)
            weight = "commonpostweight" if post else "commonweight"
            note = (f"CES {year} common content, {v}; universe: adults asked. Weight {weight}. "
                    f"{BULK_NOTE} {ces.SUBGROUP_NOTE} {survey.BASE_NOTE}")
            got, drop = var_rows(df, bv, weight=weight, latest=latest[v],
                                 version=bulk_version(year), provenance=ces.DATAVERSE[year],
                                 note=note, item_text=bv.definition, min_n=min_n)
            dropped += drop
            if not got:
                report.skip("empty", f"{year}:{v}")
            else:
                # A name asked in several years takes its latest year's label.
                register(store, per_year[latest[v]][v], BULK_CONCORDANCE_NOTE)
                rows += got
                n_vars += 1
                n_post += post
        written = store.upsert_norms(rows, prune=(ces.SOURCE, bulk_version(year)))
        report.years[year] = {"variables": n_vars, "post_wave_items": n_post, "rows": written,
                              "geography_toplines_dropped_under_n": dropped}
        print(f"{bulk_version(year)}: {n_vars} variables, {written} rows")
        total += written
        del df, rows

    if cum_vars:
        version = cumulative_version(cum_path)
        print(f"{version}: reading {len(cum_vars)} variables from {cum_path.name}")
        df = cumulative_frame(cum_path, cum_vars)
        post_years = sorted(int(y) for y, s in df.groupby("year")["weight_post"].sum().items()
                            if s > 0)
        took = _post_code(cum_meta.get("tookpost", {}).get("values", []))
        rows = []
        n_vars = n_post = dropped = 0
        years_seen: set[int] = set()
        for v, bv in cum_vars.items():
            if _unlabeled_share(df[v], cum_meta[v]["values"]) > UNLABELED_LIMIT:
                report.skip("partial", f"cumulative:{v}")
                continue
            asked = sorted(int(y) for y in df.loc[df[v].isin(list(bv.options)), "year"].unique())
            if not asked:
                continue
            post = _is_post(df, v, bv.options, took)
            weight = {y: ("weight_post" if post and y in post_years else "weight") for y in asked}
            wnote = "weight_post where the year carries it, else weight" if post else "weight"
            note = (f"CES cumulative common content (Kuriwaki), {v}; universe: adults asked. "
                    f"Weight {wnote} (year-specific). {BULK_NOTE} {CUM_SUBGROUP_NOTE} "
                    f"{survey.BASE_NOTE}")
            got, drop = var_rows(df[df["year"].isin(asked)], bv, weight=weight, latest=asked[-1],
                                 version=version, provenance=CUMULATIVE_DOI, note=note,
                                 item_text=bv.definition, min_n=min_n)
            dropped += drop
            if not got:
                report.skip("empty", f"cumulative:{v}")
            else:
                register(store, bv, CUM_CONCORDANCE_NOTE)
                rows += got
                n_vars += 1
                n_post += post
                years_seen.update(asked)
        written = store.upsert_norms(rows, prune=(ces.SOURCE, version))
        report.cumulative = {"file": cum_path.name, "variables": n_vars, "post_wave_items": n_post,
                             "rows": written, "years": sorted(years_seen),
                             "post_weight_years": post_years,
                             "geography_toplines_dropped_under_n": dropped}
        print(f"{version}: {n_vars} variables, {written} rows")
        total += written
        del df, rows

    if per_year or cum_vars:
        report.cumulative.setdefault("status", "loaded" if cum_vars else "no qualifying variables")
        bulk.write_response_order(store, ces.SOURCE, orders)   # the export's band order

    out = report_path if report_path is not None else (
        config.ROOT / "reports" / "ces_bulk.json" if raw_dir is None else None)
    if out is not None:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report.as_json(), indent=1, default=str) + "\n", encoding="utf-8")
    return total
