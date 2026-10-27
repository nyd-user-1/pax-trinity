"""ANES topics: python -m audience.load anes_topics

Every ANES construct in the store gains the subjects ANES files its question under, in
concordance.anes_topics; the export serves them, with any GSS or CES tags, as the constructs
entry's optional `topics`.

Source: the Time Series Cumulative Data File's variable list by subject, "Contents - ANES
Cumulative Data File", linked from the CDF's page
(https://electionstudies.org/data-center/anes-time-series-cumulative-data-file/) as
  https://electionstudies.org/anes_timeseries_cdf_codebook_Varlist
which redirects to the PDF (wp-content/uploads/2019/09/anes_timeseries_cdf_codebook_Varlist.pdf).
It files every VCF variable under a Roman-numeral section ("I. PARTISANSHIP AND ATTITUDES
TOWARDS PARTIES") and, for most, a lettered subsection ("III.A. ISSUES SOCIAL WELFARE"), the
headings set in Calibri-Bold. The site refuses plain HTTP clients, so the fetch uses curl_cffi
(anes_bulk._get), once, into raw/anes/topics/, synced to the audience bucket; ANES data and
documentation are free to use with citation (ANES terms of use). The variable codebook itself
(raw/anes/, the bulk tier's) carries no subject headings.

A construct's topics are its variables' headings, verbatim and in the list's order: the
section, then the subsection. A subsection takes only the section printed with its own numeral:
the list prints no heading for sections VI and XII, so their subsections (CIVIC PARTICIPATION,
ENGAGEMENT AND INFORMATION, CAMPAIGN ACTIVITY, REGISTRATION, TURNOUT, AND VOTE CHOICE;
Contextual - Election, Contextual - Vote Validation) stand alone rather than inherit the
section before. Headings that name the fielding apparatus rather than a subject (APPARATUS:
section X, ids, weights and samples, and section XI, administration, the screener and the
interviewer's observations and demographics) are left out, and reports/anes_topics.json names
the constructs that had nothing else.

The 2024 Time Series Study's own variables (V24xxxx, those the CDF does not carry) have no
subject filing to take: its variable list, user guide and codebook group variables only by
interview phase (PRE-ELECTION SURVEY VARIABLES, WEIGHTING VARIABLES, ...), which is the
apparatus too, and its questionnaire's item ids carry module codes (CAMPINT_, GEND_) the
documentation never names. Those constructs ship without topics. A harmonized construct takes
the tags of every variable its concordance row names, in order of first appearance.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from .. import config, survey
from ..db import Store
from . import anes, anes_bulk, gss_topics

SOURCE = "ANES"
VARLIST_URL = "https://electionstudies.org/anes_timeseries_cdf_codebook_Varlist"
VARLIST = Path("topics") / "anes_timeseries_cdf_codebook_varlist.pdf"
REPORT = config.ROOT / "reports" / "anes_topics.json"
APPARATUS = frozenset({"IDs, Weights, and samples", "Administration",
                       "Screener administration/ household composition",
                       "Interviewer observation(post-interview)", "Demographics of interviewer"})
HEADING = re.compile(r"^([IVXL]+)(?:\.([A-Z]))?\.\s+(.+)$")


def fetch(raw_dir: Path | None = None, refresh: bool = False) -> Path | None:
    """The CDF variable list, fetched once into raw/anes/topics/. A test's raw_dir never
    downloads: the list is read where it is or not at all."""
    path = anes._dir(raw_dir) / VARLIST
    if path.exists() and not refresh:
        return path
    if raw_dir is not None:
        return None
    return anes_bulk._get(VARLIST_URL, path, b"%PDF")


def parse_varlist(path: Path) -> dict[str, list[str]]:
    """VCF variable (lowercased) -> its [section, subsection] headings as printed."""
    import pdfplumber

    out: dict[str, list[str]] = {}
    section = numeral = subsection = None
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            lines: dict[int, list[dict]] = {}
            for w in page.extract_words(extra_attrs=["fontname"]):
                lines.setdefault(round(w["top"]), []).append(w)
            for top in sorted(lines):
                words = sorted(lines[top], key=lambda w: w["x0"])
                text = re.sub(r"\s+", " ", " ".join(w["text"] for w in words)).strip()
                m = HEADING.match(text)
                if m and "Bold" in words[0]["fontname"]:
                    roman, letter, title = m.groups()
                    if letter is None:
                        section, numeral, subsection = title, roman, None
                    else:
                        if roman != numeral:          # no heading printed for this section
                            section, numeral = None, roman
                        subsection = title
                    continue
                if re.match(r"^VCF\w+$", words[0]["text"]):
                    out.setdefault(words[0]["text"].lower(),
                                   [h for h in (section, subsection) if h])
    return out


def anes_constructs(store: Store) -> dict[str, list[str]]:
    """Every construct with ANES rows -> the ANES variables its concordance row names."""
    rows = store.query(
        "SELECT construct, anes_var FROM concordance WHERE construct IN "
        "(SELECT DISTINCT construct FROM norms WHERE source = ?) ORDER BY 1", [SOURCE])
    return {c: [v.lower() for v in survey._as_list(a)] for c, a in rows}


def topics(constructs: dict[str, list[str]], filed: dict[str, list[str]]):
    """(construct -> tags, construct -> why it has none)."""
    found, why = {}, {}
    for construct, avars in constructs.items():
        listed = [v for v in avars if v in filed]
        tags = list(dict.fromkeys(t for v in listed for t in filed[v] if t not in APPARATUS))
        if tags:
            found[construct] = tags
        elif listed:
            why[construct] = "filed only under the fielding apparatus"
        elif avars and all(v.startswith("v24") for v in avars):
            why[construct] = "a 2024 Time Series Study variable: no subject filing"
        else:
            why[construct] = "not in the CDF variable list"
    return found, why


def write_report(constructs, found, why, path: Path = REPORT) -> None:
    tally = Counter(t for tags in found.values() for t in tags)
    by_reason: dict[str, list[str]] = {}
    for c, reason in why.items():
        by_reason.setdefault(reason, []).append(c)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "constructs": len(constructs), "tagged": len(found),
        "untagged": {k: sorted(v) for k, v in sorted(by_reason.items())},
        "vocabulary": len(tally), "tags": dict(tally.most_common()),
        "apparatus_left_out": sorted(APPARATUS),
    }, ensure_ascii=False, indent=1))


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        report: bool = True) -> int:
    path = fetch(raw_dir, refresh=refresh)
    if path is None:
        print("The ANES CDF variable list is not under raw/anes/topics/ and was not fetched; "
              "no ANES topics were written.")
        return 0
    constructs = anes_constructs(store)
    found, why = topics(constructs, parse_varlist(path))
    written = gss_topics.write(store, found, constructs, column="anes_topics")
    if report:
        write_report(constructs, found, why)
    where = " (reports/anes_topics.json)" if report else ""
    print(f"ANES topics: {written:,} of {len(constructs):,} constructs tagged; "
          f"{len(constructs) - written:,} without{where}")
    return written
