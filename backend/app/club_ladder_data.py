"""Visitor-month targets, actuals and customer coverage for the achievement ladder.

Actuals are the Target page's actuals: Rial+Vat of every row of the month (promotions included,
returns negative), limited to the month's target categories and rolled up from target category to
product group through that month's target file. The club scores every visitor, so `month_sales` is
called without an rbac scope; the route layer decides who may see what.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from . import target_sales
from .club_ladder import Kpi

ALL = "__all__"
SALES_ONLY = "NOT is_promo AND NOT is_return"


@dataclass(frozen=True)
class VisitorMonth:
    code: str
    name: str
    branch: str
    month: str
    rial_targets: dict[str, float]
    rial_actuals: dict[str, float]
    coverage_target: float | None
    coverage_actual: int


def load_visitor_months(con, core_name: str, months: list[str]) -> list[VisitorMonth]:
    """One entry per (visitor, month) that has at least one target row with a code."""
    months = list(months)
    if not months:
        return []
    marks = ",".join("?" * len(months))
    by_name = target_sales.visitor_codes_by_name(con, core_name)
    # target_coverage arrived with the coverage KPI and is absent from databases built before it, so it is
    # selected only when the column exists; a missing column means "this month has no coverage target"
    has_cov = any(r[0] == "target_coverage" for r in con.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name='fact_target'").fetchall())
    cov_col = "target_coverage" if has_cov else "NULL"
    rows = con.execute(
        f"""SELECT month, branch, target_category, product_group, visitor_code, visitor_name,
                   target_rial, {cov_col}
            FROM fact_target WHERE core=? AND month IN ({marks})""", [core_name, *months]).fetchall()
    coverage = {(ym, code): n for ym, code, n in con.execute(
        f"""SELECT year_month, visitor_code, COUNT(DISTINCT customer_code) FROM fact_sales
            WHERE core=? AND year_month IN ({marks}) AND {SALES_ONLY} GROUP BY 1, 2""",
        [core_name, *months]).fetchall()}

    targets: dict[tuple[str, str], dict] = {}   # (code, month) -> name, branch, {group: target}, coverage
    group_of: dict[str, dict[str, str]] = defaultdict(dict)   # month -> target_category -> product_group
    for month, branch, cat, group, code, name, rial, cov in rows:
        group_of[month][cat] = group
        code = target_sales.resolve_code(code, name, by_name)
        if not code:
            continue
        t = targets.setdefault((code, month), {"name": name, "branch": branch, "groups": defaultdict(float),
                                               "coverage": None})
        t["groups"][group] += rial or 0.0
        if cov is not None:
            t["coverage"] = max(t["coverage"] or 0.0, cov)

    group_actual: dict[tuple[str, str, str], float] = defaultdict(float)   # (month, code, group) -> actual rial
    month_actual: dict[tuple[str, str], float] = defaultdict(float)        # (month, code) -> actual of the month's categories
    for month in months:
        if not any(m == month for _, m in targets):
            continue
        for _branch, _line, code, cat, _day, rial in target_sales.month_sales(con, core_name, month):
            group = group_of[month].get(cat)
            if group and (code, month) in targets:
                group_actual[(month, code, group)] += rial or 0.0
                month_actual[(month, code)] += rial or 0.0

    actual_by_code: dict[tuple[str, str], dict[str, float]] = defaultdict(dict)   # (month, code) -> group -> actual
    for (month, code, group), v in group_actual.items():
        actual_by_code[(month, code)][group] = v

    out = []
    for (code, month), t in sorted(targets.items()):
        groups = dict(t["groups"])
        out.append(VisitorMonth(
            code=code, name=t["name"], branch=t["branch"], month=month,
            rial_targets={**groups, ALL: sum(groups.values())},
            # every targeted group keeps a line (0.0 when nothing sold), and so does every group the
            # visitor sold without holding a target for it, so the lines add up to __all__ and a sale
            # the visitor made stays visible to a group-level KPI instead of only moving the total
            rial_actuals={**{g: 0.0 for g in groups}, **actual_by_code[(month, code)],
                          ALL: month_actual.get((month, code), 0.0)},
            coverage_target=t["coverage"],
            coverage_actual=coverage.get((month, code), 0),
        ))
    return out


def kpi_inputs(vm: VisitorMonth, kpi: Kpi) -> tuple[float | None, float]:
    """(target, actual) fed to `club_ladder.month_score` for one KPI of one visitor-month."""
    if kpi.metric == "rial":
        keys = kpi.product_groups or [ALL]
        return (sum(vm.rial_targets.get(k, 0.0) for k in keys),
                sum(vm.rial_actuals.get(k, 0.0) for k in keys))
    if kpi.metric == "coverage":
        return (vm.coverage_target, float(vm.coverage_actual))
    return (None, 0.0)


def basket_groups(vm: VisitorMonth, threshold: float) -> int:
    """Groups with a target where the visitor reached `threshold` of it."""
    return sum(1 for group, target in vm.rial_targets.items()
               if group != ALL and target > 0 and vm.rial_actuals.get(group, 0.0) / target >= threshold)


def last_sales_key(con, core_name: str) -> int | None:
    return con.execute("SELECT MAX(jdate_key) FROM fact_sales WHERE core=?", [core_name]).fetchone()[0]
