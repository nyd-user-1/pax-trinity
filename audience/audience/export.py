"""Export the store for the Next app: python -m audience.export

Writes public/audience-data/ at the repo root, committed with the app:

  index.json   {sources: [{source, label, rows, file}],
                constructs: [{construct, label, definition, wording?, topics?}],
                geographies: [{code, name, level, parent}],
                families?: [{id, label, definition, anchor, note?,
                             members: [{question, relation, of?}]}]}
  <source>.json   one per source (lowercased): an array of rows
                  [construct, geo_code, period_start, period_end, response_option,
                   subgroup_dim, subgroup_value, estimate, estimate_type, moe, item_text,
                   n, provenance_url]

The contract is fixed: the app's /audience page reads exactly this. BLOCKGROUP rows are left
out everywhere. Estimates and moe are rounded to 1 decimal, counts to whole numbers. item_text
is carried for POLL and ELECTION_RESULT rows only (null elsewhere). A topline row's
subgroup_dim and subgroup_value (the store's "all") are null, which the page shows as All.
Dates are ISO strings. n is the unweighted base (or the registered-voter base) where the store
has one, else null. Within a cell, response options run in the coded order response_order
records (the bulk tier's constructs), else alphabetically. A source file over
MAX_BYTES is split into <source>-2.json, <source>-3.json, ..., each listed in index.json as
its own entry. constructs lists those with exported rows; geographies lists US, STATE,
COUNTY and TOWN. A constructs entry carries wording, the verbatim GSS question text, where
concordance.gss_wording holds one (audience/loaders/gss_wording.py); the key is absent elsewhere.
Likewise topics, the publisher's own subject tags in its order: the GSS Data Explorer's
(concordance.gss_topics, audience/loaders/gss_topics.py), ANES's CDF variable list
(anes_topics) and the cumulative CES guide (ces_topics); a construct several sources serve takes
theirs in that order, each tag once.

families is the construct layer (migration 009, audience/construct_layer.py), named so that
constructs keeps meaning what it means: each construct groups the questions that measure one
thing, members in the seed's order, a question being a constructs entry's id. anchor is the
grouping's citation (null where none; note then says whose judgment it is); a mode member
names as of the member it administers again. The key is absent while the layer is empty.

Each question is also served alone, so a page can list a source from the index and fetch only
the question it opens: q/<source lowercased>/<construct>.json holds that question's rows from
<source>.json, in the same order and form. index.json's questions has one entry per file, in
the same order, {source, question, first, last, waves, options}: the first and last wave years
and their count (the distinct years of period_end over all its rows), and its options, each
response option once in row order. The whole-source files stay beside them.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from . import config
from .db import Store, connect

OUT = config.ROOT.parent / "public" / "audience-data"
MAX_BYTES = 4_000_000
QUESTION_DIR = "q"
ITEM_TEXT_SOURCES = ("POLL", "ELECTION_RESULT")
LEVELS = ("US", "STATE", "COUNTY", "TOWN")
ROW_FIELDS = ("construct", "geo_code", "period_start", "period_end", "response_option",
              "subgroup_dim", "subgroup_value", "estimate", "estimate_type", "moe", "item_text",
              "n", "provenance_url")


TOPIC_COLUMNS = ("gss_topics", "anes_topics", "ces_topics")


def _as_list(v) -> list:
    """An array column as read: a JSON string on DuckDB, a list on Postgres."""
    return [] if v is None else list(json.loads(v)) if isinstance(v, str) else list(v)


def _topics(columns) -> list[str]:
    """A construct's tags from every source's column, in TOPIC_COLUMNS order, each once."""
    return list(dict.fromkeys(t for col in columns for t in _as_list(col)))


def _round(value, estimate_type: str):
    if value is None:
        return None
    v = float(value)
    if estimate_type == "count":
        return int(round(v))
    r = round(v, 1)
    return 0.0 if r == 0 else r   # no -0.0


def source_rows(store: Store, source: str) -> list[list]:
    # A construct's response options follow their coded order where response_order records
    # one (the bulk tier), else the alphabet.
    ordered = store.table_exists("response_order")
    join = ("LEFT JOIN response_order o ON o.source = n.source AND o.construct = n.construct "
            "AND o.response_option = n.response_option " if ordered else "")
    rows = store.query(
        "SELECT n.construct, n.geo_code, n.period_start, n.period_end, n.response_option, "
        "n.subgroup_dim, n.subgroup_value, n.estimate, n.estimate_type, n.moe, n.item_text, n.n, "
        f"n.provenance_url FROM norms n {join}"
        "WHERE n.source = ? AND n.geography <> 'BLOCKGROUP' "
        "ORDER BY n.construct, n.geo_code, n.period_start, n.period_end, n.item_text, "
        "n.subgroup_dim, n.subgroup_value, "
        f"{'o.ordinal NULLS LAST, ' if ordered else ''}n.response_option, n.estimate_type",
        [source])
    keep_text = source in ITEM_TEXT_SOURCES
    out = []
    for (construct, geo, start, end, option, dim, value, est, etype, moe, text, n, url) in rows:
        if dim == "all":
            dim = value = None
        out.append([construct, geo, start.isoformat(), end.isoformat(), option, dim, value,
                    _round(est, etype), etype, _round(moe, etype),
                    text if keep_text else None, None if n is None else int(n), url])
    return out


def _chunks(lines: list[str]) -> list[list[str]]:
    """Split serialized rows so no file passes MAX_BYTES."""
    chunks, current, size = [], [], 4  # "[\n" + "\n]"
    for line in lines:
        n = len(line.encode("utf-8")) + 2
        if current and size + n > MAX_BYTES:
            chunks.append(current)
            current, size = [], 4
        current.append(line)
        size += n
    chunks.append(current)
    return chunks


def _write_array(path: Path, lines: list[str]) -> None:
    path.write_text("[\n" + ",\n".join(lines) + "\n]\n", encoding="utf-8")


def question_summary(source: str, construct: str, rows: list[list]) -> dict:
    """The list's read of one question in one source, from its exported rows: its first and
    last wave years and their count (the distinct years of period_end), and its options, each
    response option once in row order (the coded order within a cell)."""
    years = sorted({int(r[3][:4]) for r in rows})
    options = list(dict.fromkeys(r[4] for r in rows if r[4] is not None))
    return {"source": source, "question": construct, "first": years[0], "last": years[-1],
            "waves": len(years), "options": options}


def construct_families(store: Store, exported: set[str]) -> list[dict]:
    """The construct layer, members in their seed order. A member without exported rows is
    left out, so every member is a constructs entry; a construct left with none goes too."""
    if not store.table_exists("construct_member"):
        return []
    members: dict[str, list[dict]] = {}
    for cid, question, relation, parent in store.query(
            "SELECT construct_id, question_id, relation, parent FROM construct_member "
            "ORDER BY construct_id, ordinal"):
        if question in exported:
            members.setdefault(cid, []).append(
                {"question": question, "relation": relation, **({"of": parent} if parent else {})})
    return [{"id": cid, "label": label, "definition": definition, "anchor": anchor,
             **({"note": note} if note else {}), "members": members[cid]}
            for cid, label, definition, anchor, note in store.query(
                "SELECT construct_id, label, definition, anchor, note FROM construct ORDER BY 1")
            if cid in members]


def export(store: Store, out: Path = OUT) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    labels = dict(store.query("SELECT source, name FROM sources"))
    sources = [r[0] for r in store.query(
        "SELECT DISTINCT source FROM norms WHERE geography <> 'BLOCKGROUP' ORDER BY 1")]
    written: set[str] = {"index.json"}
    written_q: set[str] = set()
    index_sources = []
    questions = []
    for source in sources:
        rows = source_rows(store, source)
        lines = [json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows]
        stem = source.lower()
        for i, chunk in enumerate(_chunks(lines), start=1):
            name = f"{stem}.json" if i == 1 else f"{stem}-{i}.json"
            _write_array(out / name, chunk)
            written.add(name)
            index_sources.append({"source": source, "label": labels.get(source, source),
                                  "rows": len(chunk), "file": name})
        # The same rows again, one file per question: rows run by construct, so each
        # question is one contiguous slice.
        qdir = out / QUESTION_DIR / stem
        qdir.mkdir(parents=True, exist_ok=True)
        start = 0
        for end in range(1, len(rows) + 1):
            if end < len(rows) and rows[end][0] == rows[start][0]:
                continue
            construct = rows[start][0]
            _write_array(qdir / f"{construct}.json", lines[start:end])
            written_q.add(f"{stem}/{construct}.json")
            questions.append(question_summary(source, construct, rows[start:end]))
            start = end
    worded = store.column_exists("concordance", "gss_wording")
    tag_cols = [c for c in TOPIC_COLUMNS if store.column_exists("concordance", c)] or ["NULL"]
    constructs = [
        {"construct": c, "label": label, "definition": definition,
         **({"wording": wording} if wording else {}),
         **({"topics": _topics(tags)} if _topics(tags) else {})}
        for c, label, definition, wording, *tags in store.query(
            f"SELECT construct, label, definition, {'gss_wording' if worded else 'NULL'}, "
            f"{', '.join(tag_cols)} "
            "FROM concordance WHERE construct IN "
            "(SELECT DISTINCT construct FROM norms WHERE geography <> 'BLOCKGROUP') ORDER BY 1")]
    placeholders = ", ".join("?" for _ in LEVELS)
    level_order = {lvl: i for i, lvl in enumerate(LEVELS)}
    geos = sorted(
        ({"code": code, "name": name, "level": level, "parent": parent}
         for code, name, level, parent in store.query(
             f"SELECT geo_code, name, level, parent_code FROM geographies "
             f"WHERE level IN ({placeholders})", list(LEVELS))),
        key=lambda g: (level_order[g["level"]], g["code"]))
    index = {"sources": index_sources, "constructs": constructs, "geographies": geos}
    families = construct_families(store, {c["construct"] for c in constructs})
    if families:
        index["families"] = families
    if questions:
        index["questions"] = questions
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n",
                                    encoding="utf-8")
    for stale in out.glob("*.json"):
        if stale.name not in written:
            stale.unlink()
    for stale in (out / QUESTION_DIR).glob("*/*.json"):
        if f"{stale.parent.name}/{stale.name}" not in written_q:
            stale.unlink()
    for folder in (out / QUESTION_DIR).glob("*/"):
        if not any(folder.iterdir()):
            folder.rmdir()
    return index


def main() -> int:
    store = connect()
    try:
        index = export(store)
    finally:
        store.close()
    for s in index["sources"]:
        size = (OUT / s["file"]).stat().st_size
        print(f"  {s['file']:<24}{s['rows']:>8,} rows  {size / 1e6:6.2f} MB")
    worded = sum(1 for c in index["constructs"] if "wording" in c)
    tagged = sum(1 for c in index["constructs"] if "topics" in c)
    print(f"index.json: {len(index['sources'])} files, {len(index['constructs'])} constructs "
          f"({worded:,} worded, {tagged:,} with topics), "
          f"{len(index['geographies'])} geographies -> {OUT}")
    families = index.get("families", [])
    print(f"families: {len(families)} constructs, "
          f"{sum(len(f['members']) for f in families)} member questions")
    print(f"questions: {len(index.get('questions', [])):,} files under {OUT / QUESTION_DIR}; "
          f"index.json {(OUT / 'index.json').stat().st_size / 1e6:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
