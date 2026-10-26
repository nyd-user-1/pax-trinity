"""Run a loader: python -m audience.load <source> [options]"""

from __future__ import annotations

import argparse
import sys

from . import migrate
from .db import connect
from .loaders import acs, cvap


def _acs(store, args):
    return acs.run(store, vintage=args.vintage, refresh=args.refresh)


def _cvap(store, args):
    return cvap.run(store, refresh=args.refresh)


LOADERS = {
    "acs": _acs,
    "cvap": _cvap,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m audience.load")
    parser.add_argument("source", choices=sorted(LOADERS))
    parser.add_argument("--refresh", action="store_true",
                        help="refetch raw files instead of using the raw/ cache")
    parser.add_argument("--vintage", type=int, default=acs.LATEST_VINTAGE,
                        help="ACS 5-year end year (acs only; default %(default)s)")
    args = parser.parse_args(argv)
    store = connect()
    try:
        migrate.apply(store, quiet=True)
        LOADERS[args.source](store, args)
    finally:
        store.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
