"""Pew Research Center's published trends: python -m audience.load pew [--refresh]

Five series, read from Pew's own pages and topline PDFs, each a POLL question:

  - Trust in the government in Washington, 1958-2025: every poll in Pew's compilation (Pew, the
    National Election Studies, Gallup, CBS/New York Times, ABC/Washington Post, CNN), with its
    party, party-and-ideology and race splits. The individual polls only; Pew's smoothed trend
    is a moving average of them and stays out.
  - Ten election-policy proposals, 2018-2025 (the August 2025 topline carries every wave).
  - Twenty policy priorities for the president and Congress, 2021-2024 (the January 2024
    topline; Pew's phone-era figures before 2021 are not comparable and it leaves them out).
  - Which party Americans agree with on twelve policy areas, 2016-2026, and Congress's
    favorability with its party splits, 2019-2026 (the 2026 midterms appendix). The appendix's
    third table carries party splits with no total, and stays out.

Fetching: pewresearch.org refuses plain clients and answers a browser User-Agent; an article's
tables come clean from its /markdown mirror. Each document is cached in raw/pew/ as it came
(a PDF beside its pdftotext -layout text); --refresh fetches again.

Every row's source_version starts "Pew ", its provenance_url is the page or PDF it was read
from, and its item_text names who asked. A topline cell printed "*" (under half a percent) is
left out, and ERRATA corrects one misprint in the 2024 topline ("race in this county").
Pew's "Dem/Lean Dem" and "Rep/Lean Rep" take the store's Democrat and Republican, leaners
included, as provenance_note says; its Hispanic adults take the store's "Hispanic or Latino".
A construct's verbatim wording, stem and item as the topline prints them, goes in
concordance.gss_wording, which the export serves as every question's wording.
"""

from __future__ import annotations

import datetime as dt
import re
import subprocess
import urllib.request

from .. import config
from ..db import Store

SOURCE = "POLL"
VERSION_PREFIX = "Pew "
RAW = config.RAW / "pew"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/141.0.0.0 Safari/537.36")
CREDIT = "Pew Research Center"

TRUST_URL = "https://www.pewresearch.org/politics/2025/12/04/public-trust-in-government-1958-2025/"
VOTING_URL = ("https://www.pewresearch.org/wp-content/uploads/sites/20/2025/08/"
              "PP_2025.8.22_voting-policy_topline.pdf")
PRIORITIES_URL = ("https://www.pewresearch.org/politics/wp-content/uploads/sites/4/2024/02/"
                  "PP_2024.02.29_policy-priorities-topline.pdf")
APPENDIX_URL = "https://www.pewresearch.org/politics/2026/07/23/2026-midterms-appendix-additional-charts/"
DOCS = {
    "trust.md": TRUST_URL + "markdown",
    "voting-2025-topline.pdf": VOTING_URL,
    "priorities-2024-topline.pdf": PRIORITIES_URL,
    "midterms-2026-appendix.md": APPENDIX_URL + "markdown",
}

POLLSTERS = {
    "Pew Research Center": "Pew Research Center", "NES": "American National Election Studies",
    "GALLUP": "Gallup", "CBS/NYT": "CBS News/New York Times",
    "ABC/POST": "ABC News/Washington Post", "CNN": "CNN",
}
PARTY = {"Democrat/Lean Dem": "Democrat", "Republican/Lean Rep": "Republican",
         "Dem/Lean Dem": "Democrat", "Rep/Lean Rep": "Republican"}
RACE = {"Hispanic": "Hispanic or Latino", "Black": "Black", "White": "White", "Asian*": "Asian"}
LEANERS = "Democrat and Republican include independents who lean to the party"

TRUST = dict(
    construct="trust_government_washington",
    label="Do Americans trust the government in Washington to do what is right?",
    definition="Trust the government in Washington to do what is right just about always or most "
               "of the time, as every poll in Pew Research Center's 1958-2025 compilation asked it.",
    wording="How much of the time do you think you can trust the government in Washington to do "
            "what is right? Just about always, most of the time, or only some of the time?",
    option="Just about always or most of the time",
)

VOTING_STEM = "Please indicate whether you would favor or oppose the following ideas about election policy."
VOTING_COLUMNS = ("Strongly favor", "Somewhat favor", "Somewhat oppose", "Strongly oppose", "No answer")
VOTING = {
    "ATO": "automatic_registration", "HLDY": "election_day_holiday", "FLN": "felon_voting",
    "RMVVT": "remove_inactive_voters", "BLT_CL": "ballot_collection_ban", "GOVID": "photo_id",
    "PPR": "paper_backup", "ERLY": "early_voting", "ML": "vote_by_mail",
    "REGED": "same_day_registration",
}
PRIORITIES_STEM = ("How much of a priority should each of the following be for the president and "
                   "Congress to address this year?")
PRIORITIES_COLUMNS = ("Top priority", "Important but lower priority", "Not too important",
                      "Should not be done", "No answer")
PRIORITIES = {
    "PRIPRES_JOB": "jobs", "PRIPRES_BD": "budget_deficit", "PRIPRES_DTRD": "illegal_drugs",
    "PRIPRES_ENV": "environment", "PRIPRES_TER": "terrorism", "PRIPRES_GT": "global_trade",
    "PRIPRES_INF": "infrastructure", "PRIPRES_RA": "race", "PRIPRES_SC": "social_security",
    "PRIPRES_MON": "money_in_politics", "PRIPRES_EC": "economy", "PRIPRES_GCC": "climate_change",
    "PRIPRES_EDU": "education", "PRIPRES_HC": "health_care_costs", "PRIPRES_CRI": "crime",
    "PRIPRES_POOR": "poverty", "PRIPRES_MIL": "military", "PRIPRES_NRG": "energy",
    "PRIPRES_IMM": "immigration", "PRIPRES_POL": "political_system",
}
AGREE_ISSUES = {
    "Policies to deal with the budget deficit": "budget_deficit",
    "Policies related to the use of military force": "military_force",
    "Policies related to people who are gay, lesbian or transgender": "lgbt",
    "Policies to deal with crime": "crime", "Policies to deal with the economy": "economy",
    "Immigration policy": "immigration", "Healthcare policy": "healthcare",
    "Abortion policy": "abortion", "Foreign policy": "foreign_policy",
    "Policies related to the environment and climate": "environment_climate",
    "Policies to do with AI": "ai", "Education policy": "education",
}
# A misprint in the topline no questionnaire carries (the GSS loader's ERRATA practice).
ERRATA = {"PRIPRES_RA": ("race in this county", "race in this country")}
AGREE_RESPONSES = {"Agree with Rep Party NET": "Agree with the Republican Party",
                   "Agree with Dem Party NET": "Agree with the Democratic Party",
                   "Neither party": "Neither party"}

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}
FIELD = re.compile(r"^(?P<m1>[A-Z][a-z]+)\.? (?P<d1>\d{1,2})(?:[-–](?:(?P<m2>[A-Z][a-z]+)\.? )?"
                   r"(?P<d2>\d{1,2}))?, (?P<y>\d{4})$")


# Fetching -----------------------------------------------------------------------------------

def fetch(refresh: bool = False) -> dict[str, str]:
    """Each document's text, cached in raw/pew/."""
    RAW.mkdir(parents=True, exist_ok=True)
    texts = {}
    for name, url in DOCS.items():
        path = RAW / name
        if refresh or not path.exists():
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                path.write_bytes(r.read())
        if name.endswith(".pdf"):
            txt = path.with_suffix(".txt")
            if refresh or not txt.exists():
                txt.write_text(subprocess.run(["pdftotext", "-layout", str(path), "-"], check=True,
                                              capture_output=True, text=True).stdout)
            texts[name] = txt.read_text(encoding="utf-8")
        else:
            texts[name] = path.read_text(encoding="utf-8")
    return texts


# Parsing ------------------------------------------------------------------------------------

def field_period(text: str) -> tuple[dt.date, dt.date]:
    """"Sep 24-Oct 7, 2018", "January 8-12, 2021", "Aug 4-10, 2025" -> start, end."""
    m = FIELD.match(text.strip())
    if not m:
        raise ValueError(f"unread field period {text!r}")
    y = int(m["y"])
    m1 = MONTHS[m["m1"][:3].lower()]
    m2 = MONTHS[m["m2"][:3].lower()] if m["m2"] else m1
    start = dt.date(y, m1, int(m["d1"]))
    end = dt.date(y, m2, int(m["d2"] or m["d1"]))
    return start, end


def us_date(text: str) -> dt.date:
    """"9/28/2025" or "5/1/16"."""
    mo, d, y = (int(x) for x in text.strip().split("/"))
    return dt.date(y + 2000 if y < 100 else y, mo, d)


def md_tables(text: str) -> list[dict]:
    """Every markdown table under its ### heading: {heading, header, rows}."""
    tables, heading, cur = [], None, None
    for line in text.splitlines():
        if line.startswith("### "):
            heading, cur = line[4:].strip(), None
            continue
        if not line.startswith("|"):
            cur = None
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cur is None:
            cur = {"heading": heading, "header": cells, "rows": []}
            tables.append(cur)
        elif not set("".join(cells)) <= set("- "):
            cur["rows"].append(cells)
    return tables


def topline_items(text: str, codes: dict[str, str]) -> list[dict]:
    """A Pew topline's battery: each known item's code, its printed text, the form's N and its
    rows of (field period, values), the values a number or "*" each."""
    items, cur, form_n = [], None, None
    code_re = re.compile(r"^\s*(?P<code>" + "|".join(sorted(codes, key=len, reverse=True))
                         + r")\s{2,}(?P<text>\S.*?)\s*$")
    row_re = re.compile(r"^\s*(?P<when>[A-Z][a-z]+\.? \d{1,2}(?:[-–][A-Za-z]*\.? ?\d{1,2})?, \d{4})"
                        r"\s{2,}(?P<vals>[\d*\s]+?)\s*$")
    for line in text.splitlines():
        n = re.search(r"ASK FORM \d+(?: ONLY)? \[N=([\d,]+)\]", line)
        if n:
            form_n = int(n[1].replace(",", ""))
            continue
        m = code_re.match(line)
        if m:
            cur = {"code": m["code"], "text": m["text"], "n": form_n, "rows": []}
            items.append(cur)
            continue
        if cur is None:
            continue
        r = row_re.match(line)
        if r:
            cur["rows"].append((r["when"], r["vals"].split()))
        elif not cur["rows"] and line.strip() and not line.strip().startswith(("www.", "PEW")):
            cur["text"] += " " + line.strip()
        elif cur["rows"] and not line.strip():
            continue
        elif cur["rows"]:
            cur = None
    return items


# Rows ---------------------------------------------------------------------------------------

def row(construct, version, start, end, option, estimate, text, url, note,
        dim="all", value="all", n=None) -> dict:
    return dict(source=SOURCE, source_version=f"{VERSION_PREFIX}{version}", geography="US",
                geo_code="US", period_start=start, period_end=end, construct=construct,
                item_text=text, response_option=option, subgroup_dim=dim, subgroup_value=value,
                estimate=float(estimate), estimate_type="pct", n=n, moe=None, se=None,
                weight_var=None, provenance_url=url, provenance_note=note)


def trust_rows(md: str) -> tuple[list[dict], dict]:
    rows = []
    splits = {"Individual polls": ("all", None), "Democrat/Lean Dem": ("party", PARTY),
              "Republican/Lean Rep": ("party", PARTY), "Hispanic": ("race_eth", RACE),
              "Black": ("race_eth", RACE), "White": ("race_eth", RACE), "Asian*": ("race_eth", RACE),
              "Liberal Dem/Lean Dem": ("party_ideology", None),
              "Cons-Moderate Dem/Lean Dem": ("party_ideology", None),
              "Moderate-Lib Rep/Lean Rep": ("party_ideology", None),
              "Conservative Rep/Lean Rep": ("party_ideology", None)}
    seen = set()
    for t in md_tables(md):
        if not t["header"] or t["header"][0] != "Date":
            continue
        for cells in t["rows"]:
            when, who, *vals = cells
            date = us_date(when)
            pollster = POLLSTERS[who]
            for col, v in zip(t["header"][2:], vals):
                if col not in splits or not v:
                    continue
                dim, names = splits[col]
                value = "all" if dim == "all" else (names[col] if names else col)
                key = (date, who, dim, value)
                if key in seen:
                    continue
                seen.add(key)
                note = f"{CREDIT}, Public Trust in Government: 1958-2025 (2025-12-04)"
                if dim in ("party", "party_ideology"):
                    note += f"; {LEANERS}"
                if col == "Asian*":
                    note += "; Asian adults who speak English"
                asked = pollster if pollster == CREDIT else f"{pollster}, compiled by {CREDIT}"
                rows.append(row(TRUST["construct"], f"trust {who} {date.isoformat()}", date, date,
                                TRUST["option"], v, asked, TRUST_URL, note, dim, value))
    return rows, {TRUST["construct"]: TRUST}


def topline_rows(text: str, codes: dict[str, str], stem: str, columns: tuple[str, ...], prefix: str,
                 label, definition, url: str, title: str) -> tuple[list[dict], dict]:
    rows, questions = [], {}
    for item in topline_items(text, codes):
        construct = f"{prefix}_{codes[item['code']]}"
        wording = re.sub(r"\s+", " ", item["text"]).strip()
        if item["code"] in ERRATA:
            wrong, right = ERRATA[item["code"]]
            wording = wording.replace(wrong, right)
        questions[construct] = dict(construct=construct, label=label(wording),
                                    definition=definition(wording), wording=f"{stem} {wording}")
        for i, (when, vals) in enumerate(item["rows"]):
            if len(vals) != len(columns):
                raise ValueError(f"{item['code']} {when}: {len(vals)} values for {len(columns)} columns")
            start, end = field_period(when)
            for option, v in zip(columns, vals):
                if v == "*":
                    continue
                rows.append(row(construct, f"ATP {start.isoformat()}", start, end, option, v,
                                f"{CREDIT}, American Trends Panel, U.S. adults", url,
                                f"{CREDIT}, {title}; item {item['code']}",
                                n=item["n"] if i == 0 else None))
    return rows, questions


def lower_first(s: str) -> str:
    return s[0].lower() + s[1:] if s[:2] != s[:2].upper() else s


def voting_rows(text: str):
    return topline_rows(
        text, VOTING, VOTING_STEM, VOTING_COLUMNS, "election_policy",
        lambda w: f"Do Americans favor {lower_first(w)}?",
        lambda w: f"Favor or oppose {lower_first(w)}, on Pew Research Center's four-point scale.",
        VOTING_URL, "American Trends Panel Wave 176 topline (August 4-10, 2025)")


def priority_rows(text: str):
    return topline_rows(
        text, PRIORITIES, PRIORITIES_STEM, PRIORITIES_COLUMNS, "priority",
        lambda w: f"How much of a priority is {lower_first(w)}?",
        lambda w: f"How much of a priority {lower_first(w)} should be for the president and "
                  "Congress this year.",
        PRIORITIES_URL, "American Trends Panel Wave 140 topline (January 16-21, 2024)")


def appendix_rows(md: str) -> tuple[list[dict], dict]:
    rows, questions = [], {}
    note = f"{CREDIT}, 2026 midterms appendix (2026-07-23)"
    text = f"{CREDIT}, U.S. adults"
    for t in md_tables(md):
        head = t["header"]
        if head[:2] == ["", "Response"]:
            dates = [us_date(d) for d in head[2:]]
            for issue, response, *vals in t["rows"]:
                construct = f"party_agree_{AGREE_ISSUES[issue]}"
                questions[construct] = dict(
                    construct=construct,
                    label=f"Which party do Americans agree with more on {lower_first(issue)}?",
                    definition=f"Agree more with the Republican Party, the Democratic Party or "
                               f"neither on {lower_first(issue)}.",
                    wording=f"Thinking about some different policy issues, do you agree more with "
                            f"the Republican Party or the Democratic Party on {lower_first(issue)}?")
                for d, v in zip(dates, vals):
                    if v:
                        rows.append(row(construct, f"appendix {d.isoformat()}", d, d,
                                        AGREE_RESPONSES[response], v, text, APPENDIX_URL, note))
        elif head == ["Date", "Total Favorable", "Total Unfavorable", "Rep/Lean Rep", "Dem/Lean Dem"]:
            construct = "favorability_congress"
            questions[construct] = dict(
                construct=construct, label="Do Americans view Congress favorably?",
                definition="A favorable or unfavorable view of Congress, as each poll asked it.",
                wording=None)
            for when, fav, unfav, rep, dem in t["rows"]:
                d = us_date(when)
                version = f"appendix {d.isoformat()}"
                rows.append(row(construct, version, d, d, "Favorable", fav, text, APPENDIX_URL, note))
                rows.append(row(construct, version, d, d, "Unfavorable", unfav, text, APPENDIX_URL, note))
                for v, party in ((rep, "Republican"), (dem, "Democrat")):
                    rows.append(row(construct, version, d, d, "Favorable", v, text, APPENDIX_URL,
                                    f"{note}; {LEANERS}", "party", party))
    return rows, questions


def build(texts: dict[str, str]) -> tuple[dict[str, dict], list[dict]]:
    questions, rows = {}, []
    for part in (trust_rows(texts["trust.md"]),
                 voting_rows(texts["voting-2025-topline.pdf"]),
                 priority_rows(texts["priorities-2024-topline.pdf"]),
                 appendix_rows(texts["midterms-2026-appendix.md"])):
        rows += part[0]
        questions.update(part[1])
    return questions, rows


def owns(source_version: str) -> bool:
    return source_version.startswith(VERSION_PREFIX)


def run(store: Store, refresh: bool = False) -> int:
    questions, rows = build(fetch(refresh))
    taken = {c for (c,) in store.query(
        "SELECT DISTINCT construct FROM norms WHERE source <> ?", [SOURCE])}
    clash = sorted(set(questions) & taken)
    if clash:
        raise RuntimeError(f"construct ids already used by another source: {', '.join(clash)}")
    notes = ("Read from Pew Research Center's published pages and topline PDFs "
             "(audience/loaders/pew.py); each row's provenance_url is the document.")
    for c, q in sorted(questions.items()):
        entry = {"construct": c, "label": q["label"], "definition": q["definition"], "notes": notes}
        if store.column_exists("concordance", "gss_wording"):
            entry["gss_wording"] = q.get("wording")
        store.upsert_concordance(entry)
    total = store.upsert_norms(rows)
    from .polls import describe, prune_owned

    removed = prune_owned(store, SOURCE, VERSION_PREFIX, rows)
    store.touch_source(SOURCE)
    describe(store)
    print(f"pew: {total} rows in {len({r['source_version'] for r in rows})} polls and waves, "
          f"{len(questions)} questions; {removed} stale rows removed")
    return total
