"""Message-test analysis: every response for a test, read from DynamoDB, into one report.

    python -m audience.analyze <test-id> [--env all|production|development] [--out PATH]
    python -m audience.analyze --simulate [--runs N] [--n-per-arm N] [--coverage-runs N]

Inputs: the items the collector (/api/tests/<id>/responses) writes to the DynamoDB table
pax-trinity-test-responses: kind "start", "complete" or "screenout". Only completes enter the
estimates; starts and screenouts are counted.

Outcomes, each 0/100 per respondent so levels and lifts are in percent and percentage points:
  support        the ballot answer is "yes" (no and would-not-vote count as not yes)
  comprehension  the comprehension answer is the correct one

Estimators, each treatment arm against the placebo:
  unweighted  difference in means; HC2 standard error (equal to the Neyman variance)
  weighted    raked to Massachusetts targets from api.get_population_targets on the three entry
              questions that have one: education (ACS education_4, BA and Grad pooled), party
              (party_id_3, CES party ID collapsed as the question asks it) and 2024 vote
              (vote_2024, the official return over CVAP adults); ideology and media trust have
              none. WLS of the outcome on the arm, HC2
  adjusted    Lin (2013): OLS of the outcome on the arm, the entry-question dummies centered
              at their mean, and arm x centered-dummy interactions; HC2. The headline estimate.
Inference: normal p-values; the 90% criterion labels a lift "detectable" when its 90%
interval excludes 0 and "inconclusive" otherwise; Holm-adjusted p-values across arms within
an outcome, per estimator, beside the unadjusted ones.

Report schema (audience/reports/<test-id>.json):
{
  "test": str, "generated_at": ISO time, "schema": 1,
  "source": {"table": str, "region": str, "env": "all"|"production"|"development"},
  "n": {"items": int, "by_env": {env: int}, "completes": int, "starts": int,
        "screenouts": int, "by_arm": {arm: {"started": int, "completed": int,
        "screenouts": int}}, "plain": str},                     # plain-English sample size
  "outcomes": {name: {"definition": str}},
  "weighting": {"dims": [...], "dims_without_target": [...], "targets": {dim: {cat: share}},
                "sample_shares": {...}, "dropped_target_categories": {...},
                "design_effect": float|null, "max_weight": float|null, "capped": int,
                "note": str},
  "estimates": {outcome: {arm: {
      "n": {"arm": int, "placebo": int},
      "level": {"unweighted": float|null, "weighted": float|null},
      "placebo_level": {"unweighted": float|null, "weighted": float|null},
      "unweighted"|"weighted"|"adjusted": {"lift": float|null, "se": float|null,
          "ci90": [lo, hi]|null, "p": float|null, "criterion": "detectable"|"inconclusive"|null,
          "holm_p": float|null, "holm_criterion": str|null, "note": str|null},
      "headline": "adjusted"|"unweighted",
      "placement": {benchmark: {"percentile", "benchmark", "caveat"}}|{"note": str}}}},
  "subgroups": {outcome: {dim: {value: {arm: {"lift": float|null, "se": float|null,
      "n_arm": int, "n_placebo": int, "small_cell": bool}}}}},
  "notes": [str]
}
Every number is computed from the responses; a quantity that cannot be estimated is null
with a note saying why. Nothing is imputed.
"""

from __future__ import annotations

import datetime as dt
import json
import math
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import numpy as np
import pandas as pd

from . import config

TABLE = "pax-trinity-test-responses"
REGION = "us-east-1"
PLACEBO = "placebo"
ENTRY = ("ideology", "party", "education", "vote2024", "mediaTrust")
OUTCOMES = {
    "support": "Percent answering Yes on the ballot question (No and Would not vote count as not Yes).",
    "comprehension": "Percent choosing the correct description of the measure on the comprehension question.",
}
Z90 = 1.6448536269514722
CRITERION_P = 0.10
SMALL_CELL = 50
WEIGHT_CAP = 5.0
# Benchmarks for place_lift: the PAX waves' own lifts on the same outcome, and for support
# the lift dataset's closest analog (share choosing the advocated side, in percentage points).
BENCHMARKS = {"support": ("lift_support", "lift_vote_choice_dichotomized"),
              "comprehension": ("lift_comprehension",)}
# Entry-question categories -> the ACS education_4 categories they pool.
EDUCATION_MAP = {"hs-or-less": ("HS or less",), "some-college": ("Some college",),
                 "bachelors-plus": ("BA", "Grad")}


class NotEstimable(ValueError):
    """The data cannot support this estimate; the message says why."""


# -- reading ---------------------------------------------------------------------------

def _plain(v):
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, dict):
        return {k: _plain(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_plain(x) for x in v]
    return v


def fetch_items(test_id: str, table: str = TABLE, region: str = REGION) -> list[dict]:
    """Every item for the test, paging through the query."""
    import boto3
    from boto3.dynamodb.conditions import Key

    t = boto3.resource("dynamodb", region_name=region).Table(table)
    items, kwargs = [], {"KeyConditionExpression": Key("test").eq(test_id)}
    while True:
        r = t.query(**kwargs)
        items += [_plain(i) for i in r.get("Items", [])]
        if "LastEvaluatedKey" not in r:
            return items
        kwargs["ExclusiveStartKey"] = r["LastEvaluatedKey"]


def respondents(items: Iterable[dict]) -> pd.DataFrame:
    """Completes as one row each: arm, the entry answers, and the two outcomes (0/100)."""
    rows = []
    for i in items:
        if i.get("kind") != "complete":
            continue
        a = i.get("answers", {})
        rows.append({"arm": i["arm"], **{k: a.get(k) for k in ENTRY},
                     "support": 100.0 if a.get("ballot") == "yes" else 0.0,
                     "comprehension": 100.0 if a.get("comprehension") and i.get("comprehensionCorrect") else 0.0,
                     "env": i.get("env")})
    return pd.DataFrame(rows, columns=["arm", *ENTRY, *OUTCOMES, "env"])


# -- the math ------------------------------------------------------------------------------

def ols_hc2(X: np.ndarray, y: np.ndarray, w: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    """OLS (or WLS with weights w) coefficients and their HC2 covariance."""
    X = np.asarray(X, float)
    y = np.asarray(y, float)
    if w is not None:
        sw = np.sqrt(np.asarray(w, float))
        X, y = X * sw[:, None], y * sw
    n, p = X.shape
    if n <= p or np.linalg.matrix_rank(X) < p:
        raise NotEstimable(f"{n} observations cannot identify {p} coefficients")
    xtx_inv = np.linalg.inv(X.T @ X)
    beta = xtx_inv @ X.T @ y
    e = y - X @ beta
    h = np.einsum("ij,jk,ik->i", X, xtx_inv, X)
    if np.any(h > 1 - 1e-10):
        raise NotEstimable("an observation has leverage 1, so HC2 is undefined")
    meat = (X * (e * e / (1 - h))[:, None]).T @ X
    return beta, xtx_inv @ meat @ xtx_inv


def normal_p(z: float) -> float:
    return math.erfc(abs(z) / math.sqrt(2))


def summarize(lift: float, se: float) -> dict:
    if not (math.isfinite(lift) and math.isfinite(se)) or se <= 0:
        raise NotEstimable("the standard error is zero or undefined (no variation in the outcome)")
    p = normal_p(lift / se)
    return {"lift": lift, "se": se, "ci90": [lift - Z90 * se, lift + Z90 * se], "p": p,
            "criterion": "detectable" if p < CRITERION_P else "inconclusive"}


def diff_in_means(y: np.ndarray, t: np.ndarray, w: np.ndarray | None = None) -> dict:
    X = np.column_stack([np.ones(len(y)), t])
    beta, V = ols_hc2(X, y, w)
    return summarize(float(beta[1]), float(math.sqrt(V[1, 1])))


def dummies(df: pd.DataFrame, columns: Sequence[str]) -> np.ndarray:
    """Indicator columns for each entry question, first category dropped, constant columns dropped."""
    parts = []
    for c in columns:
        d = pd.get_dummies(df[c].astype("string").fillna("missing"), drop_first=True, dtype=float)
        parts.append(d)
    if not parts:
        return np.empty((len(df), 0))
    m = pd.concat(parts, axis=1).to_numpy(float)
    return m[:, m.std(axis=0) > 0] if m.size else m


def lin_adjusted(y: np.ndarray, t: np.ndarray, Z: np.ndarray) -> dict:
    """Lin (2013): the arm, centered covariates, and their interactions; the arm's coefficient."""
    Zc = Z - Z.mean(axis=0)
    X = np.column_stack([np.ones(len(y)), t, Zc, Zc * t[:, None]])
    beta, V = ols_hc2(X, y)
    return summarize(float(beta[1]), float(math.sqrt(V[1, 1])))


def holm(pvalues: Sequence[float | None]) -> list[float | None]:
    """Holm step-down adjusted p-values; None stays None and does not count toward m."""
    idx = [i for i, p in enumerate(pvalues) if p is not None]
    order = sorted(idx, key=lambda i: pvalues[i])
    m, out, running = len(order), [None] * len(pvalues), 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (m - rank) * pvalues[i]))
        out[i] = running
    return out


# -- weighting -----------------------------------------------------------------------------

# Store target dims -> the entry question each one weights. education_4 is pooled to the entry
# question's three categories; party_id_3 and vote_2024 already use its answer values.
TARGET_DIMS = {"education_4": "education", "party_id_3": "party", "vote_2024": "vote2024"}


def entry_targets(targets_by_dim: Mapping[str, Mapping[str, float]]) -> dict[str, dict[str, float]]:
    """The store's targets keyed by entry question, each normalized to sum to 1."""
    out: dict[str, dict[str, float]] = {}
    for dim, question in TARGET_DIMS.items():
        shares = targets_by_dim.get(dim)
        if not shares:
            continue
        if dim == "education_4":
            shares = {cat: sum(shares.get(a, 0.0) for a in acs) for cat, acs in EDUCATION_MAP.items()}
        total = sum(shares.values())
        if total:
            out[question] = {k: v / total for k, v in shares.items()}
    return out


def rake(df: pd.DataFrame, targets: Mapping[str, Mapping[str, float]], cap: float = WEIGHT_CAP,
         iterations: int = 200, tol: float = 1e-10) -> tuple[np.ndarray, dict]:
    """Iterative proportional fitting to the targets, weights mean 1, capped at cap x the mean
    (re-raking after each cap). Target categories with no respondents are dropped and the
    remaining shares renormalized; both facts are returned."""
    n = len(df)
    w = np.ones(n)
    usable, dropped = {}, {}
    for dim, shares in targets.items():
        present = {c: s for c, s in shares.items() if (df[dim] == c).any()}
        gone = sorted(set(shares) - set(present))
        if gone:
            dropped[dim] = gone
        tot = sum(present.values())
        if present and tot > 0:
            usable[dim] = {c: s / tot for c, s in present.items()}
    capped = 0
    for _ in range(10):
        for _ in range(iterations):
            before = w.copy()
            for dim, shares in usable.items():
                col = df[dim].to_numpy()
                in_target = np.isin(col, list(shares))
                total = w[in_target].sum()
                for c, s in shares.items():
                    mask = col == c
                    cur = w[mask].sum()
                    if cur > 0:
                        w[mask] *= s * total / cur
            if np.max(np.abs(w - before)) < tol:
                break
        w = w * n / w.sum()
        over = w > cap
        if not over.any():
            break
        capped = int(over.sum())
        w[over] = cap
        w = w * n / w.sum()
    info = {"targets": usable, "dropped_target_categories": dropped,
            "design_effect": float(n * np.sum(w ** 2) / np.sum(w) ** 2) if n else None,
            "max_weight": float(w.max()) if n else None, "capped": capped}
    return w, info


# -- the report --------------------------------------------------------------------------

def _estimate(fn, *args) -> dict:
    try:
        r = fn(*args)
        r["note"] = None
        return r
    except NotEstimable as exc:
        return {"lift": None, "se": None, "ci90": None, "p": None, "criterion": None, "note": str(exc)}


def _wmean(y, w):
    return float(np.average(y, weights=w)) if len(y) and np.sum(w) > 0 else None


def analyze_items(items: list[dict], targets_by_dim: Mapping[str, Mapping[str, float]] | None,
                  test_id: str, env: str = "all", place: bool = True,
                  subgroups: bool = True) -> dict:
    """The full report from collector items (the same path the simulator uses)."""
    items = [i for i in items if env == "all" or i.get("env") == env]
    df = respondents(items)
    arms_seen = sorted(set(df["arm"]) | {i["arm"] for i in items if "arm" in i})
    treatments = [a for a in arms_seen if a != PLACEBO]
    by_kind = Counter(i.get("kind") for i in items)
    by_arm = {a: {"started": sum(1 for i in items if i.get("kind") == "start" and i.get("arm") == a),
                  "completed": int((df["arm"] == a).sum()),
                  "screenouts": sum(1 for i in items if i.get("kind") == "screenout" and i.get("arm") == a)}
              for a in arms_seen}
    n_complete = len(df)
    small = [a for a in arms_seen if by_arm[a]["completed"] < SMALL_CELL]
    plain = (f"{n_complete} completed response{'s' if n_complete != 1 else ''} across "
             f"{len(arms_seen)} arm{'s' if len(arms_seen) != 1 else ''}"
             + (f"; {len(small)} arm(s) have fewer than {SMALL_CELL} completes, so their estimates are "
                f"noise-dominated" if small else "") + ".")
    notes: list[str] = []
    if n_complete == 0:
        notes.append("No completed responses yet: every estimate is null.")

    targets = entry_targets(targets_by_dim or {})
    if df.empty or not targets:
        w, winfo = np.ones(len(df)), {"targets": {}, "dropped_target_categories": {},
                                      "design_effect": None, "max_weight": None, "capped": 0}
        if not targets:
            notes.append("No population targets available: weighted estimates equal unweighted.")
    else:
        w, winfo = rake(df, targets)
    df = df.assign(_w=w)
    weighting = {
        "dims": sorted(winfo["targets"]), "dims_without_target": [d for d in ENTRY if d not in winfo["targets"]],
        "sample_shares": {d: {k: float(v) for k, v in df[d].value_counts(normalize=True).items()}
                          for d in winfo["targets"]} if n_complete else {},
        **winfo,
        "note": ("Raked to Massachusetts targets: education from ACS (25 and over; BA and Grad "
                 "pooled), party from the latest CES party ID (strong and weak partisans with their "
                 "party, leaners and independents as independent-other, as the entry question "
                 "asks it), and 2024 vote from the official return over CVAP adults (blank ballots "
                 f"with other). Weights capped at {WEIGHT_CAP:g}x the mean. Questions without a "
                 "target are adjusted for (Lin) but not weighted to."),
    }

    estimates: dict = {}
    sub: dict = {}
    for outcome in OUTCOMES:
        estimates[outcome] = {}
        for arm in treatments:
            pair = df[df["arm"].isin([arm, PLACEBO])]
            y = pair[outcome].to_numpy(float)
            t = (pair["arm"] == arm).to_numpy(float)
            wv = pair["_w"].to_numpy(float)
            n_arm, n_pl = int(t.sum()), int((1 - t).sum())
            if n_arm < 2 or n_pl < 2:
                why = f"needs at least 2 completes in the arm and the placebo (has {n_arm} and {n_pl})"
                unw = wtd = adj = {"lift": None, "se": None, "ci90": None, "p": None, "criterion": None, "note": why}
            else:
                unw = _estimate(diff_in_means, y, t)
                wtd = _estimate(diff_in_means, y, t, wv)
                adj = _estimate(lin_adjusted, y, t, dummies(pair, ENTRY))
            est = {
                "n": {"arm": n_arm, "placebo": n_pl},
                "level": {"unweighted": float(y[t == 1].mean()) if n_arm else None,
                          "weighted": _wmean(y[t == 1], wv[t == 1]) if n_arm else None},
                "placebo_level": {"unweighted": float(y[t == 0].mean()) if n_pl else None,
                                  "weighted": _wmean(y[t == 0], wv[t == 0]) if n_pl else None},
                "unweighted": unw, "weighted": wtd, "adjusted": adj,
                "headline": "adjusted" if adj["lift"] is not None else "unweighted",
            }
            estimates[outcome][arm] = est
        for kind in ("unweighted", "weighted", "adjusted"):
            adj_p = holm([estimates[outcome][a][kind]["p"] for a in treatments])
            for a, hp in zip(treatments, adj_p):
                estimates[outcome][a][kind]["holm_p"] = hp
                estimates[outcome][a][kind]["holm_criterion"] = (
                    None if hp is None else "detectable" if hp < CRITERION_P else "inconclusive")
        if place:
            for arm in treatments:
                estimates[outcome][arm]["placement"] = placements(outcome, estimates[outcome][arm])
        if subgroups:
            sub[outcome] = subgroup_lifts(df, outcome, treatments)

    return {
        "test": test_id, "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "schema": 1,
        "source": {"table": TABLE, "region": REGION, "env": env},
        "n": {"items": len(items), "by_env": dict(Counter(i.get("env") for i in items)),
              "completes": n_complete, "starts": by_kind.get("start", 0),
              "screenouts": by_kind.get("screenout", 0), "by_arm": by_arm, "plain": plain},
        "outcomes": {k: {"definition": v} for k, v in OUTCOMES.items()},
        "weighting": weighting, "estimates": estimates, "subgroups": sub, "notes": notes,
    }


def subgroup_lifts(df: pd.DataFrame, outcome: str, treatments: Sequence[str]) -> dict:
    """Unweighted lift per entry-question value; every cell is kept, small ones flagged."""
    out: dict = {}
    for dim in ENTRY:
        out[dim] = {}
        for value in sorted(df[dim].dropna().unique()):
            cell = df[df[dim] == value]
            out[dim][value] = {}
            for arm in treatments:
                pair = cell[cell["arm"].isin([arm, PLACEBO])]
                t = (pair["arm"] == arm).to_numpy(float)
                n_arm, n_pl = int(t.sum()), int((1 - t).sum())
                entry = {"n_arm": n_arm, "n_placebo": n_pl,
                         "small_cell": n_arm < SMALL_CELL or n_pl < SMALL_CELL}
                if n_arm >= 2 and n_pl >= 2:
                    r = _estimate(diff_in_means, pair[outcome].to_numpy(float), t)
                    entry.update(lift=r["lift"], se=r["se"], note=r["note"])
                else:
                    entry.update(lift=None, se=None,
                                 note="needs at least 2 completes in the arm and the placebo")
                out[dim][value][arm] = entry
    return out


def placements(outcome: str, est: dict) -> dict:
    lift = est[est["headline"]]["lift"]
    if lift is None:
        return {"note": "no lift to place"}
    from . import api

    out = {}
    try:
        store = api.open_store()
    except Exception as exc:  # no store on this machine
        return {"note": f"store unavailable: {exc}"}
    try:
        for construct in BENCHMARKS[outcome]:
            try:
                p = api.place_lift(lift, construct, store=store)
                out[construct] = {"percentile": p["percentile"], "benchmark": p["benchmark"],
                                  "caveat": p["caveat"]}
            except LookupError as exc:
                out[construct] = {"note": str(exc)}
    finally:
        store.close()
    return out


def population_targets() -> dict:
    """Massachusetts targets for the entry questions; a dim the store cannot build is skipped."""
    from . import api

    out = {}
    for dim in TARGET_DIMS:
        try:
            out.update(api.get_population_targets("25", dims=[dim]))
        except Exception:
            continue
    return out


def clean(obj):
    """JSON-safe: NaN and inf become null, numpy scalars plain."""
    if isinstance(obj, dict):
        return {str(k): clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean(v) for v in obj]
    if isinstance(obj, (np.floating, float)):
        f = float(obj)
        return round(f, 6) if math.isfinite(f) else None
    if isinstance(obj, np.integer):
        return int(obj)
    return obj


def report_path(test_id: str) -> Path:
    return config.ROOT / "reports" / f"{test_id}.json"


def run(test_id: str, env: str = "all", out: Path | None = None) -> dict:
    items = fetch_items(test_id)
    report = clean(analyze_items(items, population_targets(), test_id, env=env))
    path = out or report_path(test_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=1))
    return report
