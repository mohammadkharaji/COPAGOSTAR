"""Achievement-ladder scoring for the visitor club.

Pure module: holds no I/O, database or FastAPI code. Only Pydantic models and functions.
"""
from typing import Literal

from pydantic import BaseModel, Field, model_validator

DEFAULT_LADDER: list[list[float]] = [[0.6, 8.75], [0.7, 11.38], [0.8, 14.79], [0.9, 19.23], [1.05, 25]]
DEFAULT_BASKET_LADDER: list[list[float]] = [[2, 8.75], [3, 11.38], [4, 14.79], [5, 19.23], [6, 25]]
DEFAULT_BASKET_THRESHOLD = 0.7
WEIGHT_TOLERANCE = 0.001


class Kpi(BaseModel):
    key: str
    label: str
    metric: Literal["rial", "coverage", "basket"]
    weight: float = Field(gt=0, le=1)
    ladder: list[list[float]]
    product_groups: list[str] | None = None
    threshold: float = DEFAULT_BASKET_THRESHOLD


class GradeBand(BaseModel):
    grade: str
    min_rial: float = Field(ge=0)


class PrizeRow(BaseModel):
    rank_from: int = Field(ge=1)
    rank_to: int = Field(ge=1)
    amount: float = Field(ge=0)


class LadderConfig(BaseModel):
    kpis: list[Kpi] = Field(min_length=1, max_length=12)
    grade_bands: list[GradeBand]
    prize_table: list[PrizeRow]

    @model_validator(mode="after")
    def _check(self) -> "LadderConfig":
        _check_kpis(self.kpis)
        _check_grades(self.grade_bands)
        _check_prizes(self.prize_table)
        return self


def _check_ladder(ladder: list[list[float]], label: str) -> None:
    if not ladder:
        raise ValueError(f"نردبان «{label}» خالی است")
    for (t1, s1), (t2, s2) in zip(ladder, ladder[1:]):
        if t2 <= t1:
            raise ValueError(f"آستانه‌های نردبان «{label}» باید اکیداً صعودی باشند")
        if s2 < s1:
            raise ValueError(f"امتیاز نردبان «{label}» نباید کاهش یابد")


def _check_kpis(kpis: list[Kpi]) -> None:
    keys = [k.key for k in kpis]
    if len(set(keys)) != len(keys):
        raise ValueError("کلید شاخص‌ها باید یکتا باشد")
    total = sum(k.weight for k in kpis)
    if abs(total - 1) > WEIGHT_TOLERANCE:
        raise ValueError(f"جمع وزن شاخص‌ها باید ۱ باشد (اکنون {total:g})")
    for kpi in kpis:
        _check_ladder(kpi.ladder, kpi.label)
        if kpi.product_groups is not None and kpi.metric != "rial":
            raise ValueError(f"گروه‌های محصول فقط برای شاخص ریالی مجازند ({kpi.label})")


def _check_grades(bands: list[GradeBand]) -> None:
    letters = [b.grade for b in bands]
    if len(set(letters)) != len(letters):
        raise ValueError("حروف درجه‌بندی باید یکتا باشند")
    mins = [b.min_rial for b in bands]
    if any(m2 <= m1 for m1, m2 in zip(mins, mins[1:])):
        raise ValueError("بازه‌های درجه‌بندی باید به ترتیب صعودی حداقل ریال باشند")


def _check_prizes(table: list[PrizeRow]) -> None:
    for row in table:
        if row.rank_from > row.rank_to:
            raise ValueError("بازه رتبه جایزه نامعتبر است: رتبه شروع بزرگ‌تر از پایان است")
    ordered = sorted(table, key=lambda r: r.rank_from)
    for prev, cur in zip(ordered, ordered[1:]):
        if cur.rank_from <= prev.rank_to:
            raise ValueError("بازه‌های رتبه جوایز نباید با هم هم‌پوشانی داشته باشند")


def ladder_score(ladder: list[list[float]], value: float) -> float:
    score = 0.0
    for threshold, points in ladder:
        if value >= threshold:
            score = points
    return score


def kpi_value(kpi: Kpi, target: float | None, actual: float, basket_groups: int) -> float:
    if kpi.metric == "basket":
        return float(basket_groups)
    if not target:
        return 0.0
    return max(actual / target, 0.0)


def month_score(
    config: LadderConfig, inputs: dict[str, tuple[float | None, float]], basket_groups: int
) -> tuple[float, list[dict]]:
    total = 0.0
    kpis: list[dict] = []
    for kpi in config.kpis:
        target, actual = inputs.get(kpi.key, (None, 0.0))
        ratio = kpi_value(kpi, target, actual, basket_groups)
        score = ladder_score(kpi.ladder, ratio)
        weighted = score * kpi.weight
        total += weighted
        kpis.append({
            "key": kpi.key, "label": kpi.label, "metric": kpi.metric, "target": target, "actual": actual,
            "ratio": ratio, "score": score, "weight": kpi.weight, "weighted": weighted,
        })
    return total, kpis


def grade_for(bands: list[GradeBand], avg_rial: float) -> str:
    grade = "C"
    for band in bands:
        if band.min_rial <= avg_rial:
            grade = band.grade
    return grade


def dense_ranks(values: dict[str, float]) -> dict[str, int]:
    order = {v: i + 1 for i, v in enumerate(sorted(set(values.values()), reverse=True))}
    return {key: order[v] for key, v in values.items()}


def prize_for(table: list[PrizeRow], rank: int | None) -> float | None:
    if rank is None:
        return None
    for row in table:
        if row.rank_from <= rank <= row.rank_to:
            return row.amount
    return None
