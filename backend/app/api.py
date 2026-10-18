from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import date, datetime

import os

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import auth, rbac
from .config import CORES, DB_PATH, DEFAULT_CORE, HOLIDAYS, PROMO_KALA_SOURCES, RAW_DIR, ROOT
from .db import connect
from .jalali import (JALALI_MONTHS, JALALI_WEEKDAYS, days_in_jalali_month, format_jdate, gregorian_to_jalali,
                     jalali_to_gregorian, jalali_weekday, parse_jdate)
from . import returns as _returns
from .schema import LIMITATIONS

app = FastAPI(title="SR Sales Dashboard API", docs_url=None, redoc_url=None, openapi_url=None)

PUBLIC_API = {"/api/auth/login"}
limiter = auth.LoginLimiter()


@app.middleware("http")
async def require_login(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/"):
        principal = None
        if path not in PUBLIC_API:
            principal = rbac.principal_from_token(request.cookies.get(auth.COOKIE))
            if principal is None:
                return JSONResponse({"detail": "نیاز به ورود"}, status_code=401, headers={"Cache-Control": "no-store"})
            if not rbac.allowed(principal, request.method, path):
                return JSONResponse({"detail": "دسترسی به این بخش مجاز نیست"}, status_code=403,
                                    headers={"Cache-Control": "no-store"})
        request.state.principal = principal
        ctx = rbac.CURRENT.set(principal)   # route functions read their core / branch scope from here
        try:
            response = await call_next(request)
        finally:
            rbac.CURRENT.reset(ctx)
        response.headers["Cache-Control"] = "no-store"
        return response
    return await call_next(request)


class LoginBody(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=256)


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@app.post("/api/auth/login")
def login(body: LoginBody, request: Request, response: Response):
    if not auth.configured():
        raise HTTPException(503, "ورود پیکربندی نشده است")
    key = _client_key(request)
    if limiter.blocked(key):
        raise HTTPException(429, "تلاش ناموفق زیاد بود؛ چند دقیقه بعد دوباره امتحان کنید")
    principal = rbac.authenticate(body.username, body.password)
    if principal is None:
        limiter.fail(key)
        rbac.audit(body.username[:100], "login.failed", ip=key)
        time.sleep(0.4)
        raise HTTPException(401, "نام کاربری یا رمز عبور درست نیست")
    limiter.ok(key)
    rbac.audit(principal.user, "login", ip=key)
    response.set_cookie(
        auth.COOKIE, auth.make_token(principal.user, version=principal.token_version), max_age=auth.SESSION_SECONDS,
        httponly=True, samesite="strict",
        secure=request.url.scheme == "https" or os.environ.get("SR_COOKIE_SECURE") == "1", path="/")
    return {"ok": True, **principal.me()}


@app.get("/api/auth/me")
def me():
    return rbac.require().me()


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(auth.COOKIE, path="/")
    return {"ok": True}

EXPECTED_KG_MONTHS = [f"sr_kg_14050{m}" for m in range(1, 8)]

# Mirrors the workbook pivot (SR-1405 sheet) and model measures:
#   Sum of Rial+Vat = SUM(Rial+Vat) over ALL rows (sales + returns + promotion rows)
#   PromisonRial    = SUM(TotalDiscount) + SUM(DISCOUNT)
#   Promosion Kala  = Rial+Vat of the 1404 promotion sources (the model measure; zero for 1405 data)
#   مجموع پروموشن   = Promosion Kala + PromisonRial + SUM(settlement discount)
#   ریال خالص       = Sum of Rial+Vat - مجموع پروموشن
METRICS_SQL = """
    COALESCE(SUM(rial_vat), 0),
    COALESCE(SUM(qty), 0),
    COUNT(DISTINCT invoice_code),
    COALESCE(SUM(rial_vat) FILTER (WHERE source_table IN (?, ?)), 0),
    COALESCE(SUM(total_discount), 0) + COALESCE(SUM(discount), 0),
    COALESCE(SUM(settlement_discount), 0),
    COALESCE(SUM(rial_vat) FILTER (WHERE is_return), 0),
    COALESCE(SUM(rial_vat) FILTER (WHERE is_promo), 0),
    COUNT(DISTINCT customer_code)
"""


def _metrics(row) -> dict:
    gross, qty, invoices, promo_kala, promison_rial, settlement, returns, promo_rows, customers = row
    promo_total = promo_kala + promison_rial + settlement
    return {
        "sum_rial_vat": gross,
        "sum_qty": qty,
        "invoice_count": invoices,
        "promo_total_rial": promo_total,
        "promo_kala_rial": promo_kala,
        "promison_rial": promison_rial,
        "settlement_discount_rial": settlement,
        "promo_percent": (promo_total / gross) if gross else 0,
        "net_rial": gross - promo_total,
        "returns_rial": returns,
        "promo_rows_rial": promo_rows,
        "active_customers": customers,
    }


def _con():
    if not DB_PATH.exists():
        raise HTTPException(503, "پایگاه داده هنوز ساخته نشده است")
    return connect(read_only=True)


def _core(core: str) -> str:
    if core not in CORES:
        raise HTTPException(400, "هسته فروش نامعتبر است")
    rbac.check_core(core)
    return CORES[core]


# Query-parameter name -> fact_sales column. Only these may be used as filters (allow-list; values are bound params).
DIMS = {"sales_type": "sales_type", "region": "region", "state": "state", "city": "city_name", "branch": "branch",
        "brand": "brand", "group": "group_name", "grade": "grade", "visitor": "visitor",
        "main_group": "main_group", "sub_group": "sub_group"}


def _dims(request: Request, skip: tuple[str, ...] = ()) -> tuple[str, list]:
    sql, args = "", []
    for key, col in DIMS.items():
        if key in skip:
            continue
        vals = [v for v in request.query_params.getlist(key) if v]
        if vals:
            sql += f" AND {col} IN ({','.join('?' * len(vals))})"
            args += vals
    scope, sargs = rbac.branch_clause("branch")   # the user's branch scope, applied even when `branch` is skipped
    return sql + scope, args + sargs


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


@app.get("/api/health")
def health():
    if not DB_PATH.exists():
        return {"status": "not_ready", "chunks_loaded": 0, "missing_kg_chunks": EXPECTED_KG_MONTHS}
    con = connect(read_only=True)
    try:
        loaded = {r[0] for r in con.execute("SELECT DISTINCT chunk_id FROM fact_sales").fetchall()}
        last = con.execute("SELECT MAX(jdate_key) FROM fact_sales").fetchone()[0]
    finally:
        con.close()
    missing = [c for c in EXPECTED_KG_MONTHS if c not in loaded]
    return {"status": "ready" if not missing else "partial", "chunks_loaded": len(loaded), "missing_kg_chunks": missing,
            "last_data_date": f"{last // 10000}/{last // 100 % 100:02d}/{last % 100:02d}" if last else None}


SYNC_STALE_SECONDS = 3600
_sync_proc: subprocess.Popen | None = None


def _read_sync() -> dict:
    try:
        return json.loads((DB_PATH.parent / "sync_status.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _sync_running() -> bool:
    if _sync_proc is not None and _sync_proc.poll() is None:
        return True
    s = _read_sync()
    if s.get("state") != "running" or not s.get("started_at"):
        return False
    try:
        age = time.time() - datetime.fromisoformat(s["started_at"]).timestamp()
    except ValueError:
        return False
    return age < SYNC_STALE_SECONDS


@app.get("/api/sync-status")
def sync_status():
    s = _read_sync()
    if not s:
        return {"state": "never"}
    out = {k: s.get(k) for k in ("state", "finished_at", "started_at", "rows_loaded", "error", "months")}
    if out["state"] == "running" and not _sync_running():
        out["state"] = "failed"
        out["error"] = "فرایند به‌روزرسانی ناتمام مانده است"
    return out


@app.post("/api/sync", status_code=202)
def start_sync():
    global _sync_proc
    if _sync_running():
        raise HTTPException(409, "به‌روزرسانی در حال انجام است")
    if not any(RAW_DIR.glob("sr_*.tsv")):
        raise HTTPException(404, "فایل داده در پوشهٔ raw پیدا نشد")
    status_path = DB_PATH.parent / "sync_status.json"
    status_path.parent.mkdir(parents=True, exist_ok=True)
    status_path.write_text(json.dumps(
        {**_read_sync(), "state": "running", "started_at": datetime.now().isoformat(timespec="seconds"), "error": None},
        ensure_ascii=False, indent=2), encoding="utf-8")
    _sync_proc = subprocess.Popen(
        [sys.executable, "-X", "utf8", str(ROOT / "scripts" / "sync.py"), "--once", "--force"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return {"state": "running"}


@app.get("/api/meta")
def meta():
    cores = {k: v for k, v in CORES.items() if k in rbac.require().cores}
    default = DEFAULT_CORE if DEFAULT_CORE in cores else next(iter(cores), DEFAULT_CORE)
    return {"currency": "rial", "cores": cores, "default_core": default, "limitations": LIMITATIONS}


@app.get("/api/overview")
def overview(request: Request, core: str = DEFAULT_CORE, start: str | None = Query(None), end: str | None = Query(None)):
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request)
    con = _con()
    try:
        row = con.execute(f"SELECT {METRICS_SQL} FROM fact_sales WHERE core=?{rng}{dim}",
                          [*PROMO_KALA_SOURCES, name, *args, *dargs]).fetchone()
    finally:
        con.close()
    return {"core": core, **_metrics(row)}


@app.get("/api/monthly")
def monthly(request: Request, core: str = DEFAULT_CORE):
    name = _core(core)
    dim, dargs = _dims(request)
    con = _con()
    try:
        rows = con.execute(
            f"SELECT year_month, {METRICS_SQL} FROM fact_sales WHERE core=? AND year_month IS NOT NULL{dim} "
            "GROUP BY 1 ORDER BY 1", [*PROMO_KALA_SOURCES, name, *dargs]).fetchall()
    finally:
        con.close()
    out, prev = [], None
    for r in rows:
        m = _metrics(r[1:])
        m["year_month"] = r[0]
        m["invoice_growth"] = (m["invoice_count"] / prev - 1) if prev else None
        prev = m["invoice_count"]
        out.append(m)
    return out


@app.get("/api/trend")
def trend(request: Request, core: str = DEFAULT_CORE, start: str | None = None, end: str | None = None):
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request)
    con = _con()
    try:
        rows = con.execute(
            f"""SELECT jdate_key, SUM(rial_vat), COUNT(DISTINCT customer_code)
                FROM fact_sales WHERE core=?{rng}{dim} GROUP BY 1 ORDER BY 1""", [name, *args, *dargs]).fetchall()
    finally:
        con.close()
    return [{"date": f"{k // 10000}/{k // 100 % 100:02d}/{k % 100:02d}", "sum_rial_vat": g or 0, "customers": c}
            for k, g, c in rows if k]


BREAKDOWN_BY = {**DIMS, "month": "year_month", "day": "jdate_key", "product": "product_name", "customer": "customer_name"}
SALES_ONLY = "NOT is_promo AND NOT is_return"


GEO_KEYS = ("region", "state", "city")
# Option lists narrowed by other selected filters: geography by branch and each other; sub group only by its main group.
NARROWED_BY = {**{k: ("branch", *(g for g in GEO_KEYS if g != k)) for k in GEO_KEYS}, "sub_group": ("main_group",)}


@app.get("/api/filters")
def filters(request: Request, core: str = DEFAULT_CORE):
    """Option lists. region/state/city are narrowed by the selected branch and by each other, and sub_group by the
    selected main_group (never by themselves)."""
    name = _core(core)
    scope, sargs = rbac.branch_clause()
    con = _con()
    try:
        out = {}
        for key, col in DIMS.items():
            if key == "visitor":
                continue
            where, args = "", []
            if key in NARROWED_BY:
                for dep in NARROWED_BY[key]:
                    vals = [v for v in request.query_params.getlist(dep) if v]
                    if vals:
                        where += f" AND {DIMS[dep]} IN ({','.join('?' * len(vals))})"
                        args += vals
            out[key] = [r[0] for r in con.execute(
                f"SELECT {col} FROM fact_sales WHERE core=? AND {col} IS NOT NULL{where}{scope} GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 300",
                [name, *args, *sargs]).fetchall()]
        out["month"] = [r[0] for r in con.execute(
            f"SELECT DISTINCT year_month FROM fact_sales WHERE core=? AND year_month IS NOT NULL{scope} ORDER BY 1",
            [name, *sargs]).fetchall()]
    finally:
        con.close()
    return out


@app.get("/api/breakdown")
def breakdown(request: Request, by: str, core: str = DEFAULT_CORE, start: str | None = None, end: str | None = None,
              limit: int = Query(60, ge=1, le=500)):
    if by not in BREAKDOWN_BY:
        raise HTTPException(400, "بعد گزارش نامعتبر است")
    col = BREAKDOWN_BY[by]
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request)
    con = _con()
    try:
        rows = con.execute(
            f"""SELECT {col}, {METRICS_SQL},
                       COALESCE(SUM(rial_vat) FILTER (WHERE {SALES_ONLY}), 0),
                       COALESCE(SUM(rial_vat) FILTER (WHERE is_return), 0)
                FROM fact_sales WHERE core=? AND {col} IS NOT NULL{rng}{dim}
                GROUP BY 1 ORDER BY 2 DESC LIMIT {limit}""",
            [*PROMO_KALA_SOURCES, name, *args, *dargs]).fetchall()
    finally:
        con.close()
    out = []
    for r in rows:
        m = _metrics(r[1:10])
        sales_only, returns = r[10], r[11]
        m.update(key=r[0], sales_rial=sales_only,
                 return_percent=(-returns / sales_only) if sales_only and returns else 0,
                 discount_percent=(m["promison_rial"] / sales_only) if sales_only else 0)
        out.append(m)
    if by in ("month", "day"):
        out.sort(key=lambda x: str(x["key"]))
    return out


@app.get("/api/pareto")
def pareto(request: Request, by: str = "customer", core: str = DEFAULT_CORE, start: str | None = None,
           end: str | None = None, threshold: float = Query(0.8, gt=0, le=1), limit: int = Query(200, ge=1, le=2000)):
    cols = {"customer": ("customer_code", "customer_name"), "product": ("product_code", "product_name"),
            "visitor": ("visitor_code", "visitor"), "branch": ("branch", "branch"), "day": ("jdate_key", "jdate_key")}
    if by not in cols:
        raise HTTPException(400, "بعد پارتو نامعتبر است")
    code, label = cols[by]
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request)
    con = _con()
    try:
        rows = con.execute(
            f"""SELECT {code}, ANY_VALUE({label}), SUM(rial_vat) v FROM fact_sales
                WHERE core=? AND {SALES_ONLY} AND {code} IS NOT NULL{rng}{dim}
                GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY v DESC""", [name, *args, *dargs]).fetchall()
    finally:
        con.close()
    if by == "day":
        rows = [(_jdate(c), _jdate(c), v) for c, _, v in rows]
    total = sum(r[2] for r in rows)
    cum, items, pareto_count = 0.0, [], 0
    for i, (c, n, v) in enumerate(rows, 1):
        before = cum / total if total else 0
        cum += v
        if before < threshold:
            pareto_count = i
        if i <= limit:
            items.append({"rank": i, "code": c, "name": n, "sales_rial": v,
                          "share": v / total if total else 0, "cum_share": cum / total if total else 0})
    return {"total_rial": total, "count": len(rows), "pareto_count": pareto_count,
            "pareto_count_percent": pareto_count / len(rows) if rows else 0, "threshold": threshold, "items": items}


def _jdate(key) -> str | None:
    return f"{key // 10000}/{key // 100 % 100:02d}/{key % 100:02d}" if key else None


@app.get("/api/visitors")
def visitors(request: Request, core: str = DEFAULT_CORE, start: str | None = None, end: str | None = None):
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request)
    con = _con()
    try:
        rows = con.execute(
            f"""SELECT visitor_code, MODE(visitor), COUNT(DISTINCT branch), {METRICS_SQL},
                       COALESCE(SUM(rial_vat) FILTER (WHERE {SALES_ONLY}), 0), MAX(jdate_key)
                FROM fact_sales WHERE core=? AND visitor_code IS NOT NULL{rng}{dim}
                GROUP BY 1 ORDER BY SUM(rial_vat) DESC""",
            [*PROMO_KALA_SOURCES, name, *args, *dargs]).fetchall()
    finally:
        con.close()
    total_sales = sum(r[12] for r in rows if r[12] > 0)
    out = []
    for rank, r in enumerate(rows, 1):
        m = _metrics(r[3:12])
        sales_only = r[12]
        m.update(rank=rank, code=r[0], name=r[1], branch_count=r[2], sales_rial=sales_only,
                 share=(sales_only / total_sales) if total_sales and sales_only > 0 else 0,
                 return_percent=(-m["returns_rial"] / sales_only) if sales_only and m["returns_rial"] else 0,
                 discount_percent=(m["promison_rial"] / sales_only) if sales_only else 0,
                 last_sale=_jdate(r[13]))
        out.append(m)
    return out


@app.get("/api/visitor/{code}")
def visitor_profile(code: str, request: Request, core: str = DEFAULT_CORE, start: str | None = None,
                    end: str | None = None):
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request)
    base = f"core=? AND visitor_code=?{rng}{dim}"
    bargs = [name, code, *args, *dargs]
    scope, sargs = rbac.branch_clause()
    con = _con()
    try:
        names = [r[0] for r in con.execute(
            f"SELECT visitor FROM fact_sales WHERE core=? AND visitor_code=? AND visitor IS NOT NULL{scope} "
            "GROUP BY 1 ORDER BY COUNT(*) DESC", [name, code, *sargs]).fetchall()]
        if not con.execute(f"SELECT COUNT(*) FROM fact_sales WHERE core=? AND visitor_code=?{scope}",
                           [name, code, *sargs]).fetchone()[0]:
            raise HTTPException(404, "ویزیتور یافت نشد")
        all_branches = [r[0] for r in con.execute(
            f"SELECT branch FROM fact_sales WHERE core=? AND visitor_code=? AND branch IS NOT NULL{scope} "
            "GROUP BY 1 ORDER BY COUNT(*) DESC", [name, code, *sargs]).fetchall()]
        row = con.execute(
            f"""SELECT {METRICS_SQL},
                       COALESCE(SUM(rial_vat) FILTER (WHERE {SALES_ONLY}), 0),
                       COUNT(DISTINCT invoice_code) FILTER (WHERE {SALES_ONLY}),
                       COUNT(DISTINCT customer_code) FILTER (WHERE {SALES_ONLY}),
                       COUNT(DISTINCT jdate_key) FILTER (WHERE {SALES_ONLY}),
                       MIN(jdate_key) FILTER (WHERE {SALES_ONLY}), MAX(jdate_key) FILTER (WHERE {SALES_ONLY}),
                       COUNT(*) FILTER (WHERE {SALES_ONLY} AND invoice_code IS NOT NULL)
                FROM fact_sales WHERE {base}""", [*PROMO_KALA_SOURCES, *bargs]).fetchone()
        peers = con.execute(
            f"""SELECT visitor_code, SUM(rial_vat) FROM fact_sales
                WHERE core=? AND {SALES_ONLY} AND visitor_code IS NOT NULL{rng}{dim} GROUP BY 1""",
            [name, *args, *dargs]).fetchall()
        months = con.execute(
            f"""SELECT year_month, SUM(rial_vat), COUNT(DISTINCT invoice_code), COUNT(DISTINCT customer_code)
                FROM fact_sales WHERE core=? AND visitor_code=? AND {SALES_ONLY} AND year_month IS NOT NULL{dim}
                GROUP BY 1 ORDER BY 1""", [name, code, *dargs]).fetchall()
        days = con.execute(
            f"""SELECT jdate_key, SUM(rial_vat), COUNT(DISTINCT customer_code) FROM fact_sales
                WHERE {base} AND {SALES_ONLY} AND jdate_key IS NOT NULL GROUP BY 1 ORDER BY 1""", bargs).fetchall()
        splits = {}
        for key, col in (("branches", "branch"), ("brands", "brand"), ("grades", "grade"), ("sales_types", "sales_type")):
            splits[key] = [{"name": n, "sales_rial": v} for n, v in con.execute(
                f"""SELECT {col}, SUM(rial_vat) FROM fact_sales WHERE {base} AND {SALES_ONLY} AND {col} IS NOT NULL
                    GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY 2 DESC LIMIT 30""", bargs).fetchall()]
        products = con.execute(
            f"""SELECT product_name, SUM(rial_vat), SUM(qty) FROM fact_sales
                WHERE {base} AND {SALES_ONLY} AND product_name IS NOT NULL
                GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY 2 DESC LIMIT 15""", bargs).fetchall()
        customers = con.execute(
            f"""SELECT customer_code, ANY_VALUE(customer_name), SUM(rial_vat), COUNT(DISTINCT invoice_code)
                FROM fact_sales WHERE {base} AND {SALES_ONLY} AND customer_code IS NOT NULL
                GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY 3 DESC LIMIT 20""", bargs).fetchall()
        dispatch_returns = _returns.visitor_returns(con, name, code, start, end)
    finally:
        con.close()
    m = _metrics(row[:9])
    sales, invoices, buyers, active_days, first, last, lines = row[9:]
    positives = [v for _, v in peers if v and v > 0]
    mine = next((v for c, v in peers if c == code), 0) or 0
    total_sales = sum(positives)
    m.update(
        code=code, name=names[0] if names else None, names=names, all_branches=all_branches,
        sales_rial=sales, sales_invoices=invoices, buying_customers=buyers, active_days=active_days,
        sales_lines=lines, avg_lines_per_invoice=(lines / invoices) if invoices else None,
        first_sale=_jdate(first), last_sale=_jdate(last),
        avg_invoice_rial=(sales / invoices) if invoices else None,
        avg_customer_rial=(sales / buyers) if buyers else None,
        avg_active_day_rial=(sales / active_days) if active_days else None,
        return_percent=(-m["returns_rial"] / sales) if sales and m["returns_rial"] else 0,
        discount_percent=(m["promison_rial"] / sales) if sales else 0,
        rank=(1 + sum(1 for v in positives if v > mine)) if mine > 0 else None, visitor_count=len(positives),
        share=(mine / total_sales) if total_sales and mine > 0 else 0,
        months=[{"year_month": ym, "sales_rial": s or 0, "invoices": i, "customers": c} for ym, s, i, c in months],
        days=[{"date": _jdate(k), "sales_rial": s or 0, "customers": c} for k, s, c in days],
        products=[{"name": n, "sales_rial": s, "qty": q} for n, s, q in products],
        customers=[{"code": c, "name": n, "sales_rial": s, "invoices": i} for c, n, s, i in customers],
        dispatch_returns=dispatch_returns,
        **splits)
    return m


GROWTH_KINDS = {"month": 1, "season": 3, "half": 6}
GROWTH_FIELDS = ("sum_rial_vat", "net_rial", "sales_rial", "invoice_count", "active_customers")
SEASONS = ("بهار", "تابستان", "پاییز", "زمستان")


def _span_metrics(con, name, dim, dargs, s, e) -> dict:
    row = con.execute(
        f"""SELECT {METRICS_SQL},
                   COALESCE(SUM(rial_vat) FILTER (WHERE {SALES_ONLY}), 0),
                   COUNT(DISTINCT jdate_key) FILTER (WHERE {SALES_ONLY})
            FROM fact_sales WHERE core=? AND jdate_key>=? AND jdate_key<=?{dim}""",
        [*PROMO_KALA_SOURCES, name, s, e, *dargs]).fetchone()
    m = _metrics(row[:9])
    m.update(sales_rial=row[9], sales_days=row[10])
    return m


def _period_label(kind: str, a: int) -> str:
    y, m = a // 12, a % 12 + 1
    if kind == "month":
        return f"{JALALI_MONTHS[m - 1]} {y}"
    if kind == "season":
        return f"{SEASONS[(m - 1) // 3]} {y}"
    return f"نیمهٔ {'اول' if m == 1 else 'دوم'} {y}"


@app.get("/api/growth")
def growth(request: Request, kind: str = "month", core: str = DEFAULT_CORE):
    """Period-over-period growth. An unfinished period is compared with the same elapsed span of the previous period."""
    if kind not in GROWTH_KINDS:
        raise HTTPException(400, "نوع دوره نامعتبر است")
    length = GROWTH_KINDS[kind]
    name = _core(core)
    dim, dargs = _dims(request)
    scope, sargs = rbac.branch_clause()
    con = _con()
    try:
        first, last = con.execute(
            f"SELECT MIN(jdate_key), MAX(jdate_key) FROM fact_sales WHERE core=? AND jdate_key IS NOT NULL{scope}",
            [name, *sargs]).fetchone()
        if not last:
            return {"kind": kind, "last_date": None, "periods": []}
        mi = lambda k: (k // 10000) * 12 + (k // 100 % 100 - 1)
        key = lambda i, d: (i // 12) * 10000 + (i % 12 + 1) * 100 + d
        month_days = lambda i: days_in_jalali_month(i // 12, i % 12 + 1)
        first_mi, last_mi, last_day = mi(first), mi(last), last % 100
        periods = []
        for a in range(first_mi - first_mi % length, last_mi + 1, length):
            b = a + length - 1
            end_full = key(b, month_days(b))
            complete = end_full <= last
            start, end = key(a, 1), (end_full if complete else last)
            cur = _span_metrics(con, name, dim, dargs, start, end)
            item = {"key": f"{a // 12}{a % 12 + 1:02d}", "label": _period_label(kind, a), "start": _jdate(start),
                    "end": _jdate(end), "complete": complete, "full_coverage": a >= first_mi, **cur, "compare": None}
            pa = a - length
            if a >= first_mi and pa >= first_mi:
                if complete:
                    pend = key(b - length, month_days(b - length))
                else:
                    pm = pa + (last_mi - a)
                    pend = key(pm, min(last_day, month_days(pm)))
                prev = _span_metrics(con, name, dim, dargs, key(pa, 1), pend)
                item["compare"] = {
                    "label": _period_label(kind, pa), "start": _jdate(key(pa, 1)), "end": _jdate(pend), **prev,
                    "growth": {k: ((cur[k] - prev[k]) / prev[k]) if prev[k] > 0 else None for k in GROWTH_FIELDS},
                    "delta": {k: cur[k] - prev[k] for k in GROWTH_FIELDS},
                }
            periods.append(item)
    finally:
        con.close()
    return {"kind": kind, "last_date": _jdate(last), "periods": periods}


PROFILE_BY = {"branch": "branch", "brand": "brand", "group": "group_name", "product": "product_name"}
PROFILE_SPLITS = {"branch": "branch", "brand": "brand", "group": "group_name", "grade": "grade",
                  "sales_type": "sales_type", "region": "region"}


@app.get("/api/profile/{by}/{key:path}")
def dimension_profile(by: str, key: str, request: Request, core: str = DEFAULT_CORE, start: str | None = None,
                      end: str | None = None):
    """Performance profile of one branch / brand / line / product (the dimension itself is never filtered twice)."""
    if by not in PROFILE_BY:
        raise HTTPException(400, "بعد گزارش نامعتبر است")
    col = PROFILE_BY[by]
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request, skip=(by,))
    base = f"core=? AND {col}=?{rng}{dim}"
    bargs = [name, key, *args, *dargs]
    scope, sargs = rbac.branch_clause()
    con = _con()
    try:
        if not con.execute(f"SELECT COUNT(*) FROM fact_sales WHERE core=? AND {col}=?{scope}",
                           [name, key, *sargs]).fetchone()[0]:
            raise HTTPException(404, "مورد یافت نشد")
        last = con.execute(f"SELECT MAX(jdate_key) FROM fact_sales WHERE core=?{scope}", [name, *sargs]).fetchone()[0]
        row = con.execute(
            f"""SELECT {METRICS_SQL},
                       COALESCE(SUM(rial_vat) FILTER (WHERE {SALES_ONLY}), 0),
                       COUNT(DISTINCT invoice_code) FILTER (WHERE {SALES_ONLY}),
                       COUNT(DISTINCT customer_code) FILTER (WHERE {SALES_ONLY}),
                       COUNT(DISTINCT jdate_key) FILTER (WHERE {SALES_ONLY}),
                       MIN(jdate_key) FILTER (WHERE {SALES_ONLY}), MAX(jdate_key) FILTER (WHERE {SALES_ONLY}),
                       COUNT(*) FILTER (WHERE {SALES_ONLY} AND invoice_code IS NOT NULL)
                FROM fact_sales WHERE {base}""", [*PROMO_KALA_SOURCES, *bargs]).fetchone()
        total_sales = con.execute(
            f"SELECT COALESCE(SUM(rial_vat), 0) FROM fact_sales WHERE core=? AND {SALES_ONLY}{rng}{dim}",
            [name, *args, *dargs]).fetchone()[0]
        months = con.execute(
            f"""SELECT year_month, {METRICS_SQL}, COALESCE(SUM(rial_vat) FILTER (WHERE {SALES_ONLY}), 0)
                FROM fact_sales WHERE core=? AND {col}=? AND year_month IS NOT NULL{dim} GROUP BY 1 ORDER BY 1""",
            [*PROMO_KALA_SOURCES, name, key, *dargs]).fetchall()
        days = con.execute(
            f"""SELECT jdate_key, SUM(rial_vat), COUNT(DISTINCT customer_code) FROM fact_sales
                WHERE {base} AND {SALES_ONLY} AND jdate_key IS NOT NULL GROUP BY 1 ORDER BY 1""", bargs).fetchall()
        splits = {}
        for sk, scol in PROFILE_SPLITS.items():
            if sk == by:
                continue
            splits[sk] = [{"name": n, "sales_rial": v} for n, v in con.execute(
                f"""SELECT {scol}, SUM(rial_vat) FROM fact_sales WHERE {base} AND {SALES_ONLY} AND {scol} IS NOT NULL
                    GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY 2 DESC LIMIT 30""", bargs).fetchall()]
        products = [] if by == "product" else con.execute(
            f"""SELECT product_name, SUM(rial_vat), SUM(qty) FROM fact_sales
                WHERE {base} AND {SALES_ONLY} AND product_name IS NOT NULL
                GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY 2 DESC LIMIT 15""", bargs).fetchall()
        customers = con.execute(
            f"""SELECT customer_code, ANY_VALUE(customer_name), SUM(rial_vat), COUNT(DISTINCT invoice_code)
                FROM fact_sales WHERE {base} AND {SALES_ONLY} AND customer_code IS NOT NULL
                GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY 3 DESC LIMIT 20""", bargs).fetchall()
        visitors = con.execute(
            f"""SELECT visitor_code, MODE(visitor), SUM(rial_vat), COUNT(DISTINCT customer_code)
                FROM fact_sales WHERE {base} AND {SALES_ONLY} AND visitor_code IS NOT NULL
                GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY 3 DESC LIMIT 15""", bargs).fetchall()
    finally:
        con.close()
    m = _metrics(row[:9])
    sales, invoices, buyers, active_days, first, last_sale, lines = row[9:]
    month_end = lambda ym: int(ym) * 100 + days_in_jalali_month(int(ym) // 100, int(ym) % 100)
    m.update(
        by=by, key=key, sales_rial=sales, sales_invoices=invoices, buying_customers=buyers, active_days=active_days,
        sales_lines=lines, avg_lines_per_invoice=(lines / invoices) if invoices else None,
        first_sale=_jdate(first), last_sale=_jdate(last_sale), core_last_date=_jdate(last),
        share=(sales / total_sales) if total_sales > 0 and sales > 0 else 0,
        avg_invoice_rial=(sales / invoices) if invoices else None,
        avg_customer_rial=(sales / buyers) if buyers else None,
        return_percent=(-m["returns_rial"] / sales) if sales and m["returns_rial"] else 0,
        discount_percent=(m["promison_rial"] / sales) if sales else 0,
        months=[{**_metrics(r[1:10]), "year_month": r[0], "sales_rial": r[10], "complete": month_end(r[0]) <= (last or 0)}
                for r in months],
        days=[{"date": _jdate(k), "sales_rial": s or 0, "customers": c} for k, s, c in days],
        products=[{"name": n, "sales_rial": s, "qty": q} for n, s, q in products],
        customers=[{"code": c, "name": n, "sales_rial": s, "invoices": i} for c, n, s, i in customers],
        visitors=[{"code": c, "name": n, "sales_rial": s, "customers": u} for c, n, s, u in visitors],
        **{f"split_{k}": v for k, v in splits.items()})
    return m


@app.get("/api/customer/{code}")
def customer_profile(code: str, core: str = DEFAULT_CORE):
    name = _core(core)
    scope, sargs = rbac.branch_clause()
    con = _con()
    try:
        head = con.execute(
            f"""SELECT ANY_VALUE(customer_name), ANY_VALUE(branch), ANY_VALUE(sales_point_name), ANY_VALUE(grade),
                      ANY_VALUE(visitor), ANY_VALUE(region), ANY_VALUE(city_name), MAX(jdate_key)
               FROM fact_sales WHERE core=? AND customer_code=?{scope}""", [name, code, *sargs]).fetchone()
        if head is None or head[0] is None and head[7] is None:
            raise HTTPException(404, "مشتری یافت نشد")
        months = con.execute(
            f"""SELECT year_month, SUM(rial_vat) FILTER (WHERE {SALES_ONLY}), COUNT(DISTINCT invoice_code),
                       COALESCE(SUM(total_discount),0)+COALESCE(SUM(discount),0)
                FROM fact_sales WHERE core=? AND customer_code=? AND year_month IS NOT NULL{scope}
                GROUP BY 1 ORDER BY 1""", [name, code, *sargs]).fetchall()
        products = con.execute(
            f"""SELECT product_name, SUM(rial_vat), SUM(qty) FROM fact_sales
                WHERE core=? AND customer_code=? AND {SALES_ONLY}{scope} GROUP BY 1 ORDER BY 2 DESC LIMIT 15""",
            [name, code, *sargs]).fetchall()
        brands = con.execute(
            f"""SELECT brand, SUM(rial_vat) FROM fact_sales WHERE core=? AND customer_code=? AND {SALES_ONLY}
                AND brand IS NOT NULL{scope} GROUP BY 1 ORDER BY 2 DESC""", [name, code, *sargs]).fetchall()
        dispatch_returns = _returns.customer_returns(con, name, code)
    finally:
        con.close()
    last = head[7]
    return {
        "code": code, "name": head[0], "branch": head[1], "sales_point": head[2], "grade": head[3], "visitor": head[4],
        "region": head[5], "city": head[6],
        "last_purchase": f"{last // 10000}/{last // 100 % 100:02d}/{last % 100:02d}" if last else None,
        "months": [{"year_month": m, "sales_rial": s or 0, "invoices": i, "discount_rial": d} for m, s, i, d in months],
        "products": [{"name": n, "sales_rial": s, "qty": q} for n, s, q in products],
        "brands": [{"name": n, "sales_rial": s} for n, s in brands],
        "dispatch_returns": dispatch_returns,
    }


@app.get("/api/invoice-bands")
def invoice_bands(request: Request, core: str = DEFAULT_CORE, start: str | None = None, end: str | None = None,
                  step: float = Query(10_000_000, gt=0)):
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request)
    con = _con()
    try:
        rows = con.execute(
            f"""WITH inv AS (SELECT invoice_code, SUM(rial_vat) v FROM fact_sales
                    WHERE core=? AND {SALES_ONLY} AND invoice_code IS NOT NULL{rng}{dim} GROUP BY 1 HAVING SUM(rial_vat) > 0)
                SELECT CAST(FLOOR(v / ?) AS BIGINT) b, COUNT(*), SUM(v) FROM inv GROUP BY 1 ORDER BY 1""",
            [name, *args, *dargs, step]).fetchall()
    finally:
        con.close()
    total_n, total_v = sum(r[1] for r in rows), sum(r[2] for r in rows)
    cum_n = cum_v = 0.0
    out = []
    for b, n, v in rows:
        cum_n += n
        cum_v += v
        out.append({"from_rial": b * step, "to_rial": (b + 1) * step, "invoices": n, "sales_rial": v,
                    "invoice_share": n / total_n, "sales_share": v / total_v,
                    "cum_invoice_share": cum_n / total_n, "cum_sales_share": cum_v / total_v})
    return {"step_rial": step, "total_invoices": total_n, "total_rial": total_v, "bands": out}


LINE_BUCKET_MAX = 10


@app.get("/api/invoice-lines")
def invoice_lines(request: Request, core: str = DEFAULT_CORE, start: str | None = None, end: str | None = None):
    """Invoice lines = fact rows of ordinary sales (no promotion / return rows); one row is one line of an invoice."""
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request)
    where = f"core=? AND {SALES_ONLY} AND invoice_code IS NOT NULL{rng}{dim}"
    con = _con()
    try:
        buckets = con.execute(
            f"""WITH inv AS (SELECT invoice_code, COUNT(*) n FROM fact_sales WHERE {where} GROUP BY 1)
                SELECT LEAST(n, {LINE_BUCKET_MAX}) b, COUNT(*), SUM(n) FROM inv GROUP BY 1 ORDER BY 1""",
            [name, *args, *dargs]).fetchall()
        months = con.execute(
            f"""SELECT year_month, COUNT(*), COUNT(DISTINCT invoice_code), COALESCE(SUM(rial_vat), 0) FROM fact_sales
                WHERE {where} AND year_month IS NOT NULL GROUP BY 1 ORDER BY 1""",
            [name, *args, *dargs]).fetchall()
    finally:
        con.close()
    invoices, lines = sum(r[1] for r in buckets), sum(r[2] for r in buckets)
    sales = sum(r[3] for r in months)
    cum, out = 0.0, []
    for b, n, ln in buckets:
        cum += n
        out.append({"lines": b, "open_ended": b == LINE_BUCKET_MAX, "invoices": n, "line_count": ln,
                    "invoice_share": n / invoices, "cum_invoice_share": cum / invoices})
    return {
        "total_invoices": invoices, "total_lines": lines, "sales_rial": sales,
        "avg_lines_per_invoice": (lines / invoices) if invoices else None,
        "avg_rial_per_line": (sales / lines) if lines else None,
        "buckets": out,
        "months": [{"year_month": ym, "lines": ln, "invoices": inv, "sales_rial": v,
                    "avg_lines_per_invoice": (ln / inv) if inv else None} for ym, ln, inv, v in months],
    }


@app.get("/api/calendar")
def calendar(on: str | None = Query(None, description="تاریخ شمسی، مثل 1405/07/19؛ پیش‌فرض امروز")):
    if on:
        parsed = parse_jdate(on)
        if not parsed:
            raise HTTPException(400, "فرمت تاریخ باید 1405/07/19 باشد")
        jy, jm, jd = parsed
        today = jalali_to_gregorian(jy, jm, jd)
    else:
        today = date.today()
        jy, jm, jd = gregorian_to_jalali(today)
    weekday = jalali_weekday(today)
    month_days = days_in_jalali_month(jy, jm)
    holidays = set(HOLIDAYS)

    def is_working(day: int) -> bool:
        g = jalali_to_gregorian(jy, jm, day)
        return jalali_weekday(g) != 6 and format_jdate(jy, jm, day) not in holidays

    working = sum(is_working(d) for d in range(1, month_days + 1))
    passed = sum(is_working(d) for d in range(1, jd))
    return {
        "jalali_date": format_jdate(jy, jm, jd),
        "weekday_name": JALALI_WEEKDAYS[weekday],
        "month_name": JALALI_MONTHS[jm - 1],
        "year": jy, "month": jm, "day": jd,
        "month_days": month_days,
        "working_days": working,
        "days_passed": passed,
        "days_remaining": working - passed,
        "today_is_working": is_working(jd),
        "rule": "جمعه‌ها و تعطیلات تعریف‌شده در SR_HOLIDAYS غیرکاری‌اند؛ روز رفته = روزهای کاری قبل از امروز",
    }


@app.get("/api/pace")
def pace(request: Request, core: str = DEFAULT_CORE):
    name = _core(core)
    dim, dargs = _dims(request)
    scope, sargs = rbac.branch_clause()
    con = _con()
    try:
        last = con.execute(f"SELECT MAX(jdate_key) FROM fact_sales WHERE core=?{scope}", [name, *sargs]).fetchone()[0]
        if not last:
            return {"available": False}
        row = con.execute(
            f"SELECT {METRICS_SQL} FROM fact_sales WHERE core=? AND jdate_key>=? AND jdate_key<=?{dim}",
            [*PROMO_KALA_SOURCES, name, last // 100 * 100 + 1, last, *dargs]).fetchone()
    finally:
        con.close()
    jy, jm, jd = last // 10000, last // 100 % 100, last % 100

    def is_working(day: int) -> bool:
        return jalali_weekday(jalali_to_gregorian(jy, jm, day)) != 6 and format_jdate(jy, jm, day) not in HOLIDAYS

    working = sum(is_working(d) for d in range(1, days_in_jalali_month(jy, jm) + 1))
    elapsed = sum(is_working(d) for d in range(1, jd + 1))
    m = _metrics(row)
    project = lambda v: v / elapsed * working if elapsed else None
    return {
        "available": True, "year_month": f"{jy}{jm:02d}", "last_date": format_jdate(jy, jm, jd), "last_day": jd,
        "month_days": days_in_jalali_month(jy, jm), "working_days": working, "elapsed_working_days": elapsed, "remaining_working_days": working - elapsed,
        "sum_rial_vat": m["sum_rial_vat"], "net_rial": m["net_rial"],
        "projected_sum_rial_vat": project(m["sum_rial_vat"]), "projected_net_rial": project(m["net_rial"]),
        "method": "میانگین فروش هر روز کاری تا آخرین روز دارای داده، ضرب در کل روزهای کاری ماه",
    }


@app.get("/api/data-health")
def data_health():
    c_sql, c_args = rbac.core_clause()
    b_sql, b_args = rbac.branch_clause()
    scope, sargs = c_sql + b_sql, [*c_args, *b_args]    # counts cover only what the user may see
    con = _con()
    try:
        q = lambda s: con.execute(f"SELECT COUNT(*) FROM fact_sales WHERE 1=1{scope}{s}", sargs).fetchone()[0]
        return {
            "rows": q(""),
            "null_customer_code": q(" AND customer_code IS NULL"),
            "null_invoice_date": q(" AND jdate_key IS NULL"),
            "negative_rows_non_return": q(" AND rial_vat<0 AND NOT is_return"),
            "limitations": LIMITATIONS,
        }
    finally:
        con.close()


from . import target as _target  # noqa: E402  (monthly sales target vs actual; routes under /api/target)
app.include_router(_target.router)
app.include_router(_returns.router)

from . import admin as _admin  # noqa: E402  (users, roles, audit log; admin-only, see rbac.access_for)
app.include_router(_admin.router)

DIST = ROOT / "frontend" / "dist"
if DIST.is_dir():
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
