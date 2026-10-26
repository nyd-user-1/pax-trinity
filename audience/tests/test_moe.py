import math

from audience.moe import proportion_moe, se, sum_moe


def test_sum_moe_is_root_sum_of_squares():
    assert sum_moe([3.0, 4.0]) == 5.0
    assert sum_moe([3.0, None]) is None
    assert sum_moe([]) == 0.0


def test_proportion_moe():
    # p = 0.25; sqrt(30^2 - 0.0625 * 40^2) / 400 = sqrt(800) / 400
    assert math.isclose(proportion_moe(100, 400, 30, 40), math.sqrt(800) / 400)


def test_proportion_moe_falls_back_to_ratio_formula():
    # 10^2 - 0.25 * 60^2 < 0, so the + form applies: sqrt(100 + 900) / 200
    assert math.isclose(proportion_moe(100, 200, 10, 60), math.sqrt(1000) / 200)


def test_proportion_moe_unknown_inputs():
    assert proportion_moe(1, 2, None, 1) is None
    assert proportion_moe(1, 0, 1, 1) is None


def test_se_from_90_percent_moe():
    assert math.isclose(se(1.645), 1.0)
