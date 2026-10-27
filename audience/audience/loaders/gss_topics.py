"""GSS topics: python -m audience.load gss_topics

Every GSS construct in the store gains the subjects the GSS Data Explorer files its question
under, in concordance.gss_topics; the export serves them as the constructs entry's optional
`topics`.

Source: the GSS Data Explorer (NORC at the University of Chicago), two public routes, no key,
the Explorer's own Origin header:

- The variable list, the route gss.explorer_catalog() reads for the bulk tier's links and
  gss_wording.py for the question texts. Its records carry id, name, description,
  surveyQuestion, years, module, subject and tag_info; the earlier cache kept the first four.
    https://3ilfsaj2lj.execute-api.us-east-1.amazonaws.com/prod/guest-variable?page=<n>&limit=100
  A page returns some thirty variables whatever the limit, and consecutive pages overlap, so
  the fetch reads page after page until three come back empty and keeps one record per id.
  Saved verbatim, sorted by id, as raw/gss/data_explorer_subjects.json.
- A variable's own record, the one its page renders
  (https://gssdataexplorer.norc.org/variables/<id>/vshow; workspace_id=NaN is what the page
  sends for a guest):
    https://3ilfsaj2lj.execute-api.us-east-1.amazonaws.com/prod/variables/guest-details/<id>?workspace_id=NaN
  Fetched only for the variables the list gives no subject; where the list has one, the page
  shows the same. Saved verbatim, keyed by id, as raw/gss/data_explorer_details.json.

Both fetches wait FETCH_DELAY seconds between requests, retry a failed request three times,
and checkpoint to <file>.partial so an interrupted fetch resumes where it stopped. Both files
sync to the audience bucket's raw/gss/ prefix beside the wordings cache, and a cached file is
never refetched without --refresh. The GSS data and documentation are free for public use
with citation (NORC); the Explorer states no other terms for these routes.

A construct's topics are its variable's subjects exactly as the Explorer gives them: the
list's, or where the list has none, the page's. For many variables first asked since 2010 the
page's subject is only the name of the module that asked it (GSS Next, ISSP Digital
Societies); a module isn't a topic (the lead's ruling, 2026-10-26), so those are skipped and
the construct ships without topics, while the raw files keep every module for a module
grouping later. reports/gss_topics.json names the constructs skipped that way. A tag the
source repeats appears once. A harmonized construct pooling several
variables takes all of theirs in the order they first appear; a construct whose variables
carry no subject has no topics.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from .. import config
from ..db import Store
from . import gss, gss_wording

SOURCE = "GSS"
SUBJECTS = "data_explorer_subjects.json"
FETCH_DELAY = 0.5
CHECKPOINT = 10
EMPTY_PAGES = 3
REPORT = config.ROOT / "reports" / "gss_topics.json"


HEADERS = {"User-Agent": "Mozilla/5.0 (audience loader)",
           "Origin": "https://gssdataexplorer.norc.org"}
DETAILS = "data_explorer_details.json"
DETAILS_API = "https://3ilfsaj2lj.execute-api.us-east-1.amazonaws.com/prod/variables/guest-details/"


def _request(url: str, params: dict) -> dict:
    import requests

    for attempt in range(4):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=120)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    return {}


def _get(page: int) -> list[dict]:
    return _request(gss.EXPLORER_API, {"page": page, "limit": 100}).get("variables") or []


def _details(vid: int) -> dict:
    return (_request(f"{DETAILS_API}{vid}", {"workspace_id": "NaN"}).get("response") or {}
            ).get("response") or {}


def fetch(raw_dir: Path | None = None, refresh: bool = False) -> Path | None:
    """The Explorer's full variable records, fetched once into raw/gss/; returns the path."""
    d = gss._dirs(raw_dir)
    target = d / SUBJECTS
    if target.exists() and not refresh:
        return target
    partial = d / f"{SUBJECTS}.partial"
    state = {"next_page": 1, "empty_run": 0, "records": {}}
    if partial.exists() and not refresh:
        state = json.loads(partial.read_text())
        print(f"resuming the Explorer fetch at page {state['next_page']} "
              f"({len(state['records']):,} records so far)")
    d.mkdir(parents=True, exist_ok=True)
    try:
        while state["empty_run"] < EMPTY_PAGES:
            page = state["next_page"]
            got = _get(page)
            state["empty_run"] = 0 if got else state["empty_run"] + 1
            for v in got:
                state["records"][str(v["id"])] = v
            state["next_page"] = page + 1
            if page % CHECKPOINT == 0:
                partial.write_text(json.dumps(state))
                print(f"  page {page}: {len(state['records']):,} records", flush=True)
            time.sleep(FETCH_DELAY)
    except Exception as exc:
        partial.write_text(json.dumps(state))
        print(f"Explorer fetch stopped at page {state['next_page']} ({exc}); rerun to resume")
        return None
    records = sorted(state["records"].values(), key=lambda v: v["id"])
    target.write_text(json.dumps(records, ensure_ascii=False))
    partial.unlink(missing_ok=True)
    print(f"{len(records):,} Explorer records -> {target}")
    return target


def fetch_details(ids, raw_dir: Path | None = None, refresh: bool = False) -> Path | None:
    """The page records of the given variable ids, fetched once each into raw/gss/."""
    d = gss._dirs(raw_dir)
    target, partial = d / DETAILS, d / f"{DETAILS}.partial"
    have: dict[str, dict] = {}
    if not refresh:
        for f in (target, partial):
            if f.exists():
                have.update(json.loads(f.read_text()))
    todo = [str(i) for i in ids if str(i) not in have]
    if not todo and target.exists() and not partial.exists():
        return target
    if todo:
        print(f"fetching {len(todo):,} Explorer variable pages ({len(have):,} cached)")
    d.mkdir(parents=True, exist_ok=True)
    try:
        for n, vid in enumerate(todo, start=1):
            have[vid] = _details(int(vid))
            if n % (CHECKPOINT * 5) == 0:
                partial.write_text(json.dumps(have, ensure_ascii=False))
                print(f"  {n:,} of {len(todo):,} pages", flush=True)
            time.sleep(FETCH_DELAY)
    except Exception as exc:
        partial.write_text(json.dumps(have, ensure_ascii=False))
        print(f"Explorer page fetch stopped ({exc}); rerun to resume")
        return None
    target.write_text(json.dumps(dict(sorted(have.items(), key=lambda kv: int(kv[0]))),
                                 ensure_ascii=False))
    partial.unlink(missing_ok=True)
    return target


def _tags(values) -> list[str]:
    return list(dict.fromkeys(t for t in (values or []) if t))   # the source repeats a few


def subjects(raw_dir: Path | None = None, refresh: bool = False) -> dict[str, list[str]]:
    """mnemonic (lowercased) -> its Explorer subjects, verbatim and in the Explorer's order:
    the variable list's, or the variable's own page's where the list has none, unless the page's
    subject is only the name of its module."""
    path = fetch(raw_dir, refresh=refresh)
    if path is None:
        return {}
    records = json.loads(path.read_text())
    bare = [v["id"] for v in records if not _tags(v.get("subject"))]
    details_path = fetch_details(bare, raw_dir, refresh=refresh)
    pages = json.loads(details_path.read_text()) if details_path else {}
    out: dict[str, list[str]] = {}
    for v in records:
        tags = _tags(v.get("subject"))
        if not tags:
            page = pages.get(str(v["id"])) or {}
            tags = [] if _module_named(page) else _tags(page.get("subject"))
        out.setdefault(v["name"].lower(), tags)
    return out


def _module_named(page: dict) -> bool:
    """The page's subject is nothing but the name of the module that asked it."""
    tags = _tags(page.get("subject"))
    return bool(tags) and set(tags) <= set(page.get("module") or [])


def provenance(raw_dir: Path | None = None) -> dict[str, str]:
    """mnemonic (lowercased) -> where its subjects come from: "list", "page", or "page: the
    module's name" where the page's subject is only the name of the module that asked it, and
    so skipped."""
    d = gss._dirs(raw_dir)
    if not (d / SUBJECTS).exists():
        return {}
    pages = json.loads((d / DETAILS).read_text()) if (d / DETAILS).exists() else {}
    out: dict[str, str] = {}
    for v in json.loads((d / SUBJECTS).read_text()):
        page = pages.get(str(v["id"])) or {}
        if _tags(v.get("subject")):
            where = "list"
        elif _tags(page.get("subject")):
            where = "page: the module's name" if _module_named(page) else "page"
        else:
            continue
        out.setdefault(v["name"].lower(), where)
    return out


def topics(constructs: dict[str, list[str]], by_var: dict[str, list[str]]) -> dict[str, list[str]]:
    """construct -> its topics: its variable's subjects, or for a construct pooling several
    variables, all of theirs in the order they first appear. Constructs with none are absent."""
    found = {}
    for construct, gvars in constructs.items():
        tags: list[str] = []
        for var in gvars:
            for tag in by_var.get(var, by_var.get(f"{var}_", [])):   # class_, union_
                if tag not in tags:
                    tags.append(tag)
        if tags:
            found[construct] = tags
    return found


def write(store: Store, found: dict[str, list[str]], constructs) -> int:
    """Replace the GSS topics: those found set, every other GSS construct's cleared."""
    pairs = [(c, found.get(c)) for c in constructs]
    with store.transaction():
        for i in range(0, len(pairs), 500):
            part = pairs[i:i + 500]
            store.execute(
                "UPDATE concordance SET gss_topics = v.t FROM (VALUES "
                + ", ".join("(?, ?)" for _ in part)
                + ") AS v(c, t) WHERE concordance.construct = v.c",
                [x for c, t in part for x in (c, store.array_value(t))])
    return sum(1 for _, t in pairs if t)


def write_report(constructs: dict[str, list[str]], found: dict[str, list[str]], path: Path,
                 where: dict[str, str] | None = None) -> None:
    from collections import Counter

    where = where or {}
    tally = Counter(t for tags in found.values() for t in tags)
    source = {c: sorted({where.get(v, where.get(f"{v}_", "")) for v in gvars} - {""})
              for c, gvars in constructs.items()}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "constructs": len(constructs), "tagged": len(found),
        "tagged_from": dict(Counter(", ".join(v) for c, v in source.items()
                                    if c in found).most_common()),
        "untagged": sorted(set(constructs) - set(found)),
        "vocabulary": len(tally),
        "tags": dict(tally.most_common()),
        "skipped_as_module_names": sorted(c for c, v in source.items() if c not in found
                                          and v == ["page: the module's name"]),
        "pooled": {c: found.get(c, []) for c, v in constructs.items() if len(v) > 1},
    }, ensure_ascii=False, indent=1))


def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        report: bool = True) -> int:
    by_var = subjects(raw_dir, refresh=refresh)
    if not by_var:
        print("The GSS Data Explorer's variable records are not under raw/gss/ and could not be "
              "fetched; no topics were written.")
        return 0
    constructs = gss_wording.gss_constructs(store)
    found = topics(constructs, by_var)
    written = write(store, found, constructs)
    if report:
        write_report(constructs, found, REPORT, provenance(raw_dir))
    where = " (reports/gss_topics.json)" if report else ""
    print(f"GSS topics: {written:,} of {len(constructs):,} constructs tagged; "
          f"{len(constructs) - written:,} without{where}")
    return written
