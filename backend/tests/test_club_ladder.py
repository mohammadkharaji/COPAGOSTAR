import pytest
from pydantic import ValidationError
from app import club_ladder as L

LAD = L.DEFAULT_LADDER

def test_ladder_score_steps():
    assert L.ladder_score(LAD, 0.59) == 0
    assert L.ladder_score(LAD, 0.6) == 8.75
    assert L.ladder_score(LAD, 0.85) == 14.79
    assert L.ladder_score(LAD, 1.05) == 25
    assert L.ladder_score(LAD, 3.0) == 25

def test_kpi_value_clamps_and_handles_missing_target():
    rial = L.Kpi(key="r", label="ریالی", metric="rial", weight=1, ladder=LAD)
    assert L.kpi_value(rial, 1000, -200, 0) == 0          # returns exceed sales
    assert L.kpi_value(rial, None, 500, 0) == 0           # no target
    assert L.kpi_value(rial, 0, 500, 0) == 0
    assert L.kpi_value(rial, 1000, 850, 0) == pytest.approx(0.85)
    basket = L.Kpi(key="b", label="سبد", metric="basket", weight=1, ladder=L.DEFAULT_BASKET_LADDER)
    assert L.kpi_value(basket, None, 0, 4) == 4

def test_month_score_weights_two_kpis():
    cfg = L.LadderConfig(kpis=[
        L.Kpi(key="rial", label="ریالی", metric="rial", weight=0.6, ladder=LAD),
        L.Kpi(key="cov", label="پوشش", metric="coverage", weight=0.4, ladder=LAD)],
        grade_bands=[], prize_table=[])
    score, kpis = L.month_score(cfg, {"rial": (1000, 850), "cov": (50, 50)}, 0)
    # rial 0.85 -> 14.79 * 0.6 = 8.874 ; coverage 1.0 -> 19.23 * 0.4 = 7.692
    assert score == pytest.approx(16.566)
    assert [k["key"] for k in kpis] == ["rial", "cov"]
    assert kpis[0]["weighted"] == pytest.approx(8.874) and kpis[1]["ratio"] == 1.0

@pytest.mark.parametrize("bad", [
    {"kpis": [{"key": "a", "label": "a", "metric": "rial", "weight": 0.5, "ladder": LAD}]},                   # sum 0.5
    {"kpis": [{"key": "a", "label": "a", "metric": "rial", "weight": 1, "ladder": [[0.9, 25], [0.6, 8]]}]},   # not increasing
    {"kpis": [{"key": "a", "label": "a", "metric": "coverage", "weight": 1, "ladder": LAD, "product_groups": ["x"]}]},
    {"kpis": [{"key": "a", "label": "a", "metric": "rial", "weight": 0.5, "ladder": LAD},
              {"key": "a", "label": "b", "metric": "rial", "weight": 0.5, "ladder": LAD}]},                      # dup key
])
def test_config_rejects_bad_shapes(bad):
    with pytest.raises(ValidationError):
        L.LadderConfig(grade_bands=[], prize_table=[], **bad)

def test_prize_ranges_must_not_overlap():
    with pytest.raises(ValidationError):
        L.LadderConfig(kpis=[L.Kpi(key="a", label="a", metric="rial", weight=1, ladder=LAD)], grade_bands=[],
                       prize_table=[{"rank_from": 1, "rank_to": 3, "amount": 1}, {"rank_from": 3, "rank_to": 5, "amount": 1}])

def test_grade_ranks_and_prize():
    bands = [L.GradeBand(grade="C", min_rial=0), L.GradeBand(grade="B", min_rial=5e9), L.GradeBand(grade="A", min_rial=12e9)]
    assert L.grade_for(bands, 4.9e9) == "C" and L.grade_for(bands, 5e9) == "B" and L.grade_for(bands, 20e9) == "A"
    assert L.grade_for([], 1) == "C"
    assert L.dense_ranks({"a": 10, "b": 10, "c": 7, "d": 0}) == {"a": 1, "b": 1, "c": 2, "d": 3}
    table = [L.PrizeRow(rank_from=1, rank_to=1, amount=100), L.PrizeRow(rank_from=2, rank_to=5, amount=80)]
    assert L.prize_for(table, 1) == 100 and L.prize_for(table, 4) == 80
    assert L.prize_for(table, 6) is None and L.prize_for(table, None) is None
