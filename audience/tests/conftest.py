import datetime as dt

import pytest

from audience import db, migrate
from audience.loaders import acs, cvap


@pytest.fixture
def store(tmp_path):
    s = db.connect(duckdb_path=tmp_path / "norms.duckdb")
    migrate.apply(s, quiet=True)
    yield s
    s.close()


@pytest.fixture(scope="session")
def loaded(tmp_path_factory):
    """A fresh store with both loaders run once from the raw/ cache (fetching if needed)."""
    s = db.connect(duckdb_path=tmp_path_factory.mktemp("loaded") / "norms.duckdb")
    migrate.apply(s, quiet=True)
    counts = {"ACS": acs.run(s), "CVAP": cvap.run(s)}
    yield s, counts
    s.close()


def need(counts, source):
    if not counts[source]:
        pytest.skip(f"{source} raw data unavailable (see the loader's printed instructions)")


def make_row(**over):
    row = dict(
        source="ACS", source_version="ACS 2020-2024 5yr", geography="STATE", geo_code="25",
        period_start=dt.date(2020, 1, 1), period_end=dt.date(2024, 12, 31), construct="sex",
        item_text="B01001. Sex by Age", response_option="Male", subgroup_dim="all",
        subgroup_value="all", estimate=100.0, estimate_type="count",
        provenance_url="https://api.census.gov/data/2024/acs/acs5",
    )
    row.update(over)
    return row
