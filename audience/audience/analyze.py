"""Analyze a message test, or validate the analysis by simulation.

    python -m audience.analyze <test-id> [--env all|production|development] [--out PATH]
    python -m audience.analyze --simulate [--runs 40] [--n-per-arm 50000]
                               [--coverage-runs 1000] [--coverage-n-per-arm 500] [--seed N]

The report schema is documented in audience/analysis.py. Reports go to audience/reports/
(gitignored).
"""

from __future__ import annotations

import argparse
import json
import sys

from . import analysis, config


def _print_report(r: dict) -> None:
    print(f"{r['test']}: {r['n']['plain']}  items by env: {r['n']['by_env']}")
    for outcome, arms in r["estimates"].items():
        for arm, e in arms.items():
            h = e[e["headline"]]
            lift = "null" if h["lift"] is None else f"{h['lift']:+.1f} pp (se {h['se']:.1f}, {h['criterion']})"
            print(f"  {outcome:<13} {arm:<20} n {e['n']['arm']:>4} vs {e['n']['placebo']:>4}  "
                  f"{e['headline']}: {lift}{'  ' + h['note'] if h.get('note') else ''}")


def _print_simulation(v: dict) -> None:
    for name in ("bias_experiment", "coverage_experiment"):
        x = v[name]
        print(f"{name}: {x['runs']} runs, {x['n_per_arm']:,} per arm")
        for k, p in x["pooled"].items():
            print(f"  {k:<10} max |bias| {p['max_abs_bias']:.3f} pp, mean |bias| {p['mean_abs_bias']:.3f} pp, "
                  f"90% coverage {p['coverage90']:.3f} (MC se {p['coverage_mc_se']:.3f})")
    print("verdict:", json.dumps(v["verdict"]))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m audience.analyze")
    parser.add_argument("test", nargs="?", help="the test id, e.g. open-primaries-1")
    parser.add_argument("--env", default="all", choices=["all", "production", "development"],
                        help="which items to include (default all; dev walks are stamped development)")
    parser.add_argument("--out", help="report path (default audience/reports/<test>.json)")
    parser.add_argument("--simulate", action="store_true", help="validate the analysis on planted lifts")
    parser.add_argument("--runs", type=int, default=40)
    parser.add_argument("--n-per-arm", type=int, default=50_000)
    parser.add_argument("--coverage-runs", type=int, default=1_000)
    parser.add_argument("--coverage-n-per-arm", type=int, default=500)
    parser.add_argument("--seed", type=int, default=20261026)
    args = parser.parse_args(argv)

    if args.simulate:
        from .simulate import validate

        v = analysis.clean(validate(args.runs, args.n_per_arm, args.coverage_runs,
                                    args.coverage_n_per_arm, args.seed))
        path = config.ROOT / "reports" / "simulation.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(v, indent=1))
        _print_simulation(v)
        print(f"wrote {path}")
        return 0
    if not args.test:
        parser.error("give a test id, or --simulate")
    from pathlib import Path

    out = Path(args.out) if args.out else None
    report = analysis.run(args.test, env=args.env, out=out)
    _print_report(report)
    print(f"wrote {out or analysis.report_path(args.test)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
