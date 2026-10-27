"""One store, two backends: a DuckDB file by default, Postgres when DATABASE_URL is set.

Loaders talk only to Store. The differences it hides: parameter style, array columns
(text[] in Postgres, JSON in DuckDB), bulk upsert mechanics, and transactions.
"""

from __future__ import annotations

import contextlib
import datetime as dt
import hashlib
import json
import math
import time
import uuid
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence

from . import config

NORM_COLUMNS = (
    "norm_id", "natural_key", "source", "source_version", "geography", "geo_code",
    "period_start", "period_end", "construct", "item_text", "response_option",
    "subgroup_dim", "subgroup_value", "estimate", "estimate_type", "n", "se", "moe",
    "weight_var", "provenance_url", "provenance_note", "extracted_at",
)

# The sha256 natural key. estimate_type is part of it: every cell is stored once as a
# count and once as a pct, and without estimate_type those two rows would share a key
# and the second would overwrite the first.
KEY_FIELDS = (
    "source", "source_version", "geo_code", "period_start", "period_end", "construct",
    "item_text", "response_option", "subgroup_dim", "subgroup_value", "estimate_type",
)

REQUIRED_FIELDS = (
    "source", "source_version", "geography", "geo_code", "period_start", "period_end",
    "construct", "subgroup_dim", "subgroup_value", "estimate_type", "provenance_url",
)

ESTIMATE_TYPES = {"pct", "mean", "count", "lift_pp"}
GEOGRAPHIES = {"US", "STATE", "COUNTY", "TOWN", "BLOCKGROUP"}
ARRAY_COLUMNS = {"anes_var", "gss_var", "ces_var", "wvs_var"}

# Fixed namespace so norm_id = uuid5(NAMESPACE, natural_key) is stable forever.
NAMESPACE = uuid.UUID("6f1d3a52-7c1e-4b8e-9a43-0c2d5e7f9b10")

# Columns refreshed when a rerun hits an existing natural key.
_UPDATE_COLUMNS = (
    "geography", "estimate", "n", "se", "moe", "weight_var",
    "provenance_url", "provenance_note", "extracted_at",
)


class RowRejected(ValueError):
    """A loader handed the store a row it must not write."""


def _key_part(value: Any) -> Any:
    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat()
    return value


def natural_key(row: dict) -> str:
    parts = [_key_part(row.get(f)) for f in KEY_FIELDS]
    blob = json.dumps(parts, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def norm_id_for(key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, key))


class Store:
    def __init__(self, dialect: str, conn: Any, label: str):
        self.dialect = dialect
        self.conn = conn
        self.label = label

    # -- plumbing -----------------------------------------------------------------

    def _sql(self, sql: str) -> str:
        return sql.replace("?", "%s") if self.dialect == "postgres" else sql

    def execute(self, sql: str, params: Iterable[Any] = ()) -> None:
        if self.dialect == "postgres":
            with self.conn.cursor() as cur:
                cur.execute(self._sql(sql), tuple(params) or None)
        else:
            self.conn.execute(sql, list(params))

    def query(self, sql: str, params: Iterable[Any] = ()) -> list[tuple]:
        if self.dialect == "postgres":
            with self.conn.cursor() as cur:
                cur.execute(self._sql(sql), tuple(params) or None)
                return cur.fetchall()
        return self.conn.execute(sql, list(params)).fetchall()

    def script(self, sql: str) -> None:
        """Run a multi-statement SQL script with no parameters."""
        if self.dialect == "postgres":
            with self.conn.cursor() as cur:
                cur.execute(sql)
        else:
            self.conn.execute(sql)

    @contextlib.contextmanager
    def transaction(self) -> Iterator[None]:
        if self.dialect == "postgres":
            with self.conn.transaction():
                yield
            return
        self.conn.execute("BEGIN TRANSACTION")
        try:
            yield
        except BaseException:
            self.conn.execute("ROLLBACK")
            raise
        self.conn.execute("COMMIT")

    def close(self) -> None:
        self.conn.close()

    def table_exists(self, name: str) -> bool:
        rows = self.query(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = ?", [name]
        )
        return rows[0][0] > 0

    def array_value(self, values):
        """A Python list as an array column takes it: JSON text on DuckDB, a list on Postgres."""
        if values is None:
            return None
        if self.dialect == "duckdb":
            return json.dumps(list(values), ensure_ascii=False)
        return list(values)

    def column_exists(self, table: str, column: str) -> bool:
        rows = self.query(
            "SELECT count(*) FROM information_schema.columns "
            "WHERE table_name = ? AND column_name = ?", [table, column])
        return rows[0][0] > 0

    # -- writes -------------------------------------------------------------------

    def upsert_norms(self, rows: Iterable[dict], prune: tuple[str, str] | None = None) -> int:
        """Validate and upsert norm rows on their natural key. Returns rows written.

        prune=(source, source_version): the batch is that slice's complete output, so rows
        in the slice whose keys are not in the batch are deleted in the same transaction.
        A loader whose logic changes then leaves nothing stale behind."""
        known = {r[0] for r in self.query("SELECT construct FROM concordance")}
        now = dt.datetime.now(dt.timezone.utc)
        batch: list[dict] = []
        seen: set[str] = set()
        for raw in rows:
            row = dict(raw)
            missing = [f for f in REQUIRED_FIELDS if row.get(f) in (None, "")]
            if missing:
                raise RowRejected(f"row missing {', '.join(missing)}: {_brief(row)}")
            if row["estimate_type"] not in ESTIMATE_TYPES:
                raise RowRejected(f"unknown estimate_type {row['estimate_type']!r}: {_brief(row)}")
            if row["geography"] not in GEOGRAPHIES:
                raise RowRejected(f"unknown geography {row['geography']!r}: {_brief(row)}")
            if row["construct"] not in known:
                raise RowRejected(
                    f"construct {row['construct']!r} has no concordance row; add it first"
                )
            for f in ("estimate", "se", "moe"):
                v = row.get(f)
                if v is not None and not math.isfinite(v):
                    raise RowRejected(f"non-finite {f}: {_brief(row)}")
            key = natural_key(row)
            if key in seen:
                raise RowRejected(f"duplicate natural key within one batch: {_brief(row)}")
            seen.add(key)
            row["natural_key"] = key
            row["norm_id"] = norm_id_for(key)
            row.setdefault("extracted_at", now)
            if row["extracted_at"] is None:
                row["extracted_at"] = now
            batch.append(row)
        if prune is not None:
            stray = [r for r in batch if (r["source"], r["source_version"]) != tuple(prune)]
            if stray:
                raise RowRejected(f"row outside the pruned slice {prune}: {_brief(stray[0])}")
        if not batch:
            return 0
        with self.transaction():
            if self.dialect == "postgres":
                self._upsert_postgres(batch, prune)
            else:
                self._upsert_duckdb(batch, prune)
        return len(batch)

    def _prune(self, prune: tuple[str, str] | None) -> None:
        if prune is None:
            return
        self.execute(
            "DELETE FROM norms WHERE source = ? AND source_version = ? "
            "AND natural_key NOT IN (SELECT natural_key FROM _norms_batch)",
            list(prune),
        )

    def _upsert_sql(self, staging: str, norm_id_expr: str) -> str:
        cols = ", ".join(NORM_COLUMNS)
        select = ", ".join(norm_id_expr if c == "norm_id" else c for c in NORM_COLUMNS)
        sets = ", ".join(f"{c} = excluded.{c}" for c in _UPDATE_COLUMNS)
        return (
            f"INSERT INTO norms ({cols}) SELECT {select} FROM {staging} "
            f"ON CONFLICT (natural_key) DO UPDATE SET {sets}"
        )

    def _upsert_duckdb(self, batch: list[dict], prune: tuple[str, str] | None) -> None:
        import pyarrow as pa

        schema = pa.schema([
            ("norm_id", pa.string()), ("natural_key", pa.string()),
            ("source", pa.string()), ("source_version", pa.string()),
            ("geography", pa.string()), ("geo_code", pa.string()),
            ("period_start", pa.date32()), ("period_end", pa.date32()),
            ("construct", pa.string()), ("item_text", pa.string()),
            ("response_option", pa.string()), ("subgroup_dim", pa.string()),
            ("subgroup_value", pa.string()), ("estimate", pa.float64()),
            ("estimate_type", pa.string()), ("n", pa.int64()),
            ("se", pa.float64()), ("moe", pa.float64()),
            ("weight_var", pa.string()), ("provenance_url", pa.string()),
            ("provenance_note", pa.string()),
            ("extracted_at", pa.timestamp("us", tz="UTC")),
        ])
        table = pa.Table.from_pylist(
            [{c: r.get(c) for c in NORM_COLUMNS} for r in batch], schema=schema
        )
        self.conn.register("_norms_batch", table)
        try:
            self.conn.execute(self._upsert_sql("_norms_batch", "CAST(norm_id AS UUID)"))
            self._prune(prune)
        finally:
            self.conn.unregister("_norms_batch")

    def _upsert_postgres(self, batch: list[dict], prune: tuple[str, str] | None) -> None:
        cols = ", ".join(NORM_COLUMNS)
        with self.conn.cursor() as cur:
            cur.execute(
                "CREATE TEMP TABLE _norms_batch (LIKE norms INCLUDING DEFAULTS) ON COMMIT DROP"
            )
            with cur.copy(f"COPY _norms_batch ({cols}) FROM STDIN") as copy:
                for r in batch:
                    copy.write_row(tuple(r.get(c) for c in NORM_COLUMNS))
            cur.execute(self._upsert_sql("_norms_batch", "norm_id"))
        self._prune(prune)

    def upsert_concordance(self, row: dict) -> None:
        """Insert or update one concordance row. Array columns take Python lists."""
        cols = [c for c in row if c != "construct"]
        values = []
        for c in cols:
            v = row[c]
            if c in ARRAY_COLUMNS and v is not None and self.dialect == "duckdb":
                v = json.dumps(list(v))
            values.append(v)
        placeholders = ", ".join("?" for _ in range(len(cols) + 1))
        sets = ", ".join(f"{c} = excluded.{c}" for c in cols)
        self.execute(
            f"INSERT INTO concordance (construct, {', '.join(cols)}) VALUES ({placeholders}) "
            f"ON CONFLICT (construct) DO UPDATE SET {sets}",
            [row["construct"], *values],
        )

    def touch_source(self, source: str) -> None:
        self.execute("UPDATE sources SET last_loaded = now() WHERE source = ?", [source])

    def replace_rows(self, table: str, columns: Sequence[str], rows: Sequence[Sequence[Any]]) -> int:
        """Replace a whole table's contents in one transaction (plain text/number columns)."""
        cols = ", ".join(columns)
        with self.transaction():
            self.execute(f"DELETE FROM {table}")
            if not rows:
                return 0
            if self.dialect == "postgres":
                with self.conn.cursor() as cur:
                    with cur.copy(f"COPY {table} ({cols}) FROM STDIN") as copy:
                        for r in rows:
                            copy.write_row(tuple(r))
            else:
                import pyarrow as pa

                batch = pa.Table.from_pylist([dict(zip(columns, r)) for r in rows])
                self.conn.register("_replace_batch", batch)
                try:
                    self.conn.execute(f"INSERT INTO {table} ({cols}) SELECT {cols} FROM _replace_batch")
                finally:
                    self.conn.unregister("_replace_batch")
        return len(rows)


def _brief(row: dict) -> str:
    return "/".join(str(row.get(f)) for f in ("source", "geo_code", "construct", "response_option"))


def connect(database_url: str | None = None, duckdb_path: str | Path | None = None) -> Store:
    """Open the store. Postgres if a URL is given or DATABASE_URL is set, else DuckDB."""
    url = database_url if database_url is not None else (
        None if duckdb_path is not None else config.env("DATABASE_URL")
    )
    if url:
        import psycopg

        conn = psycopg.connect(url, autocommit=True)
        return Store("postgres", conn, label=_redact(url))
    import duckdb

    path = Path(duckdb_path) if duckdb_path is not None else config.DEFAULT_DUCKDB
    path.parent.mkdir(parents=True, exist_ok=True)
    return Store("duckdb", _open_duckdb(duckdb, path), label=str(path))


LOCK_TRIES = 20
LOCK_WAIT_SECONDS = 30


def _open_duckdb(duckdb, path: Path, tries: int | None = None, wait: float | None = None):
    """Open the file, waiting out another process's write lock: up to LOCK_TRIES attempts,
    LOCK_WAIT_SECONDS apart (two windows may load into the same file)."""
    tries = LOCK_TRIES if tries is None else tries
    wait = LOCK_WAIT_SECONDS if wait is None else wait
    for attempt in range(1, tries + 1):
        try:
            return duckdb.connect(str(path))
        except duckdb.IOException as exc:
            if "lock" not in str(exc).lower() or attempt == tries:
                raise
            print(f"{path.name} is locked by another process; retry {attempt}/{tries - 1} "
                  f"in {wait:g}s", flush=True)
            time.sleep(wait)


def _redact(url: str) -> str:
    if "@" in url and "://" in url:
        scheme, rest = url.split("://", 1)
        return f"{scheme}://***@{rest.split('@', 1)[1]}"
    return url
