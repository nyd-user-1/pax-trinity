"""The polls registry: one record per poll behind the POLL source's rows (Brendan, through the
lead, 2026-11-02: "make sure an accurate representation of each poll is included somewhere
per poll"). python -m audience.export --source POLL (or the full export) writes it as
polls.json (split at the export's MAX_BYTES into polls-2.json, ...), named in index.json's
"polls" list.

The store keeps a poll only as its rows' slices (source_version); this gathers each poll's
slices and states what its sources say about it, nothing more. A field a source doesn't state
is absent, never guessed.

What makes one poll:
  - VoteHub splits a survey into a row per question. Its rows with the same pollster, sponsors,
    field dates and place (the state its races stand in, else the U.S.) are one poll: govblock's
    grouping, with sponsors and place added so two sponsors' or two states' polls on the same
    dates stay apart. A survey VoteHub cites by two documents (toplines and tables) stays one.
  - A pollster's release (loaders/releases.py) is the same poll as the VoteHub rows that cite
    it, and joins them.
  - The AP-NORC public-use file is the same poll as the seed's AP-NORC 2016-05 topline.
  - Pew's trust compilation: a poll per pollster and date as Pew lists it. Pew's toplines: a
    poll per American Trends Panel wave (a wave both toplines carry is one). Pew's 2026
    midterms appendix: a poll per table date as printed.
  - Each open-primaries seed poll is its own.

A record:
  id            "poll_" and ten hex characters of its identity; stable as its rows grow
  pollster      as the source names it; sponsors, partisan (VoteHub's sponsor flag) where given
  start, end    the field period (ISO dates); date_note where the source prints a month only
  geo           where its rows stand: "US" or a state FIPS
  populations   VoteHub's: [{code: a|rv|lv|v, label, n}], one per population it reports
  n             the sample a source states for the whole poll (Pew's topline header, the seed)
  sample, margin, mode, fieldwork, weighting, population
                the release's own words, kept only where they read as what they claim to be
                (a mode that names a mode, a fieldwork sentence that says "conducted", ...);
                margin is as printed (pollsters state 95%; the rows' moe column is 90%)
  wave          an American Trends Panel wave Pew names
  note          a source's own note on the poll, verbatim
  release_questions  how many questions the release prints (the rows carry only those asked
                in two or more releases)
  links         [{kind, url}]: release, cited (a document VoteHub cites), topline, page
  via           the compilations that carry it: VoteHub, release, Pew, seed
  votehub_ids   VoteHub's own ids for its rows
  questions     [{id, start, end}]: each question id (a constructs entry) it asked, at its wave
  rows          [{url, end, label}]: the keys of its exported rows. A row
                [construct, geo, start, end, option, dim, value, est, type, moe, item_text, n,
                provenance_url] belongs to the poll whose rows hold {url: provenance_url,
                end: end, label: item_text}.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from collections import defaultdict
from pathlib import Path

from . import config
from .db import Store

FIELDWORD = re.compile(r"\bconducted\b", re.I)
MODEWORD = re.compile(r"\b(online|web|internet|phone|telephone|landline|cell|text|sms|mail|"
                      r"interview|panel|ivr|mixed|live caller|in-person|face-to-face|opt-in)\w*", re.I)
POPWORD = re.compile(r"\b(adults?|voters?|citizens?|residents?|respondents?)\b", re.I)


def _pid(key: str) -> str:
    return "poll_" + hashlib.sha1(key.encode()).hexdigest()[:10]


def _said(text: str | None, word: re.Pattern, limit: int) -> str | None:
    """A release's own words, kept only where they read as what they claim to be."""
    t = re.sub(r"\s+", " ", text or "").strip()
    # A fragment that starts mid-word ("ts beginning with ...") isn't the release's statement.
    return t if t and len(t) <= limit and word.search(t) and t.upper() != t and not t[:1].islower() else None


class _Union:
    def __init__(self):
        self.up: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.up.setdefault(x, x)
        while self.up[x] != x:
            self.up[x] = self.up[self.up[x]]
            x = self.up[x]
        return x

    def join(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.up[max(ra, rb)] = min(ra, rb)


def _slices(store: Store) -> dict[str, dict]:
    """Each POLL slice's questions (with their waves), row keys and places, from the store."""
    out: dict[str, dict] = defaultdict(lambda: {"questions": set(), "rows": set(), "geo": set(),
                                                "n": set(), "moe": set(), "notes": set()})
    for sv, construct, start, end, geo, text, url, n, moe, note in store.query(
            "SELECT DISTINCT source_version, construct, period_start, period_end, geo_code, "
            "item_text, provenance_url, CASE WHEN subgroup_dim = 'all' THEN n END, "
            "CASE WHEN subgroup_dim = 'all' THEN moe END, provenance_note "
            "FROM norms WHERE source = 'POLL' AND geography <> 'BLOCKGROUP'"):
        s = out[sv]
        s["questions"].add((construct, start.isoformat(), end.isoformat()))
        s["rows"].add((url, end.isoformat(), text))
        s["geo"].add(geo)
        if n is not None:
            s["n"].add(int(n))
        if moe is not None:
            s["moe"].add(float(moe))
        if note:
            s["notes"].add(note)
    return out


def _votehub(slices: dict) -> dict[str, dict]:
    from .loaders import votehub

    ids = {sv[len(votehub.VERSION_PREFIX):] for sv in slices if votehub.owns(sv)}
    if not ids:
        return {}
    polls, _ = votehub.fetch(refresh=False)
    return {p["id"]: p for p in polls if p.get("id") in ids}


def _releases(slices: dict, vh: dict) -> dict[str, dict]:
    """Each release slice's parsed release and the VoteHub ids that cite it, read from the
    release cache; empty where the cache isn't on this machine."""
    from .loaders import releases

    svs = {sv for sv in slices if releases.owns(sv)}
    cache = releases.CACHE
    if not svs or not (cache / "manifest.json").exists():
        return {}
    by8 = {sv.rsplit(" ", 1)[-1]: sv for sv in svs}
    manifest = json.loads((cache / "manifest.json").read_text())["urls"]
    cites: dict[str, set[str]] = defaultdict(set)
    for pid, p in vh.items():
        cites[p.get("url")].add(pid)
    out: dict[str, dict] = {}
    for url, entry in manifest.items():
        f = entry.get("file")
        if not f or f["sha256"][:8] not in by8:
            continue
        sv = by8[f["sha256"][:8]]
        rec = out.get(sv)
        if rec is None:
            path = cache / "parsed" / f"{f['sha256']}.json"
            rec = out[sv] = {"release": json.loads(path.read_text()), "url": entry.get("pdf_url") or url,
                             "votehub": set()}
        rec["votehub"] |= cites.get(url, set())
    return out


MONTH = {m: i for i, m in enumerate(["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY",
                                     "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"], 1)}


def _pew_docs() -> dict[str, dict]:
    """What Pew's two toplines state about their own wave: its name, N, first field day and,
    for the 2025 wave, its mode."""
    from .loaders import pew

    out = {}
    for name, url in (("voting-2025-topline.txt", pew.VOTING_URL), ("priorities-2024-topline.txt", pew.PRIORITIES_URL)):
        path = pew.RAW / name
        if not path.exists():
            continue
        head = path.read_text(encoding="utf-8")[:2500]
        wave = re.search(r"WAVE (\d+)", head)
        n = re.search(r"N=([\d,]+)", head)
        day = re.search(r"\b(" + "|".join(MONTH) + r") (\d{1,2})[-–]\d{1,2}, (\d{4})", head)
        out[url] = {"wave": f"American Trends Panel Wave {wave[1]}" if wave else None,
                    "n": int(n[1].replace(",", "")) if n else None,
                    "start": f"{day[3]}-{MONTH[day[1]]:02d}-{int(day[2]):02d}" if day else None,
                    "mode": "primarily online, with some interviews conducted by live telephone"
                    if re.search(r"conducted primarily online,\s+with some interviews conducted by live\s+telephone", head)
                    else None}
    return out


def build(store: Store) -> list[dict]:
    from .loaders import pew, polls as seedpolls, releases, votehub

    slices = _slices(store)
    vh = _votehub(slices)
    rel = _releases(slices, vh)
    pewdoc = _pew_docs()
    u = _Union()
    keyof: dict[str, str] = {}

    def place(p: dict) -> str:
        q = votehub.question_of(p["poll_type"], p["subject"]) or {}
        return votehub.FIPS[q["state"]] if q.get("state") else "US"

    for sv in slices:
        u.find(sv)
        if votehub.owns(sv):
            p = vh.get(sv[len(votehub.VERSION_PREFIX):])
            if p:
                k = "|".join([p["pollster"], ";".join(sorted(p.get("sponsors") or [])),
                              p.get("start_date") or p["end_date"], p["end_date"], place(p)])
                keyof[sv] = "votehub|" + k
                u.join(sv, "votehub|" + k)
        elif releases.owns(sv) and sv in rel:
            for pid in rel[sv]["votehub"]:
                u.join(sv, votehub.VERSION_PREFIX + pid)
    from .loaders import apnorc
    if apnorc.SOURCE_VERSION in slices and "AP-NORC 2016-05" in slices:
        u.join(apnorc.SOURCE_VERSION, "AP-NORC 2016-05")

    groups: dict[str, list[str]] = defaultdict(list)
    for sv in slices:
        groups[u.find(sv)].append(sv)

    records = []
    for root, svs in groups.items():
        svs.sort()
        rec: dict = {"links": [], "via": []}
        anchor = sorted(keyof[sv] for sv in svs if sv in keyof)
        rec["id"] = _pid(anchor[0] if anchor else svs[0])
        vps = [vh[sv[len(votehub.VERSION_PREFIX):]] for sv in svs
               if votehub.owns(sv) and sv[len(votehub.VERSION_PREFIX):] in vh]
        rels = [rel[sv] for sv in svs if sv in rel]
        if vps:
            rec["via"].append("VoteHub")
            rec["pollster"] = vps[0]["pollster"]
            sponsors = sorted({s for p in vps for s in (p.get("sponsors") or [])})
            if sponsors:
                rec["sponsors"] = sponsors
            partisan = {p["partisan"] for p in vps if p.get("partisan")}
            if len(partisan) == 1:
                rec["partisan"] = partisan.pop()
            pops: dict[str, int | None] = {}
            for p in vps:
                code = p.get("population")
                if code:
                    n = p.get("sample_size") or None
                    pops[code] = max(filter(None, [pops.get(code), n]), default=None)
            if pops:
                rec["populations"] = [{"code": c, "label": votehub.POPULATIONS.get(c, c),
                                       **({"n": n} if n else {})} for c, n in sorted(pops.items())]
            release_urls = {r["url"] for r in rels}
            for url in sorted({p["url"] for p in vps} - release_urls):
                rec["links"].append({"kind": "cited", "url": url})
            rec["votehub_ids"] = sorted(p["id"] for p in vps)
        if rels:
            rec["via"].append("release")
            r0 = rels[0]["release"]
            # Release rows' item_text opens on VoteHub's name for the pollster.
            label = next(k[2] for sv in svs if releases.owns(sv) for k in slices[sv]["rows"])
            rec.setdefault("pollster", label.split(",")[0])
            sample = releases.stated_sample(r0.get("sample"))
            if sample:
                rec["sample"] = sample
            if (r0.get("margin_of_error") or "").strip():
                rec["margin"] = r0["margin_of_error"].strip()
            method = r0.get("method") or {}
            for field, word, limit in (("mode", MODEWORD, 120), ("population", POPWORD, 100),
                                       ("fieldwork", FIELDWORD, 300), ("weighting", re.compile(r"weight", re.I), 400)):
                said = _said(method.get(field), word, limit)
                if said:
                    rec[field] = said
            rec["release_questions"] = len(r0.get("questions") or [])
            for r in rels:
                if {"kind": "release", "url": r["url"]} not in rec["links"]:
                    rec["links"].insert(0, {"kind": "release", "url": r["url"]})
        pews = [sv for sv in svs if pew.owns(sv)]
        if pews:
            rec["via"].append("Pew")
            sv = pews[0]
            kind = sv.split(" ")[1]
            if kind == "trust":
                who = sv.split(" ", 2)[2].rsplit(" ", 1)[0]
                rec["pollster"] = pew.POLLSTERS.get(who, who)
                rec["note"] = f"compiled by {pew.CREDIT}, Public Trust in Government: 1958-2025"
                rec["links"].append({"kind": "page", "url": pew.TRUST_URL})
                if rec["pollster"] == pew.CREDIT:
                    year = int(sv.rsplit(" ", 1)[1][:4])
                    # The page's own note: "Data from 2020 and later comes from Pew Research
                    # Center's online American Trends Panel; prior data is from telephone surveys."
                    rec["mode"] = "online (American Trends Panel)" if year >= 2020 else "telephone"
            elif kind == "ATP":
                rec["pollster"] = pew.CREDIT
                urls = sorted({k[0] for k in slices[sv]["rows"]})
                start = min(q[1] for q in slices[sv]["questions"])
                for url in urls:
                    rec["links"].append({"kind": "topline", "url": url})
                    d = pewdoc.get(url) or {}
                    if d.get("start") == start:          # the topline's own wave
                        rec.update({k: v for k, v in (("wave", d["wave"]), ("n", d["n"]), ("mode", d["mode"])) if v})
                if "mode" not in rec and "2016-10-01" <= start <= "2024-06-30":
                    # The 2025 topline's note: ATP surveys from October 2016 to June 2024 were
                    # conducted fully online.
                    rec["mode"] = "online (American Trends Panel)"
            elif kind == "appendix":
                rec["pollster"] = pew.CREDIT
                rec["date_note"] = "the date as the appendix table prints it"
                rec["links"].append({"kind": "page", "url": pew.APPENDIX_URL})
                if slices[sv]["questions"] and max(q[2] for q in slices[sv]["questions"]).startswith("2026-07"):
                    rec["fieldwork"] = "Survey of U.S. adults conducted July 6-12, 2026."
        seeds = [sv for sv in svs if not (votehub.owns(sv) or releases.owns(sv) or pew.owns(sv))]
        if seeds:
            rec["via"].append("seed")
            main = next((sv for sv in seeds if sv != apnorc.SOURCE_VERSION), seeds[0])
            rec.setdefault("pollster", re.sub(r"\s+\d{4}-\d{2}(\s+PUF)?$", "", main))
            ns = set().union(*(slices[sv]["n"] for sv in seeds))
            if len(ns) == 1:
                rec["n"] = ns.pop()
            # The seed's own margin, never the public-use file's computed one.
            moes = set().union(*(slices[sv]["moe"] for sv in seeds if sv != apnorc.SOURCE_VERSION))
            if len(moes) == 1:
                rec["margin"] = f"±{moes.pop():g} (as the seed gives it)"
            notes = sorted(set().union(*(slices[sv]["notes"] for sv in seeds)), key=len, reverse=True)
            kept = [n for i, n in enumerate(notes) if not any(n in m for m in notes[:i])]
            if kept:
                rec["note"] = " | ".join(sorted(kept))
            for url in sorted({k[0] for sv in seeds for k in slices[sv]["rows"]}):
                rec["links"].append({"kind": "page", "url": url})
            if apnorc.SOURCE_VERSION in seeds:
                rec["via"].append("AP-NORC public-use file")
        qs = sorted({q for sv in svs for q in slices[sv]["questions"]}, key=lambda q: (q[0], q[2]))
        rec["start"] = min(q[1] for q in qs)
        rec["end"] = max(q[2] for q in qs)
        geos = sorted({g for sv in svs for g in slices[sv]["geo"]})
        rec["geo"] = geos[0] if len(geos) == 1 else geos
        rec["questions"] = [{"id": c, "start": s, "end": e} for c, s, e in qs]
        rec["rows"] = [{"url": url, "end": end, "label": text}
                       for url, end, text in sorted({k for sv in svs for k in slices[sv]["rows"]},
                                                     key=lambda k: (k[1], k[0] or "", k[2] or ""))]
        records.append(_ordered(rec))
    records.sort(key=lambda r: (r["end"], r.get("pollster", "")), reverse=True)
    ids = [r["id"] for r in records]
    if len(ids) != len(set(ids)):
        raise RuntimeError("two polls share an id")
    return records


ORDER = ("id", "pollster", "sponsors", "partisan", "start", "end", "date_note", "geo", "populations",
         "n", "sample", "margin", "mode", "population", "fieldwork", "weighting", "wave", "note",
         "release_questions", "links", "via", "votehub_ids", "questions", "rows")


def _ordered(rec: dict) -> dict:
    return {k: rec[k] for k in ORDER if k in rec and rec[k] not in (None, [], "")}


def write(records: list[dict], out: Path, chunks) -> list[str]:
    """polls.json, split as the export splits a source; returns the files written."""
    lines = [json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in records]
    names = []
    for i, chunk in enumerate(chunks(lines), start=1):
        name = "polls.json" if i == 1 else f"polls-{i}.json"
        (out / name).write_text("[\n" + ",\n".join(chunk) + "\n]\n", encoding="utf-8")
        names.append(name)
    for stale in out.glob("polls-*.json"):
        if stale.name not in names:
            stale.unlink()
    return names


def main() -> int:  # python -m audience.polls_registry: build and summarize, write nothing
    from .db import connect

    store = connect()
    try:
        records = build(store)
    finally:
        store.close()
    via = defaultdict(int)
    for r in records:
        via[" + ".join(r["via"])] += 1
    size = sum(len(json.dumps(r, ensure_ascii=False, separators=(",", ":"))) + 2 for r in records)
    print(f"{len(records)} polls, {size / 1e6:.2f} MB; by source: {dict(via)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
