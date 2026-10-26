"""The poll seed loader: values as given, rejected rows named, idempotent reruns."""

import csv

import pytest

from audience.loaders import apnorc, polls
from survey_helpers import count, norm_rows

COLUMNS = ",".join(polls.COLUMNS)


def seed_row(**over):
    with open(polls.SEED, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if all(r[k] == v for k, v in over.items()):
                return r
    raise LookupError(over)


def test_seed_loads_whole_and_reruns_unchanged(store):
    with open(polls.SEED, newline="", encoding="utf-8") as f:
        n_csv = sum(1 for _ in csv.DictReader(f))
    assert polls.run(store) == n_csv == count(store)
    assert polls.run(store) == n_csv == count(store)


@pytest.mark.parametrize("source, version, option", [
    ("POLL", "UMass-WCVB 2026-08", "Yes"),
    ("ELECTION_RESULT", "CO 2024 general", "Yes"),
])
def test_spot_check_one_row_per_source_against_the_csv(store, source, version, option):
    polls.run(store)
    want = seed_row(source=source, source_version=version, response_option=option)
    got = norm_rows(store, "source = ? AND source_version = ? AND response_option = ?",
                    [source, version, option])
    assert len(got) == 1
    got = got[0]
    assert got["estimate"] == float(want["estimate"])
    assert got["n"] == (int(want["n"]) if want["n"] else None)
    assert got["geo_code"] == want["geo_code"] and got["geography"] == want["geography"]
    assert got["item_text"] == want["item_text"]
    assert got["provenance_url"] == want["provenance_url"]
    assert got["subgroup_dim"] == "all" and got["subgroup_value"] == "all"
    assert got["moe"] is None and got["se"] is None


def test_rows_without_provenance_are_rejected_and_named(store, tmp_path, capsys):
    seed = tmp_path / "seed.csv"
    seed.write_text(
        COLUMNS + "\n"
        "POLL,X 2026-01,US,US,2026-01-01,2026-01-02,open_primaries_support,Q?,Yes,all,,55,pct,900,3.3,https://example.org/x,\n"
        "POLL,X 2026-01,US,US,2026-01-01,2026-01-02,open_primaries_support,Q?,No,all,,40,pct,900,,,missing url\n"
        "POLL,X 2026-01,US,US,2026-01-01,2026-01-02,open_primaries_support,Q?,Yes,party,,60,pct,,,https://example.org/x,\n")
    assert polls.run(store, seed=seed) == 1
    out = capsys.readouterr().out
    assert "line 3: empty provenance_url" in out and "line 4: empty subgroup_value" in out
    row = norm_rows(store)[0]
    assert row["moe"] == 3.3 and row["se"] == pytest.approx(3.3 / 1.645)


def test_a_poll_leaving_the_seed_is_removed_but_the_microdata_slice_stays(store, tmp_path):
    polls.run(store)
    from conftest import make_row
    store.upsert_norms([make_row(source=apnorc.SOURCE, source_version=apnorc.SOURCE_VERSION,
                                 construct="open_primaries_support", geography="US", geo_code="US",
                                 subgroup_dim="sex", subgroup_value="Male", estimate_type="pct")])
    seed = tmp_path / "seed.csv"
    with open(polls.SEED, encoding="utf-8") as f:
        lines = f.read().splitlines()
    keep = [lines[0]] + [l for l in lines[1:] if "YouGov 2014-06" not in l]
    seed.write_text("\n".join(keep) + "\n")
    polls.run(store, seed=seed)
    assert count(store, "source_version = 'YouGov 2014-06'") == 0
    assert count(store, "source_version = ?", [apnorc.SOURCE_VERSION]) == 1
    assert count(store, "source_version = 'AP-NORC 2016-05'") == 2
