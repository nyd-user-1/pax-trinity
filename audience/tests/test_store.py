import json

import pytest

from audience import db, migrate
from conftest import make_row


def count(store, where="1=1", params=()):
    return store.query(f"SELECT count(*) FROM norms WHERE {where}", params)[0][0]


def test_migrations_apply_clean_to_a_fresh_file(tmp_path):
    s = db.connect(duckdb_path=tmp_path / "fresh.duckdb")
    on_disk = [p.stem for p in migrate.migration_files()]
    assert on_disk[:3] == ["001_schema", "002_seed_population", "003_survey_sources"]
    assert migrate.apply(s, quiet=True) == on_disk
    assert migrate.apply(s, quiet=True) == []
    for table in ("norms", "concordance", "sources", "schema_migrations"):
        assert s.table_exists(table)
    assert {r[0] for r in s.query("SELECT source FROM sources")} >= {
        "ACS", "CVAP", "CPS", "VOTERFILE_MA", "GSS", "ANES", "CES", "WVS",
        "LIFT_ARCHIVE", "PAX_TEST"}
    assert all(r[0] and r[1] for r in s.query("SELECT url, license FROM sources"))
    assert {r[0] for r in s.query("SELECT construct FROM concordance")} == {
        "sex", "age_bucket", "race_eth", "education_4", "hh_income_bucket",
        "citizenship", "cvap", "registration", "turnout",
    }
    s.close()


def test_natural_key_covers_source_and_estimate_type():
    base = make_row()
    assert db.natural_key(base) == db.natural_key(dict(base, estimate=5.0))
    assert db.natural_key(base) != db.natural_key(dict(base, source="CVAP"))
    assert db.natural_key(base) != db.natural_key(dict(base, estimate_type="pct"))


@pytest.mark.parametrize("url", [None, ""])
def test_rows_without_provenance_url_are_refused(store, url):
    with pytest.raises(db.RowRejected, match="provenance_url"):
        store.upsert_norms([make_row(provenance_url=url)])
    assert count(store) == 0


def test_rows_with_unknown_construct_are_refused(store):
    with pytest.raises(db.RowRejected, match="concordance"):
        store.upsert_norms([make_row(construct="trust_gov")])


def test_upsert_is_idempotent_and_updates_in_place(store):
    rows = [make_row(), make_row(estimate_type="pct", estimate=48.5)]
    assert store.upsert_norms(rows) == 2
    ids = store.query("SELECT norm_id FROM norms ORDER BY norm_id")
    store.upsert_norms(rows)
    assert count(store) == 2
    store.upsert_norms([make_row(estimate=101.0)])
    assert count(store) == 2
    assert store.query("SELECT norm_id FROM norms ORDER BY norm_id") == ids
    assert float(store.query(
        "SELECT estimate FROM norms WHERE estimate_type = 'count'")[0][0]) == 101.0


def test_prune_clears_stale_rows_in_its_slice_only(store):
    store.upsert_norms([make_row(), make_row(response_option="Female")])
    store.upsert_norms([make_row(source="CVAP", source_version="CVAP 2020-2024 5yr")])
    store.upsert_norms([make_row()], prune=("ACS", "ACS 2020-2024 5yr"))
    assert count(store, "source = 'ACS'") == 1
    assert count(store, "source = 'CVAP'") == 1
    with pytest.raises(db.RowRejected, match="outside the pruned slice"):
        store.upsert_norms([make_row(source="CVAP")], prune=("ACS", "ACS 2020-2024 5yr"))


def test_concordance_array_columns_round_trip(store):
    store.upsert_concordance({
        "construct": "trust_gov", "label": "Trust in government",
        "definition": "How often the federal government can be trusted to do what is right.",
        "anes_var": ["VCF0604"],
    })
    value = store.query("SELECT anes_var FROM concordance WHERE construct = 'trust_gov'")[0][0]
    assert (json.loads(value) if isinstance(value, str) else value) == ["VCF0604"]
