"""The bulk tier: every categorical variable of a respondent-level survey file, beside the
hand-harmonized constructs.

A bulk variable is its own construct, named after the file's variable (lowercased). Its
response options are the file's own value labels in coded order, so nothing is invented:

- A variable qualifies with 2 to 24 labeled substantive codes. Codes labeled as non-answers
  (refused, don't know, no answer, uncodeable, ...) are left out of the base, as the
  harmonized loaders leave out the extended-missing codes.
- Every observed value must be a labeled code. A labeled scale whose points between its
  labeled ends carry no label (a 1-7 scale labeled only at 1 and 7) keeps every integer
  point, the unlabeled ones named by their number, as the harmonized EQWLTH item does.
  Anything else with unlabeled values (an age, a count with a top code, an amount) is
  continuous and skipped: no banding is invented.

Rows: the weighted topline for every period the variable was asked; the subgroup
breakdowns for the latest period only. survey.shares does the arithmetic, so the n < 50
rule and the Kish-effective-n margins are the house's.

The export lists a construct's response options alphabetically unless response_order
(migration 007) holds their coded order; write_response_order() records it.
"""

from __future__ import annotations

import re
from typing import Iterable, Mapping, Sequence

import pandas as pd

from . import survey
from .db import Store

MIN_BANDS = 2
MAX_BANDS = 24

# Value labels of numeric codes that mark a non-answer, compared lowercased with
# punctuation and spacing squeezed. "Not sure", "depends", "can't say" and "other" are
# answers a questionnaire offers and stay in the base.
MISSING_LABELS = frozenset({
    "refused", "refuse", "dk", "na", "don't know", "dont know", "do not know",
    "no answer", "iap", "inapplicable", "not applicable", "skipped", "skipped on web",
    "dk, na, iap", "dk/na", "na/dk", "dk, na", "not imputable", "uncodeable",
    "uncodable", "missing", "not available in this release", "not available in this year",
    "see codebook", "not ascertained", "no response",
})


def _norm(label: str) -> str:
    return re.sub(r"\s+", " ", str(label).strip().lower().replace("’", "'"))


def is_missing_label(label: str) -> bool:
    return _norm(label) in MISSING_LABELS


def sentence_case(text: str) -> str:
    """First letter up, the rest as written; an all-capitals label is lowered first."""
    t = re.sub(r"\s+", " ", str(text or "")).strip()
    if not t:
        return t
    if not re.search(r"[a-z]", t):
        t = t.lower()
    return t[0].upper() + t[1:]


def _code(c) -> float:
    return float(c)


def _num(c) -> str:
    f = float(c)
    return str(int(f)) if f.is_integer() else f"{f:g}"


def labeled_codes(value_labels: Mapping | None) -> dict[float, str]:
    """The substantive numeric codes and their labels, in coded order. String keys
    (Stata's extended missing values, read as NaN) and non-answer labels are left out."""
    out = {}
    for k, label in sorted(((k, v) for k, v in (value_labels or {}).items()
                            if not isinstance(k, str)), key=lambda kv: float(kv[0])):
        if not is_missing_label(label):
            out[_code(k)] = str(label)
    return out


def missing_codes(value_labels: Mapping | None) -> set[float]:
    return {_code(k) for k, v in (value_labels or {}).items()
            if not isinstance(k, str) and is_missing_label(v)}


def options_for(values: pd.Series, value_labels: Mapping | None) -> tuple[dict | None, str]:
    """The response options of one variable: {code: band label} in coded order, or None
    and the reason it does not qualify."""
    labeled = labeled_codes(value_labels)
    if len(labeled) < MIN_BANDS:
        return None, f"{len(labeled)} labeled code{'s' * (len(labeled) != 1)}"
    if len(labeled) > MAX_BANDS:
        return None, f"{len(labeled)} labeled codes (over {MAX_BANDS})"
    seen = pd.unique(values.dropna())
    if len(seen) == 0:
        return None, "no answers in the file"
    unlabeled = set(float(v) for v in seen) - set(labeled) - missing_codes(value_labels)
    if not unlabeled:
        return {c: sentence_case(l) for c, l in labeled.items()}, ""
    if any(not v.is_integer() for v in unlabeled):
        return None, "continuous (unlabeled non-integer values)"
    lo, hi = min(labeled), max(labeled)
    if not (lo.is_integer() and hi.is_integer()) or any(v < lo or v > hi for v in unlabeled):
        return None, "continuous (unlabeled values outside the labeled codes)"
    points = int(hi - lo) + 1
    if points > MAX_BANDS:
        return None, f"continuous ({points}-point range labeled only in part)"
    opts = {}
    for p in range(int(lo), int(hi) + 1):
        c = float(p)
        if c in labeled:
            text = sentence_case(labeled[c])
            opts[c] = text if re.match(rf"{p}\b", text) else f"{p} ({text})"
        elif c not in missing_codes(value_labels):
            opts[c] = str(p)
    return opts, ""


def cells(df: pd.DataFrame, item: str, weight: str, options: Mapping,
          subgroups: Mapping[str, str], period: str = "year",
          min_n: int = survey.MIN_CELL_N):
    """Toplines for every period with an answer; breakdowns for the latest period whose
    topline is stored. Returns (cells, skipped, latest period or None)."""
    top, _ = survey.shares(df, item, weight, options, None, period=period, min_n=min_n)
    if not top:
        return [], {}, None
    latest = max(c.period for c in top)
    full, skipped = survey.shares(df.loc[df[period] == latest], item, weight, options,
                                  subgroups, period=period, min_n=min_n)
    return [c for c in top if c.period != latest] + full, skipped, latest


def write_response_order(store: Store, source: str,
                         orders: Mapping[str, Sequence[str]]) -> int:
    """Replace the source's recorded option order: construct -> labels in coded order."""
    if not store.table_exists("response_order"):
        return 0
    rows = []
    for construct, labels in orders.items():
        for i, label in enumerate(dict.fromkeys(labels)):
            rows.append((source, construct, label, i))
    with store.transaction():
        store.execute("DELETE FROM response_order WHERE source = ?", [source])
        for i in range(0, len(rows), 500):
            part = rows[i:i + 500]
            store.execute(
                "INSERT INTO response_order (source, construct, response_option, ordinal) "
                "VALUES " + ", ".join("(?, ?, ?, ?)" for _ in part),
                [v for r in part for v in r])
    return len(rows)


def prune_slice(store: Store, source: str, version: str, keep: Iterable[str]) -> int:
    """Delete the slice's rows whose natural key is not in keep: the prune upsert_norms does
    for a single batch, for a slice written in several."""
    keep = set(keep)
    have = store.query("SELECT natural_key FROM norms WHERE source = ? AND source_version = ?",
                       [source, version])
    stale = [k for (k,) in have if k not in keep]
    for i in range(0, len(stale), 500):
        part = stale[i:i + 500]
        store.execute(f"DELETE FROM norms WHERE natural_key IN ({', '.join('?' for _ in part)})",
                      part)
    return len(stale)
