"""The lift archive's ads, described: python -m audience.lift_ads

Writes public/lift/archive-ads.json for /lift: one entry per ad-in-a-study (the export's response_option,
"<ad id> (study <study id>)"), from the replication archive's studies.RDS and the coders' tagging files
(tagging_2018.RDS, tagging_2020.RDS; Hewitt, Broockman, Coppock et al., APSR 2024). The campaigns are
anonymized in the archive and stay so: an ad is described by what the archive records about it, never named.

  { "<option>": { "state", "race", "date", "cycle", "ad", "ads", "tone", "focus",
                  "traits": [trait keys rated present], "emotions": {emotion: rating} } }

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

# The traits /lift's Traits view reads, by their tagging columns; each present at a mean rating of 0.5.
TRAITS = {
    "policy_facts": "policy_facts", "candidate_facts": "candidate_facts", "mentions_party": "mentions_party",
    "mentions_trump": "mentions_trump", "cites_source": "fact_cite_yes", "name_calling": "technique_neg_name",
    "testimonial": ["technique_pos_testimonial", "technique_neg_testimonial"], "plain_folks": "technique_plain_folks",
    "messenger_female": "messenger_female", "messenger_male": "messenger_male", "messenger_black": "messenger_black",
    "messenger_white": "messenger_white", "messenger_elderly": "messenger_elderly", "messenger_children": "messenger_children",
}
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
            }
    return out


def main() -> int:
    ads = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(ads, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    coded = sum(1 for a in ads.values() if a["emotions"])
    print(f"{OUT.relative_to(config.ROOT.parent)}: {len(ads)} ads, {coded} with coded emotions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
