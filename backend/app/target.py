"""Monthly sales target vs actual (read-only). Targets are loaded from target_<core>_<YYYYMM>.tsv by app.ingest.

Actual = Rial+Vat of non-promotion rows (returns count negatively) whose product's TargetCategory is one of the month's
target categories. The expected share of the month is the same working-day rule the dashboard's pace card uses: working
days up to the last day with data / working days of the month (Fridays and SR_HOLIDAYS are off).
"""
from __future__ import annotations

import re
from collections import defaultdict, namedtuple

from fastapi import APIRouter, HTTPException, Query, Request

from .config import CORES, DB_PATH, HOLIDAYS
from .db import connect
from .jalali import days_in_jalali_month, format_jdate, jalali_to_gregorian, jalali_weekday

router = APIRouter(prefix="/api/target")

TARGET_CORES = ("kg",)  # the chain core gets its own target later
BY = ("branch", "manager", "supervisor", "visitor", "line", "group", "category")
FILTERS = ("branch", "line", "manager", "supervisor", "group", "category", "visitor")
# achieved / expected-to-date: at or above ON_TRACK is on plan, at or above WATCH is slightly behind, below is behind
ON_TRACK, WATCH = 1.0, 0.9
NO_CODE = "__no_code__"      # target rows of visitors that cannot be matched to a visitor code
OTHER = "__other__"          # sales of visitors that have no target
NO_SUPERVISOR, NO_MANAGER = "بدون سرپرست در فایل تارگت", "بدون مدیر در فایل تارگت"

T = namedtuple("T", "branch line category group code name supervisor manager rial")
A = namedtuple("A", "branch line code category day amount")


def _table_exists(con, name: str) -> bool:
    return bool(con.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name=?", [name]).fetchone()[0])


def _is_working(jy: int, jm: int, d: int) -> bool:
    return jalali_weekday(jalali_to_gregorian(jy, jm, d)) != 6 and format_jdate(jy, jm, d) not in HOLIDAYS


def _status(achieved: float, expected: float) -> str | None:
    if expected <= 0:
        return None
    r = achieved / expected
    return "ahead" if r >= ON_TRACK else "near" if r >= WATCH else "behind"


def _filters(request: Request) -> dict[str, set[str]]:
    out = {}
    for k in FILTERS:
        vals = {v for v in request.query_params.getlist(k) if v}
        if vals:
            out[k] = vals
    return out


@router.get("")
def target_report(request: Request, core: str = "kg", month: str | None = Query(None), by: str = "branch"):
    if core not in CORES:
        raise HTTPException(400, "هسته فروش نامعتبر است")
    if by not in BY:
        raise HTTPException(400, "بعد گزارش نامعتبر است")
    if month is not None and not re.fullmatch(r"\d{6}", month):
        raise HTTPException(400, "ماه باید به شکل 140507 باشد")
    if core not in TARGET_CORES:
        return {"available": False, "core": core, "months": [], "reason": "تارگت این هسته هنوز تعریف نشده است."}
    if not DB_PATH.exists():
        raise HTTPException(503, "پایگاه داده هنوز ساخته نشده است")
    name = CORES[core]
    filters = _filters(request)
    con = connect(read_only=True)
    try:
        if not _table_exists(con, "fact_target"):
            return {"available": False, "core": core, "months": [], "reason": "هنوز هیچ تارگتی بارگذاری نشده است."}
        months = [{"month": m, "rows": n, "target_rial": s, "loaded_at": at} for m, n, s, at in con.execute(
            """SELECT t.month, COUNT(*), SUM(t.target_rial), MAX(m.loaded_at) FROM fact_target t
               LEFT JOIN ingest_manifest m ON m.file_name = t.chunk_id || '.tsv'
               WHERE t.core=? GROUP BY 1 ORDER BY 1 DESC""", [name]).fetchall()]
        if not months:
            return {"available": False, "core": core, "months": [], "reason": "هنوز هیچ تارگتی بارگذاری نشده است."}
        ym = month or months[0]["month"]
        if ym not in {m["month"] for m in months}:
            raise HTTPException(404, "تارگت این ماه بارگذاری نشده است")
        trows = [T(*r) for r in con.execute(
            """SELECT branch, line, target_category, product_group, visitor_code, visitor_name, supervisor, manager, target_rial
               FROM fact_target WHERE core=? AND month=?""", [name, ym]).fetchall()]
        by_name = {n: (c, k) for n, c, k in con.execute(
            """SELECT visitor, ANY_VALUE(visitor_code), COUNT(DISTINCT visitor_code) FROM fact_sales
               WHERE core=? AND visitor IS NOT NULL AND visitor_code IS NOT NULL GROUP BY 1""", [name]).fetchall()}
        sales = con.execute(
            """SELECT s.branch, s.group_name, s.visitor_code, d.target_category, COALESCE(s.jdate_key, 0) % 100, SUM(s.rial_vat)
               FROM fact_sales s LEFT JOIN dim_product d ON d.unique_product_code = s.unique_product_code
               WHERE s.core=? AND s.year_month=? AND NOT s.is_promo GROUP BY 1, 2, 3, 4, 5""", [name, ym]).fetchall()
        last = con.execute("SELECT MAX(jdate_key) FROM fact_sales WHERE core=?", [name]).fetchone()[0]
    finally:
        con.close()

    # Visitor code: the one in the file, else the database code of the same name when that name has exactly one code.
    trows = [t._replace(code=t.code or (by_name[t.name][0] if t.name in by_name and by_name[t.name][1] == 1 else None))
             for t in trows]
    cats = {t.category for t in trows}
    manager_of = {(t.branch, t.line): t.manager for t in trows}
    group_of = {t.category: t.group for t in trows}
    codes: dict[str, dict] = {}
    for t in trows:
        if t.code:
            c = codes.setdefault(t.code, {"name": t.name, "supervisor": t.supervisor, "branch": t.branch, "rial": 0.0})
            c["rial"] += t.rial
    outside = sum(r[5] or 0 for r in sales if r[3] not in cats)
    arows = [A(r[0], r[1], r[2], r[3], r[4], r[5] or 0.0) for r in sales if r[3] in cats]

    def t_attrs(t):
        return {"branch": t.branch, "line": t.line, "manager": t.manager, "supervisor": t.supervisor,
                "group": t.group, "category": t.category, "visitor": t.code}

    def a_attrs(a):
        return {"branch": a.branch, "line": a.line, "manager": manager_of.get((a.branch, a.line)),
                "supervisor": codes[a.code]["supervisor"] if a.code in codes else None,
                "group": group_of[a.category], "category": a.category, "visitor": a.code}

    def keep(attrs, skip=None):
        return all(attrs[k] in v for k, v in filters.items() if k != skip)

    options = {}
    for k in FILTERS:
        vals = {t_attrs(t)[k] for t in trows if keep(t_attrs(t), skip=k) and t_attrs(t)[k]}
        options[k] = ([{"value": c, "label": codes[c]["name"]} for c in sorted(vals, key=lambda c: codes[c]["name"])]
                      if k == "visitor" else sorted(vals))
    tsel = [(t, t_attrs(t)) for t in trows]
    tsel = [t for t, at in tsel if keep(at)]
    asel = [(a, at) for a, at in ((a, a_attrs(a)) for a in arows) if keep(at)]

    jy, jm = int(ym[:4]), int(ym[4:])
    month_days = days_in_jalali_month(jy, jm)
    last_ym, last_day = (last // 100, last % 100) if last else (0, 0)
    as_of_day = last_day if int(ym) == last_ym else month_days if int(ym) < last_ym else 0
    elapsed_to = [0] * (month_days + 1)
    for d in range(1, month_days + 1):
        elapsed_to[d] = elapsed_to[d - 1] + _is_working(jy, jm, d)
    working, elapsed = elapsed_to[month_days], elapsed_to[as_of_day]
    exp_pct = elapsed / working if working else 0.0
    remaining = working - elapsed

    def label(key):
        if by == "visitor":
            return ("ویزیتورهای بدون کد (هدف فقط در شعبه/سرپرست/مدیر لحاظ شده)" if key == NO_CODE
                    else "سایر ویزیتورها (بدون تارگت)" if key == OTHER else codes[key]["name"])
        return key

    def key_t(t):
        return {"branch": t.branch, "line": t.line, "manager": t.manager, "supervisor": t.supervisor, "group": t.group,
                "category": t.category, "visitor": t.code or NO_CODE}[by]

    def key_a(a, at):
        return {"branch": a.branch or "—", "line": a.line or "—", "manager": at["manager"] or NO_MANAGER,
                "supervisor": at["supervisor"] or NO_SUPERVISOR, "group": at["group"], "category": a.category,
                "visitor": a.code if a.code in codes else OTHER}[by]

    agg: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
    for t in tsel:
        agg[key_t(t)][0] += t.rial
    for a, at in asel:
        agg[key_a(a, at)][1] += a.amount

    def metrics(target, actual):
        expected = target * exp_pct
        return {
            "target_rial": target, "actual_rial": actual, "achieved_pct": actual / target if target else None,
            "expected_rial": expected, "gap_rial": actual - expected,
            "needed_per_day_rial": (max(target - actual, 0) / remaining) if remaining > 0 and target else None,
            "projected_rial": actual / elapsed * working if elapsed else None,
            "projected_pct": (actual / elapsed * working / target) if elapsed and target else None,
            "status": _status(actual, expected) if target else None,
        }

    rows = []
    for key, (target, actual) in sorted(agg.items(), key=lambda kv: (-kv[1][0], -kv[1][1])):
        row = {"key": key, "label": label(key), "synthetic": key in (NO_CODE, OTHER) or key in (NO_SUPERVISOR, NO_MANAGER),
               **metrics(target, actual)}
        if row["synthetic"]:
            row["status"] = None
        if by == "visitor" and key in codes:
            row.update(code=key, branch=codes[key]["branch"], supervisor=codes[key]["supervisor"])
        rows.append(row)

    total_target = sum(t.rial for t in tsel)
    total_actual = sum(a.amount for a, _ in asel)
    by_day: dict[int, float] = defaultdict(float)
    for a, _ in asel:
        if a.day:
            by_day[a.day] += a.amount
    daily, cum = [], 0.0
    for d in range(1, month_days + 1):
        has = d <= as_of_day
        cum += by_day.get(d, 0.0) if has else 0.0
        daily.append({"date": format_jdate(jy, jm, d), "day": d, "working": _is_working(jy, jm, d),
                      "actual_rial": by_day.get(d, 0.0) if has else None, "actual_cum_rial": cum if has else None,
                      "expected_cum_rial": total_target * elapsed_to[d] / working if working else 0.0,
                      "achieved_cum_pct": (cum / total_target) if has and total_target else None})
    no_code = {t.name for t in trows if not t.code}
    counts = defaultdict(int)
    for r in rows:
        if r["status"]:
            counts[r["status"]] += 1
    return {
        "available": True, "core": core, "month": ym, "jalali_month": f"{jy}/{jm:02d}", "by": by, "months": months,
        "as_of": format_jdate(jy, jm, as_of_day) if as_of_day else None, "month_days": month_days,
        "working_days": working, "elapsed_working_days": elapsed, "remaining_working_days": remaining, "expected_pct": exp_pct,
        "summary": metrics(total_target, total_actual), "status_counts": dict(counts), "rows": rows, "daily": daily,
        "options": options, "filters": {k: sorted(v) for k, v in filters.items()},
        "quality": {
            "visitors_in_target": len({t.name for t in trows}), "visitors_without_code": len(no_code),
            "target_rial_without_code": sum(t.rial for t in trows if not t.code),
            "sales_outside_target_categories_rial": outside,
            "target_categories": len(cats),
        },
        "thresholds": {"on_track": ON_TRACK, "watch": WATCH},
        "method": "تحقق = فروش (Rial+Vat، بدون ردیف‌های پروموشن، با کسر مرجوعی) دسته‌کالاهای تارگتی. درصد انتظار = روزهای کاری تا آخرین روز دارای داده ÷ روزهای کاری ماه؛ همان قاعدهٔ کارت پیش‌بینی داشبورد (جمعه و SR_HOLIDAYS غیرکاری).",
    }
