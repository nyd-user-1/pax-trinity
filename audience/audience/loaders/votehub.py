"""Poll toplines from VoteHub's public API (https://votehub.com/polls/api/, CC BY 4.0).

    python -m audience.load votehub [--refresh]

One request brings every poll VoteHub has compiled: each pollster's published topline, never
the crosstabs. The answer is cached as it came in raw/votehub/<date>.json; --refresh pulls it
again. Campaigns' own polls come only when asked for (?internal=true) and are left out.

A question is a poll type and its subject, as govblock's /polls groups them
(govblock scripts/polls/load.mjs): Donald Trump's approval, the 2026 Michigan Senate race.
Each is a POLL construct with its concordance row; its label is the question a reader would
ask. A poll is its own slice, source_version "VoteHub <id>", since one pollster can field two
polls of one question on the same dates (for two sponsors, or two matchups). item_text names
the pollster, its sponsors and the population, which the export carries on every row;
provenance_url is the poll's own release, and provenance_note credits VoteHub and keeps its id.

Rows are loaded as VoteHub gives them, with three exceptions: a poll with no release URL is
skipped (the store requires provenance); a poll whose field dates can't both be right (its start
after its end, or a period past MAX_FIELD_DAYS: year typos) is skipped rather than guessed at;
and the generic ballot's "Dem" and "Rep" read "Democrat" and "Republican". A House district or a
city stands at its state. A row the pull no longer produces (a poll gone from VoteHub, a renamed answer) is deleted on the next run.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import urllib.request

from .. import config
from ..db import Store

SOURCE = "POLL"
VERSION_PREFIX = "VoteHub "
API = "https://api.votehub.com/polls"
RAW = config.RAW / "votehub"
CREDIT = "Topline compiled by VoteHub (https://votehub.com/polls/, CC BY 4.0)"
MAX_FIELD_DAYS = 60   # a longer period in VoteHub's dates is a typo (one runs 368 days)

STATES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
    "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA",
    "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
}
CITIES = {"New York City": ("NY", "nyc")}
FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08", "CT": "09",
    "DE": "10", "DC": "11", "FL": "12", "GA": "13", "HI": "15", "ID": "16", "IL": "17",
    "IN": "18", "IA": "19", "KS": "20", "KY": "21", "LA": "22", "ME": "23", "MD": "24",
    "MA": "25", "MI": "26", "MN": "27", "MS": "28", "MO": "29", "MT": "30", "NE": "31",
    "NV": "32", "NH": "33", "NJ": "34", "NM": "35", "NY": "36", "NC": "37", "ND": "38",
    "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46",
    "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53", "WV": "54",
    "WI": "55", "WY": "56",
}
POPULATIONS = {"a": "adults", "rv": "registered voters", "lv": "likely voters", "v": "voters"}
SUBJECT_IDS = {"Donald Trump": "trump", "JD Vance": "vance", "Congress": "congress",
               "Supreme Court": "supreme_court"}
CHOICES = {"generic-ballot": {"Dem": "Democrat", "Rep": "Republican"}}


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def the(subject: str) -> str:
    return "the Supreme Court" if subject == "Supreme Court" else subject


def parse_subject(subject: str) -> dict:
    """"2026 Texas Republican" -> year, place, party, state; "2026 TX-23" -> a district."""
    m = re.match(r"^(\d{4}) (.+?)(?: (Democratic|Republican))?$", subject)
    if not m:
        return {"year": None, "place": subject, "party": None, "state": None, "key": slug(subject)}
    year, place, party = m.groups()
    district = re.match(r"^([A-Z]{2})-(\d{2})$", place)
    if district:
        state, key = district[1], f"{district[1].lower()}_{district[2]}"
    elif place in CITIES:
        state, key = CITIES[place]
    elif place in STATES:
        state, key = STATES[place], STATES[place].lower()
    else:
        state, key = None, slug(place)
    return {"year": year, "place": place, "party": party, "state": state, "key": key}


def question_of(poll_type: str, subject: str) -> dict | None:
    """A poll type and its subject as one question: its construct id, the question a reader
    asks (the label), what it measures (the definition) and where it was asked."""
    s = parse_subject(subject)
    year, place, party, state, key = s["year"], s["place"], s["party"], s["state"], s["key"]
    primary = f"_{party[:3].lower()}_primary" if party else ""
    race = f"{party} primary" if party else "race"
    if poll_type == "approval":
        who = SUBJECT_IDS.get(subject, slug(subject))
        return dict(construct=f"approval_{who}", state=None,
                    label=f"Do Americans approve of {the(subject)}?",
                    definition=f"Approve or disapprove of {the(subject)}'s performance, as each poll asked it.")
    if poll_type == "favorability":
        who = SUBJECT_IDS.get(subject, slug(subject))
        return dict(construct=f"favorability_{who}", state=None,
                    label=f"Do Americans view {the(subject)} favorably?",
                    definition=f"A favorable or unfavorable view of {the(subject)}, as each poll asked it.")
    if poll_type == "generic-ballot":
        return dict(construct=f"generic_ballot_{slug(subject)}", state=None,
                    label=f"Who leads the {subject} generic congressional ballot?",
                    definition=f"Would vote for the Democratic or the Republican candidate for Congress in {subject}.")
    if poll_type == "presidential-primary":
        return dict(construct=f"president_{year}{primary or '_' + slug(place)}", state=None,
                    label=f"Who leads the {subject} presidential primary?",
                    definition=f"Vote intention in the {subject} presidential primary, each candidate the poll named.")
    if not year or not state:
        return None
    if poll_type == "us-senator":
        return dict(construct=f"senate_{year}_{key}{primary}", state=state,
                    label=f"Who leads the {year} {place} Senate {race}?",
                    definition=f"Vote intention in the {year} {place} {race} for the U.S. Senate.")
    if poll_type == "governor":
        label = (f"Who leads the {year} {place} {party} primary for governor?" if party
                 else f"Who leads the {year} {place} governor's race?")
        return dict(construct=f"governor_{year}_{key}{primary}", state=state, label=label,
                    definition=f"Vote intention in the {year} {place} {race} for governor.")
    if poll_type == "us-representative":
        return dict(construct=f"house_{year}_{key}{primary}", state=state,
                    label=f"Who leads the {year} race in {place}{f' ({party} primary)' if party else ''}?",
                    definition=f"Vote intention in the {year} {race} for the U.S. House in {place}.")
    if poll_type == "attorney-general":
        return dict(construct=f"attorney_general_{year}_{key}{primary}", state=state,
                    label=f"Who leads the {year} {place} attorney general {race}?",
                    definition=f"Vote intention in the {year} {race} for attorney general in {place}.")
    if poll_type == "mayor":
        return dict(construct=f"mayor_{year}_{key}{primary}", state=state,
                    label=f"Who leads the {year} {place} mayoral {race}?",
                    definition=f"Vote intention in the {year} {race} for mayor of {place}.")
    measure = re.match(r"^proposition-(\d+)$", poll_type)
    if measure:
        voters = "Californians" if place == "California" else f"{place} voters"
        return dict(construct=f"prop_{measure[1]}_{year}_{key}", state=state,
                    label=f"Do {voters} support Proposition {measure[1]}?",
                    definition=f"Support for or opposition to Proposition {measure[1]} on the {year} {place} ballot.")
    return None


def fetch(refresh: bool = False) -> tuple[list[dict], str]:
    """VoteHub's polls and the raw file they came from: the newest cached pull unless
    refresh, else a new one saved as raw/votehub/<today>.json."""
    RAW.mkdir(parents=True, exist_ok=True)
    cached = sorted(RAW.glob("????-??-??.json"))
    if cached and not refresh:
        path = cached[-1]
    else:
        req = urllib.request.Request(API, headers={"accept": "application/json",
                                                   "User-Agent": "pax-trinity audience loader"})
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read()
        path = RAW / f"{dt.date.today().isoformat()}.json"
        path.write_bytes(body)
    return json.loads(path.read_text(encoding="utf-8")), path.name


def build(polls: list[dict]) -> tuple[dict[str, dict], list[dict], list[str]]:
    """Concordance rows by construct, norm rows, and a line for each poll skipped."""
    questions: dict[str, dict] = {}
    rows: list[dict] = []
    skipped: list[str] = []
    for p in polls:
        pid = p.get("id")
        if p.get("internal"):
            continue
        if not p.get("answers") or not p.get("end_date"):
            skipped.append(f"{pid}: no answers or no end date")
            continue
        if not p.get("url"):
            skipped.append(f"{pid}: no release URL")
            continue
        q = question_of(p["poll_type"], p["subject"])
        if q is None:
            skipped.append(f"{pid}: no question for {p['poll_type']} / {p['subject']}")
            continue
        end = dt.date.fromisoformat(p["end_date"])
        start = dt.date.fromisoformat(p.get("start_date") or p["end_date"])
        if start > end or (end - start).days > MAX_FIELD_DAYS:
            skipped.append(f"{pid}: field dates {p.get('start_date')} to {p['end_date']} can't both be right")
            continue
        questions.setdefault(q["construct"], q)
        who = p["pollster"] + (f" for {', '.join(p['sponsors'])}" if p.get("sponsors") else "")
        pop = POPULATIONS.get(p.get("population") or "", "population not stated")
        seat = p.get("seat_name")
        text = f"{who}, {pop}" + (f" ({seat})" if seat and seat not in p["subject"] else "")
        note = f"{CREDIT}, poll {pid}"
        if p.get("partisan"):
            note += f"; sponsor partisan: {'Democratic' if p['partisan'] == 'DEM' else 'Republican'}"
        geo = FIPS[q["state"]] if q["state"] else "US"
        relabel = CHOICES.get(p["poll_type"], {})
        seen: set[str] = set()
        for a in p["answers"]:
            choice = relabel.get(a["choice"], a["choice"])
            if choice in seen or a.get("pct") is None:
                continue
            seen.add(choice)
            rows.append(dict(
                source=SOURCE, source_version=f"{VERSION_PREFIX}{pid}",
                geography="STATE" if q["state"] else "US", geo_code=geo,
                period_start=start, period_end=end, construct=q["construct"], item_text=text,
                response_option=choice, subgroup_dim="all", subgroup_value="all",
                estimate=float(a["pct"]), estimate_type="pct",
                n=int(p["sample_size"]) if p.get("sample_size") else None,
                moe=None, se=None, weight_var=None,
                provenance_url=p["url"], provenance_note=note,
            ))
    return questions, rows, skipped


def owns(source_version: str) -> bool:
    return source_version.startswith(VERSION_PREFIX)


def run(store: Store, refresh: bool = False) -> int:
    polls, raw_name = fetch(refresh)
    questions, rows, skipped = build(polls)
    # A construct another source already measures is not this loader's to relabel.
    taken = {c for (c,) in store.query(
        "SELECT DISTINCT construct FROM norms WHERE source <> ?", [SOURCE])}
    clash = sorted(set(questions) & taken)
    if clash:
        raise RuntimeError(f"construct ids already used by another source: {', '.join(clash)}")
    for c, q in sorted(questions.items()):
        store.upsert_concordance({
            "construct": c, "label": q["label"], "definition": q["definition"],
            "notes": "Every public poll VoteHub compiles for this question (https://votehub.com/polls/, "
                     "CC BY 4.0); campaigns' internal polls are left out. Each row's item_text names "
                     "the pollster, its sponsors and the population; provenance_url is the poll's release.",
        })
    total = store.upsert_norms(rows)
    from .polls import describe, prune_owned

    removed = prune_owned(store, SOURCE, VERSION_PREFIX, rows)
    store.touch_source(SOURCE)
    describe(store)
    for line in skipped:
        print(f"  skipped {line}")
    print(f"{raw_name}: {total} rows in {len({r['source_version'] for r in rows})} polls and "
          f"{len(questions)} questions; {len(skipped)} skipped, {removed} stale rows removed")
    return total
