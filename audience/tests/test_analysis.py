"""The analysis engine: the HC2 and Lin math on fixtures, raking, Holm, the report's shape on
a handful of responses, and the simulator in miniature. No AWS."""

import math

import numpy as np
import pandas as pd
import pytest

from audience import analysis as an
from audience.simulate import TARGETS, run_experiment, simulate_items


def test_hc2_difference_in_means_is_the_neyman_variance():
    y = np.array([1.0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0])
    t = np.array([1.0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0])
    r = an.diff_in_means(y, t)
    y1, y0 = y[t == 1], y[t == 0]
    assert r["lift"] == pytest.approx(y1.mean() - y0.mean())
    assert r["se"] == pytest.approx(math.sqrt(y1.var(ddof=1) / len(y1) + y0.var(ddof=1) / len(y0)))
    assert r["ci90"][1] - r["lift"] == pytest.approx(1.6448536 * r["se"], rel=1e-6)


def test_hc2_matches_the_explicit_formula():
    rng = np.random.default_rng(3)
    X = np.column_stack([np.ones(30), rng.normal(size=30), rng.integers(0, 2, 30)])
    y = X @ [1.0, 0.5, -0.3] + rng.normal(size=30)
    beta, V = an.ols_hc2(X, y)
    bread = np.linalg.inv(X.T @ X)
    e = y - X @ beta
    h = np.array([X[i] @ bread @ X[i] for i in range(30)])
    meat = sum(np.outer(X[i], X[i]) * e[i] ** 2 / (1 - h[i]) for i in range(30))
    assert np.allclose(V, bread @ meat @ bread)


def test_lin_equals_the_difference_of_per_arm_intercepts():
    """With covariates centered at the pooled mean, the fully interacted regression splits into
    one regression per arm; Lin's estimate is the difference of their intercepts and its HC2
    variance the sum of theirs."""
    rng = np.random.default_rng(7)
    n = 80
    t = (np.arange(n) % 2).astype(float)
    Z = np.column_stack([rng.integers(0, 2, n), rng.integers(0, 2, n)]).astype(float)
    y = 50 + 6 * t + 10 * Z[:, 0] - 5 * Z[:, 1] + rng.normal(0, 8, n)
    r = an.lin_adjusted(y, t, Z)
    Zc = Z - Z.mean(axis=0)
    b1, V1 = an.ols_hc2(np.column_stack([np.ones(int(t.sum())), Zc[t == 1]]), y[t == 1])
    b0, V0 = an.ols_hc2(np.column_stack([np.ones(int((1 - t).sum())), Zc[t == 0]]), y[t == 0])
    assert r["lift"] == pytest.approx(b1[0] - b0[0])
    assert r["se"] == pytest.approx(math.sqrt(V1[0, 0] + V0[0, 0]))


def test_not_estimable_is_reported_not_raised():
    y = np.array([1.0, 1.0, 1.0, 1.0])
    t = np.array([1.0, 1.0, 0.0, 0.0])
    r = an._estimate(an.diff_in_means, y, t)
    assert r["lift"] is None and "no variation" in r["note"]


def test_holm():
    # Sorted 0.01, 0.03, 0.04 -> 3 x 0.01, 2 x 0.03, then max(0.06, 1 x 0.04): monotone step-down.
    adj = an.holm([0.01, 0.04, 0.03, None])
    assert adj[0] == pytest.approx(0.03) and adj[2] == pytest.approx(0.06) and adj[1] == pytest.approx(0.06)
    assert adj[3] is None


def test_rake_hits_the_targets_and_reports_empty_categories():
    df = pd.DataFrame({"education": ["hs-or-less"] * 10 + ["some-college"] * 20 + ["bachelors-plus"] * 70})
    w, info = an.rake(df, {"education": {"hs-or-less": 0.3, "some-college": 0.25, "bachelors-plus": 0.45}})
    shares = df.assign(w=w).groupby("education")["w"].sum() / w.sum()
    assert shares["hs-or-less"] == pytest.approx(0.3) and shares["bachelors-plus"] == pytest.approx(0.45)
    assert w.mean() == pytest.approx(1.0) and info["design_effect"] > 1
    w2, info2 = an.rake(df[df["education"] != "hs-or-less"],
                        {"education": {"hs-or-less": 0.3, "some-college": 0.25, "bachelors-plus": 0.45}})
    assert info2["dropped_target_categories"] == {"education": ["hs-or-less"]}
    assert info2["targets"]["education"]["some-college"] == pytest.approx(0.25 / 0.70)


def test_entry_targets_map_the_store_dims_to_the_entry_questions():
    t = an.entry_targets({"education_4": {"HS or less": 0.3, "Some college": 0.2, "BA": 0.3, "Grad": 0.2},
                          "party_id_3": {"democrat": 0.4, "independent-other": 0.45, "republican": 0.15},
                          "vote_2024": {"democrat": 0.4, "republican": 0.25, "other": 0.05, "did-not-vote": 0.3}})
    assert t["education"] == pytest.approx({"hs-or-less": 0.3, "some-college": 0.2, "bachelors-plus": 0.5})
    assert set(t) == {"education", "party", "vote2024"}
    assert t["vote2024"]["did-not-vote"] == pytest.approx(0.3)
    assert an.entry_targets({"party_id_3": {"democrat": 1.0}}) == {"party": {"democrat": 1.0}}


def test_raking_on_three_dims_meets_every_margin():
    rng = np.random.default_rng(2)
    items = simulate_items(rng, 400)
    targets = an.entry_targets(TARGETS)
    df = an.respondents(items)
    w, info = an.rake(df, targets)
    for question, shares in targets.items():
        got = df.assign(w=w).groupby(question)["w"].sum() / w.sum()
        for cat, share in shares.items():
            assert got[cat] == pytest.approx(share, abs=1e-6), (question, cat)
    assert info["capped"] == 0 and info["design_effect"] > 1


def _item(arm, ballot="yes", correct=True, party="democrat", education="bachelors-plus"):
    return {"kind": "complete", "arm": arm, "env": "development", "comprehensionCorrect": correct,
            "answers": {"ideology": "moderate", "party": party, "education": education,
                        "vote2024": "democrat", "mediaTrust": "podcast-clip", "ballot": ballot,
                        "comprehension": "one-primary-top-two" if correct else "ranked-choice"}}


def test_a_handful_of_responses_reports_honest_nulls():
    items = [_item("placebo"), _item("px-gaby", "no"), {"kind": "start", "arm": "px-gaby", "env": "development"}]
    r = an.clean(an.analyze_items(items, TARGETS, "t", place=False))
    assert r["n"]["completes"] == 2 and r["n"]["starts"] == 1
    assert "fewer than 50" in r["n"]["plain"]
    e = r["estimates"]["support"]["px-gaby"]
    assert e["adjusted"]["lift"] is None and "at least 2" in e["adjusted"]["note"]
    assert e["level"]["unweighted"] == 0.0 and e["placebo_level"]["unweighted"] == 100.0


def test_report_shape_and_flags_on_simulated_data():
    rng = np.random.default_rng(11)
    items = simulate_items(rng, 120)
    r = an.clean(an.analyze_items(items, TARGETS, "sim", place=False))
    assert set(r["estimates"]) == {"support", "comprehension"}
    e = r["estimates"]["support"]["arm-a"]
    for kind in ("unweighted", "weighted", "adjusted"):
        assert e[kind]["lift"] is not None and e[kind]["criterion"] in ("detectable", "inconclusive")
        assert e[kind]["holm_p"] >= e[kind]["p"]
    assert e["headline"] == "adjusted"
    assert r["weighting"]["dims"] == ["education", "party", "vote2024"] and r["weighting"]["design_effect"] > 1
    assert r["weighting"]["dims_without_target"] == ["ideology", "mediaTrust"]
    cell = r["subgroups"]["support"]["party"]["republican"]["arm-a"]
    assert cell["small_cell"] is True and cell["n_arm"] < 50   # flagged, not dropped


def test_simulator_in_miniature_recovers_planted_lifts():
    r = run_experiment(runs=8, n_per_arm=4000, seed=5)
    for c in r["cells"]:
        # Each mean is within 4 standard errors of the planted lift, using the analysis's own
        # reported se (8 runs estimate the spread too noisily to judge by).
        assert abs(c["bias"]) <= 4 * c["mean_reported_se"] / math.sqrt(r["runs"]), c
    # The reported se tracks the actual spread, judged per estimator over its eight cells: one
    # cell's spread from 8 runs falls below half its se by chance often enough to flake.
    for k in ("unweighted", "weighted", "adjusted"):
        ratios = [c["sd_of_estimates"] / c["mean_reported_se"] for c in r["cells"] if c["estimator"] == k]
        assert 0.7 < sum(ratios) / len(ratios) < 1.3, (k, ratios)
    assert 0.7 <= r["pooled"]["adjusted"]["coverage90"] <= 1.0
