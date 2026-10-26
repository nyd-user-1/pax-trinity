"""Run a loader: python -m audience.load <source> [options]"""

from __future__ import annotations

import argparse
import sys

from . import geographies, migrate
from .db import connect
from .loaders import acs, anes, ces, cps, cvap, gss, ma_enrollment, wvs
from .loaders import apnorc, polls
from .loaders import lift_archive, pax_tests

# CLI name -> loader module. Each module exposes SOURCE and run(store, ...); the audit
# reads this map to tell "loader exists, raw data absent" from "no loader".
MODULES = {
    "acs": acs,
    "cvap": cvap,
    "cps": cps,
    "ma_enrollment": ma_enrollment,
    "gss": gss,
    "anes": anes,
    "ces": ces,
    "wvs": wvs,
    "polls": polls,
    "apnorc": apnorc,
    "lift_archive": lift_archive,
    "pax_tests": pax_tests,
}


def _run(name, store, args):
    if name == "acs":
        return acs.run(store, vintage=args.vintage, refresh=args.refresh)
    return MODULES[name].run(store, refresh=args.refresh)


LOADERS = {name: (lambda store, args, _n=name: _run(_n, store, args)) for name in MODULES}


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
        geographies.refresh(store)  # keep every norms geo_code named
    finally:
        store.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
