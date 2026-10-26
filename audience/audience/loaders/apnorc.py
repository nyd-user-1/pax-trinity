"""AP-NORC Campaign and Election poll, May 12-15 2016, public-use file: subgroup shares of
Q8, the fair-way-to-select-a-nominee item, by sex, age group and party.

The zip (codebook PDF plus CSV, Stata, SAS and SPSS copies) is downloaded once into
raw/apnorc/. Q8 in the codebook: "With the process of primaries and caucuses, the Republican
and Democratic Parties determine which candidate will be their party's nominee. Which do you
think is more fair way to select a nominee?" (1) Open primaries and caucuses, (2) Closed
primaries and caucuses. Weight: finalwt.

The rows join the seed's topline rows for this poll: same construct, item_text and response
labels, read from audience/seed/open_primary_polls.csv. The topline's base is every
respondent, so these cells keep skipped or refused answers in the base as their own option.
"""

from __future__ import annotations

import csv
import datetime as dt
import re
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

from .. import config
from .. import survey
from ..db import Store
from ..survey import MIN_CELL_N, PARTY_3

SOURCE = "POLL"
SOURCE_VERSION = "AP-NORC 2016-05 PUF"
SEED_VERSION = "AP-NORC 2016-05"   # the seed's topline rows for this poll
CONSTRUCT = "open_primaries_support"
ZIP_URL = ("https://apnorc.org/wp-content/uploads/2020/02/"
           "AP-NORC-Campaign-and-Election-May-2016-PUF.zip")
DATA_FILE = "may_2016_omnibus.csv"
PERIOD = (dt.date(2016, 5, 12), dt.date(2016, 5, 15))
NO_ANSWER = "Skipped or refused"

# Age groups as AGEGRP codes them. Only 18-29 and 65+ match the harmonized age buckets, so
# they are stored under their own dimension, age_5, not age.
AGEGRP = {1: "18-29", 2: "30-39", 3: "40-49", 4: "50-64", 5: "65+"}
GENDER = {1: "Male", 2: "Female"}

NOTE = ("AP-NORC Center for Public Affairs Research, AmeriSpeak omnibus, May 12-15 2016, "
        "public-use file {file}, item Q8, weight finalwt. The base is every respondent in the "
        "cell, with skipped or refused kept as its own option, as in the published topline. "
        "party counts independents who lean (INDEP) with that party; age_5 is AGEGRP's five "
        "groups. n is the unweighted base; se uses the Kish effective n (the panel's design "
        "effect is ignored); moe is 1.645 x se.")

INSTRUCTIONS = """\
The AP-NORC May 2016 public-use file is not under {raw}/ and could not be downloaded:

    {url}

Save the zip into audience/raw/apnorc/, then rerun: python -m audience.load apnorc
No rows were written."""


def _dir(raw_dir: Path | None) -> Path:
    return Path(raw_dir) if raw_dir is not None else config.RAW / "apnorc"


def locate(raw_dir: Path | None = None) -> Path | None:
    d = _dir(raw_dir)
    direct = sorted(d.glob("*may_2016_omnibus*.csv")) if d.exists() else []
    if direct:
        return direct[0]
    for z in sorted(d.glob("*.zip")) if d.exists() else []:
        with zipfile.ZipFile(z) as zf:
            if DATA_FILE in zf.namelist():
                zf.extractall(d)
                return d / DATA_FILE
    return None


def fetch(raw_dir: Path | None = None) -> Path | None:
    import requests

    d = _dir(raw_dir)
    d.mkdir(parents=True, exist_ok=True)
    target = d / ZIP_URL.rsplit("/", 1)[1]
    print(f"downloading {ZIP_URL}")
    try:
        resp = requests.get(ZIP_URL, timeout=120, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code in (403, 406):
            from curl_cffi import requests as creq

            resp = creq.get(ZIP_URL, impersonate="chrome", timeout=120)
        resp.raise_for_status()
        if not resp.content.startswith(b"PK"):
            print("the download is not a zip file")
            return None
        target.write_bytes(resp.content)
    except Exception as exc:  # network or HTTP failure, or curl_cffi missing
        print(f"download failed: {exc}")
        return None
    return locate(raw_dir)


def _code(series: pd.Series) -> pd.Series:
    """'(1) Open primaries and caucuses' -> 1; '-99', blank -> NaN."""
    return pd.to_numeric(series.astype("string").str.extract(r"^\((\d+)\)", expand=False),
                         errors="coerce")


def read_file(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, usecols=["su_id", "finalwt", "Q8", "party", "indep", "AGEGRP",
                                    "GENDER"], encoding="cp1252", dtype=str)
    out = pd.DataFrame({"su_id": df["su_id"].astype(int),
                        "finalwt": pd.to_numeric(df["finalwt"])})
    for col in ("Q8", "party", "indep", "AGEGRP", "GENDER"):
        out[col] = _code(df[col])
    return out


def party_3(party: pd.Series, indep: pd.Series) -> pd.Series:
    """PARTY 1 Democrat, 2 Republican; 3 Independent or 4 None of these, then INDEP 1 lean
    Democrat, 2 lean Republican, 3 don't lean. Leaners join their party; non-leaners are
    Independent; no answer to either -> NaN."""
    out = pd.Series(np.nan, index=party.index, dtype=object)
    out[(party == 1) | (party.isin([3, 4]) & (indep == 1))] = PARTY_3[0]
    out[(party == 2) | (party.isin([3, 4]) & (indep == 2))] = PARTY_3[2]
    out[party.isin([3, 4]) & (indep == 3)] = PARTY_3[1]
    return out


def seed_topline(seed: Path) -> tuple[str, dict[int, str]] | None:
    """The seed's item_text and response labels for this poll's Q8 rows."""
    with open(seed, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f)
                if r["source_version"] == SEED_VERSION and r["construct"] == CONSTRUCT]
    if not rows:
        return None
    labels = {r["response_option"] for r in rows}
    open_label = next((l for l in labels if l.lower().startswith("open")), None)
    closed_label = next((l for l in labels if l.lower().startswith("closed")), None)
    if not (open_label and closed_label):
        return None
    return rows[0]["item_text"], {1: open_label, 2: closed_label}


def prepare(df: pd.DataFrame, labels: dict[int, str]) -> pd.DataFrame:
    d = df[df["finalwt"] > 0].copy()
    d["year"] = 2016
    d["_q8"] = d["Q8"].map(labels).astype(object).where(d["Q8"].isin(list(labels)), NO_ANSWER)
    d["_sex"] = survey.recode(d["GENDER"], GENDER)
    d["_age_5"] = survey.recode(d["AGEGRP"], AGEGRP)
    d["_party"] = party_3(d["party"], d["indep"])
    return d


SUBGROUPS = {"sex": "_sex", "age_5": "_age_5", "party": "_party"}


def build_rows(df: pd.DataFrame, item_text: str, labels: dict[int, str],
               min_n: int = MIN_CELL_N, file_name: str = DATA_FILE) -> list[dict]:
    d = prepare(df, labels)
    options = {labels[1]: labels[1], labels[2]: labels[2], NO_ANSWER: NO_ANSWER}
    cells, skipped = survey.shares(d, "_q8", "finalwt", options, SUBGROUPS, min_n=min_n)
    cells = [c for c in cells if c.dim != "all"]   # the topline is the seed's
    return survey.norm_rows(
        cells, skipped, source=SOURCE, source_version=SOURCE_VERSION, geography="US",
        geo_code="US", place="United States", construct=CONSTRUCT, item_text=item_text,
        weight_var="finalwt", provenance_url=ZIP_URL, note=NOTE.format(file=file_name),
        period_dates=lambda _y: PERIOD)


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        seed: Path | None = None, download: bool | None = None, min_n: int = MIN_CELL_N) -> int:
    """download defaults to True for the real raw/apnorc/ and False when a test passes raw_dir."""
    from .polls import SEED

    download = raw_dir is None if download is None else download

    topline = seed_topline(Path(seed) if seed is not None else SEED)
    if topline is None:
        print(f"The seed has no {SEED_VERSION} rows for {CONSTRUCT} to attach the "
              "subgroups to. No rows were written.")
        return 0
    item_text, labels = topline
    path = None if refresh else locate(raw_dir)
    if path is None and download:
        path = fetch(raw_dir)
    if path is None:
        print(INSTRUCTIONS.format(raw=_dir(raw_dir), url=ZIP_URL))
        return 0
    df = read_file(path)
    if df["Q8"].notna().sum() == 0:
        print(f"{path.name} has no Q8 answers; the item could not be located. No rows were written.")
        return 0
    survey.merge_concordance(store, CONSTRUCT, "Support for open primaries",
                             "Support for primaries open to all voters, as asked in a poll or "
                             "decided by a ballot measure; item_text gives each wording.",
                             note="AP-NORC May 2016 public-use file: Q8, weight finalwt.")
    rows = build_rows(df, item_text, labels, min_n=min_n, file_name=path.name)
    written = store.upsert_norms(rows, prune=(SOURCE, SOURCE_VERSION))
    store.touch_source(SOURCE)
    print(f"{SOURCE_VERSION}: {written} rows, Q8 by sex, age_5 and party (US)")
    return written
