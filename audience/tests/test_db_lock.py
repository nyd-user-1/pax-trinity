"""A locked DuckDB file is waited out, not failed on."""

import duckdb
import pytest

from audience import db


class FakeDuckDB:
    IOException = duckdb.IOException

    def __init__(self, failures, message="Could not set lock on file"):
        self.failures, self.message, self.calls = failures, message, 0

    def connect(self, path):
        self.calls += 1
        if self.calls <= self.failures:
            raise duckdb.IOException(f'IO Error: {self.message} "{path}"')
        return "conn"


def test_waits_out_a_lock(tmp_path, capsys):
    fake = FakeDuckDB(failures=2)
    assert db._open_duckdb(fake, tmp_path / "x.duckdb", tries=5, wait=0) == "conn"
    assert fake.calls == 3 and "retry 2/4" in capsys.readouterr().out


def test_gives_up_after_the_last_try(tmp_path):
    fake = FakeDuckDB(failures=99)
    with pytest.raises(duckdb.IOException):
        db._open_duckdb(fake, tmp_path / "x.duckdb", tries=3, wait=0)
    assert fake.calls == 3


def test_other_io_errors_are_not_retried(tmp_path):
    fake = FakeDuckDB(failures=1, message="Permission denied")
    with pytest.raises(duckdb.IOException):
        db._open_duckdb(fake, tmp_path / "x.duckdb", tries=5, wait=0)
    assert fake.calls == 1
