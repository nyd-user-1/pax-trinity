"""The analysis's validation: synthetic respondents with planted lifts, run through the same
analysis.analyze_items path as a real test, many times.

Each simulated respondent gets entry answers drawn from fixed shares, with education skewed
away from the Massachusetts targets so the raking weights vary. Their chance of answering Yes
on the ballot, and of getting the comprehension question right, depends on party, ideology,
education and 2024 vote, then rises by the arm's planted lift (the same for everyone, so
the population effect equals the planted one for every estimator). Outcomes are Bernoulli.

Two experiments, both reported:
  bias      R runs at a large n per arm: is the mean estimate within 0.1 pp of the planted
            lift? (the pax2 standard: about 40 simulated tests, within about 0.1 of truth)
  coverage  many runs at a field-sized n per arm: do 90% intervals cover the planted lift
            about 90% of the time? (the pax2 standard: 89-90%)
"""

from __future__ import annotations

import math

import numpy as np

from .analysis import ENTRY, PLACEBO, analyze_items

PLANTED = {"support": {"arm-a": 6.0, "arm-b": 3.0, "arm-c": 0.0, "arm-d": -2.0},
           "comprehension": {"arm-a": 6.0, "arm-b": 3.0, "arm-c": 0.0, "arm-d": -2.0}}
ARMS = (PLACEBO, "arm-a", "arm-b", "arm-c", "arm-d")
CHOICES = {
    "ideology": (["liberal", "moderate", "conservative"], [0.38, 0.37, 0.25]),
    "party": (["democrat", "independent-other", "republican"], [0.40, 0.38, 0.22]),
    # Skewed to the college-educated, as online panels are; MA's 25+ targets are roughly
    # 32 / 24 / 44.
    "education": (["hs-or-less", "some-college", "bachelors-plus"], [0.18, 0.22, 0.60]),
    "vote2024": (["democrat", "republican", "other", "did-not-vote"], [0.50, 0.28, 0.04, 0.18]),
    "mediaTrust": (["tv-broadcast", "direct-to-camera", "podcast-clip"], [0.45, 0.30, 0.25]),
}
TARGETS = {"education_4": {"HS or less": 0.30, "Some college": 0.24, "BA": 0.26, "Grad": 0.20}}


def _base(ans: dict[str, np.ndarray], outcome: str) -> np.ndarray:
    """Placebo-level probabilities, kept inside [0.15, 0.85] so a lift of up to 6 pp never clips."""
    if outcome == "support":
        p = (0.46 + 0.10 * (ans["party"] == "democrat") - 0.12 * (ans["party"] == "republican")
             + 0.05 * (ans["ideology"] == "liberal") - 0.05 * (ans["ideology"] == "conservative")
             + 0.04 * (ans["education"] == "bachelors-plus") - 0.04 * (ans["vote2024"] == "did-not-vote"))
    else:
        p = (0.52 + 0.14 * (ans["education"] == "bachelors-plus") - 0.10 * (ans["education"] == "hs-or-less")
             + 0.04 * (ans["vote2024"] != "did-not-vote") - 0.03 * (ans["mediaTrust"] == "tv-broadcast"))
    return np.clip(p, 0.15, 0.85)


def simulate_items(rng: np.random.Generator, n_per_arm: int, planted=PLANTED) -> list[dict]:
    items = []
    for arm in ARMS:
        ans = {k: rng.choice(vals, size=n_per_arm, p=shares) for k, (vals, shares) in CHOICES.items()}
        draws = {}
        for outcome in ("support", "comprehension"):
            lift = 0.0 if arm == PLACEBO else planted[outcome][arm]
            draws[outcome] = rng.random(n_per_arm) < _base(ans, outcome) + lift / 100
        for i in range(n_per_arm):
            answers = {k: str(ans[k][i]) for k in ENTRY}
            answers["ballot"] = "yes" if draws["support"][i] else "no"
            correct = bool(draws["comprehension"][i])
            answers["comprehension"] = "one-primary-top-two" if correct else "ranked-choice"
            items.append({"kind": "complete", "arm": arm, "answers": answers,
                          "comprehensionCorrect": correct, "env": "simulation"})
    return items


def run_experiment(runs: int, n_per_arm: int, seed: int, planted=PLANTED) -> dict:
    """Estimates of every arm x outcome x estimator across runs, against the planted lifts."""
    rng = np.random.default_rng(seed)
    kinds = ("unweighted", "weighted", "adjusted")
    est = {(o, a, k): [] for o in planted for a in planted[o] for k in kinds}
    cover = {(o, a, k): [] for o in planted for a in planted[o] for k in kinds}
    ses = {(o, a, k): [] for o in planted for a in planted[o] for k in kinds}
    for _ in range(runs):
        report = analyze_items(simulate_items(rng, n_per_arm, planted), TARGETS, "simulation",
                               place=False, subgroups=False)
        for o in planted:
            for a, truth in planted[o].items():
                for k in kinds:
                    r = report["estimates"][o][a][k]
                    est[(o, a, k)].append(r["lift"])
                    ses[(o, a, k)].append(r["se"])
                    cover[(o, a, k)].append(r["ci90"][0] <= truth <= r["ci90"][1])
    cells = []
    for (o, a, k), values in est.items():
        v = np.array(values, float)
        truth = planted[o][a]
        sd = float(v.std(ddof=1)) if runs > 1 else float("nan")
        cells.append({"outcome": o, "arm": a, "estimator": k, "planted": truth,
                      "mean_estimate": float(v.mean()), "bias": float(v.mean() - truth),
                      "mc_se_of_mean": sd / math.sqrt(runs), "sd_of_estimates": sd,
                      "mean_reported_se": float(np.mean(ses[(o, a, k)])),
                      "coverage90": float(np.mean(cover[(o, a, k)]))})
    pooled = {}
    for k in kinds:
        mine = [c for c in cells if c["estimator"] == k]
        hits = sum(c["coverage90"] * runs for c in mine)
        trials = runs * len(mine)
        cov = hits / trials
        pooled[k] = {"coverage90": cov, "coverage_mc_se": math.sqrt(cov * (1 - cov) / trials),
                     "max_abs_bias": max(abs(c["bias"]) for c in mine),
                     "mean_abs_bias": float(np.mean([abs(c["bias"]) for c in mine]))}
    return {"runs": runs, "n_per_arm": n_per_arm, "seed": seed, "cells": cells, "pooled": pooled}


def validate(runs: int = 40, n_per_arm: int = 50_000, coverage_runs: int = 1_000,
             coverage_n_per_arm: int = 500, seed: int = 20261026) -> dict:
    bias = run_experiment(runs, n_per_arm, seed)
    coverage = run_experiment(coverage_runs, coverage_n_per_arm, seed + 1)
    verdict = {
        k: {"bias_within_0.1": bias["pooled"][k]["max_abs_bias"] <= 0.1,
            "coverage_89_to_91": 0.89 <= coverage["pooled"][k]["coverage90"] <= 0.91}
        for k in bias["pooled"]}
    return {"planted": PLANTED, "targets": TARGETS, "bias_experiment": bias,
            "coverage_experiment": coverage, "verdict": verdict}
