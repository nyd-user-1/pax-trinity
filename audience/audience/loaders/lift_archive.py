"""The lift dataset: ad-level persuasion effects from the replication archive of Hewitt,
Broockman, Coppock et al., "How Experiments Help Campaigns Persuade Voters: Evidence from a
Large Archive of Campaigns' Own Experiments" (APSR 2024), doi:10.7910/DVN/LBPSSV.

What the archive holds (replication_archive.zip, CC0): R scripts, two appendices, and
output/processed_data/*.RDS. The raw survey exports are not posted. The files read here:

  regression_ates.RDS  one row per study x ad x outcome: the ad's effect against the study's
                       placebo, from lm_robust with the study's pre-treatment covariates
                       (estimate, std.error, conf.low/high, p.value, n_obs = ad-arm n)
  studies.RDS          one row per study (146): cycle, race level, states, test date,
                       days until the election, total n, number of ads
  tagging_2018.RDS,    coders' mean ratings of each ad's features (tone, primary focus,
  tagging_2020.RDS     race level for 2018 ads)

Outcomes (definitions.R): favorability and vote choice are indices, the weighted mean of a
study's 0-10 questions (negative-direction items reversed) times 10, so 0-100;
votechoice_dichotomized recodes vote choice to 0 / 50 / 100 around its midpoint. Effects
are in points on those scales; for the dichotomized outcome they are percentage points.
There is no turnout outcome in the archive.

One ad was tested in two studies, so each row's response_option is "<ad id> (study <study
id>)": the archive identifies an effect by the pair.
"""

from __future__ import annotations

import datetime as dt
import zipfile
from pathlib import Path

import pandas as pd

from .. import config
from ..constructs import CONSTRUCTS
from ..db import Store
from .. import survey
from ..moe import Z90

SOURCE = "LIFT_ARCHIVE"
SOURCE_VERSION = "Hewitt et al. 2024 replication archive (doi:10.7910/DVN/LBPSSV)"
DOI_URL = "https://doi.org/10.7910/DVN/LBPSSV"
DATA_URL = "https://dataverse.harvard.edu/api/access/datafile/7609590"
ZIP_NAME = "replication_archive.zip"

CONSTRUCT_FOR = {
    "favorability": "lift_favorability",
    "votechoice": "lift_vote_choice",
    "votechoice_dichotomized": "lift_vote_choice_dichotomized",
}
ITEM_TEXT = {
    "favorability": "Favorability: weighted mean of the study's candidate-favorability "
                    "questions, each 0-10 with negative-direction items reversed, times 10 (0-100)",
    "votechoice": "Vote choice: weighted mean of the study's vote-choice questions, each 0-10 "
                  "with negative-direction items reversed, times 10 (0-100)",
    "votechoice_dichotomized": "Vote choice (dichotomized): the vote-choice index recoded "
                               "0 below its midpoint, 50 at it, 100 above it",
}
UNITS = {"favorability": "points on the 0-100 index", "votechoice": "points on the 0-100 index",
         "votechoice_dichotomized": "percentage points"}

INSTRUCTIONS = f"""\
The lift dataset is not under {{raw}}/ and could not be downloaded.
It is CC0 on Harvard Dataverse with no login ({DOI_URL}). Download

    {DATA_URL}

(replication_archive.zip, about 270 MB) into audience/raw/lift_archive/, then rerun:
python -m audience.load lift_archive
No rows were written."""

CONCORDANCE_NOTE = (
    "LIFT_ARCHIVE: forced-exposure online survey-experiment estimates from campaigns' own "
    "tests of their ads, 2018 and 2020 cycles (146 studies, 617 ads, 51 campaigns), each ad "
    "against its study's placebo; Hewitt, Broockman, Coppock et al., APSR 2024.")


def _dir(raw_dir: Path | None) -> Path:
    return Path(raw_dir) if raw_dir is not None else config.RAW / "lift_archive"


def processed_dir(raw_dir: Path | None = None) -> Path | None:
    """The archive's output/processed_data/, unzipping the cached zip if needed."""
    d = _dir(raw_dir)
    found = sorted(d.rglob("output/processed_data/regression_ates.RDS")) if d.exists() else []
    if found:
        return found[0].parent
    z = d / ZIP_NAME
    if z.exists():
        with zipfile.ZipFile(z) as zf:
            members = [m for m in zf.namelist()
                       if "processed_data/" in m and not m.startswith("__MACOSX")
                       and Path(m).name in ("regression_ates.RDS", "studies.RDS",
                                            "tagging_2018.RDS", "tagging_2020.RDS",
                                            "responses.RDS")]
            zf.extractall(d, members=members)
        return processed_dir(raw_dir) if members else None
    return None


def fetch(raw_dir: Path | None = None) -> Path | None:
    import requests

    d = _dir(raw_dir)
    d.mkdir(parents=True, exist_ok=True)
    target = d / ZIP_NAME
    print(f"downloading {DATA_URL}")
    try:
        with requests.get(DATA_URL, stream=True, timeout=600) as resp:
            resp.raise_for_status()
            tmp = target.with_suffix(".part")
            with open(tmp, "wb") as f:
                for chunk in resp.iter_content(1 << 20):
                    f.write(chunk)
        if not zipfile.is_zipfile(tmp):
            raise RuntimeError("the download is not a zip")
        tmp.rename(target)
    except Exception as exc:
        print(f"download failed: {exc}")
        return None
    return processed_dir(raw_dir)


def read_frames(pdir: Path) -> dict[str, pd.DataFrame]:
    import pyreadr

    out = {}
    for name in ("regression_ates", "studies", "tagging_2018", "tagging_2020"):
        out[name] = pyreadr.read_r(str(pdir / f"{name}.RDS"))[None]
    return out


# -- rows --------------------------------------------------------------------------------

def _argmax_label(row: pd.Series, columns: dict[str, str]) -> str | None:
    vals = {label: row.get(col) for col, label in columns.items() if pd.notna(row.get(col))}
    if not vals:
        return None
    label, value = max(vals.items(), key=lambda kv: kv[1])
    return label if value >= 0.5 else None


TONE = {"tone_positive": "positive", "tone_negative": "negative", "tone_contrast": "contrast"}
FOCUS = {"primary_focus_candidate": "candidate", "primary_focus_issues": "issues",
         "primary_focus_neither": "neither"}


def ad_features(tagging: pd.DataFrame) -> pd.DataFrame:
    """content_id -> tone, focus, race_level (2018 tagging only), from coders' mean ratings:
    a label is given when its mean rating is the largest and at least 0.5."""
    t = tagging.copy()
    t["tone"] = t.apply(lambda r: _argmax_label(r, TONE), axis=1)
    t["focus"] = t.apply(lambda r: _argmax_label(r, FOCUS), axis=1)
    if "race_level" not in t:
        t["race_level"] = None
    return t[["content_id", "tone", "focus", "race_level"]].rename(
        columns={"race_level": "ad_race_level"})


def _fmt(x, digits=1):
    return "?" if pd.isna(x) else f"{x:.{digits}f}"


def build_rows(frames: dict[str, pd.DataFrame]) -> list[dict]:
    ates = frames["regression_ates"].rename(columns={
        "std.error": "se", "conf.low": "ci_lo", "conf.high": "ci_hi", "p.value": "p"})
    studies = frames["studies"]
    features = pd.concat([ad_features(frames["tagging_2018"]), ad_features(frames["tagging_2020"])],
                         ignore_index=True).drop_duplicates("content_id")
    m = ates.merge(studies, on="study_id", how="left", validate="many_to_one")
    m = m.merge(features, on="content_id", how="left", validate="many_to_one")
    unknown = sorted(set(m["outcome"]) - set(CONSTRUCT_FOR))
    if unknown:
        raise RuntimeError(f"outcomes not mapped to a lift construct: {unknown}")
    if m["dataset_year"].isna().any():
        raise RuntimeError("effects whose study has no cycle in studies.RDS")
    rows = []
    for r in m.itertuples(index=False):
        cycle = int(r.dataset_year)
        race = r.race_level if isinstance(r.race_level, str) else r.ad_race_level
        states = "national (50 states)" if r.n_states == 50 else (r.states if isinstance(r.states, str) else "?")
        features_txt = ", ".join(x for x in (
            f"race level {race}" if isinstance(race, str) else None,
            f"tone {r.tone}" if isinstance(r.tone, str) else None,
            f"focus {r.focus}" if isinstance(r.focus, str) else None) if x)
        note = (
            f"United States. Ad-level effect from the replication archive of Hewitt, Broockman, "
            f"Coppock et al. (APSR 2024), output/processed_data/regression_ates.RDS: "
            f"{r.outcome_name}, ad arm minus the study's placebo, in {UNITS[r.outcome]}, from "
            f"lm_robust with the study's pre-treatment covariates; a forced-exposure online "
            f"survey experiment run by the campaign. Study {r.study_id}: {cycle} cycle "
            f"({r.dataset} dataset), states {states}, tested {r.date} "
            f"({_fmt(r.days_until_election, 0)} days before the election), study n "
            f"{r.n_responses_study}, {r.n_treatments} ads. Ad arm n {r.n_obs}; published 95% CI "
            f"[{_fmt(r.ci_lo, 2)}, {_fmt(r.ci_hi, 2)}], p = {_fmt(r.p, 3)}."
            + (f" Coded features: {features_txt}." if features_txt else "")
            + " moe is 1.645 x the published se.")
        rows.append(dict(
            source=SOURCE, source_version=SOURCE_VERSION, geography="US", geo_code="US",
            period_start=dt.date(cycle, 1, 1), period_end=dt.date(cycle, 12, 31),
            construct=CONSTRUCT_FOR[r.outcome], item_text=ITEM_TEXT[r.outcome],
            response_option=f"{r.content_id} (study {r.study_id})",
            subgroup_dim="all", subgroup_value="all",
            estimate=round(float(r.estimate), 6), estimate_type="lift_pp",
            n=int(r.n_obs), se=round(float(r.se), 6), moe=round(Z90 * float(r.se), 6),
            weight_var=None, provenance_url=DOI_URL, provenance_note=note,
        ))
    return rows


def write_concordance(store: Store) -> None:
    for outcome, construct in CONSTRUCT_FOR.items():
        label, definition = CONSTRUCTS[construct]
        survey.merge_concordance(store, construct, label, definition, note=CONCORDANCE_NOTE)


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None) -> int:
    write_concordance(store)
    pdir = None if refresh else processed_dir(raw_dir)
    if pdir is None:
        pdir = fetch(raw_dir)
    if pdir is None:
        print(INSTRUCTIONS.format(raw=_dir(raw_dir)))
        return 0
    rows = build_rows(read_frames(pdir))
    written = store.upsert_norms(rows, prune=(SOURCE, SOURCE_VERSION))
    store.touch_source(SOURCE)
    ads = {r["response_option"].split(" ", 1)[0] for r in rows}
    print(f"{SOURCE_VERSION}: {written} ad-level effects, {len(ads)} ads, "
          f"{len({r['response_option'] for r in rows})} study x ad pairs")
    return written
