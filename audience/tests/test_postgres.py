"""The Postgres backend, end to end. Runs only when AUDIENCE_TEST_DATABASE_URL is set; works in
a throwaway schema and drops it afterwards."""

import os
import uuid

import pytest

from audience import audit, db, migrate
from audience.loaders import ces, cvap, wvs
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
    assert migrate.apply(pg, quiet=True) == [p.stem for p in migrate.migration_files()]
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


def test_postgres_survey_loaders_merge_concordance_arrays(pg):
    """Two survey loaders writing one construct's text[] columns, then a rerun."""
    from survey_helpers import FIXTURES

    migrate.apply(pg, quiet=True)
    n_ces = ces.run(pg, raw_dir=FIXTURES / "ces", allow_synthetic=True, min_n=5)
    n_wvs = wvs.run(pg, raw_dir=FIXTURES / "wvs", allow_synthetic=True, min_n=5)
    assert n_ces and n_wvs
    ces.run(pg, raw_dir=FIXTURES / "ces", allow_synthetic=True, min_n=5)
    assert pg.query("SELECT count(*) FROM norms")[0][0] == n_ces + n_wvs
    pg.upsert_concordance({"construct": "trust_gov", "label": "x", "definition": "y",
                           "anes_var": ["VCF0604"], "ces_var": ["CC22_423"]})
    ces.run(pg, raw_dir=FIXTURES / "ces", allow_synthetic=True, min_n=5)
    anes_var, ces_var = pg.query(
        "SELECT anes_var, ces_var FROM concordance WHERE construct = 'trust_gov'")[0]
    assert anes_var == ["VCF0604"] and ces_var == ["CC22_423"]
    assert audit.run(pg) == 0
