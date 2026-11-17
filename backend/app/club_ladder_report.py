"""Leaderboard and scorecard for visitor achievement-ladder plans.

Reads the sales database read-only and returns JSON-ready dicts. The route layer owns the access checks and the
degradation gates (missing database, unsupported core, nothing loaded), so this module raises no HTTP errors and is
safe to call only once those gates passed.
"""
from __future__ import annotations

from collections import defaultdict

from . import club_ladder_data as D
from .club_ladder import (DEFAULT_BASKET_THRESHOLD, LadderConfig, dense_ranks, grade_for, month_score, prize_for)
from .config import CORES
from .db import connect
from .jalali import days_in_jalali_month

NOTE_NO_TARGET = "برای این ویزیتور در این ماه هدفی ثبت نشده است."
GRADE_WINDOW_MONTHS = 3


def plan_months(plan: dict) -> list[str]:
    """Every whole Jalali month that lies inside [start_key, end_key]."""
    start, end = plan["start_key"], plan["end_key"]
    sy, sm, ey, em = start // 10000, start // 100 % 100, end // 10000, end // 100 % 100
    out, y, m = [], sy, sm
    while (y, m) <= (ey, em):
        days = days_in_jalali_month(y, m)
        first, last = y * 10000 + m * 100 + 1, y * 10000 + m * 100 + days
        if first >= start and last <= end:
            out.append(f"{y:04d}{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _config(plan: dict) -> LadderConfig:
    return LadderConfig.model_validate(plan["config"])


def _basket_threshold(cfg: LadderConfig) -> float:
    return next((k.threshold for k in cfg.kpis if k.metric == "basket"), DEFAULT_BASKET_THRESHOLD)


def _prior_months(start_key: int, count: int = GRADE_WINDOW_MONTHS) -> list[str]:
    """The `count` Jalali months just before the plan's first month, newest first."""
    y, m = start_key // 10000, start_key // 100 % 100
    out = []
    for _ in range(count):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
        out.append(f"{y:04d}{m:02d}")
    return out


def _grade_averages(con, core_name: str, months: list[str]) -> dict[str, float]:
    """visitor code -> average monthly Rial+Vat over the months that hold any sales (promotions included)."""
    if not months:
        return {}
    marks = ",".join("?" * len(months))
    have = con.execute(
        f"SELECT COUNT(DISTINCT year_month) FROM fact_sales WHERE core=? AND year_month IN ({marks})",
        [core_name, *months]).fetchone()[0] or 0
    if not have:
        return {}
    rows = con.execute(
        f"SELECT visitor_code, SUM(rial_vat) FROM fact_sales WHERE core=? AND year_month IN ({marks}) "
        "AND visitor_code IS NOT NULL GROUP BY 1", [core_name, *months]).fetchall()
    return {code: float(rial or 0.0) / have for code, rial in rows}


def _completed(months: list[str], last_sales: int | None) -> dict[str, bool]:
    """A month is complete once the last day with sales lies after its own last day."""
    out = {}
    for month in months:
        y, m = int(month[:4]), int(month[4:])
        last_day = y * 10000 + m * 100 + days_in_jalali_month(y, m)
        out[month] = bool(last_sales) and last_sales > last_day
    return out


def _month_scores(cfg: LadderConfig, vms: list) -> dict[tuple[str, str], float]:
    threshold = _basket_threshold(cfg)
    out = {}
    for vm in vms:
        inputs = {k.key: D.kpi_inputs(vm, k) for k in cfg.kpis}
        out[(vm.code, vm.month)] = month_score(cfg, inputs, D.basket_groups(vm, threshold))[0]
    return out


def _rows(cfg: LadderConfig, vms: list, scores: dict, completed: dict, last_month: str | None,
          averages: dict[str, float]) -> list[dict]:
    meta: dict[str, tuple[str, str, str]] = {}          # code -> (latest target month, name, branch)
    for vm in vms:
        current = meta.get(vm.code)
        if current is None or vm.month >= current[0]:
            meta[vm.code] = (vm.month, vm.name, vm.branch)

    months_by_code: dict[str, dict[str, float]] = {code: {} for code in meta}
    for (code, month), score in scores.items():
        if completed.get(month) and code in months_by_code:
            months_by_code[code][month] = score
    totals = {code: sum(months.values()) for code, months in months_by_code.items()}
    grades = {code: grade_for(cfg.grade_bands, averages.get(code, 0.0)) for code in meta}
    latest_scores = {code: scores.get((code, last_month), 0.0) if last_month else 0.0 for code in meta}

    national = dense_ranks(totals)
    by_grade: dict[str, dict[str, float]] = defaultdict(dict)
    by_branch: dict[tuple[str, str], dict[str, float]] = defaultdict(dict)
    for code, total in totals.items():
        by_grade[grades[code]][code] = total
        by_branch[(meta[code][2] or "", grades[code])][code] = total
    rank_grade = {code: rank for group in by_grade.values() for code, rank in dense_ranks(group).items()}
    rank_branch = {code: rank for group in by_branch.values() for code, rank in dense_ranks(group).items()}
    rank_month = dense_ranks(latest_scores)

    rows = []
    for code, (month, name, branch) in meta.items():
        months = months_by_code[code]
        tenure = len(months)
        total = totals[code]
        rows.append({
            "code": code, "name": name, "branch": branch, "grade": grades[code], "tenure": tenure,
            "months": months, "total": total, "average": total / tenure if tenure else 0.0,
            "rank_national": national.get(code), "rank_grade": rank_grade.get(code),
            "rank_branch": rank_branch.get(code), "rank_month_national": rank_month.get(code),
            "provisional_month": ({"month": last_month, "score": latest_scores[code]}
                                  if last_month and not completed.get(last_month) else None),
            "prize": prize_for(cfg.prize_table, national.get(code)),
        })
    rows.sort(key=lambda r: (-r["total"], r["code"]))
    return rows


def leaderboard(plan: dict) -> dict:
    """Scores, grades, ranks and prizes for every visitor with a target row inside the plan window."""
    cfg = _config(plan)
    months = plan_months(plan)
    core_name = CORES[plan["core"]]
    con = connect(read_only=True)
    try:
        last = D.last_sales_key(con, core_name)
        vms = D.load_visitor_months(con, core_name, months)
        averages = _grade_averages(con, core_name, _prior_months(plan["start_key"]))
    finally:
        con.close()
    scores = _month_scores(cfg, vms)
    completed = _completed(months, last)
    rows = _rows(cfg, vms, scores, completed, months[-1] if months else None, averages)
    return {"available": True, "plan": plan,
            "months": [{"month": m, "completed": completed[m]} for m in months], "rows": rows}


def _month_kpis(cfg: LadderConfig, vm) -> list[dict]:
    inputs = {k.key: D.kpi_inputs(vm, k) for k in cfg.kpis}
    return month_score(cfg, inputs, D.basket_groups(vm, _basket_threshold(cfg)))[1]


def scorecard(plan: dict, code: str, month: str | None = None) -> dict:
    """One visitor's leaderboard row plus the chosen month's KPI breakdown."""
    board = leaderboard(plan)
    cfg = _config(plan)
    months = [m["month"] for m in board["months"]]
    chosen = month or (months[-1] if months else None)
    vm = None
    if chosen:
        con = connect(read_only=True)
        try:
            vm = next((v for v in D.load_visitor_months(con, CORES[plan["core"]], [chosen]) if v.code == code), None)
        finally:
            con.close()
    row = next((r for r in board["rows"] if r["code"] == code), None) or {
        "code": code, "name": code, "branch": None, "grade": None, "tenure": 0, "months": {}, "total": 0.0,
        "average": 0.0, "rank_national": None, "rank_grade": None, "rank_branch": None,
        "rank_month_national": None, "provisional_month": None, "prize": None}
    return {**row, "month": chosen, "kpis": _month_kpis(cfg, vm) if vm else [],
            "note": None if vm else NOTE_NO_TARGET,
            "ladder_max": max(points for _, points in cfg.kpis[0].ladder)}
