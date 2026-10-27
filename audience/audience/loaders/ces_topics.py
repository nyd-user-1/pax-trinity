"""CES topics: python -m audience.load ces_topics

Every CES construct in the store gains the section the CES files its question under, in
concordance.ces_topics; the export serves it, with any GSS or ANES tags, as the constructs
entry's optional `topics`.

Source: the Guide to the Cumulative Common Content (Kuriwaki, Harvard Dataverse,
doi:10.7910/DVN/II2DB6, CC0), the PDF ces_bulk already fetches into raw/ces/docs/ and the
audience bucket holds. Its bookmark outline files every cumulative variable under a section of
"Variables" (Demographics, Turnout, Partisan Identity, Approval, Presidential Vote, ...), each
entry "name: label"; the step reads that outline (pdfminer, which pdfplumber brings), so
nothing is scraped. A test's raw_dir never downloads.

A construct's topics are the sections its variables are filed under, verbatim, one per
variable: the outline is flat, so "Vote Choice Variables", "Presidential Vote" and "House,
Senate and Governor Vote" are siblings, not parent and child. A variable matches by its name,
which the CES keeps across years: the cumulative tier's own variables, and a year's variable
under the same name (employ, faminc, newsint). Sections that name the fielding apparatus
rather than a subject (APPARATUS: Administration, Weights) are left out.

The yearly Common Content has no subject filing to take: each year's guide tabulates its
variables in one flat run under "Common Content", its five parts are fielding phases (sample
identifiers, profile, pre-election, post-election, contextual), the questionnaires' modules are
the instrument's flow blocks (commoncore, implicit_module_1, alreadyvoted), and the Dataverse
files are not ingested as tabular, so they carry no variable groups. Those constructs ship
without topics; reports/ces_topics.json names every untagged construct and why.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from .. import config, survey
from ..db import Store
from . import ces, ces_bulk, gss_topics

SOURCE = "CES"
GUIDE = Path("docs") / ces_bulk.CUMULATIVE_GUIDE[0]
REPORT = config.ROOT / "reports" / "ces_topics.json"
APPARATUS = frozenset({"Administration", "Weights"})


def fetch(raw_dir: Path | None = None, refresh: bool = False) -> Path | None:
    """The cumulative guide, fetched once from Dataverse into raw/ces/docs/ where ces_bulk
    has not already put it. A test's raw_dir never downloads."""
    path = ces._dir(raw_dir) / GUIDE
    if path.exists() and not refresh:
        return path
    if raw_dir is not None:
        return None
    import requests

    name, fid = ces_bulk.CUMULATIVE_GUIDE
    try:
        resp = requests.get(f"https://dataverse.harvard.edu/api/access/datafile/{fid}",
                            timeout=300)
        resp.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(resp.content)
    except Exception as exc:
        print(f"download failed: {exc}")
        return None
    return path


def parse_guide(path: Path) -> dict[str, str]:
    """Cumulative variable name (lowercased) -> its section of "Variables", as printed."""
    from pdfminer.pdfdocument import PDFDocument
    from pdfminer.pdfparser import PDFParser

    out: dict[str, str] = {}
    with open(path, "rb") as fh:
        outline = [(level, title) for level, title, *_ in PDFDocument(PDFParser(fh)).get_outlines()]
    inside, section = False, None
    for level, title in outline:
        title = " ".join(str(title).split())
        if level == 1:
            inside = title == "Variables"
        elif inside and level == 2:
            section = title
        elif inside and level == 3 and ":" in title and section:
            out.setdefault(title.split(":", 1)[0].strip().lower(), section)
    return out


def ces_constructs(store: Store) -> dict[str, list[str]]:
    """Every construct with CES rows -> the CES variables its concordance row names."""
    rows = store.query(
        "SELECT construct, ces_var FROM concordance WHERE construct IN "
        "(SELECT DISTINCT construct FROM norms WHERE source = ?) ORDER BY 1", [SOURCE])
    return {c: [v.lower() for v in survey._as_list(a)] for c, a in rows}


def topics(constructs: dict[str, list[str]], filed: dict[str, str]):
    """(construct -> tags, construct -> why it has none)."""
    found, why = {}, {}
    for construct, cvars in constructs.items():
        listed = [v for v in cvars if v in filed]
        tags = list(dict.fromkeys(filed[v] for v in listed if filed[v] not in APPARATUS))
        if tags:
            found[construct] = tags
        elif listed:
            why[construct] = "filed only under the fielding apparatus"
        else:
            why[construct] = "a yearly Common Content variable: no subject filing"
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
        print("The cumulative CES guide is not under raw/ces/docs/ and was not fetched; "
              "no CES topics were written.")
        return 0
    constructs = ces_constructs(store)
    found, why = topics(constructs, parse_guide(path))
    written = gss_topics.write(store, found, constructs, column="ces_topics")
    if report:
        write_report(constructs, found, why)
    where = " (reports/ces_topics.json)" if report else ""
    print(f"CES topics: {written:,} of {len(constructs):,} constructs tagged; "
          f"{len(constructs) - written:,} without{where}")
    return written
