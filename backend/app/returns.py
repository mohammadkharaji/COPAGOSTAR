"""Distribution-order returns (read-only). Loaded from ret_<core>_<YYYYMMDD>_<HHMM>.tsv by app.ingest into fact_returns.

One row is one dispatch order (حواله). A return is the order's fully returned plus partially returned rial; there is no
product, quantity or visitor code in this source. It is independent of the return rows inside fact_sales (SR): the two are
never added together, and the sales figures of the dashboard do not change.

Percent = returned rial / order rial of the same orders (the filtered set). Customers join by customer_code; visitors join by
name, so a visitor name that carries more than one visitor_code in the sales data is reported as ambiguous, not merged.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from . import config, rbac
from .config import CORES
from .db import connect

router = APIRouter(prefix="/api/returns")

# Query parameter -> fact_returns column. Only these are filters (allow-list; values are bound parameters).
FILTERS = {"branch": "branch", "visitor": "visitor", "supervisor": "supervisor", "customer": "customer_code",
           "reason": "return_reason", "status": "return_status"}
# Dashboard filters that exist on sales pages but cannot be applied to a dispatch order.
UNSUPPORTED = ("sales_type", "region", "state", "city", "brand", "group", "grade", "main_group", "sub_group")
STATUS_LABEL = {"full": "برگشتی کامل", "partial": "برگشتی جزئی", "none": "بدون برگشتی"}
NO_REASON = "نامشخص"
MAX_LIMIT = 500

_AGG = """COUNT(*), COUNT(*) FILTER (WHERE return_status <> 'none'), COUNT(*) FILTER (WHERE return_status = 'full'),
          COUNT(*) FILTER (WHERE return_status = 'partial'), COALESCE(SUM(order_rial), 0), COALESCE(SUM(return_rial), 0),
          COALESCE(SUM(full_return_rial), 0), COALESCE(SUM(part_return_rial), 0),
          COUNT(DISTINCT customer_code) FILTER (WHERE return_status <> 'none'),
          COUNT(*) FILTER (WHERE COALESCE(invoice_no, '') <> ''), COALESCE(SUM(order_rial) FILTER (WHERE COALESCE(invoice_no, '') <> ''), 0)"""


def _agg(r) -> dict:
    orders, returned, full, partial, order_rial, return_rial, full_rial, part_rial, customers, invoiced, invoiced_rial = r
    return {"orders": orders, "returned_orders": returned, "full_orders": full, "partial_orders": partial,
            "order_rial": order_rial, "return_rial": return_rial, "full_return_rial": full_rial,
            "partial_return_rial": part_rial, "returned_customers": customers,
            "return_percent": (return_rial / order_rial) if order_rial else 0,
            "returned_order_percent": (returned / orders) if orders else 0,
            "invoiced_orders": invoiced, "invoiced_order_percent": (invoiced / orders) if orders else 0,
            "invoiced_order_rial": invoiced_rial, "invoiced_rial_percent": (invoiced_rial / order_rial) if order_rial else 0}


def _table_exists(con) -> bool:
    return bool(con.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name='fact_returns'").fetchone()[0])


def _range(start: str | None, end: str | None) -> tuple[str, list]:
    sql, args = "", []
    for val, op in ((start, ">="), (end, "<=")):
        if val:
            digits = val.replace("/", "")
            if not digits.isdigit() or len(digits) != 8:
                raise HTTPException(400, "فرمت تاریخ باید 1405/07/18 باشد")
            sql += f" AND jdate_key {op} ?"
            args.append(int(digits))
    return sql, args


def _filters(request: Request) -> tuple[str, list, list[str]]:
    sql, args, ignored = "", [], []
    for key, col in FILTERS.items():
        vals = [v for v in request.query_params.getlist(key) if v]
        if key == "status":
            bad = [v for v in vals if v not in STATUS_LABEL]
            if bad:
                raise HTTPException(400, "وضعیت نامعتبر است")
        if vals:
            sql += f" AND {col} IN ({','.join('?' * len(vals))})"
            args += vals
    for key in UNSUPPORTED:
        if any(request.query_params.getlist(key)):
            ignored.append(key)
    scope, sargs = rbac.scope_clause()   # the user's branch scope, always applied
    return sql + scope, args + sargs, ignored


def _core(core: str) -> str:
    if core not in CORES:
        raise HTTPException(400, "هسته فروش نامعتبر است")
    rbac.check_core(core)
    return CORES[core]


def _open():
    if not config.DB_PATH.exists():
        raise HTTPException(503, "پایگاه داده هنوز ساخته نشده است")
    return connect(read_only=True)


UNAVAILABLE = {"available": False, "reason": "هنوز هیچ برگشتی حواله‌ای بارگذاری نشده است."}


@router.get("/summary")
def summary(request: Request, core: str = "kg", start: str | None = None, end: str | None = None):
    name = _core(core)
    rng, rargs = _range(start, end)
    flt, fargs, ignored = _filters(request)
    where, args = f"core=?{rng}{flt}", [name, *rargs, *fargs]
    con = _open()
    try:
        if not _table_exists(con):
            return {**UNAVAILABLE, "core": core}
        scope, sargs = rbac.scope_clause()
        have = con.execute(f"SELECT COUNT(*), MIN(jdate_key), MAX(jdate_key) FROM fact_returns WHERE core=?{scope}",
                           [name, *sargs]).fetchone()
        if not have[0]:
            return {**UNAVAILABLE, "core": core}
        total = _agg(con.execute(f"SELECT {_AGG} FROM fact_returns WHERE {where}", args).fetchone())
        months = [{"year_month": r[0], **_agg(r[1:])} for r in con.execute(
            f"SELECT year_month, {_AGG} FROM fact_returns WHERE {where} GROUP BY 1 ORDER BY 1", args).fetchall()]
        branches = [{"branch": r[0], **_agg(r[1:])} for r in con.execute(
            f"SELECT branch, {_AGG} FROM fact_returns WHERE {where} GROUP BY 1 ORDER BY SUM(return_rial) DESC", args).fetchall()]
        reasons = [{"reason": r[0], "orders": r[1], "return_rial": r[2]} for r in con.execute(
            f"""SELECT COALESCE(return_reason, '{NO_REASON}'), COUNT(*), COALESCE(SUM(return_rial), 0) FROM fact_returns
                WHERE {where} AND return_status <> 'none' GROUP BY 1 ORDER BY 3 DESC""", args).fetchall()]
        visitors = [{"visitor": r[0], **_agg(r[1:])} for r in con.execute(
            f"""SELECT visitor, {_AGG} FROM fact_returns WHERE {where} AND visitor IS NOT NULL
                GROUP BY 1 ORDER BY SUM(return_rial) DESC LIMIT 15""", args).fetchall()]
        customers = [{"code": r[0], "name": r[1], **_agg(r[2:])} for r in con.execute(
            f"""SELECT customer_code, ANY_VALUE(customer_name), {_AGG} FROM fact_returns WHERE {where}
                AND customer_code IS NOT NULL GROUP BY 1 ORDER BY SUM(return_rial) DESC LIMIT 15""", args).fetchall()]
        negative = con.execute(f"SELECT COUNT(*) FROM fact_returns WHERE {where} AND return_rial < 0", args).fetchone()[0]
        options = {k: [r[0] for r in con.execute(
            f"SELECT DISTINCT {col} FROM fact_returns WHERE core=? AND {col} IS NOT NULL{scope} ORDER BY 1",
            [name, *sargs]).fetchall()]
            for k, col in (("branch", "branch"), ("reason", "return_reason"), ("supervisor", "supervisor"))}
    finally:
        con.close()
    return {"available": True, "core": core, "first_date": have[1], "last_date": have[2], "total": total, "months": months,
            "branches": branches, "reasons": reasons, "visitors": visitors, "customers": customers, "options": options,
            "ignored_filters": ignored, "quality": {"negative_return_orders": negative},
            "method": "درصد برگشتی = مبلغ برگشتی (کامل + جزئی) ÷ مبلغ حواله‌های همان مجموعه. این گزارش از فایل حواله پخش است و "
                      "با ردیف‌های مرجوعی داخل فروش (SR) جمع نمی‌شود."}


@router.get("/list")
def listing(request: Request, core: str = "kg", start: str | None = None, end: str | None = None,
            limit: int = Query(100, ge=1, le=MAX_LIMIT), offset: int = Query(0, ge=0), all_orders: bool = False):
    name = _core(core)
    rng, rargs = _range(start, end)
    flt, fargs, ignored = _filters(request)
    where = f"core=?{rng}{flt}" + ("" if all_orders else " AND return_status <> 'none'")
    args = [name, *rargs, *fargs]
    con = _open()
    try:
        if not _table_exists(con):
            return {**UNAVAILABLE, "core": core, "rows": [], "count": 0}
        count = con.execute(f"SELECT COUNT(*) FROM fact_returns WHERE {where}", args).fetchone()[0]
        rows = con.execute(
            f"""SELECT branch, dispatch_no, order_date, customer_code, customer_name, visitor, supervisor, distributor, driver,
                       order_rial, full_return_rial, part_return_rial, return_rial, return_status, return_reason, invoice_no
                FROM fact_returns WHERE {where} ORDER BY jdate_key DESC, branch, dispatch_no LIMIT ? OFFSET ?""",
            [*args, limit, offset]).fetchall()
    finally:
        con.close()
    keys = ("branch", "dispatch_no", "order_date", "customer_code", "customer_name", "visitor", "supervisor", "distributor",
            "driver", "order_rial", "full_return_rial", "partial_return_rial", "return_rial", "status", "reason", "invoice_no")
    return {"available": True, "core": core, "count": count, "limit": limit, "offset": offset, "ignored_filters": ignored,
            "rows": [dict(zip(keys, r)) for r in rows]}


# --- helpers for the customer and visitor profile endpoints (called with their open read-only connection) ---

def _profile(con, name: str, col_sql: str, args: list, rng: str, rargs: list) -> dict | None:
    if not _table_exists(con):
        return None
    scope, sargs = rbac.scope_clause()
    where = f"core=? AND {col_sql}{rng}{scope}"
    base = [name, *args, *rargs, *sargs]
    total = _agg(con.execute(f"SELECT {_AGG} FROM fact_returns WHERE {where}", base).fetchone())
    months = [{"year_month": r[0], **_agg(r[1:])} for r in con.execute(
        f"SELECT year_month, {_AGG} FROM fact_returns WHERE {where} GROUP BY 1 ORDER BY 1", base).fetchall()]
    reasons = [{"reason": r[0], "orders": r[1], "return_rial": r[2]} for r in con.execute(
        f"""SELECT COALESCE(return_reason, '{NO_REASON}'), COUNT(*), COALESCE(SUM(return_rial), 0) FROM fact_returns
            WHERE {where} AND return_status <> 'none' GROUP BY 1 ORDER BY 3 DESC""", base).fetchall()]
    recent = [dict(zip(("branch", "dispatch_no", "order_date", "customer_code", "customer_name", "order_rial", "return_rial",
                        "status", "reason"), r)) for r in con.execute(
        f"""SELECT branch, dispatch_no, order_date, customer_code, customer_name, order_rial, return_rial, return_status,
                   return_reason FROM fact_returns WHERE {where} AND return_status <> 'none'
            ORDER BY jdate_key DESC, dispatch_no DESC LIMIT 10""", base).fetchall()]
    return {"available": True, "total": total, "months": months, "reasons": reasons, "recent": recent}


def customer_returns(con, name: str, code: str, start: str | None = None, end: str | None = None) -> dict | None:
    rng, rargs = _range(start, end)
    return _profile(con, name, "customer_code=?", [code], rng, rargs)


def visitor_returns(con, name: str, code: str, start: str | None = None, end: str | None = None) -> dict | None:
    """Returns of one visitor, matched by the visitor's name(s) in the sales data (the returns file has no visitor code).

    A name that is also used under another visitor code cannot be attributed to one person; such names are listed in
    `ambiguous_names` and left out of the totals."""
    if not _table_exists(con):
        return None
    scope, sargs = rbac.scope_clause()
    names = [r[0] for r in con.execute(
        f"SELECT visitor FROM fact_sales WHERE core=? AND visitor_code=? AND visitor IS NOT NULL{scope} GROUP BY 1",
        [name, code, *sargs]).fetchall()]
    shared = {r[0] for r in con.execute(
        f"""SELECT visitor FROM fact_sales WHERE core=? AND visitor IN ({','.join('?' * len(names))})
            AND visitor_code IS NOT NULL{scope} GROUP BY 1 HAVING COUNT(DISTINCT visitor_code) > 1""",
        [name, *names, *sargs]).fetchall()} if names else set()
    usable = [n for n in names if n not in shared]
    rng, rargs = _range(start, end)
    out = (_profile(con, name, f"visitor IN ({','.join('?' * len(usable))})", usable, rng, rargs) if usable else
           {"available": True, "total": _agg((0,) * 11), "months": [], "reasons": [], "recent": []})
    out.update(matched_names=usable, ambiguous_names=sorted(shared),
               note="کد ویزیتور در فایل حواله نیست؛ تطبیق با نام ویزیتور انجام شده است." if usable or shared else None)
    return out
