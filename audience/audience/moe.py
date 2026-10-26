"""Census margin-of-error approximations for derived estimates.

ACS and CVAP publish 90% MOEs. Formulas from the Census Bureau, "Understanding and Using
American Community Survey Data: What All Data Users Need to Know" (2020), ch. 8:
https://www.census.gov/content/dam/Census/library/publications/2020/acs/acs_general_handbook_2020_ch08.pdf
"""

from __future__ import annotations

import math
from typing import Iterable

Z90 = 1.645


def sum_moe(moes: Iterable[float | None]) -> float | None:
    """MOE of a sum of estimates: root of the summed squares. None if any part is unknown."""
    total = 0.0
    for m in moes:
        if m is None:
            return None
        total += m * m
    return math.sqrt(total)


def proportion_moe(num: float, den: float, moe_num: float | None, moe_den: float | None) -> float | None:
    """MOE of p = num/den where num is a subset of den. Falls back to the ratio formula
    when the term under the root goes negative, as the handbook directs."""
    if moe_num is None or moe_den is None or den <= 0:
        return None
    p = num / den
    under = moe_num ** 2 - (p ** 2) * (moe_den ** 2)
    if under < 0:
        under = moe_num ** 2 + (p ** 2) * (moe_den ** 2)
    return math.sqrt(under) / den


def se(moe: float | None) -> float | None:
    return None if moe is None else moe / Z90
