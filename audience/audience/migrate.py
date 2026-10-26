"""Apply numbered SQL migrations: python -m audience.migrate"""

from __future__ import annotations

import sys

from . import config
from .db import Store, connect

DIALECT_TYPES = {
    "duckdb": {"${TEXT_ARRAY}": "JSON", "${NUMERIC}": "DECIMAL(38,10)"},
    "postgres": {"${TEXT_ARRAY}": "text[]", "${NUMERIC}": "numeric"},
}


def migration_files():
    return sorted(config.MIGRATIONS.glob("[0-9][0-9][0-9]_*.sql"))


def render(sql: str, dialect: str) -> str:
    for token, value in DIALECT_TYPES[dialect].items():
        sql = sql.replace(token, value)
    return sql


def apply(store: Store, quiet: bool = False) -> list[str]:
    """Apply every migration not yet recorded in schema_migrations. Returns those applied."""
    store.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        "version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
    )
    done = {r[0] for r in store.query("SELECT version FROM schema_migrations")}
    applied = []
    for path in migration_files():
        version = path.stem
        if version in done:
            continue
        with store.transaction():
            store.script(render(path.read_text(), store.dialect))
            store.execute("INSERT INTO schema_migrations (version) VALUES (?)", [version])
        applied.append(version)
        if not quiet:
            print(f"applied {version}")
    if not quiet and not applied:
        print("schema up to date")
    return applied


def main() -> int:
    store = connect()
    try:
        print(f"store: {store.dialect} {store.label}")
        apply(store)
    finally:
        store.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
