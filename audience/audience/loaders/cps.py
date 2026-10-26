"""CPS November Voting and Registration Supplement, 2016-2024, via the IPUMS CPS API:
turnout and registration for the US and Massachusetts, overall and by sex, age bucket,
race_eth, education and family income, per election year.

IPUMS builds extracts asynchronously. The extract is defined once below; its sha256 names
the cache directory raw/ipums/<hash>/. The loader:
  1. uses raw/ipums/<hash>/*.csv.gz if it is there (no API call);
  2. else, if raw/ipums/<hash>/submitted.json records an extract number, polls that extract
     (it never resubmits a definition it has already submitted);
  3. else submits the definition, records the number, polls until the extract is built,
     and downloads it.
A poll that outlasts --wait-minutes leaves the extract number in place; rerun to resume.
Without IPUMS_API_KEY in audience/.env (and no cached file) it prints how to get a key and
writes nothing.

Rates follow the Census Bureau's P20 convention. The base is every U.S. citizen 18 and over
in the civilian population. Refused, don't know, no response and supplement non-interviews
stay in the base and are reported as their own option, "No response", so "Voted" is the
P20 "percent voted (citizen)". Respondents who voted count as registered (the supplement
does not ask them). Turnout among those who answered is Voted / (Voted + Did not vote).
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from .. import categories as cat
from .. import config
from ..db import Store
from .. import survey
from ..survey import MIN_CELL_N

SOURCE = "CPS"
SOURCE_VERSION = "CPS November Voting and Registration Supplement 2016-2024 (IPUMS CPS)"
API = "https://api.ipums.org"
IPUMS_URL = "https://cps.ipums.org/cps/"
YEARS = (2016, 2018, 2020, 2022, 2024)

# The brief's ten variables plus CITIZEN (the P20 base is citizens; VOTED alone cannot
# separate non-citizens from supplement non-interviews) and POPSTAT (the P20 universe is
# the civilian population; POPSTAT 1 = adult civilian).
VARIABLES = ("VOSUPPWT", "VOTED", "VOREG", "AGE", "SEX", "RACE", "HISPAN", "EDUC", "FAMINC",
             "STATEFIP", "CITIZEN", "POPSTAT")

EXTRACT = {
    "description": "PAX audience database: CPS November voting supplements 2016-2024",
    "dataStructure": {"rectangular": {"on": "P"}},
    "dataFormat": "csv",
    "samples": {f"cps{y}_11s": {} for y in YEARS},
    "variables": {v: {} for v in VARIABLES},
}

KEY_INSTRUCTIONS = """\
IPUMS_API_KEY is not set, and no CPS extract is cached under {cache}/.
Register (free) at https://account.ipums.org/user/new and request IPUMS CPS access, then
create an API key at https://account.ipums.org/api_keys and add this line to audience/.env:

    IPUMS_API_KEY=<your key>

and rerun: python -m audience.load cps
(IPUMS builds the extract in a few minutes; the loader waits for it.) No rows were written."""


def extract_hash(definition: dict = EXTRACT) -> str:
    blob = json.dumps(definition, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


def cache_dir(raw_dir: Path | None = None) -> Path:
    base = Path(raw_dir) if raw_dir is not None else config.RAW / "ipums"
    return base / extract_hash()


def cached_file(raw_dir: Path | None = None) -> Path | None:
    d = cache_dir(raw_dir)
    files = sorted(d.glob("*.csv.gz")) + sorted(d.glob("*.csv"))
    return files[0] if files else None


# -- IPUMS API ---------------------------------------------------------------------------

def _headers(key: str) -> dict:
    return {"Authorization": key, "Content-Type": "application/json"}


def submit(key: str, session=None) -> int:
    import requests

    http = session or requests
    resp = http.post(f"{API}/extracts?collection=cps&version=2", headers=_headers(key),
                     data=json.dumps(EXTRACT), timeout=60)
    resp.raise_for_status()
    return int(resp.json()["number"])


def status(key: str, number: int, session=None) -> dict:
    import requests

    http = session or requests
    resp = http.get(f"{API}/extracts/{number}?collection=cps&version=2",
                    headers=_headers(key), timeout=60)
    resp.raise_for_status()
    return resp.json()


def download(key: str, url: str, target: Path, session=None) -> Path:
    import requests

    http = session or requests
    with http.get(url, headers={"Authorization": key}, stream=True, timeout=600) as resp:
        resp.raise_for_status()
        tmp = target.with_suffix(target.suffix + ".part")
        with open(tmp, "wb") as f:
            for chunk in resp.iter_content(1 << 20):
                f.write(chunk)
    tmp.rename(target)
    return target


def fetch(key: str, raw_dir: Path | None = None, wait_minutes: float = 60,
          poll_seconds: float = 30, session=None) -> Path | None:
    """Submit (once) or resume the extract, wait for it, download it. None if not ready."""
    d = cache_dir(raw_dir)
    d.mkdir(parents=True, exist_ok=True)
    record = d / "submitted.json"
    if record.exists():
        number = json.loads(record.read_text())["number"]
        print(f"resuming IPUMS CPS extract {number}")
    else:
        number = submit(key, session)
        record.write_text(json.dumps({"number": number, "definition": EXTRACT,
                                      "submitted_at": dt.datetime.now().isoformat()}, indent=1))
        print(f"submitted IPUMS CPS extract {number}")
    deadline = time.monotonic() + wait_minutes * 60
    while True:
        info = status(key, number, session)
        state = info.get("status")
        if state == "completed":
            url = info["downloadLinks"]["data"]["url"]
            target = d / f"cps_{extract_hash()}.csv.gz"
            print(f"downloading extract {number}")
            return download(key, url, target, session)
        if state in ("failed", "canceled"):
            record.unlink()
            raise RuntimeError(f"IPUMS extract {number} {state}; rerun to submit again")
        if time.monotonic() > deadline:
            print(f"extract {number} is still {state}; rerun later to resume. No rows were written.")
            return None
        print(f"  extract {number}: {state}")
        time.sleep(poll_seconds)


def read_file(path: Path) -> pd.DataFrame:
    wanted = {"YEAR", *VARIABLES}
    return pd.read_csv(path, usecols=lambda c: c.upper() in wanted, low_memory=False)\
             .rename(columns=str.upper)


# -- recodes and rates ---------------------------------------------------------------------

def race_eth(race: pd.Series, hispan: pd.Series) -> pd.Series:
    """HISPAN 100-612 -> Hispanic; else RACE 100 White, 200 Black, 650-652 Asian or Pacific
    Islander, other codes (300, 700, 801-830) Other or multiracial; 999 blank -> NaN."""
    out = pd.Series(np.nan, index=race.index, dtype=object)
    out[race == 100] = cat.RACE_ETH[1]
    out[race == 200] = cat.RACE_ETH[2]
    out[race.isin([650, 651, 652])] = cat.RACE_ETH[3]
    out[race.isin([300, 700]) | race.between(801, 830)] = cat.RACE_ETH[4]
    out[hispan.between(100, 612)] = cat.RACE_ETH[0]
    return out


def education_4(educ: pd.Series) -> pd.Series:
    """EDUC 002-073 HS or less; 080-100 Some college (incl. associate's); 110-111 BA;
    120-125 Grad; 000/001 NIU and 999 missing -> NaN."""
    out = pd.Series(np.nan, index=educ.index, dtype=object)
    out[educ.between(2, 73)] = cat.EDUCATION_4[0]
    out[educ.between(80, 100)] = cat.EDUCATION_4[1]
    out[educ.between(110, 111)] = cat.EDUCATION_4[2]
    out[educ.between(120, 125)] = cat.EDUCATION_4[3]
    return out


def income_bucket(faminc: pd.Series) -> pd.Series:
    """FAMINC bands to the six harmonized bands. Open-ended old codes that straddle a band
    edge (800 '$50,000 and over', 840 '$75,000 and over') and 995-999 -> NaN."""
    b = cat.HH_INCOME_BUCKET
    out = pd.Series(np.nan, index=faminc.index, dtype=object)
    out[faminc.between(100, 600)] = b[0]
    out[faminc.between(700, 740)] = b[1]
    out[faminc.between(810, 830)] = b[2]
    out[faminc == 841] = b[3]
    out[faminc == 842] = b[4]
    out[faminc == 843] = b[5]
    return out


TURNOUT = {"Voted": "Voted", "Did not vote": "Did not vote", "No response": "No response"}
REGISTRATION = {"Registered": "Registered", "Not registered": "Not registered",
                "No response": "No response"}


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    """Restrict to the P20 universe and build the status and subgroup columns."""
    df = df.rename(columns=str.upper)
    citizen = df["CITIZEN"].isin([1, 2, 3, 4])
    adult = df["AGE"] >= 18
    civilian = df["POPSTAT"] == 1 if "POPSTAT" in df else True
    d = df[citizen & adult & civilian & (df["VOSUPPWT"] > 0)].copy()
    d["year"] = d["YEAR"].astype(int)
    voted = d["VOTED"] == 2
    d["_turnout"] = np.where(voted, "Voted", np.where(d["VOTED"] == 1, "Did not vote", "No response"))
    d["_registration"] = np.where(voted | (d["VOREG"] == 2), "Registered",
                                  np.where(d["VOREG"] == 1, "Not registered", "No response"))
    d["_sex"] = survey.recode(d["SEX"], {1: cat.SEX[0], 2: cat.SEX[1]})
    d["_age"] = survey.age_bucket(d["AGE"])
    d["_race_eth"] = race_eth(d["RACE"], d["HISPAN"])
    d["_educ"] = education_4(d["EDUC"])
    d["_income"] = income_bucket(d["FAMINC"])
    return d


SUBGROUPS = {"sex": "_sex", "age": "_age", "race_eth": "_race_eth", "educ": "_educ",
             "income": "_income"}
GEOS = (("US", "US", "United States", None), ("STATE", "25", "Massachusetts", 25))

NOTE = ("CPS November supplement via IPUMS CPS ({extract}). Census P20 convention: the base "
        "is citizens 18+ in the civilian population, weighted by VOSUPPWT; refused, don't know, "
        "no response and supplement non-interviews stay in the base as 'No response', so "
        "'Voted' matches the P20 percent voted (citizen). Those who voted count as registered. "
        "count rows are weighted persons. n is the unweighted base. se uses the Kish effective n "
        "(the CPS design effect is ignored); moe is 1.645 x se. income is family income "
        "(FAMINC); race_eth puts Hispanic first.")

# PES1 and PES2 as printed in the Census technical documentation (cpsnov20.pdf, 2020); the
# date fill changes by year.
ITEM_TEXT = {
    "turnout": "In any election, some people are not able to vote because they are sick or busy "
               "or have some other reason, and others do not want to vote. Did (you/name) vote "
               "in the election held on Tuesday, November (date)?",
    "registration": "(Were you/Was name) registered to vote in the November (date) election?",
}


def period_dates(year) -> tuple[dt.date, dt.date]:
    y = int(year)
    return dt.date(y, 11, 1), dt.date(y, 11, 30)


def build_rows(df: pd.DataFrame, extract_label: str = "cached extract",
               min_n: int = MIN_CELL_N) -> list[dict]:
    d = prepare(df)
    rows: list[dict] = []
    for geography, geo_code, place, fips in GEOS:
        sub = d if fips is None else d[d["STATEFIP"] == fips]
        for construct, col, options, var in (("turnout", "_turnout", TURNOUT, "VOTED"),
                                             ("registration", "_registration", REGISTRATION,
                                              "VOREG, VOTED")):
            cells, skipped = survey.shares(sub, col, "VOSUPPWT", options, SUBGROUPS,
                                           min_n=min_n, with_counts=True)
            rows += survey.norm_rows(
                cells, skipped, source=SOURCE, source_version=SOURCE_VERSION,
                geography=geography, geo_code=geo_code, place=place, construct=construct,
                item_text=ITEM_TEXT[construct], weight_var="VOSUPPWT",
                provenance_url=IPUMS_URL, note=NOTE.format(extract=extract_label),
                period_dates=period_dates, with_counts=True)
    return rows


def write_concordance(store: Store) -> None:
    survey.merge_concordance(
        store, "turnout", "Turnout", "Voted in the given election.", cps_var="VOTED",
        note="CPS VOTED, Census P20 base (citizens 18+, nonresponse kept as 'No response').")
    survey.merge_concordance(
        store, "registration", "Voter registration", "Registered to vote for the given election.",
        cps_var="VOREG",
        note="CPS VOREG is asked only of non-voters; voters count as registered.")


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        allow_synthetic: bool = False, min_n: int = MIN_CELL_N, wait_minutes: float = 60) -> int:
    write_concordance(store)  # the crosswalk is recorded even before the data arrives
    path = None if refresh else cached_file(raw_dir)
    label = f"extract definition {extract_hash()}"
    if path is None:
        key = config.env("IPUMS_API_KEY")
        if not key:
            print(KEY_INSTRUCTIONS.format(cache=cache_dir(raw_dir)))
            return 0
        path = fetch(key, raw_dir, wait_minutes=wait_minutes)
        if path is None:
            return 0
    record = cache_dir(raw_dir) / "submitted.json"
    if record.exists():
        label = f"extract {json.loads(record.read_text())['number']}, definition {extract_hash()}"
    survey.refuse_synthetic([path], allow_synthetic)
    rows = build_rows(read_file(path), label, min_n=min_n)
    written = store.upsert_norms(rows, prune=(SOURCE, SOURCE_VERSION))
    store.touch_source(SOURCE)
    years = sorted({r["period_start"].year for r in rows})
    print(f"{SOURCE_VERSION}: {written} rows, US and MA, {years}")
    return written
