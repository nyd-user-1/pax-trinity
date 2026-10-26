"""The Postgres backend, end to end. Runs only when AUDIENCE_TEST_DATABASE_URL is set; works in
a throwaway schema and drops it afterwards."""

import os
import uuid

import pytest

from audience import audit, db, migrate
from audience.loaders import cvap
from conftest import make_row

URL = os.environ.get("AUDIENCE_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="AUDIENCE_TEST_DATABASE_URL not set")


@pytest.fixture
def pg():
    s = db.connect(database_url=URL)
    schema = f"audience_test_{uuid.uuid4().hex[:8]}"
    s.execute(f"CREATE SCHEMA {schema}")
    s.execute(f"SET search_path TO {schema}")
    yield s
    s.execute(f"DROP SCHEMA {schema} CASCADE")
    s.close()


def test_postgres_migrate_load_rerun_audit(pg, capsys):
    assert migrate.apply(pg, quiet=True) == ["001_schema", "002_seed_population"]
    assert migrate.apply(pg, quiet=True) == []
    with pytest.raises(db.RowRejected):
        pg.upsert_norms([make_row(provenance_url="")])
    first = cvap.run(pg)
    if not first:
        pytest.skip("CVAP raw data unavailable")
    n = pg.query("SELECT count(*) FROM norms")[0][0]
    cvap.run(pg)
    assert pg.query("SELECT count(*) FROM norms")[0][0] == n == first
    pg.upsert_concordance({"construct": "trust_gov", "label": "Trust", "definition": "d",
                           "anes_var": ["VCF0604"]})
    assert pg.query("SELECT anes_var FROM concordance WHERE construct = 'trust_gov'")[0][0] == ["VCF0604"]
    assert audit.run(pg) == 0
