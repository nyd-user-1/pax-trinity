"""The lift archive's ads, described: python -m audience.lift_ads

Writes public/lift/archive-ads.json for /lift: one entry per ad-in-a-study (the export's response_option,
"<ad id> (study <study id>)"), from the replication archive's studies.RDS and the coders' tagging files
(tagging_2018.RDS, tagging_2020.RDS; Hewitt, Broockman, Coppock et al., APSR 2024). The campaigns are
anonymized in the archive and stay so: an ad is described by what the archive records about it, never named.

  { "<option>": { "state", "race", "date", "cycle", "ad", "ads", "tone", "focus",
                  "traits": [trait keys rated present], "emotions": {emotion: rating},
                  "control": {construct: [placebo mean, placebo n]} } }

control is the ad's test's placebo group on each outcome, from the archive's respondent-level file
(responses.RDS: treat 0, drop 0), so a lift reads from where it started; tests/test_lift_archive.py checks one
ad's published effect against the same file.

A trait is present where the coders' mean rating is at least 0.5, the rule loaders/lift_archive.py uses for
tone and focus. Emotion ratings are kept as rated (0-1, rounded to 2 places) for the Emotional appeal column.
"""

from __future__ import annotations

import json
import sys

import pandas as pd

from . import config
from .loaders.lift_archive import FOCUS, TONE, _argmax_label, processed_dir, read_frames

OUT = config.ROOT.parent / "public" / "lift" / "archive-ads.json"

# The traits /lift reads, by their tagging columns, each present at a mean rating of 0.5: those coded in both
# cycles (a 2020-only code would read absent on every 2018 ad).
TRAITS = {
    "policy_facts": "policy_facts", "candidate_facts": "candidate_facts", "mentions_party": "mentions_party",
    "mentions_trump": "mentions_trump", "cites_source": "fact_cite_yes", "asks_for_vote": "explicit_vote_for",
    "issue_healthcare": "issue_healthcare", "issue_taxes": "issue_taxes", "high_production": "production_value_high",
    "name_calling": "technique_neg_name", "positive_labels": "technique_pos_name",
    "testimonial": ["technique_pos_testimonial", "technique_neg_testimonial"],
    "transfer": ["technique_pos_transfer", "technique_neg_transfer"], "plain_folks": "technique_plain_folks",
    "messenger_female": "messenger_female", "messenger_male": "messenger_male", "messenger_black": "messenger_black",
    "messenger_white": "messenger_white", "messenger_asian": "messenger_asian", "messenger_latinx": "messenger_latinx",
    "messenger_young_adult": "messenger_young_adult", "messenger_middle_aged": "messenger_middle_aged",
    "messenger_elderly": "messenger_elderly", "messenger_children": "messenger_children",
    "messenger_politician": "messenger_politician", "messenger_celebrity": "messenger_celebrity",
    "messenger_veteran": "messenger_veteran",
}
OUTCOMES = {"favorability": "lift_favorability", "votechoice": "lift_vote_choice", "votechoice_dichotomized": "lift_vote_choice_dichotomized"}
EMOTIONS = ["anger", "disgust", "enthusiasm", "fear", "humor", "pride", "sadness", "somber"]


def _present(row: pd.Series, cols) -> bool:
    cols = cols if isinstance(cols, list) else [cols]
    return any(pd.notna(row.get(c)) and row.get(c) >= 0.5 for c in cols)


def build() -> dict:
    pdir = processed_dir()
    if pdir is None:
        raise SystemExit("The lift archive is not under audience/raw/lift_archive; run python -m audience.load lift_archive first.")
    frames = read_frames(pdir)
    ates, studies = frames["regression_ates"], frames["studies"].set_index("study_id")
    tagging = pd.concat([frames["tagging_2018"], frames["tagging_2020"]], ignore_index=True).drop_duplicates("content_id").set_index("content_id")
    # Each test's placebo group on each outcome: the respondents shown the placebo (treat 0) and kept (drop 0).
    import pyreadr

    resp = pyreadr.read_r(str(pdir / "responses.RDS"))[None]
    placebo = resp[(resp["treat"] == 0) & (resp["drop"] == 0)]
    control: dict[str, dict[str, list]] = {}
    for study_id, g in placebo.groupby("study_id", observed=True):
        for col, construct in OUTCOMES.items():
            v = g[col].dropna()
            if len(v):
                control.setdefault(str(study_id), {})[construct] = [round(float(v.mean()), 1), int(len(v))]
    out: dict[str, dict] = {}
    pairs = ates[["content_id", "study_id"]].drop_duplicates()
    for study_id, group in pairs.groupby("study_id", sort=False):
        st = studies.loc[study_id]
        ads = sorted(group["content_id"].astype(str))
        for k, ad in enumerate(ads, start=1):
            t = tagging.loc[ad] if ad in tagging.index else None
            states = st["states"] if isinstance(st["states"], str) else ""
            out[f"{ad} (study {study_id})"] = {
                "state": "National" if st.get("n_states") == 50 else states.replace("|", ", "),
                # 2018's studies carry no race level; their ads' tagging does (as loaders/lift_archive.py reads it).
                "race": st["race_level"] if isinstance(st["race_level"], str) else (t["race_level"] if t is not None and isinstance(t.get("race_level"), str) else None),
                "date": str(st["date"])[:10] if pd.notna(st["date"]) else None,
                "cycle": int(st["dataset_year"]),
                "ad": k,
                "ads": len(ads),
                "tone": _argmax_label(t, TONE) if t is not None else None,
                "focus": _argmax_label(t, FOCUS) if t is not None else None,
                "traits": [key for key, cols in TRAITS.items() if t is not None and _present(t, cols)],
                "emotions": {e: round(float(t[f"emotion_{e}"]), 2) for e in EMOTIONS if t is not None and pd.notna(t.get(f"emotion_{e}"))},
                "control": control.get(str(study_id), {}),
            }
    return out


def main() -> int:
    ads = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(ads, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    coded = sum(1 for a in ads.values() if a["emotions"])
    based = sum(1 for a in ads.values() if a["control"])
    print(f"{OUT.relative_to(config.ROOT.parent)}: {len(ads)} ads, {coded} with coded emotions, {based} with their test's placebo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
