"""Questions pollsters asked again and again, read from their own releases:
python -m audience.load releases [--cache <dir>]

govblock read every VoteHub poll's release on 2026-09-25 (its scripts/polls/release_*.py):
name, sample, method, every question's number, title, verbatim wording and crosstabs, kept as
parsed/<file sha256>.json beside manifest.json in its cache (~/.cache/govblock/poll-releases,
copied to s3://pax-trinity-audience-613473203863/raw/polls/releases/). The parse is heuristic,
and two faults are known: questions with no wording, and crosstab headers shifted a column. So
this loader takes the narrow cut (the lead's ruling, 2026-11-02): a question a pollster asked in
the same wording in three or more releases, from releases that clear a gate.

Linking. A VoteHub poll's url is the manifest's key; its file's sha256 names the parsed release.
The polls citing one release are one survey: VoteHub's pollster and field dates are its own.
A release cited by polls of two pollsters is left out.

The gate, per release:
  - Headers. Each crosstab column's group and label must map onto the store's subgroups
    (HEADERS: sex, party, age, race_eth, educ, ideology, presidential vote; Emerson's six age
    bands as age_6; white adults by education as white_by_educ). A label found under the wrong
    group ("2016 Vote / Liberal", "Gender / 18-29") is the shift fault, and the whole release is
    refused. A column the map doesn't know (region, income, "Ind Rep") is dropped. Quinnipiac's
    banners are lost in the parse, so its abbreviations are read by label alone under its
    population banners (BY_LABEL). Gallup's two-line headers parse into fragments ("conserva" /
    "tive") and are not mapped.
  - VoteHub. At least one of the release's questions must match a VoteHub topline of the same
    poll (two or more answers by name) and agree within 2 points in some one column (the Total,
    or the population VoteHub reports), and none may disagree.
  Per question: verbatim wording (a question, or a statement of eight words or more; not a
  heading in capitals or a battery item that lost its stem), with its numbering stripped; not
  a question about the sample itself (gender, age, race, education, party, past vote, mode);
  a Total column first; distinct, non-empty answer labels; every row as many values as
  columns; Total shares summing to 90-110.

A release stands where its VoteHub polls do: one state's races put it in that state, approval
and the generic ballot put it in the U.S.; a release whose polls stand in two places is left
out. A repeated question is (pollster, place, wording, title) normalized, in MIN_WAVES or more
releases with different end dates (three for the first batch, two since). Its id is the
pollster, place and title or wording, ending in a hash of that identity so it never moves. Each is one POLL construct, labelled by its title (or wording) with the
verbatim wording in concordance.gss_wording. Each release is a slice, source_version
"Release <pollster>/<end date>[ <sha8>]"; item_text names the pollster, the sample and the margin
the release states (as printed, 95%; the moe column is the store's 90% and stays empty); rows are
Total as "all" and each mapped column as its subgroup; n is the column's unweighted N where the
release prints one.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

from ..db import Store

SOURCE = "POLL"
VERSION_PREFIX = "Release "
CACHE = Path(os.path.expanduser("~/.cache/govblock/poll-releases"))
MIN_WAVES = 2   # the lead's growth ruling, step 3 (2026-11-02); the first batch took 3
CREDIT = "Read from the pollster's release by govblock's release reader (2026-09-25)"
NOTES = ("Read from the pollster's own releases (audience/loaders/releases.py); each row's "
         "provenance_url is the release.")

# Header group (normalized) -> (store dim, {label (normalized): store value}).
_SEX = {"male": "Male", "men": "Male", "female": "Female", "women": "Female"}
_PARTY = {"dem": "Democrat", "democrat": "Democrat", "rep": "Republican",
          "republican": "Republican", "ind": "Independent", "independent": "Independent"}
_AGE = {"18-29": "18-29", "under 30": "18-29", "30-44": "30-44", "45-64": "45-64", "65+": "65+"}
_RACE = {"white": "White", "black": "Black", "hispanic": "Hispanic or Latino",
         "white or caucasian": "White", "black or african american": "Black",
         "hispanic or latino of any race": "Hispanic or Latino", "asian": "Asian",
         "other or multiple races": "Other or multiracial"}
# The store's four education bands; Emerson's "Vocational/technical school" fits none and drops.
_EDUC = {"high school or less": "HS or less", "associate degree/some college": "Some college",
         "college graduate": "BA", "postgraduate or higher": "Grad"}
# Emerson's six age bands match neither age nor age_5, so they stand as their own dim.
_AGE_6 = {"18-29 years": "18-29", "30-39 years": "30-39", "40-49 years": "40-49",
          "50-59 years": "50-59", "60-69 years": "60-69", "70 or more years": "70+"}
_WHITE_EDUC = {"no degree": "White, no 4-year degree", "4yr degree+": "White, 4-year degree"}
_IDEO = {"lib": "Liberal", "liberal": "Liberal", "mod": "Moderate", "moderate": "Moderate",
         "con": "Conservative", "conservative": "Conservative"}
HEADERS = {
    "gender": ("sex", _SEX), "sex": ("sex", _SEX),
    "party id": ("party", _PARTY), "party": ("party", _PARTY),
    "party identification": ("party", _PARTY),
    "party registration or affiliation": ("party", {"democrat": "Democrat", "republican": "Republican"}),
    "ethnicity": ("race_eth", _RACE),
    "age": ("age", _AGE), "age (4 category)": ("age", _AGE),
    "race": ("race_eth", _RACE), "race (4 category)": ("race_eth", _RACE),
    "race/ethnicity": ("race_eth", _RACE),
    "ideology": ("ideology", _IDEO), "ideology (3 category)": ("ideology", _IDEO),
    "2024 vote": ("presidential_vote_2024", {"harris": "Voted Dem", "trump": "Voted Rep"}),
    "2020 vote": ("presidential_vote_2020", {"biden": "Voted Dem", "trump": "Voted Rep"}),
    "2016 vote": ("presidential_vote_2016", {"clinton": "Voted Dem", "trump": "Voted Rep"}),
    # Emerson prints the question as the group: "The highest level of education you have ..."
    "the highest level of education you have": ("educ", _EDUC),
    "age range": ("age_6", _AGE_6),
    "the 2024 presidential election": ("presidential_vote_2024", {
        "kamala harris": "Voted Dem", "donald trump": "Voted Rep", "someone else": "Voted Other",
        "did not vote": "Did not vote"}),
    "white by education": ("white_by_educ", _WHITE_EDUC),
}
# Pollsters whose banners the parse loses: their own abbreviations, read by label alone, but
# only under the groups named (under Quinnipiac's WHITE banner "Men" means white men).
BY_LABEL = {
    "Quinnipiac University": {
        "groups": {"", "registered voters", "adults", "likely voters"},
        "labels": {"men": ("sex", "Male"), "wom": ("sex", "Female"),
                   "rep": ("party", "Republican"), "dem": ("party", "Democrat"),
                   "ind": ("party", "Independent"), "wht": ("race_eth", "White"),
                   "blk": ("race_eth", "Black"), "hsp": ("race_eth", "Hispanic or Latino")},
        "grouped": {"4 yr coll deg": {"yes": ("white_by_educ", "White, 4-year degree"),
                                      "no": ("white_by_educ", "White, no 4-year degree")}},
    },
}
TOTALS = {"total", "tot"}
# Labels that belong to groups the map drops; under a mapped group they signal a shift too.
_OTHER_HOMES = {
    "income": {"<50k", "50-100k", "100k +", "under $50k", "$50-100k", "$100k or more", "< $50k",
               "$100k+"},
    "region": {"northeast", "midwest", "south", "west"},
    "urban/rural": {"urban", "suburb", "rural"},
}
HOMES: dict[str, set[str]] = defaultdict(set)
for _g, (_dim, _labels) in HEADERS.items():
    for _l in _labels:
        HOMES[_l].add(_dim)
for _dim, _labels in _OTHER_HOMES.items():
    for _l in _labels:
        HOMES[_l].add(_dim)

DROP_ROWS = re.compile(r"^(totals?|unweighted n|weighted n|n|base)$", re.I)
# Questions about the sample itself, which restate its weighting targets: left out.
SCREENERS = re.compile(
    r"(\bgender\b|\byour sex\b|ethnicity|racial or ethnic|age range|\byour age\b|how old|"
    r"highest level of (education|school)|party (registration|affiliation)|press 1|"
    r"are you a democrat|lean democrat|what area do you live|local television news|"
    r"in what (county|city|state) do you live|what is your (education|race|gender|age|party)|"
    r"\bdid you vote for\b|think of yourself as a (republican|democrat)|are you registered to vote|"
    r"who did you vote for in the 20\d\d presidential|^(age|mode|education|gender|party|race|"
    r"20\d\d vote)$)", re.I)
# A question's number or variable code before its wording: "1* ", "Q12. ", "(A1). ", "CURY2. ".
NUMBERING = re.compile(r"^\s*(?:(?:Q\.?\s*)?\d+[a-z]?[*.):]?|\(?[A-Z]{1,8}\d+[a-z]?\)?[.:])\s+")
CELL_NOTE = re.compile(r"\s+(row|col|column) %$", re.I)


def worded(text: str) -> bool:
    """Wording a respondent heard: a question, or a statement of eight words or more that
    addresses the respondent; not a heading in capitals ("GALLUP POLL SOCIAL SURVEY"), a
    battery item that lost its stem ("Immigration policy") or header fragments run together."""
    if len(text) < 15 or text.upper() == text:
        return False
    if re.search(r"\s\?", text):          # a grid stem with its item's slot left blank
        return False
    addressed = re.search(r"\byou(r)?\b", text, re.I) is not None
    if text.rstrip().endswith("?"):
        # A question addresses the respondent or opens on a question word; a fragment like
        # "Donald Trump's job performance?" (its stem lost to the title) does neither.
        return addressed or re.match(
            r"(who|whom|what|which|how|why|when|where|do|does|did|is|are|was|were|would|should|"
            r"will|can|could|have|has)\b", text, re.I) is not None
    if re.search(r"\b(are|you|the|of|a|an|to|for|and|or|is|be|were)$", text.rstrip(), re.I):
        return False                          # cut off mid-sentence
    # A statement must address the respondent; header fragments glued together don't.
    return len(text.split()) >= 8 and addressed


def _norm(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("–", "-").replace("’", "'")).strip().lower()


def _key(s: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", _norm(s)).strip()


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def pct(v) -> float | None:
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*%?\s*", str(v or ""))
    return float(m[1]) if m else None


def count(v) -> int | None:
    m = re.fullmatch(r"\s*\(?([\d,]+)\)?\s*", str(v or ""))
    return int(m[1].replace(",", "")) if m else None


# Linking ------------------------------------------------------------------------------------

def link(polls: list[dict], cache: Path = CACHE) -> tuple[list[dict], Counter]:
    """VoteHub polls grouped by the release file they cite: one survey per release, standing
    where its polls do (a state's races put it in that state; approval and the generic ballot
    nationally). A release whose polls stand in two places is left out."""
    from . import votehub

    manifest = json.loads((Path(cache) / "manifest.json").read_text())["urls"]
    stats: Counter = Counter()
    by_sha: dict[str, dict] = {}
    for p in polls:
        if p.get("internal") or not p.get("url") or not p.get("end_date"):
            continue
        stats["polls"] += 1
        entry = manifest.get(p["url"])
        if not entry or not entry.get("file"):
            continue
        sha = entry["file"]["sha256"]
        parsed = Path(cache) / "parsed" / f"{sha}.json"
        if not parsed.exists():
            continue
        stats["polls with a parsed release"] += 1
        s = by_sha.setdefault(sha, {"sha": sha, "parsed": parsed, "polls": [],
                                    "url": entry.get("pdf_url") or p["url"]})
        s["polls"].append(p)
    surveys = []
    for s in by_sha.values():
        if len({p["pollster"] for p in s["polls"]}) > 1:
            stats["releases cited by two pollsters"] += 1
            continue
        states = {(votehub.question_of(p["poll_type"], p["subject"]) or {}).get("state")
                  for p in s["polls"]}
        if len(states) > 1:
            stats["releases mixing national and state polls"] += 1
            continue
        s["state"] = states.pop()
        s["pollster"] = s["polls"][0]["pollster"]
        s["start"] = min(p.get("start_date") or p["end_date"] for p in s["polls"])
        s["end"] = max(p["end_date"] for p in s["polls"])
        try:
            s["release"] = json.loads(s["parsed"].read_text())
        except (OSError, ValueError):
            stats["unreadable parse"] += 1
            continue
        surveys.append(s)
    stats["releases"] = len(surveys)
    return surveys, stats


# The gate -----------------------------------------------------------------------------------

def column_map(columns: list[dict], pollster: str = "") -> tuple[list[tuple[str, str] | None], bool]:
    """Each column's (dim, value) — ("all", "all") for Total, None when dropped — and whether
    a label sits under the wrong group (the shift fault)."""
    out, shifted = [], False
    own = BY_LABEL.get(pollster)
    for i, c in enumerate(columns):
        group, label = _norm(c.get("group")), _norm(c.get("label"))
        if i == 0:
            out.append(("all", "all") if group == "" and label in TOTALS else None)
            continue
        if own:
            hit = (own["labels"].get(label) if group in own["groups"]
                   else own["grouped"].get(group, {}).get(label))
            out.append(hit)
            continue
        mapped = HEADERS.get(group)
        if mapped and label in mapped[1]:
            out.append((mapped[0], mapped[1][label]))
            continue
        if mapped and HOMES.get(label) and mapped[0] not in HOMES[label]:
            shifted = True
        out.append(None)
    return out, shifted


def clean_question(q: dict, release: dict, pollster: str = "") -> dict | None:
    wording = NUMBERING.sub("", re.sub(r"\s+", " ", q.get("wording") or "")).strip()
    title = NUMBERING.sub("", re.sub(r"\s+", " ", q.get("title") or "")).strip() or None
    if title and (title.upper() == title or re.search(r"\b[A-Z]{2,}\d+[A-Z]*\b", title)
                  or wording.lower().startswith(title.lower())):
        title = None   # a heading, a variable code ("DEMS105TRND."), or the wording cut short
    if not worded(wording) or SCREENERS.search(wording) or (title and SCREENERS.search(title)):
        return None
    columns = q.get("columns") or release.get("columns") or [{"group": "", "label": "Total"}]
    cmap, _ = column_map(columns, pollster)
    if cmap[0] != ("all", "all"):
        return None
    rows = []
    for r in q.get("rows") or []:
        label = CELL_NOTE.sub("", re.sub(r"\s+", " ", r.get("label") or "")).strip()
        if DROP_ROWS.match(label):
            continue
        if not label:
            return None
        values = r.get("values") or []
        if len(values) != len(columns):
            return None
        rows.append((label, values))
    if not rows or len({_key(label) for label, _ in rows}) < len(rows):
        return None
    total = [pct(v[0]) for _, v in rows]
    if any(t is None for t in total) or not 90 <= sum(total) <= 110:
        return None
    ns = q.get("n") or release.get("n")
    ns = [count(x) for x in ns] if isinstance(ns, list) and len(ns) == len(columns) else None
    return {"number": q.get("number"), "title": title, "wording": wording, "rows": rows,
            "columns": cmap, "n": ns}


def match_row(choice: str, rows: list) -> list | None:
    """The row a VoteHub answer names: the same label, else the one row whose words hold the
    answer's words ("Trump" in "Donald Trump"); None when absent or ambiguous."""
    want = _key(choice)
    exact = [v for label, v in rows if _key(label) == want]
    if exact:
        return exact[0] if len(exact) == 1 else None
    words = set(want.split())
    loose = [v for label, v in rows if words and words <= set(_key(label).split())]
    return loose[0] if len(loose) == 1 else None


def verify(questions: list[dict], polls: list[dict]) -> str:
    """'verified', 'disagrees' or 'unmatched': the release against VoteHub's toplines of the
    same poll. A question matches a topline when two or more of its answers name rows; it
    agrees when some one column (the Total, or the population VoteHub reports) holds every
    matched answer within 2 points."""
    agree = disagree = 0
    for p in polls:
        answers = [(a["choice"], a["pct"]) for a in p.get("answers") or [] if a.get("pct") is not None]
        if len(answers) < 2:
            continue
        best = None
        for q in questions:
            pairs = [(value, row) for choice, value in answers
                     if (row := match_row(choice, q["rows"])) is not None]
            if len(pairs) >= 2 and (best is None or len(pairs) > len(best)):
                best = pairs
        if best is None:
            continue
        width = min(len(row) for _, row in best)
        if any(all((x := pct(row[j])) is not None and abs(value - x) <= 2 for value, row in best)
               for j in range(width)):
            agree += 1
        else:
            disagree += 1
    return "disagrees" if disagree else "verified" if agree else "unmatched"


def gate(surveys: list[dict]) -> tuple[list[dict], dict[str, str]]:
    passed, why = [], {}
    for s in surveys:
        rel = s["release"]
        raw = rel.get("questions") or []
        if any(column_map(q.get("columns") or rel.get("columns") or [], s["pollster"])[1] for q in raw):
            why[s["sha"]] = "header shift"
            continue
        qs = [c for c in (clean_question(q, rel, s["pollster"]) for q in raw) if c]
        if not qs:
            why[s["sha"]] = "no question clears the per-question checks"
            continue
        verdict = verify(qs, s["polls"])
        if verdict != "verified":
            why[s["sha"]] = f"VoteHub {verdict}"
            continue
        why[s["sha"]] = "passed"
        passed.append({**s, "questions": qs})
    return passed, why


# Repeats and rows ---------------------------------------------------------------------------

def repeats(surveys: list[dict], min_waves: int = MIN_WAVES) -> list[dict]:
    groups: dict[tuple, list] = defaultdict(list)
    for s in surveys:
        for q in s["questions"]:
            groups[(s["pollster"], s["state"] or "", _key(q["wording"]), _key(q["title"]))].append((s, q))
    out, ids = [], set()
    for key, items in sorted(groups.items()):
        pollster, state = key[0], key[1]
        by_end = {}
        for s, q in items:
            by_end.setdefault(s["end"], (s, q))   # one release per end date
        if len(by_end) < min_waves:
            continue
        s0, q0 = max(by_end.values(), key=lambda x: x[0]["end"])
        place = f"_{state.lower()}" if state else ""
        base = f"{slug(pollster)[:18]}{place}_{slug(q0['title'] or q0['wording'])[:44]}".strip("_")
        # The id ends in a hash of the question's identity, so it never moves as the set grows.
        construct = f"{base}_{hashlib.sha1('|'.join(key).encode()).hexdigest()[:5]}"
        if construct in ids:
            raise RuntimeError(f"two repeated questions share the id {construct}")
        ids.add(construct)
        out.append({"construct": construct, "pollster": pollster, "state": state or None,
                    "title": q0["title"],
                    "wording": q0["wording"], "waves": len(by_end),
                    "items": sorted(by_end.values(), key=lambda x: x[0]["end"])})
    return out


def rows_of(rep: dict) -> list[dict]:
    from . import votehub

    rows = []
    for s, q in rep["items"]:
        start = dt.date.fromisoformat(s["start"])
        end = dt.date.fromisoformat(s["end"])
        start, end = min(start, end), max(start, end)
        # The poll as its rows name it: the pollster, its sample and the margin it states, as
        # printed (a 95% margin, which the store's 90% moe column does not take). The parsed
        # name is often a page heading ("NOTE ABOUT RESULTS") and stays out.
        rel = s["release"]
        sample = (rel.get("sample") or "").strip()
        if sample.upper() == sample:
            sample = ""   # a headline the parse took for the sample ("2026 MAJORITY OF VOTERS")
        text = ", ".join(x for x in (s["pollster"], sample, (rel.get("margin_of_error") or "").strip()) if x)
        version = f"{VERSION_PREFIX}{slug(s['pollster'])}/{s['end']} {s['sha'][:8]}"
        seen = set()
        for label, values in q["rows"]:
            for j, cell in enumerate(q["columns"]):
                if cell is None:
                    continue
                value = pct(values[j])
                key = (label, cell)
                if value is None or key in seen:
                    continue
                seen.add(key)
                rows.append(dict(
                    source=SOURCE, source_version=version,
                    geography="STATE" if rep["state"] else "US",
                    geo_code=votehub.FIPS[rep["state"]] if rep["state"] else "US",
                    period_start=start, period_end=end, construct=rep["construct"],
                    item_text=text[:300], response_option=label[:200], subgroup_dim=cell[0],
                    subgroup_value=cell[1], estimate=value, estimate_type="pct",
                    n=(q["n"][j] if q["n"] else None), moe=None, se=None, weight_var=None,
                    provenance_url=s["url"],
                    provenance_note=f"{CREDIT}; question {q['number'] or '?'}; release sha256 {s['sha']}"))
    return rows


def build(polls: list[dict], cache: Path = CACHE):
    surveys, stats = link(polls, cache)
    gated, why = gate(surveys)
    reps = repeats(gated)
    rows = [r for rep in reps for r in rows_of(rep)]
    return reps, rows, stats, why


def owns(source_version: str) -> bool:
    return source_version.startswith(VERSION_PREFIX)


def run(store: Store, refresh: bool = False, cache: Path | None = None) -> int:
    from . import votehub

    polls, raw_name = votehub.fetch(refresh=False)
    cache = Path(cache) if cache else CACHE
    if not (cache / "manifest.json").exists():
        print(f"No release cache at {cache}; copy it from "
              "s3://pax-trinity-audience-613473203863/raw/polls/releases/. Nothing loaded.")
        return 0
    reps, rows, stats, why = build(polls, cache)
    taken = {c for (c,) in store.query(
        "SELECT DISTINCT construct FROM norms WHERE source <> ?", [SOURCE])}
    clash = sorted({r["construct"] for r in reps} & taken)
    if clash:
        raise RuntimeError(f"construct ids already used by another source: {', '.join(clash)}")
    from .votehub import STATES

    names = {v: k for k, v in STATES.items()}
    for rep in reps:
        label = rep["title"] or (rep["wording"] if len(rep["wording"]) <= 140
                                 else rep["wording"][:137].rstrip() + "...")
        where = f" ({names[rep['state']]})" if rep["state"] else ""
        entry = {"construct": rep["construct"], "label": f"{label}{where}",
                 "definition": f"{rep['pollster']}'s question, asked in the same wording in "
                               f"{rep['waves']} of its releases"
                               + (f" of {names[rep['state']]} voters." if rep["state"] else "."),
                 "notes": NOTES}
        if store.column_exists("concordance", "gss_wording"):
            entry["gss_wording"] = rep["wording"]
        store.upsert_concordance(entry)
    total = store.upsert_norms(rows)
    from .polls import describe, prune_owned

    removed = prune_owned(store, SOURCE, VERSION_PREFIX, rows)
    # Concordance rows this loader wrote whose question it no longer produces, and no source uses.
    store.execute("DELETE FROM concordance WHERE notes = ? AND construct NOT IN "
                  "(SELECT DISTINCT construct FROM norms)", [NOTES])
    store.touch_source(SOURCE)
    describe(store)
    outcomes = Counter(why.values())
    print(f"releases ({raw_name}): {stats['releases']} linked; "
          + ", ".join(f"{k} {v}" for k, v in outcomes.most_common()))
    print(f"releases: {total} rows in {len(reps)} repeated questions; {removed} stale rows removed")
    return total
