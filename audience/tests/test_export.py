"""The app export: index.json and one file per source, exactly as the /audience page reads
them."""

import json

from audience import export, geographies
from audience.loaders import polls
from conftest import need

FIELDS = 11


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
    assert set(index) == {"sources", "constructs", "geographies"}
    assert all(set(s) == {"source", "label", "rows", "file"} for s in index["sources"])
    assert all(set(c) == {"construct", "label", "definition"} for c in index["constructs"])
    assert all(set(g) == {"code", "name", "level", "parent"} for g in index["geographies"])
    assert {g["level"] for g in index["geographies"]} == {"US", "STATE", "COUNTY", "TOWN"}
    files = {s["source"]: s["file"] for s in index["sources"]}
    assert files["ACS"] == "acs.json" and files["ELECTION_RESULT"] == "election_result.json"
    assert {p.name for p in out.glob("*.json")} == set(files.values()) | {"index.json"}
    for s in index["sources"]:
        rows = json.loads((out / s["file"]).read_text())
        assert len(rows) == s["rows"] and all(len(r) == FIELDS for r in rows)
    acs = json.loads((out / "acs.json").read_text())
    count = next(r for r in acs if r[8] == "count")
    pct = next(r for r in acs if r[8] == "pct")
    assert isinstance(count[7], int) and isinstance(count[9], int)
    assert pct[7] == round(pct[7], 1) and pct[10] is None
    topline = next(r for r in acs if r[0] == "sex")
    assert topline[5] is None and topline[6] is None    # the store's "all", shown as All
    by_sex = next(r for r in acs if r[5] == "sex")
    assert by_sex[6] in ("Male", "Female")
    poll = json.loads((out / "poll.json").read_text())
    assert all(r[10] for r in poll)                     # item_text carried for polls
    cvap = json.loads((out / "cvap.json").read_text())
    assert all(len(r[1]) < 12 for r in cvap)            # no block groups
    n_cvap = store.query("SELECT count(*) FROM norms WHERE source = 'CVAP' "
                         "AND geography <> 'BLOCKGROUP'")[0][0]
    assert len(cvap) == n_cvap
    used = {r[0] for f in files.values() for r in json.loads((out / f).read_text())}
    assert {c["construct"] for c in index["constructs"]} == used


def test_an_oversized_source_splits_and_stale_files_go(loaded, tmp_path, monkeypatch):
    store, counts = loaded
    need(counts, "ACS")
    out = tmp_path / "audience-data"
    out.mkdir()
    (out / "old-source.json").write_text("[]")
    monkeypatch.setattr(export, "MAX_BYTES", 1_000_000)
    index, out = run_export(store, tmp_path)
    acs = [s for s in index["sources"] if s["source"] == "ACS"]
    assert [s["file"] for s in acs] == ["acs.json", "acs-2.json", "acs-3.json"]
    total = store.query("SELECT count(*) FROM norms WHERE source = 'ACS'")[0][0]
    assert sum(s["rows"] for s in acs) == total
    assert all((out / s["file"]).stat().st_size <= 1_000_000 for s in acs)
    assert not (out / "old-source.json").exists()
