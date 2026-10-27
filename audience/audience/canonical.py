"""The field's own trend lists, the anchors of the construct layer: python -m audience.canonical

Two lists, each a publisher's curated set of the trends it tracks. construct_layer.py builds
a construct from each item; this module fetches the lists and reads them.

GSS Key Trends (NORC at the University of Chicago), the GSS Data Explorer's Trends page,
https://gssdataexplorer.norc.org/trends. Public routes, no key, sent with the Explorer's
Origin header. They are the routes the Explorer's own front end calls, read from its script
bundle as the Internet Archive holds it (main.a23921cd.chunk.js, captured 2026-01-30): the
live site serves its page but not its scripts today.
  GET  https://yyq2en1ci9.execute-api.us-east-1.amazonaws.com/prod/get-trends
       the five categories and their subcategories
  POST .../prod/get-measures {"category": <category>}
       a category's subcategories, each with its items: cat (the item's title), id and
       varName (the trend variable, often a recode such as polviews_r)
  POST .../prod/get-trend-var-info {"var": <varName>}
       the item's bands, breakdowns and source variables (name, varId, desc, ques)
Saved together as raw/gss/key_trends/key_trends.json. An item links to its page as the
Explorer does: /trends?category=<category>&measure=<varName>.

ANES Guide to Public Opinion and Electoral Behavior (American National Election Studies),
https://electionstudies.org/resources/anes-guide/. Its page lists every chart under a section
and a subtopic, each titled with its years. The page is fetched once into
raw/anes/guide/guide.html; the site answers plain HTTP clients with 403, so the fetch goes
through curl_cffi, as the ANES loader's does. The chart pages render in the browser and name
no variable. The Guide's previous edition did name them, one page per table ("Table 2A.1.
Source: VCF0301 in the ANES Cumulative Data File"). Those pages are read from the Internet
Archive's latest capture of each (https://web.archive.org, top-tables/?id=1 to 123) into
raw/anes/guide/top_tables/. Their demographic breakdowns (second-tables) are not read.

Every request waits FETCH_DELAY seconds (ARCHIVE_DELAY at the Internet Archive, which refuses
a faster client) and retries three times. A fetched file is never
refetched without --refresh, so an interrupted fetch resumes where it stopped. The raw files
sync to the audience bucket's raw/gss/key_trends/ and raw/anes/guide/. Both publishers ask
to be cited; neither states other terms for these pages.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
from pathlib import Path

from . import config

GSS_DIR = config.RAW / "gss" / "key_trends"
ANES_DIR = config.RAW / "anes" / "guide"
KEY_TRENDS = GSS_DIR / "key_trends.json"
GUIDE_PAGE = ANES_DIR / "guide.html"
TOP_TABLES = ANES_DIR / "top_tables"
FETCH_DELAY = 1.0
# The Internet Archive refuses a client that asks faster than about one page in four seconds.
ARCHIVE_DELAY = 5.0

GSS_API = "https://yyq2en1ci9.execute-api.us-east-1.amazonaws.com/prod/"
GSS_HEADERS = {"Origin": "https://gssdataexplorer.norc.org",
               "User-Agent": "Mozilla/5.0 (audience loader)"}
GSS_TRENDS = "https://gssdataexplorer.norc.org/trends"
GUIDE_URL = "https://electionstudies.org/resources/anes-guide/"
GUIDE_CHART = GUIDE_URL + "anes-guide.html?chart="
TOP_TABLE_URL = GUIDE_URL + "top-tables/?id="
CDX = "http://web.archive.org/cdx/search/cdx"

KEY_TRENDS_LIST = "GSS Key Trends"
GUIDE_LIST = "ANES Guide to Public Opinion and Electoral Behavior"


def _retry(call, backoff: float = FETCH_DELAY * 5):
    for attempt in range(4):
        try:
            return call()
        except Exception as exc:  # noqa: BLE001 - every failure is retried, the last raised
            if attempt == 3:
                raise
            print(f"  retry {attempt + 1}: {exc}", flush=True)
            time.sleep(backoff * (attempt + 1))


def _gss(route: str, body: dict | None = None):
    import requests

    def call():
        if body is None:
            resp = requests.get(GSS_API + route, headers=GSS_HEADERS, timeout=120)
        else:
            resp = requests.post(GSS_API + route, json=body, headers=GSS_HEADERS, timeout=120)
        resp.raise_for_status()
        return resp.json()
    time.sleep(FETCH_DELAY)
    return _retry(call)


def fetch_key_trends(refresh: bool = False) -> Path:
    """Categories, their items and each item's variable record, in one file."""
    if KEY_TRENDS.exists() and not refresh:
        return KEY_TRENDS
    GSS_DIR.mkdir(parents=True, exist_ok=True)
    partial = KEY_TRENDS.with_suffix(".json.partial")
    done = json.loads(partial.read_text()) if partial.exists() and not refresh else {}
    trends = done.get("trends") or _gss("get-trends")
    measures = done.get("measures", {})
    for c in trends:
        name = c["Category"].strip()
        if name not in measures:
            measures[name] = _gss("get-measures", {"category": name})
    info = done.get("info", {})
    names = [t["varName"] for m in measures.values() for s in m["subCategories"]
             for t in s["subTopic"]]
    for i, var in enumerate(names, start=1):
        if var in info:
            continue
        info[var] = _gss("get-trend-var-info", {"var": var})
        if i % 20 == 0:
            partial.write_text(json.dumps({"trends": trends, "measures": measures, "info": info}))
            print(f"  key trends: {len(info)}/{len(names)} items", flush=True)
    for c in trends:
        c.pop("Img", None)   # an inline picture, not data
    KEY_TRENDS.write_text(json.dumps(
        {"routes": [GSS_API + r for r in ("get-trends", "get-measures", "get-trend-var-info")],
         "fetched": time.strftime("%Y-%m-%d"), "trends": trends, "measures": measures,
         "info": info}, ensure_ascii=False, indent=1) + "\n")
    partial.unlink(missing_ok=True)
    return KEY_TRENDS


def _anes_get(url: str) -> str:
    from curl_cffi import requests as creq

    def call():
        resp = creq.get(url, impersonate="chrome", timeout=120)
        resp.raise_for_status()
        return resp.text
    time.sleep(FETCH_DELAY)
    return _retry(call)


def _captures(prefix: str) -> dict[str, str]:
    """url -> its latest successful Internet Archive capture timestamp, for every url under
    prefix, in one index query."""
    import requests

    def cdx():
        resp = requests.get(CDX, params={"url": prefix, "matchType": "prefix", "output": "json",
                                         "filter": "statuscode:200"}, timeout=180)
        resp.raise_for_status()
        return resp.json()
    latest: dict[str, str] = {}
    for row in _retry(cdx, backoff=120)[1:]:
        url = row[2].replace("http://", "https://").replace(":80/", "/")
        latest[url] = max(latest.get(url, ""), row[1])
    return latest


def _archived(url: str, stamp: str) -> str:
    import requests

    def body():
        resp = requests.get(f"https://web.archive.org/web/{stamp}id_/{url}", timeout=120)
        resp.raise_for_status()
        return resp.text
    time.sleep(ARCHIVE_DELAY)
    return _retry(body, backoff=120)


def fetch_anes_guide(refresh: bool = False, tables: range = range(1, 124)) -> Path:
    """The Guide's page, and its previous edition's top tables from the Internet Archive."""
    ANES_DIR.mkdir(parents=True, exist_ok=True)
    if refresh or not GUIDE_PAGE.exists():
        GUIDE_PAGE.write_text(_anes_get(GUIDE_URL))
    TOP_TABLES.mkdir(exist_ok=True)
    todo = [n for n in tables if refresh or not (TOP_TABLES / f"{n}.html").exists()]
    captures = _captures(TOP_TABLE_URL) if todo else {}
    missing = []
    for n in todo:
        url = TOP_TABLE_URL + str(n)
        if url not in captures:
            missing.append(n)
            continue
        body = _archived(url, captures[url])
        (TOP_TABLES / f"{n}.html").write_text(
            f"<!-- web.archive.org capture {captures[url]} of {url} -->\n{body}")
        print(f"  ANES Guide table {n}: capture {captures[url]}", flush=True)
    if missing:
        print(f"  no archived capture for top tables {missing}")
    return ANES_DIR


def _text(fragment: str) -> str:
    fragment = re.sub(r"<script.*?</script>|<style.*?</style>", " ", fragment, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def key_trends() -> list[dict]:
    """Every Key Trends item: its category and subcategory, title, trend variable, the source
    variables its record names (lowercased, the year variable aside) and its page."""
    from urllib.parse import quote

    data = json.loads(KEY_TRENDS.read_text())
    items = []
    for category, m in data["measures"].items():
        for sub in m["subCategories"]:
            for t in sub["subTopic"]:
                record = data["info"][t["varName"]]
                variables = [v["name"].lower() for v in record.get("variable", [])
                             if v["name"].lower() != "year"]
                # A record naming no variable stands for its own trend variable.
                variables = variables or [re.sub(r"(_r\d*|_rec)$", "", t["varName"].lower())]
                items.append({
                    "list": KEY_TRENDS_LIST, "subject": category, "subtopic": sub["name"].strip(),
                    "item": t["cat"].strip(), "key": t["varName"], "variables": variables,
                    "url": f"{GSS_TRENDS}?category={quote(category)}&measure={t['varName']}"})
    return items


GUIDE_TOKEN = re.compile(
    r'<button[^>]*accordion-button[^>]*>(.*?)</button>'
    r'|<h3 class="subtopic">(.*?)</h3>'
    r'|<p class="guide_chart_title"><a href="anes-guide\.html\?chart=([^"]+)"[^>]*>(.*?)'
    r'<span class="guide_chart_title_year">(.*?)</span>', re.S)


def guide_items() -> list[dict]:
    """Every chart on the Guide's page: section, subtopic, title, years and page."""
    page = GUIDE_PAGE.read_text()
    page = page[page.find("Expand All"):]
    items, section, subtopic = [], None, None
    for m in GUIDE_TOKEN.finditer(page):
        if m.group(1) is not None:
            section = _text(m.group(1))
        elif m.group(2) is not None:
            subtopic = _text(m.group(2))
        else:
            first, _, last = _text(m.group(5)).partition("-")
            items.append({"list": GUIDE_LIST, "subject": section, "subtopic": subtopic,
                          "item": _text(m.group(4)), "key": m.group(3),
                          "years": (int(first), int(last or first)),
                          "url": GUIDE_CHART + m.group(3)})
    return items


SOURCE = re.compile(r"Table (\S+?)\.? Source: (.*?) in the ANES Cumulative Data File")
VCF = re.compile(r"\bVCF\d{4}[a-z]?\b", re.I)


def guide_tables() -> list[dict]:
    """The previous edition's top tables: number, title, the VCF variables its source line
    names, its question text and the capture read."""
    out = []
    for path in sorted(TOP_TABLES.glob("*.html"), key=lambda p: int(p.stem)):
        raw = path.read_text(errors="replace")
        stamp = re.match(r"<!-- web.archive.org capture (\d+)", raw)
        text = _text(raw)
        head = "The ANES Guide to Public Opinion and Electoral Behavior"
        title = text[text.find(head) + len(head):].strip() if head in text else ""
        title = re.split(r"\s+(?:\d{4}\s*-\s*\d{4}|\d{4})\b", title, maxsplit=1)[0].strip()
        source = SOURCE.search(text)
        question = re.search(r"Question Text: (.*?)(?: Link to | Back to |$)", text)
        out.append({
            "id": int(path.stem), "title": title,
            "table": source.group(1) if source else None,
            "variables": sorted({v.upper() for v in VCF.findall(source.group(2))}) if source else [],
            "question": question.group(1)[:600] if question else None,
            "capture": stamp.group(1) if stamp else None,
            "url": TOP_TABLE_URL + path.stem})
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m audience.canonical")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args(argv)
    fetch_key_trends(args.refresh)
    fetch_anes_guide(args.refresh)
    print(f"GSS Key Trends: {len(key_trends())} items -> {KEY_TRENDS}")
    tables = guide_tables()
    print(f"ANES Guide: {len(guide_items())} charts; previous edition: {len(tables)} tables, "
          f"{sum(1 for t in tables if t['variables'])} naming variables -> {ANES_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
