"""Store health check: python -m audience.audit

Exits 1 if any row lacks provenance_url or any construct lacks a concordance row.
"""

from __future__ import annotations

import sys

from .db import Store, connect


def run(store: Store) -> int:
    failures = 0
    print(f"store: {store.dialect} {store.label}\n")

    per_source = store.query(
        "SELECT source, count(*), count(DISTINCT geo_code) "
        "FROM norms GROUP BY source ORDER BY source"
    )
    print("rows per source")
    if not per_source:
        print("  (none)")
    for source, n, geos in per_source:
        print(f"  {source:<14}{n:>10,} rows  {geos:>6,} geographies")
    total = sum(r[1] for r in per_source)
    print(f"  {'total':<14}{total:>10,}\n")

    missing = store.query(
        "SELECT count(*) FROM norms WHERE provenance_url IS NULL OR provenance_url = ''"
    )[0][0]
    print(f"rows missing provenance_url: {missing}")
    failures += missing > 0

    orphans = [r[0] for r in store.query(
        "SELECT DISTINCT n.construct FROM norms n "
        "LEFT JOIN concordance c ON c.construct = n.construct "
        "WHERE c.construct IS NULL ORDER BY 1"
    )]
    print(f"constructs in norms lacking a concordance row: {', '.join(orphans) or 'none'}")
    failures += bool(orphans)

    unloaded = [r[0] for r in store.query(
        "SELECT s.source FROM sources s "
        "WHERE NOT EXISTS (SELECT 1 FROM norms n WHERE n.source = s.source) ORDER BY 1"
    )]
    print(f"sources in the sources table with no rows loaded: {', '.join(unloaded) or 'none'}")
    return 1 if failures else 0


def main() -> int:
    store = connect()
    try:
        if not store.table_exists("norms"):
            print("no schema yet: run python -m audience.migrate")
            return 1
        return run(store)
    finally:
        store.close()


if __name__ == "__main__":
    sys.exit(main())
