"""The app export: index.json and one file per source, exactly as the /audience page reads
them."""

import json

from audience import export, geographies
from audience.loaders import polls
from conftest import need

FIELDS = 13


def run_export(store, tmp_path):
    geographies.refresh(store, quiet=True)
    out = tmp_path / "audience-data"
    return export.export(store, out), out


def test_index_and_files_follow_the_contract(loaded, tmp_path):
    store, counts = loaded
    need(counts, "ACS")
    need(counts, "CVAP")
    polls.run(store)
    index, out = run_export(store, tmp_path)
    assert set(index) == {"sources", "constructs", "geographies", "questions"}
    assert all(set(s) == {"source", "label", "rows", "file"} for s in index["sources"])
    assert all({"construct", "label", "definition"} <= set(c)
               <= {"construct", "label", "definition", "wording"} for c in index["constructs"])
    assert all(set(g) == {"code", "name", "level", "parent"} for g in index["geographies"])
    assert {g["level"] for g in index["geographies"]} == {"US", "STATE", "COUNTY", "TOWN"}
    files: dict[str, list[str]] = {}
    for s in index["sources"]:
        files.setdefault(s["source"], []).append(s["file"])
    assert files["ACS"][0] == "acs.json" and files["ELECTION_RESULT"] == ["election_result.json"]
    assert files["ACS"][1:] == [f"acs-{i}.json" for i in range(2, len(files["ACS"]) + 1)]
    names = [f for fs in files.values() for f in fs]
    assert {p.name for p in out.glob("*.json")} == set(names) | {"index.json"}
    for s in index["sources"]:
        rows = json.loads((out / s["file"]).read_text())
        assert len(rows) == s["rows"] and all(len(r) == FIELDS for r in rows)
        assert (out / s["file"]).stat().st_size <= export.MAX_BYTES
    acs = [r for f in files["ACS"] for r in json.loads((out / f).read_text())]
    assert len(acs) == store.query("SELECT count(*) FROM norms WHERE source = 'ACS'")[0][0]
    count = next(r for r in acs if r[8] == "count")
    pct = next(r for r in acs if r[8] == "pct")
    assert isinstance(count[7], int) and isinstance(count[9], int)
    assert pct[7] == round(pct[7], 1) and pct[10] is None
    topline = next(r for r in acs if r[0] == "sex")
    assert topline[5] is None and topline[6] is None    # the store's "all", shown as All
    by_sex = next(r for r in acs if r[5] == "sex")
    assert by_sex[6] in ("Male", "Female")
    assert all(r[12] and r[12].startswith("https://") for r in acs)   # provenance_url
    assert all(r[11] is None for r in acs)              # ACS publishes no n
    poll = json.loads((out / "poll.json").read_text())
    assert all(r[10] for r in poll)                     # item_text carried for polls
    seed_n = {r[11] for r in poll}
    assert None in seed_n and 1060 in seed_n            # n where the seed gives one, else null
    cvap = [r for f in files["CVAP"] for r in json.loads((out / f).read_text())]
    assert all(len(r[1]) < 12 for r in cvap)            # no block groups
    n_cvap = store.query("SELECT count(*) FROM norms WHERE source = 'CVAP' "
                         "AND geography <> 'BLOCKGROUP'")[0][0]
    assert len(cvap) == n_cvap
    used = {r[0] for f in names for r in json.loads((out / f).read_text())}
    assert {c["construct"] for c in index["constructs"]} == used


def test_each_question_is_served_alone_and_summarized(loaded, tmp_path):
    store, counts = loaded
    need(counts, "ACS")
    polls.run(store)
    index, out = run_export(store, tmp_path)
    by_source: dict[str, list] = {}
    for s in index["sources"]:
        by_source.setdefault(s["source"], []).extend(json.loads((out / s["file"]).read_text()))
    served = {(q["source"], q["question"]) for q in index["questions"]}
    assert served == {(s, r[0]) for s, rows in by_source.items() for r in rows}
    assert {p.relative_to(out / "q").as_posix() for p in (out / "q").glob("*/*.json")} == {
        f"{s.lower()}/{q}.json" for s, q in served}
    for q in index["questions"]:
        assert set(q) == {"source", "question", "first", "last", "waves", "options"}
        rows = json.loads((out / "q" / q["source"].lower() / f"{q['question']}.json").read_text())
        assert rows == [r for r in by_source[q["source"]] if r[0] == q["question"]]
        years = sorted({int(r[3][:4]) for r in rows})
        assert (q["first"], q["last"], q["waves"]) == (years[0], years[-1], len(years))
        assert q["options"] == list(dict.fromkeys(r[4] for r in rows if r[4] is not None))
    sex = next(q for q in index["questions"] if q["source"] == "ACS" and q["question"] == "sex")
    assert sex["options"] == ["Female", "Male"]


def test_a_question_that_leaves_the_store_leaves_q(loaded, tmp_path):
    store, counts = loaded
    need(counts, "ACS")
    stale = tmp_path / "audience-data" / "q" / "gone"
    stale.mkdir(parents=True)
    (stale / "old.json").write_text("[]")
    (tmp_path / "audience-data" / "q" / "acs").mkdir()
    (tmp_path / "audience-data" / "q" / "acs" / "retired.json").write_text("[]")
    _, out = run_export(store, tmp_path)
    assert not stale.exists()
    assert not (out / "q" / "acs" / "retired.json").exists()
    assert (out / "q" / "acs" / "sex.json").exists()


def test_an_oversized_source_splits_and_stale_files_go(loaded, tmp_path, monkeypatch):
    store, counts = loaded
    need(counts, "ACS")
    out = tmp_path / "audience-data"
    out.mkdir()
    (out / "old-source.json").write_text("[]")
    monkeypatch.setattr(export, "MAX_BYTES", 1_000_000)
    index, out = run_export(store, tmp_path)
    acs = [s for s in index["sources"] if s["source"] == "ACS"]
    assert len(acs) > 3
    assert [s["file"] for s in acs] == ["acs.json"] + [f"acs-{i}.json" for i in range(2, len(acs) + 1)]
    total = store.query("SELECT count(*) FROM norms WHERE source = 'ACS'")[0][0]
    assert sum(s["rows"] for s in acs) == total
    assert all((out / s["file"]).stat().st_size <= 1_000_000 for s in acs)
    assert not (out / "old-source.json").exists()
