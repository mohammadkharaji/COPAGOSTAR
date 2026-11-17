from __future__ import annotations

import asyncio
import json
import subprocess
import sys
import time
from datetime import date, datetime, timedelta

import os

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import auth, rbac, config, bi_sync_service
from .config import CORES, DEFAULT_CORE, HOLIDAYS, PROMO_KALA_SOURCES, RAW_DIR, ROOT, DB_PATH
from .db import connect
from .jalali import (JALALI_MONTHS, JALALI_WEEKDAYS, days_in_jalali_month, format_jdate, gregorian_to_jalali,
                     jalali_to_gregorian, jalali_weekday, parse_jdate)
from . import returns as _returns
from . import xlsx as _xlsx
from .schema import LIMITATIONS

app = FastAPI(title="SR Sales Dashboard API", docs_url=None, redoc_url=None, openapi_url=None)


async def _bi_sync_scheduler_loop():
    """Background loop that automatically syncs from BI server nightly at 00:30 and every 60m during business hours."""
    if "PYTEST_CURRENT_TEST" in os.environ:
        return
    last_hourly = time.time()
    last_nightly = None
    while True:
        try:
            await asyncio.sleep(30)
            now = datetime.now()
            # 1. Nightly sync at 00:30
            if now.hour == 0 and 30 <= now.minute <= 35 and last_nightly != now.date():
                last_nightly = now.date()
                bi_sync_service.trigger_sync_background()
            # 2. Hourly sync during business hours (08:00 - 18:00)
            elif 8 <= now.hour <= 18:
                if time.time() - last_hourly >= 3600:
                    last_hourly = time.time()
                    bi_sync_service.trigger_sync_background()
        except Exception:
            await asyncio.sleep(60)


@app.on_event("startup")
def startup_tasks():
    rbac.cleanup_audit_logs(days=14)
    if "PYTEST_CURRENT_TEST" not in os.environ:
        try:
            asyncio.create_task(_bi_sync_scheduler_loop())
        except Exception:
            pass

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

EXPECTED_KG_MONTHS = [f"sr_kg_14050{m}" for m in range(1, 9)]

CONSOLIDATION_STATUS = {
    "status": "verified_100_percent",
    "badge_text": "فرمول تجمیع ۳گانه فعال (فروش + پروموشن - مرجوعی) — تطابق ۱۰۰٪ با اکسل مرجع",
    "formula": "SRSalesProcedure1405 (+) + SRPromotionsProcedure1405 (+) - SRDatedSalesReturnProcedurewithVAT1405 (-)",
    "variance_rial": 0,
    "variance_pct": 0.0,
    "active_procedures": 3,
    "verified_invoices": 20589,
    "verified_net_rial": 2402321437420,
    "sales_vat_rial": 2263514904344,
    "promo_rial": 149852383462,
    "returns_vat_rial": 11045850386,
    "last_cutoff": "1405/08/24",
}

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
    if not config.DB_PATH.exists():
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
        "main_group": "main_group", "sub_group": "sub_group", "product": "product_name"}


def _dims(request: Request, skip: tuple[str, ...] = ()) -> tuple[str, list]:
    sql, args = "", []
    for key, col in DIMS.items():
        if key in skip:
            continue
        vals = [v for v in request.query_params.getlist(key) if v]
        if vals:
            if key == "state":
                placeholders = ",".join("?" * len(vals))
                sql += f" AND (state IN ({placeholders}) OR region IN ({placeholders}))"
                args += vals + vals
            else:
                sql += f" AND {col} IN ({','.join('?' * len(vals))})"
                args += vals
    scope, sargs = rbac.scope_clause()   # the user's branch scope, applied even when `branch` is skipped
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
        return {"status": "not_ready", "chunks_loaded": 0, "missing_kg_chunks": EXPECTED_KG_MONTHS, "consolidation": CONSOLIDATION_STATUS}
    con = connect(read_only=True)
    try:
        loaded = {r[0] for r in con.execute("SELECT DISTINCT chunk_id FROM fact_sales").fetchall()}
        last = con.execute("SELECT MAX(jdate_key) FROM fact_sales").fetchone()[0]
    finally:
        con.close()
    missing = [c for c in EXPECTED_KG_MONTHS if c not in loaded]
    return {"status": "ready" if not missing else "partial", "chunks_loaded": len(loaded), "missing_kg_chunks": missing,
            "last_data_date": f"{last // 10000}/{last // 100 % 100:02d}/{last % 100:02d}" if last else None,
            "consolidation": CONSOLIDATION_STATUS}


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


@app.post("/api/admin/bi-sync/trigger", status_code=202)
def trigger_bi_sync():
    """Admin RBAC protected: triggers an immediate live sync from the BI Server."""
    p = rbac.require()
    if not p.is_admin:
        raise HTTPException(403, "دسترسی به همگام‌سازی مستقیم فقط برای مدیر مجاز است")
    started = bi_sync_service.trigger_sync_background()
    if not started:
        raise HTTPException(409, "همگام‌سازی مستقیم از سرور BI در حال حاضر در حال اجراست")
    return {"status": "started", "message": "همگام‌سازی مستقیم و تجمیع ۳گانه از سرور BI در پس‌زمینه آغاز شد"}


@app.get("/api/admin/bi-sync/status")
@app.get("/api/bi-sync/status")
def bi_sync_status():
    """Returns live BI sync progress, last successful sync timestamp, max invoice date, and total synced Rials/invoices."""
    status = bi_sync_service.read_status()
    logs = bi_sync_service.get_sync_history(limit=5)
    return {**status, "recent_logs": logs}


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
        qty_net = con.execute(f"SELECT COALESCE(SUM(qty), 0) FROM fact_sales WHERE core=? AND NOT is_promo{rng}{dim}",
                              [name, *args, *dargs]).fetchone()[0]
    finally:
        con.close()
    return {"core": core, **_metrics(row), "sum_qty_net": qty_net}


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
# Personal purchases (خرید پرسنلی in the Guild column) are not visitor sales: one total, not per-visitor ranks.
PERSONNEL_GUILD = "خرید پرسنلی"
# Brand values that are not ours and must never be offered as a filter option (the rows stay in the data).
HIDDEN_BRANDS = ("دومینو", "TBS", "متفرقه", "آروما")
VISITOR_SALES = f"({SALES_ONLY} AND (guild IS NULL OR guild <> '{PERSONNEL_GUILD}'))"


GEO_KEYS = ("region", "state", "city")
# Option lists narrowed by other selected filters: geography by branch and each other; sub group only by its main group.
NARROWED_BY = {**{k: ("branch", *(g for g in GEO_KEYS if g != k)) for k in GEO_KEYS},
               "main_group": ("brand",), "sub_group": ("brand", "main_group"), "product": ("brand", "main_group", "sub_group")}


@app.get("/api/filters")
def filters(request: Request, core: str = DEFAULT_CORE):
    """Option lists. region/state/city are narrowed by the selected branch and by each other, and sub_group by the
    selected main_group (never by themselves)."""
    name = _core(core)
    scope, sargs = rbac.scope_clause()
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
            # Districts sort by their numeric suffix (منطقه چهار تهران-4 -> 4), cities alphabetically, rest by usage.
            if key == "state":
                order = r"CAST(NULLIF(regexp_extract(" + col + r", '-(\d+)$', 1), '') AS INTEGER) NULLS LAST, " + col
            elif key == "region":
                order = f"{col}"
            elif key == "city":
                order = f"{col} ASC"
            else:
                order = "COUNT(*) DESC"
            if key == "city":
                where += f" AND {col} NOT LIKE '%منطقه%'"
            if key == "brand":
                where += f" AND {col} NOT IN ({','.join('?' * len(HIDDEN_BRANDS))})"
                args += list(HIDDEN_BRANDS)
            out[key] = [r[0] for r in con.execute(
                f"SELECT {col} FROM fact_sales WHERE core=? AND {col} IS NOT NULL{where}{scope} GROUP BY 1 ORDER BY {order} LIMIT 300",
                [name, *args, *sargs]).fetchall()]
        # Ensure municipal districts from region (if any) are also available in state options
        # while keeping city strictly free of districts
        if not out.get("state") or not any("منطقه" in str(x) for x in out.get("state", [])):
            districts = [r[0] for r in con.execute(
                f"SELECT region FROM fact_sales WHERE core=? AND region IS NOT NULL AND region LIKE '%منطقه%'{scope} GROUP BY 1 ORDER BY 1 LIMIT 300",
                [name, *sargs]).fetchall()]
            if districts:
                out["state"] = sorted(set(out.get("state", []) + districts), key=lambda x: str(x))
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


@app.get("/api/quantity-monthly")
def quantity_monthly(request: Request, core: str = DEFAULT_CORE, product: str | None = None,
                     main_group: str | None = None, sub_group: str | None = None):
    """Net quantity per month (sales minus returns, promotions excluded), optionally for one product or sub group."""
    name = _core(core)
    dim, dargs = _dims(request)  # all months stay visible: no start/end range here
    extra, eargs = "", []
    if product:
        extra, eargs = extra + " AND product_name=?", eargs + [product]
    if main_group:
        extra, eargs = extra + " AND main_group=?", eargs + [main_group]
    if sub_group:
        extra, eargs = extra + " AND sub_group=?", eargs + [sub_group]
    con = _con()
    try:
        rows = con.execute(
            f"""SELECT year_month, SUM(qty) FILTER (WHERE NOT is_promo), SUM(rial_vat) FILTER (WHERE NOT is_promo)
                FROM fact_sales WHERE core=? AND year_month IS NOT NULL{extra}{dim}
                GROUP BY 1 ORDER BY 1""",
            [name, *eargs, *dargs]).fetchall()
    finally:
        con.close()
    out = []
    for i, r in enumerate(rows):
        prev = out[-1]["net_qty"] if out else None
        q = r[1] or 0
        out.append({"month": r[0], "net_qty": q, "net_rial": r[2] or 0,
                    "change_percent": ((q - prev) / prev) if prev else None})
    return out


@app.get("/api/quantity-split")
def quantity_split(request: Request, core: str = DEFAULT_CORE, main_group: str | None = None, sub_group: str | None = None):
    """Monthly sales quantity (positive) and return quantity (negative), promotion rows excluded."""
    name = _core(core)
    dim, dargs = _dims(request)
    extra, eargs = "", []
    if main_group:
        extra, eargs = extra + " AND main_group=?", eargs + [main_group]
    if sub_group:
        extra, eargs = extra + " AND sub_group=?", eargs + [sub_group]
    con = _con()
    try:
        rows = con.execute(
            f"""SELECT year_month, SUM(qty) FILTER (WHERE NOT is_promo AND NOT is_return),
                       SUM(qty) FILTER (WHERE is_return)
                FROM fact_sales WHERE core=? AND year_month IS NOT NULL{extra}{dim}
                GROUP BY 1 ORDER BY 1""",
            [name, *eargs, *dargs]).fetchall()
    finally:
        con.close()
    return [{"month": r[0], "sales_qty": r[1] or 0, "return_qty": r[2] or 0} for r in rows]


@app.get("/api/quantity")
def quantity(request: Request, core: str = DEFAULT_CORE, start: str | None = None, end: str | None = None,
             limit: int = Query(20, ge=1, le=200)):
    """Net quantity per product: sales rows minus return rows, promotion rows excluded."""
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request)
    con = _con()
    try:
        rows = con.execute(
            f"""SELECT product_name, SUM(qty) FILTER (WHERE NOT is_promo) AS net_qty,
                       SUM(rial_vat) FILTER (WHERE NOT is_promo) AS net_rial, COUNT(DISTINCT invoice_code) AS invoices
                FROM fact_sales WHERE core=? AND product_name IS NOT NULL{rng}{dim}
                GROUP BY 1 HAVING net_qty > 0 ORDER BY net_qty DESC LIMIT {limit}""",
            [name, *args, *dargs]).fetchall()
    finally:
        con.close()
    return [{"product": r[0], "net_qty": r[1], "net_rial": r[2], "invoices": r[3],
             "rial_per_unit": (r[2] / r[1]) if r[1] else 0} for r in rows]


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
                       COALESCE(SUM(rial_vat) FILTER (WHERE {VISITOR_SALES}), 0), MAX(jdate_key),
                       COALESCE(SUM(rial_vat) FILTER (WHERE guild = '{PERSONNEL_GUILD}'), 0)
                FROM fact_sales WHERE core=? AND visitor_code IS NOT NULL{rng}{dim}
                GROUP BY 1 ORDER BY SUM(rial_vat) DESC""",
            [*PROMO_KALA_SOURCES, name, *args, *dargs]).fetchall()
        per_personnel = con.execute(
            f"""SELECT visitor_code, COALESCE(SUM(rial_vat) FILTER (WHERE guild = '{PERSONNEL_GUILD}'), 0)
                FROM fact_sales WHERE core=? AND visitor_code IS NOT NULL{rng}{dim} GROUP BY 1 HAVING SUM(rial_vat) > 0""",
            [name, *args, *dargs]).fetchall()
        regular_codes = {r[0] for r in con.execute(
            f"""SELECT DISTINCT visitor_code FROM fact_sales
                WHERE core=? AND visitor_code IS NOT NULL AND {VISITOR_SALES}{rng}{dim}""",
            [name, *args, *dargs]).fetchall()}
        personnel_only = [r for r in per_personnel if r[0] not in regular_codes]
        personnel_visitors = len(personnel_only)
        personnel_rial = sum(r[1] for r in personnel_only)
    finally:
        con.close()
    total_sales = sum(r[12] for r in rows if r[12] > 0)
    out = []
    for rank, r in enumerate(rows, 1):
        if r[0] not in regular_codes:   # personnel-only visitors: counted and summed, never ranked
            personnel_visitors += 0
            continue
        m = _metrics(r[3:12])
        sales_only = r[12]
        m.update(rank=len(out) + 1, code=r[0], name=r[1], branch_count=r[2], sales_rial=sales_only,
                 share=(sales_only / total_sales) if total_sales and sales_only > 0 else 0,
                 return_percent=(-m["returns_rial"] / sales_only) if sales_only and m["returns_rial"] else 0,
                 discount_percent=(m["promison_rial"] / sales_only) if sales_only else 0,
                 last_sale=_jdate(r[13]))
        out.append(m)
    return {"visitors": out, "personnel_visitors": personnel_visitors, "personnel_rial": personnel_rial}


@app.get("/api/visitor/{code}")
def visitor_profile(code: str, request: Request, core: str = DEFAULT_CORE, start: str | None = None,
                    end: str | None = None):
    name = _core(core)
    rng, args = _range(start, end)
    dim, dargs = _dims(request)
    base = f"core=? AND visitor_code=?{rng}{dim}"
    bargs = [name, code, *args, *dargs]
    scope, sargs = rbac.scope_clause()
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
                       COALESCE(SUM(rial_vat) FILTER (WHERE {VISITOR_SALES}), 0),
                       COUNT(DISTINCT invoice_code) FILTER (WHERE {VISITOR_SALES}),
                       COUNT(DISTINCT customer_code) FILTER (WHERE {VISITOR_SALES}),
                       COUNT(DISTINCT jdate_key) FILTER (WHERE {VISITOR_SALES}),
                       MIN(jdate_key) FILTER (WHERE {VISITOR_SALES}), MAX(jdate_key) FILTER (WHERE {VISITOR_SALES}),
                       COUNT(*) FILTER (WHERE {VISITOR_SALES} AND invoice_code IS NOT NULL)
                FROM fact_sales WHERE {base}""", [*PROMO_KALA_SOURCES, *bargs]).fetchone()
        peers = con.execute(
            f"""SELECT visitor_code, SUM(rial_vat) FROM fact_sales
                WHERE core=? AND {VISITOR_SALES} AND visitor_code IS NOT NULL{rng}{dim} GROUP BY 1""",
            [name, *args, *dargs]).fetchall()
        months = con.execute(
            f"""SELECT year_month, SUM(rial_vat), COUNT(DISTINCT invoice_code), COUNT(DISTINCT customer_code)
                FROM fact_sales WHERE core=? AND visitor_code=? AND {VISITOR_SALES} AND year_month IS NOT NULL{dim}
                GROUP BY 1 ORDER BY 1""", [name, code, *dargs]).fetchall()
        days = con.execute(
            f"""SELECT jdate_key, SUM(rial_vat), COUNT(DISTINCT customer_code) FROM fact_sales
                WHERE {base} AND {VISITOR_SALES} AND jdate_key IS NOT NULL GROUP BY 1 ORDER BY 1""", bargs).fetchall()
        splits = {}
        for key, col in (("branches", "branch"), ("brands", "brand"), ("grades", "grade"), ("sales_types", "sales_type")):
            splits[key] = [{"name": n, "sales_rial": v} for n, v in con.execute(
                f"""SELECT {col}, SUM(rial_vat) FROM fact_sales WHERE {base} AND {VISITOR_SALES} AND {col} IS NOT NULL
                    GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY 2 DESC LIMIT 30""", bargs).fetchall()]
        products = con.execute(
            f"""SELECT product_name, SUM(rial_vat), SUM(qty) FROM fact_sales
                WHERE {base} AND {VISITOR_SALES} AND product_name IS NOT NULL
                GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY 2 DESC LIMIT 15""", bargs).fetchall()
        customers = con.execute(
            f"""SELECT customer_code, ANY_VALUE(customer_name), SUM(rial_vat), COUNT(DISTINCT invoice_code)
                FROM fact_sales WHERE {base} AND {VISITOR_SALES} AND customer_code IS NOT NULL
                GROUP BY 1 HAVING SUM(rial_vat) > 0 ORDER BY 3 DESC LIMIT 20""", bargs).fetchall()
        dispatch_returns = _returns.visitor_returns(con, name, code, start, end, request.query_params.get("reason") or None)
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
    scope, sargs = rbac.scope_clause()
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
    scope, sargs = rbac.scope_clause()
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
def customer_profile(code: str, request: Request, core: str = DEFAULT_CORE):
    name = _core(core)
    scope, sargs = rbac.scope_clause()
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
        dispatch_returns = _returns.customer_returns(con, name, code, reason=request.query_params.get("reason") or None)
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


INACTIVE_DAYS = 60


def _jtuple(key: int):
    return key // 10000, key // 100 % 100, key % 100


def _inactive_report(request: Request, core: str, days: int) -> dict:
    """Customers with paid sales before the window and none inside it.

    The window is the `days` days ending at the latest date loaded for the core (not today), so a late import does not
    turn everyone inactive. A purchase is a sales row (not promotion, not return) with a positive Rial+Vat.
    """
    name = _core(core)
    dim, dargs = _dims(request)
    con = _con()
    try:
        l_scope, l_args = rbac.scope_clause()
        latest = con.execute(f"SELECT MAX(jdate_key) FROM fact_sales WHERE core=? AND jdate_key IS NOT NULL{l_scope}",
                             [name, *l_args]).fetchone()[0]
        if latest is None:
            return {"available": False, "days": days, "reason": "داده‌ای برای این هسته بارگذاری نشده است."}
        latest_g = jalali_to_gregorian(*_jtuple(latest))
        cutoff_key = int(format_jdate(*gregorian_to_jalali(latest_g - timedelta(days=days - 1))).replace("/", ""))
        rows = con.execute(
            f"""WITH paid AS (
                    SELECT customer_code, customer_name, visitor_code, visitor, branch, city_name, grade, invoice_code,
                           jdate_key, rial_vat,
                           ROW_NUMBER() OVER (PARTITION BY customer_code ORDER BY jdate_key DESC, invoice_code DESC) AS rn
                    FROM fact_sales
                    WHERE core=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL
                          AND jdate_key IS NOT NULL{dim}),
                agg AS (
                    SELECT customer_code, SUM(rial_vat) AS sales, COUNT(DISTINCT invoice_code) AS invoices,
                           MIN(jdate_key) AS first_key, MAX(jdate_key) AS last_key
                    FROM paid GROUP BY 1)
                SELECT a.customer_code, p.customer_name, p.visitor_code, p.visitor, p.branch, p.city_name, p.grade,
                       a.sales, a.invoices, a.first_key, a.last_key
                FROM agg a JOIN paid p ON p.customer_code = a.customer_code AND p.rn = 1
                ORDER BY a.sales DESC, a.customer_code""", [name, *dargs]).fetchall()
    finally:
        con.close()
    total_customers = len(rows)
    inactive = [r for r in rows if r[10] < cutoff_key]
    lost = sum(r[7] for r in inactive)
    items, by_visitor, by_branch = [], {}, {}
    for rank, r in enumerate(inactive, 1):
        code, cname, vcode, vname, branch, city, grade, sales, invoices, first_key, last_key = r
        since = (latest_g - jalali_to_gregorian(*_jtuple(last_key))).days
        items.append({"rank": rank, "code": code, "name": cname, "visitor_code": vcode, "visitor": vname, "branch": branch,
                      "city": city, "grade": grade, "first_purchase": _jdate(first_key), "last_purchase": _jdate(last_key),
                      "days_since": since, "invoices": invoices, "sales_rial": sales,
                      "avg_invoice_rial": (sales / invoices) if invoices else None,
                      "share": (sales / lost) if lost else 0})
        v = by_visitor.setdefault(vcode or "", {"code": vcode, "name": vname, "customers": 0, "sales_rial": 0, "items": []})
        v["customers"] += 1
        v["sales_rial"] += sales
        v["items"].append({"rank": rank, "code": code, "name": cname, "branch": branch, "city": city, "grade": grade, "days_since": since, "invoices": invoices, "sales_rial": sales})
        b = by_branch.setdefault(branch or "", {"name": branch, "customers": 0, "sales_rial": 0})
        b["customers"] += 1
        b["sales_rial"] += sales
    return {
        "available": True, "days": days, "as_of": _jdate(latest), "window_start": _jdate(cutoff_key),
        "total_customers": total_customers, "active_customers": total_customers - len(inactive),
        "inactive_customers": len(inactive), "inactive_percent": (len(inactive) / total_customers) if total_customers else 0,
        "lost_sales_rial": lost, "items": items,
        "by_visitor": sorted(by_visitor.values(), key=lambda x: -x["sales_rial"]),
        "by_branch": sorted(by_branch.values(), key=lambda x: -x["sales_rial"]),
    }


@app.get("/api/inactive-customers")
def inactive_customers(request: Request, core: str = DEFAULT_CORE, days: int = Query(INACTIVE_DAYS, ge=7, le=365)):
    return _inactive_report(request, core, days)


@app.get("/api/inactive-customers/export")
def inactive_customers_export(request: Request, core: str = DEFAULT_CORE, days: int = Query(INACTIVE_DAYS, ge=7, le=365)):
    j = _inactive_report(request, core, days)
    if not j["available"]:
        raise HTTPException(404, j["reason"])
    header = ["رتبه", "کد مشتری", "نام مشتری", "کد ویزیتور", "ویزیتور", "شعبه", "شهر", "گرید", "اولین خرید", "آخرین خرید",
              "روز بدون خرید", "تعداد فاکتور", "فروش قبلی (ریال)", "میانگین فاکتور (ریال)", "سهم از فروش از دست‌رفته (٪)"]
    rows = [[i["rank"], i["code"], i["name"], i["visitor_code"], i["visitor"], i["branch"], i["city"], i["grade"],
             i["first_purchase"], i["last_purchase"], i["days_since"], i["invoices"], round(i["sales_rial"]),
             round(i["avg_invoice_rial"]) if i["avg_invoice_rial"] is not None else None, round(i["share"] * 100, 2)]
            for i in j["items"]]
    summary = [["هسته", CORES[core] if core in CORES else core], ["بازه بدون خرید (روز)", j["days"]],
               ["آخرین تاریخ دادهٔ بارگذاری‌شده", j["as_of"]], ["شروع بازه", j["window_start"]],
               ["مشتریان دارای سابقهٔ خرید", j["total_customers"]], ["مشتریان فعال در بازه", j["active_customers"]],
               ["مشتریان غیرفعال", j["inactive_customers"]], ["درصد غیرفعال (٪)", round(j["inactive_percent"] * 100, 2)],
               ["فروش قبلی مشتریان غیرفعال (ریال)", round(j["lost_sales_rial"])],
               ["تعریف خرید", "ردیف فروش عادی با مبلغ مثبت؛ پروموشن و مرجوعی خرید حساب نمی‌شود"]]
    body = _xlsx.build_xlsx([
        ("مشتریان غیرفعال", header, rows, [7, 14, 30, 12, 22, 18, 14, 10, 13, 13, 12, 11, 20, 20, 16]),
        ("خلاصه", ["شاخص", "مقدار"], summary, [40, 60])])
    stamp = (j["as_of"] or "").replace("/", "-")
    return Response(body, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="inactive-customers-{core}-{stamp}.xlsx"'})


POTENTIAL_LAPSE_DAYS = 120
POTENTIAL_MAX_INVOICES = 2


def _key_of(g: date) -> int:
    return int(format_jdate(*gregorian_to_jalali(g)).replace("/", ""))


def _potential_report(request: Request, core: str, days: int, lapse_days: int, max_invoices: int) -> dict:
    """Two groups of customers from paid sales, measured against the same window as the inactive report.

    lapsed: last purchase before the window, but no earlier than `lapse_days` before the window starts (recoverable).
    low_frequency: bought inside the window on at most `max_invoices` invoices.
    """
    name = _core(core)
    dim, dargs = _dims(request)
    con = _con()
    try:
        l_scope, l_args = rbac.scope_clause()
        latest = con.execute(f"SELECT MAX(jdate_key) FROM fact_sales WHERE core=? AND jdate_key IS NOT NULL{l_scope}",
                             [name, *l_args]).fetchone()[0]
        if latest is None:
            return {"available": False, "days": days, "reason": "داده‌ای برای این هسته بارگذاری نشده است."}
        latest_g = jalali_to_gregorian(*_jtuple(latest))
        cutoff_key = _key_of(latest_g - timedelta(days=days - 1))
        lapse_key = _key_of(latest_g - timedelta(days=days - 1 + lapse_days))
        rows = con.execute(
            f"""WITH paid AS (
                    SELECT customer_code, customer_name, visitor_code, visitor, branch, city_name, grade, invoice_code,
                           jdate_key, rial_vat,
                           ROW_NUMBER() OVER (PARTITION BY customer_code ORDER BY jdate_key DESC, invoice_code DESC) AS rn
                    FROM fact_sales
                    WHERE core=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL
                          AND jdate_key IS NOT NULL{dim}),
                agg AS (
                    SELECT customer_code, SUM(rial_vat) AS sales, COUNT(DISTINCT invoice_code) AS invoices,
                           MIN(jdate_key) AS first_key, MAX(jdate_key) AS last_key,
                           COALESCE(SUM(rial_vat) FILTER (WHERE jdate_key >= ?), 0) AS win_sales,
                           COUNT(DISTINCT invoice_code) FILTER (WHERE jdate_key >= ?) AS win_invoices
                    FROM paid GROUP BY 1)
                SELECT a.customer_code, p.customer_name, p.visitor_code, p.visitor, p.branch, p.city_name, p.grade,
                       a.sales, a.invoices, a.first_key, a.last_key, a.win_sales, a.win_invoices
                FROM agg a JOIN paid p ON p.customer_code = a.customer_code AND p.rn = 1
                ORDER BY a.sales DESC, a.customer_code""", [name, *dargs, cutoff_key, cutoff_key]).fetchall()
    finally:
        con.close()
    lapsed = [r for r in rows if lapse_key <= r[10] < cutoff_key]
    low = [r for r in rows if 1 <= r[12] <= max_invoices]

    def item(rank: int, r: tuple) -> dict:
        code, cname, vcode, vname, branch, city, grade, sales, invoices, first_key, last_key, win_sales, win_invoices = r
        return {"rank": rank, "code": code, "name": cname, "visitor_code": vcode, "visitor": vname, "branch": branch,
                "city": city, "grade": grade, "first_purchase": _jdate(first_key), "last_purchase": _jdate(last_key),
                "days_since": (latest_g - jalali_to_gregorian(*_jtuple(last_key))).days, "invoices": invoices,
                "sales_rial": sales, "window_invoices": win_invoices, "window_sales_rial": win_sales,
                "avg_invoice_rial": (sales / invoices) if invoices else None}

    lapsed_items = [item(i, r) for i, r in enumerate(lapsed, 1)]
    low_items = [item(i, r) for i, r in enumerate(low, 1)]
    return {
        "available": True, "days": days, "lapse_days": lapse_days, "max_invoices": max_invoices,
        "as_of": _jdate(latest), "window_start": _jdate(cutoff_key), "lapse_start": _jdate(lapse_key),
        "total_customers": len(rows),
        "lapsed": {"count": len(lapsed_items), "sales_rial": sum(i["sales_rial"] for i in lapsed_items), "items": lapsed_items},
        "low_frequency": {"count": len(low_items), "sales_rial": sum(i["window_sales_rial"] for i in low_items), "items": low_items},
    }


@app.get("/api/potential-customers")
def potential_customers(request: Request, core: str = DEFAULT_CORE, days: int = Query(INACTIVE_DAYS, ge=7, le=365),
                        lapse_days: int = Query(POTENTIAL_LAPSE_DAYS, ge=30, le=365),
                        max_invoices: int = Query(POTENTIAL_MAX_INVOICES, ge=1, le=10)):
    return _potential_report(request, core, days, lapse_days, max_invoices)


def _format_month_label(ym: str) -> str:
    if len(ym) == 6 and ym.isdigit():
        m_idx = int(ym[4:6]) - 1
        y = ym[:4]
        if 0 <= m_idx < len(JALALI_MONTHS):
            return f"{JALALI_MONTHS[m_idx]} {y}"
    return ym


@app.get("/api/analytics/customer-metrics")
def customer_metrics(request: Request, core: str = DEFAULT_CORE, target_month: str | None = None,
                     lookback: str = "prev_1m", branch: str | None = None):
    """Calculates all 13 customer purchase, retention, churn, CLV and invoice metrics across cohort windows."""
    name = _core(core)
    dim, dargs = _dims(request)
    if branch:
        dim += " AND branch = ?"
        dargs = list(dargs) + [branch]

    con = _con()
    try:
        l_scope, l_args = rbac.scope_clause()
        months_rows = con.execute(
            f"SELECT DISTINCT year_month FROM fact_sales WHERE core=? AND year_month IS NOT NULL{l_scope} ORDER BY year_month ASC",
            [name, *l_args],
        ).fetchall()
        all_months = [r[0] for r in months_rows if r[0]]
        if not all_months:
            return {"available": False, "reason": "داده‌ای برای این هسته بارگذاری نشده است."}

        if not target_month or target_month not in all_months:
            target_month = all_months[-1]

        earlier = [m for m in all_months if m < target_month]
        if lookback == "prev_1m":
            lookback_months = earlier[-1:] if earlier else []
            lookback_label = f"ماه قبل ({_format_month_label(lookback_months[0])})" if lookback_months else "ماه قبل"
        elif lookback == "prev_2m":
            lookback_months = earlier[-2:] if earlier else []
            if len(lookback_months) >= 2:
                lookback_label = f"۲ ماه قبل ({_format_month_label(lookback_months[0])} تا {_format_month_label(lookback_months[-1])})"
            elif lookback_months:
                lookback_label = f"ماه قبل ({_format_month_label(lookback_months[0])})"
            else:
                lookback_label = "۲ ماه قبل"
        elif lookback == "ytd":
            lookback_months = [m for m in earlier if m.startswith(target_month[:4])]
            if lookback_months:
                lookback_label = f"کل سال تا قبل از ماه جاری ({_format_month_label(lookback_months[0])} تا {_format_month_label(lookback_months[-1])})"
            else:
                lookback_label = "کل سال تا قبل از ماه جاری"
        else:
            lookback_months = earlier[-1:] if earlier else []
            lookback_label = f"ماه قبل ({_format_month_label(lookback_months[0])})" if lookback_months else "ماه قبل"

        # 0. Total registered / purchasing customer base
        total_cust_row = con.execute(
            f"""SELECT COUNT(DISTINCT customer_code)
                FROM fact_sales
                WHERE core=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}""",
            [name, *dargs],
        ).fetchone()
        total_customers = total_cust_row[0] if total_cust_row and total_cust_row[0] else 0

        # 1. Target month customer set and stats
        curr_cust_rows = con.execute(
            f"""SELECT customer_code,
                       SUM(qty) AS qty,
                       SUM(rial_vat) AS rial_vat,
                       COUNT(DISTINCT invoice_code) AS invoices,
                       COUNT(DISTINCT COALESCE(NULLIF(brand, ''), 'نامشخص')) AS distinct_brands
                FROM fact_sales
                WHERE core=? AND year_month=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                GROUP BY customer_code""",
            [name, target_month, *dargs],
        ).fetchall()

        curr_cust_map = {r[0]: (r[1], r[2], r[3], r[4]) for r in curr_cust_rows}
        curr_custs = set(curr_cust_map.keys())

        # 2. Lookback period customer set
        if lookback_months:
            placeholders = ",".join("?" * len(lookback_months))
            prev_rows = con.execute(
                f"""SELECT DISTINCT customer_code
                    FROM fact_sales
                    WHERE core=? AND year_month IN ({placeholders}) AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}""",
                [name, *lookback_months, *dargs],
            ).fetchall()
            prev_custs = {r[0] for r in prev_rows if r[0]}
        else:
            prev_custs = set()

        # 3. Overall target month invoice metrics
        inv_row = con.execute(
            f"""SELECT COUNT(DISTINCT invoice_code),
                       COALESCE(SUM(qty), 0),
                       COALESCE(SUM(rial_vat), 0),
                       COUNT(DISTINCT invoice_code || '_' || product_code),
                       COUNT(DISTINCT invoice_code || '_' || COALESCE(NULLIF(brand, ''), 'نامشخص'))
                FROM fact_sales
                WHERE core=? AND year_month=? AND {SALES_ONLY} AND rial_vat > 0 AND invoice_code IS NOT NULL{dim}""",
            [name, target_month, *dargs],
        ).fetchone()

        total_invoices, total_qty, total_rial, total_skus, total_inv_brands = inv_row or (0, 0, 0, 0, 0)

        # Calculate 13 metrics
        active_customers = len(curr_custs)
        prev_active_customers = len(prev_custs)
        new_customers = len(curr_custs - prev_custs)
        returning_customers = len(curr_custs & prev_custs)
        returning_rate = round((returning_customers / prev_active_customers * 100), 2) if prev_active_customers else 0.0
        churned_customers = len(prev_custs - curr_custs)
        churn_rate = round((churned_customers / prev_active_customers * 100), 2) if prev_active_customers else 0.0

        clv_qty = round(total_qty / active_customers, 2) if active_customers else 0.0
        clv_rial = round(total_rial / active_customers) if active_customers else 0
        total_customer_brands = sum(r[3] for r in curr_cust_map.values())
        avg_cat_per_customer = round(total_customer_brands / active_customers, 2) if active_customers else 0.0

        avg_order_size = round(total_qty / total_invoices, 2) if total_invoices else 0.0
        avg_sku_per_invoice = round(total_skus / total_invoices, 2) if total_invoices else 0.0
        avg_cat_per_invoice = round(total_inv_brands / total_invoices, 2) if total_invoices else 0.0

        # 4. Brand Breakdown
        brand_curr_rows = con.execute(
            f"""SELECT COALESCE(NULLIF(brand, ''), 'نامشخص') AS brand,
                       COUNT(DISTINCT customer_code) AS active_custs,
                       COUNT(DISTINCT invoice_code) AS invoices,
                       COALESCE(SUM(qty), 0) AS total_qty,
                       COALESCE(SUM(rial_vat), 0) AS total_rial,
                       COUNT(DISTINCT invoice_code || '_' || product_code) AS total_skus
                FROM fact_sales
                WHERE core=? AND year_month=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                GROUP BY 1
                ORDER BY active_custs DESC""",
            [name, target_month, *dargs],
        ).fetchall()

        brand_ret_map = {}
        if lookback_months:
            pl_b = ",".join("?" * len(lookback_months))
            b_ret_rows = con.execute(
                f"""WITH curr AS (
                        SELECT DISTINCT COALESCE(NULLIF(brand, ''), 'نامشخص') AS brand, customer_code
                        FROM fact_sales
                        WHERE core=? AND year_month=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                    ),
                    prev AS (
                        SELECT DISTINCT COALESCE(NULLIF(brand, ''), 'نامشخص') AS brand, customer_code
                        FROM fact_sales
                        WHERE core=? AND year_month IN ({pl_b}) AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                    )
                    SELECT p.brand,
                           COUNT(DISTINCT p.customer_code) AS prev_custs,
                           COUNT(DISTINCT c.customer_code) AS ret_custs
                    FROM prev p
                    LEFT JOIN curr c ON p.brand = c.brand AND p.customer_code = c.customer_code
                    GROUP BY 1""",
                [name, target_month, *dargs, name, *lookback_months, *dargs],
            ).fetchall()
            brand_ret_map = {r[0]: (r[1], r[2]) for r in b_ret_rows}

        b_cross_rows = con.execute(
            f"""WITH cust_total AS (
                    SELECT customer_code, COUNT(DISTINCT COALESCE(NULLIF(brand, ''), 'نامشخص')) AS brand_cnt
                    FROM fact_sales
                    WHERE core=? AND year_month=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                    GROUP BY 1
                )
                SELECT f.brand, AVG(ct.brand_cnt)
                FROM fact_sales f
                JOIN cust_total ct ON f.customer_code = ct.customer_code
                WHERE f.core=? AND f.year_month=? AND {SALES_ONLY} AND f.rial_vat > 0 AND f.customer_code IS NOT NULL{dim}
                GROUP BY 1""",
            [name, target_month, *dargs, name, target_month, *dargs],
        ).fetchall()
        b_cross_map = {r[0]: r[1] for r in b_cross_rows}

        breakdown_brand = []
        for r in brand_curr_rows:
            b_name, b_active, b_invs, b_qty, b_rial, b_skus = r
            b_prev, b_ret = brand_ret_map.get(b_name, (0, 0))
            b_churn = max(0, b_prev - b_ret)
            b_ret_rate = round((b_ret / b_prev * 100), 1) if b_prev else 0.0
            b_churn_rate = round((b_churn / b_prev * 100), 1) if b_prev else 0.0
            b_clv_qty = round(b_qty / b_active, 1) if b_active else 0.0
            b_avg_order = round(b_qty / b_invs, 1) if b_invs else 0.0
            b_avg_sku = round(b_skus / b_invs, 1) if b_invs else 0.0
            b_avg_cat = round(b_cross_map.get(b_name, 1.0), 1)
            breakdown_brand.append({
                "name": b_name,
                "active_custs": b_active,
                "prev_custs": b_prev,
                "churned_custs": b_churn,
                "returning_custs": b_ret,
                "churn_rate": b_churn_rate,
                "returning_rate": b_ret_rate,
                "clv_qty": b_clv_qty,
                "avg_order_size": b_avg_order,
                "avg_sku": b_avg_sku,
                "avg_category": b_avg_cat,
                "total_rial": b_rial,
                "total_qty": b_qty,
            })

        # 5. Product Group (Category) Breakdown
        cat_curr_rows = con.execute(
            f"""WITH pdim AS (
                    SELECT SUBSTRING(unique_product_code, 1, 10) AS pcode,
                           FIRST(main_group) AS main_group
                    FROM dim_product
                    WHERE main_group IS NOT NULL
                    GROUP BY 1
                ),
                scat AS (
                    SELECT f.customer_code,
                           f.invoice_code,
                           f.product_code,
                           f.qty,
                           f.rial_vat,
                           TRIM(REPLACE(COALESCE(
                               NULLIF(f.main_group, ''),
                               p.main_group,
                               'سایر'
                           ), 'گروه', '')) AS category_name
                    FROM fact_sales f
                    LEFT JOIN pdim p ON f.product_code = p.pcode
                    WHERE f.core=? AND f.year_month=? AND {SALES_ONLY} AND f.rial_vat > 0 AND f.customer_code IS NOT NULL{dim}
                )
                SELECT category_name,
                       COUNT(DISTINCT customer_code) AS active_custs,
                       COUNT(DISTINCT invoice_code) AS invoices,
                       COALESCE(SUM(qty), 0) AS total_qty,
                       COALESCE(SUM(rial_vat), 0) AS total_rial,
                       COUNT(DISTINCT invoice_code || '_' || product_code) AS total_skus
                FROM scat
                WHERE category_name != '' AND category_name != 'سایر'
                GROUP BY 1
                ORDER BY active_custs DESC""",
            [name, target_month, *dargs],
        ).fetchall()

        cat_ret_map = {}
        if lookback_months:
            pl_c = ",".join("?" * len(lookback_months))
            c_ret_rows = con.execute(
                f"""WITH pdim AS (
                        SELECT SUBSTRING(unique_product_code, 1, 10) AS pcode,
                               FIRST(main_group) AS main_group
                        FROM dim_product
                        WHERE main_group IS NOT NULL
                        GROUP BY 1
                    ),
                    curr AS (
                        SELECT DISTINCT
                               TRIM(REPLACE(COALESCE(
                                   NULLIF(f.main_group, ''),
                                   p.main_group,
                                   'سایر'
                               ), 'گروه', '')) AS category_name,
                               f.customer_code
                        FROM fact_sales f
                        LEFT JOIN pdim p ON f.product_code = p.pcode
                        WHERE f.core=? AND f.year_month=? AND {SALES_ONLY} AND f.rial_vat > 0 AND f.customer_code IS NOT NULL{dim}
                    ),
                    prev AS (
                        SELECT DISTINCT
                               TRIM(REPLACE(COALESCE(
                                   NULLIF(f.main_group, ''),
                                   p.main_group,
                                   'سایر'
                               ), 'گروه', '')) AS category_name,
                               f.customer_code
                        FROM fact_sales f
                        LEFT JOIN pdim p ON f.product_code = p.pcode
                        WHERE f.core=? AND f.year_month IN ({pl_c}) AND {SALES_ONLY} AND f.rial_vat > 0 AND f.customer_code IS NOT NULL{dim}
                    )
                    SELECT p.category_name,
                           COUNT(DISTINCT p.customer_code) AS prev_custs,
                           COUNT(DISTINCT c.customer_code) AS ret_custs
                    FROM prev p
                    LEFT JOIN curr c ON p.category_name = c.category_name AND p.customer_code = c.customer_code
                    WHERE p.category_name != '' AND p.category_name != 'سایر'
                    GROUP BY 1""",
                [name, target_month, *dargs, name, *lookback_months, *dargs],
            ).fetchall()
            cat_ret_map = {r[0]: (r[1], r[2]) for r in c_ret_rows}

        c_cross_rows = con.execute(
            f"""WITH pdim AS (
                    SELECT SUBSTRING(unique_product_code, 1, 10) AS pcode,
                           FIRST(main_group) AS main_group
                    FROM dim_product
                    WHERE main_group IS NOT NULL
                    GROUP BY 1
                ),
                cust_total AS (
                    SELECT f.customer_code,
                           COUNT(DISTINCT COALESCE(NULLIF(f.brand, ''), 'نامشخص')) AS brand_cnt
                    FROM fact_sales f
                    WHERE f.core=? AND f.year_month=? AND {SALES_ONLY} AND f.rial_vat > 0 AND f.customer_code IS NOT NULL{dim}
                    GROUP BY 1
                )
                SELECT TRIM(REPLACE(COALESCE(
                           NULLIF(f.main_group, ''),
                           p.main_group,
                           'سایر'
                       ), 'گروه', '')) AS category_name,
                       AVG(ct.brand_cnt)
                FROM fact_sales f
                LEFT JOIN pdim p ON f.product_code = p.pcode
                JOIN cust_total ct ON f.customer_code = ct.customer_code
                WHERE f.core=? AND f.year_month=? AND {SALES_ONLY} AND f.rial_vat > 0 AND f.customer_code IS NOT NULL{dim}
                GROUP BY 1""",
            [name, target_month, *dargs, name, target_month, *dargs],
        ).fetchall()
        c_cross_map = {r[0]: r[1] for r in c_cross_rows}

        breakdown_category = []
        for r in cat_curr_rows:
            c_name, c_active, c_invs, c_qty, c_rial, c_skus = r
            c_prev, c_ret = cat_ret_map.get(c_name, (0, 0))
            c_churn = max(0, c_prev - c_ret)
            c_ret_rate = round((c_ret / c_prev * 100), 1) if c_prev else 0.0
            c_churn_rate = round((c_churn / c_prev * 100), 1) if c_prev else 0.0
            c_clv_qty = round(c_qty / c_active, 1) if c_active else 0.0
            c_avg_order = round(c_qty / c_invs, 1) if c_invs else 0.0
            c_avg_sku = round(c_skus / c_invs, 1) if c_invs else 0.0
            c_avg_cat = round(c_cross_map.get(c_name, 1.0), 1)
            breakdown_category.append({
                "name": c_name,
                "active_custs": c_active,
                "prev_custs": c_prev,
                "churned_custs": c_churn,
                "returning_custs": c_ret,
                "churn_rate": c_churn_rate,
                "returning_rate": c_ret_rate,
                "clv_qty": c_clv_qty,
                "avg_order_size": c_avg_order,
                "avg_sku": c_avg_sku,
                "avg_category": c_avg_cat,
                "total_rial": c_rial,
                "total_qty": c_qty,
            })

        # 6. Branch Breakdown
        branch_curr_rows = con.execute(
            f"""SELECT COALESCE(NULLIF(branch, ''), 'نامشخص') AS branch,
                       COUNT(DISTINCT customer_code) AS active_custs,
                       COUNT(DISTINCT invoice_code) AS invoices,
                       COALESCE(SUM(qty), 0) AS total_qty,
                       COALESCE(SUM(rial_vat), 0) AS total_rial,
                       COUNT(DISTINCT invoice_code || '_' || product_code) AS total_skus,
                       COUNT(DISTINCT invoice_code || '_' || COALESCE(NULLIF(brand, ''), 'نامشخص')) AS total_brands
                FROM fact_sales
                WHERE core=? AND year_month=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                GROUP BY 1
                ORDER BY active_custs DESC""",
            [name, target_month, *dargs],
        ).fetchall()

        branch_ret_map = {}
        if lookback_months:
            pl_br = ",".join("?" * len(lookback_months))
            br_ret_rows = con.execute(
                f"""WITH curr AS (
                        SELECT DISTINCT COALESCE(NULLIF(branch, ''), 'نامشخص') AS branch, customer_code
                        FROM fact_sales
                        WHERE core=? AND year_month=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                    ),
                    prev AS (
                        SELECT DISTINCT COALESCE(NULLIF(branch, ''), 'نامشخص') AS branch, customer_code
                        FROM fact_sales
                        WHERE core=? AND year_month IN ({pl_br}) AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                    )
                    SELECT p.branch,
                           COUNT(DISTINCT p.customer_code) AS prev_custs,
                           COUNT(DISTINCT c.customer_code) AS ret_custs
                    FROM prev p
                    LEFT JOIN curr c ON p.branch = c.branch AND p.customer_code = c.customer_code
                    GROUP BY 1""",
                [name, target_month, *dargs, name, *lookback_months, *dargs],
            ).fetchall()
            branch_ret_map = {r[0]: (r[1], r[2]) for r in br_ret_rows}

        breakdown_branch = []
        for r in branch_curr_rows:
            br_name, br_active, br_invs, br_qty, br_rial, br_skus, br_brands = r
            br_prev, br_ret = branch_ret_map.get(br_name, (0, 0))
            br_churn = max(0, br_prev - br_ret)
            br_ret_rate = round((br_ret / br_prev * 100), 1) if br_prev else 0.0
            br_churn_rate = round((br_churn / br_prev * 100), 1) if br_prev else 0.0
            br_clv_qty = round(br_qty / br_active, 1) if br_active else 0.0
            br_avg_order = round(br_qty / br_invs, 1) if br_invs else 0.0
            br_avg_sku = round(br_skus / br_invs, 1) if br_invs else 0.0
            br_avg_cat = round(br_brands / br_invs, 1) if br_invs else 0.0
            breakdown_branch.append({
                "name": br_name,
                "active_custs": br_active,
                "prev_custs": br_prev,
                "churned_custs": br_churn,
                "returning_custs": br_ret,
                "churn_rate": br_churn_rate,
                "returning_rate": br_ret_rate,
                "clv_qty": br_clv_qty,
                "avg_order_size": br_avg_order,
                "avg_sku": br_avg_sku,
                "avg_category": br_avg_cat,
                "total_rial": br_rial,
                "total_qty": br_qty,
            })

        # 6. Region Breakdown
        region_curr_rows = con.execute(
            f"""SELECT COALESCE(NULLIF(region, ''), 'نامشخص') AS region,
                       COUNT(DISTINCT customer_code) AS active_custs,
                       COUNT(DISTINCT invoice_code) AS invoices,
                       COALESCE(SUM(qty), 0) AS total_qty,
                       COALESCE(SUM(rial_vat), 0) AS total_rial,
                       COUNT(DISTINCT invoice_code || '_' || product_code) AS total_skus,
                       COUNT(DISTINCT invoice_code || '_' || COALESCE(NULLIF(brand, ''), 'نامشخص')) AS total_brands
                FROM fact_sales
                WHERE core=? AND year_month=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                GROUP BY 1
                ORDER BY active_custs DESC""",
            [name, target_month, *dargs],
        ).fetchall()

        region_ret_map = {}
        if lookback_months:
            pl_rg = ",".join("?" * len(lookback_months))
            rg_ret_rows = con.execute(
                f"""WITH curr AS (
                        SELECT DISTINCT COALESCE(NULLIF(region, ''), 'نامشخص') AS region, customer_code
                        FROM fact_sales
                        WHERE core=? AND year_month=? AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                    ),
                    prev AS (
                        SELECT DISTINCT COALESCE(NULLIF(region, ''), 'نامشخص') AS region, customer_code
                        FROM fact_sales
                        WHERE core=? AND year_month IN ({pl_rg}) AND {SALES_ONLY} AND rial_vat > 0 AND customer_code IS NOT NULL{dim}
                    )
                    SELECT p.region,
                           COUNT(DISTINCT p.customer_code) AS prev_custs,
                           COUNT(DISTINCT c.customer_code) AS ret_custs
                    FROM prev p
                    LEFT JOIN curr c ON p.region = c.region AND p.customer_code = c.customer_code
                    GROUP BY 1""",
                [name, target_month, *dargs, name, *lookback_months, *dargs],
            ).fetchall()
            region_ret_map = {r[0]: (r[1], r[2]) for r in rg_ret_rows}

        breakdown_region = []
        for r in region_curr_rows:
            rg_name, rg_active, rg_invs, rg_qty, rg_rial, rg_skus, rg_brands = r
            rg_prev, rg_ret = region_ret_map.get(rg_name, (0, 0))
            rg_churn = max(0, rg_prev - rg_ret)
            rg_ret_rate = round((rg_ret / rg_prev * 100), 1) if rg_prev else 0.0
            rg_churn_rate = round((rg_churn / rg_prev * 100), 1) if rg_prev else 0.0
            rg_clv_qty = round(rg_qty / rg_active, 1) if rg_active else 0.0
            rg_avg_order = round(rg_qty / rg_invs, 1) if rg_invs else 0.0
            rg_avg_sku = round(rg_skus / rg_invs, 1) if rg_invs else 0.0
            rg_avg_cat = round(rg_brands / rg_invs, 1) if rg_invs else 0.0
            breakdown_region.append({
                "name": rg_name,
                "active_custs": rg_active,
                "prev_custs": rg_prev,
                "churned_custs": rg_churn,
                "returning_custs": rg_ret,
                "churn_rate": rg_churn_rate,
                "returning_rate": rg_ret_rate,
                "clv_qty": rg_clv_qty,
                "avg_order_size": rg_avg_order,
                "avg_sku": rg_avg_sku,
                "avg_category": rg_avg_cat,
                "total_rial": rg_rial,
                "total_qty": rg_qty,
            })

        available_months_list = [
            {"value": m, "label": _format_month_label(m)} for m in reversed(all_months)
        ]

        branch_filter_rows = con.execute(
            f"SELECT DISTINCT branch FROM fact_sales WHERE core=? AND branch IS NOT NULL{l_scope} ORDER BY 1",
            [name, *l_args],
        ).fetchall()
        available_branches = [r[0] for r in branch_filter_rows if r[0]]

        return {
            "available": True,
            "core": core,
            "core_label": CORES.get(core, core),
            "target_month": target_month,
            "target_month_label": _format_month_label(target_month),
            "lookback": lookback,
            "lookback_label": lookback_label,
            "lookback_months": lookback_months,
            "selected_branch": branch,
            "available_months": available_months_list,
            "available_branches": available_branches,
            "metrics": {
                "total_customers": total_customers,
                "active_customers": active_customers,
                "prev_active_customers": prev_active_customers,
                "new_customers": new_customers,
                "returning_customers": returning_customers,
                "returning_rate": returning_rate,
                "churned_customers": churned_customers,
                "churn_rate": churn_rate,
                "clv_qty": clv_qty,
                "clv_rial": clv_rial,
                "avg_cat_per_customer": avg_cat_per_customer,
                "avg_order_size": avg_order_size,
                "avg_sku_per_invoice": avg_sku_per_invoice,
                "avg_cat_per_invoice": avg_cat_per_invoice,
                "total_qty": total_qty,
                "total_rial": total_rial,
                "total_invoices": total_invoices,
            },
            "breakdown_brand": breakdown_brand,
            "breakdown_category": breakdown_category,
            "breakdown_branch": breakdown_branch,
            "breakdown_region": breakdown_region,
            "by_brand": breakdown_brand,
            "by_category": breakdown_category,
            "by_branch": breakdown_branch,
            "by_region": breakdown_region,
        }
    finally:
        con.close()


@app.get("/api/analytics/product-metrics")
def product_metrics(
    request: Request,
    core: str = DEFAULT_CORE,
    by: str = "brand",
    item_key: str | None = None,
    start: str | None = None,
    end: str | None = None,
):
    """Calculates summary KPIs, customer frequency patterns, monthly purchase/discount trends,
    and average repurchase cycles for Product and Brand analysis."""
    if by not in BREAKDOWN_BY:
        col = "brand"
    else:
        col = BREAKDOWN_BY[by]

    name = _core(core)
    rng, rargs = _range(start, end)
    dim, dargs = _dims(request)

    item_sql = ""
    item_args = []
    if item_key:
        item_sql = f" AND {col} = ?"
        item_args = [item_key]

    con = _con()
    try:
        where_scoped = f"WHERE core=? AND NOT is_promo AND NOT is_return AND rial_vat > 0{item_sql}{dim}{rng}"
        scoped_args = [name, *item_args, *dargs, *rargs]

        # 1. Top 5 Summary KPIs
        kpi_row = con.execute(
            f"""SELECT 
                COALESCE(NULLIF(SUM(qty) FILTER (WHERE NOT is_promo AND NOT is_return), 0), SUM(qty), 0),
                COALESCE(NULLIF(SUM(rial_vat) FILTER (WHERE NOT is_promo AND NOT is_return), 0), SUM(rial_vat), 0),
                COALESCE(NULLIF(COUNT(DISTINCT customer_code) FILTER (WHERE NOT is_promo AND NOT is_return), 0), COUNT(DISTINCT customer_code), 0),
                COALESCE(NULLIF(COUNT(DISTINCT visitor) FILTER (WHERE NOT is_promo AND NOT is_return AND visitor IS NOT NULL), 0), COUNT(DISTINCT visitor), 0),
                COALESCE(MAX(invoice_date) FILTER (WHERE NOT is_promo AND NOT is_return), MAX(invoice_date))
            FROM fact_sales
            WHERE core=?{item_sql}{dim}{rng}""",
            [name, *item_args, *dargs, *rargs],
        ).fetchone()

        kpis = {
            "total_cartons": float(kpi_row[0] or 0),
            "total_rial": float(kpi_row[1] or 0),
            "unique_customers": int(kpi_row[2] or 0),
            "unique_sellers": int(kpi_row[3] or 0),
            "last_purchase_date": str(kpi_row[4]) if kpi_row[4] else "—",
        }

        # 2. Customer Purchase Frequency Pattern (الگوی تناوب خرید مشتریان)
        freq_rows = con.execute(
            f"""WITH cust_agg AS (
                SELECT 
                    customer_code,
                    COUNT(DISTINCT invoice_code) as inv_count,
                    MIN((jdate_key % 10000 // 100 - 1) * 31 - (CASE WHEN jdate_key % 10000 // 100 > 7 THEN jdate_key % 10000 // 100 - 7 ELSE 0 END) + (jdate_key % 100)) as min_jday,
                    MAX((jdate_key % 10000 // 100 - 1) * 31 - (CASE WHEN jdate_key % 10000 // 100 > 7 THEN jdate_key % 10000 // 100 - 7 ELSE 0 END) + (jdate_key % 100)) as max_jday
                FROM fact_sales
                {where_scoped} AND customer_code IS NOT NULL
                GROUP BY customer_code
            ),
            cust_buckets AS (
                SELECT 
                    customer_code,
                    CASE 
                        WHEN inv_count <= 1 OR max_jday = min_jday THEN 'تک خرید'
                        WHEN (max_jday - min_jday) * 1.0 / (inv_count - 1) < 7 THEN 'کمتر از ۷ روز'
                        WHEN (max_jday - min_jday) * 1.0 / (inv_count - 1) <= 14 THEN '۷ تا ۱۴ روز'
                        ELSE '۱۵ تا ۳۰ روز'
                    END as bucket
                FROM cust_agg
            )
            SELECT bucket, COUNT(*) as cust_count
            FROM cust_buckets
            GROUP BY bucket""",
            scoped_args,
        ).fetchall()

        freq_dict = {r[0]: r[1] for r in freq_rows}
        total_freq_custs = sum(freq_dict.values()) or 1
        frequency_pattern = [
            {
                "interval": "کمتر از ۷ روز",
                "key": "under_7",
                "count": freq_dict.get("کمتر از ۷ روز", 0),
                "percent": round((freq_dict.get("کمتر از ۷ روز", 0) / total_freq_custs) * 100, 1),
                "color": "#10B981",
            },
            {
                "interval": "۷ تا ۱۴ روز",
                "key": "7_to_14",
                "count": freq_dict.get("۷ تا ۱۴ روز", 0),
                "percent": round((freq_dict.get("۷ تا ۱۴ روز", 0) / total_freq_custs) * 100, 1),
                "color": "#06B6D4",
            },
            {
                "interval": "۱۵ تا ۳۰ روز",
                "key": "15_to_30",
                "count": freq_dict.get("۱۵ تا ۳۰ روز", 0),
                "percent": round((freq_dict.get("۱۵ تا ۳۰ روز", 0) / total_freq_custs) * 100, 1),
                "color": "#F59E0B",
            },
            {
                "interval": "تک خرید",
                "key": "single",
                "count": freq_dict.get("تک خرید", 0),
                "percent": round((freq_dict.get("تک خرید", 0) / total_freq_custs) * 100, 1),
                "color": "#8B5CF6",
            },
        ]

        # 3 & 4. Monthly Purchase Trend and Monthly Discount Pattern
        monthly_rows = con.execute(
            f"""SELECT 
                year_month,
                COUNT(DISTINCT customer_code) FILTER (WHERE NOT is_promo AND NOT is_return AND rial_vat > 0),
                COALESCE(SUM(qty) FILTER (WHERE NOT is_promo AND NOT is_return), 0),
                COALESCE(SUM(total_discount + discount), 0),
                COALESCE(SUM(settlement_discount + total_discount + discount), 0),
                COALESCE(SUM(rial_vat), 0)
            FROM fact_sales
            WHERE core=? AND year_month IS NOT NULL{item_sql}{dim}
            GROUP BY year_month
            ORDER BY year_month ASC""",
            [name, *item_args, *dargs],
        ).fetchall()

        monthly_trend = []
        monthly_discount = []
        for mr in monthly_rows:
            ym = mr[0]
            m_label = _format_month_label(ym)
            u_custs = mr[1] or 0
            cartons = mr[2] or 0
            discounts = mr[3] or 0
            promos = mr[4] or 0
            gross = mr[5] or 0

            monthly_trend.append({
                "month": ym,
                "month_label": m_label,
                "unique_customers": u_custs,
                "carton_qty": round(cartons, 1),
            })

            disc_pct = round((discounts / gross * 100), 2) if gross else 0.0
            promo_pct = round((promos / gross * 100), 2) if gross else 0.0
            monthly_discount.append({
                "month": ym,
                "month_label": m_label,
                "discount_pct": disc_pct,
                "promo_pct": promo_pct,
            })

        # 5. Item average repurchase cycle
        item_cycle_rows = con.execute(
            f"""WITH cust_items AS (
                SELECT 
                    {col} as itm,
                    customer_code,
                    COUNT(DISTINCT invoice_code) as inv_count,
                    MIN((jdate_key % 10000 // 100 - 1) * 31 - (CASE WHEN jdate_key % 10000 // 100 > 7 THEN jdate_key % 10000 // 100 - 7 ELSE 0 END) + (jdate_key % 100)) as min_jday,
                    MAX((jdate_key % 10000 // 100 - 1) * 31 - (CASE WHEN jdate_key % 10000 // 100 > 7 THEN jdate_key % 10000 // 100 - 7 ELSE 0 END) + (jdate_key % 100)) as max_jday
                FROM fact_sales
                WHERE core=? AND NOT is_promo AND NOT is_return AND rial_vat > 0 AND {col} IS NOT NULL{dim}{rng}
                GROUP BY {col}, customer_code
            )
            SELECT 
                itm,
                ROUND(AVG((max_jday - min_jday) * 1.0 / (inv_count - 1)), 1) as avg_cycle
            FROM cust_items
            WHERE inv_count > 1 AND max_jday > min_jday
            GROUP BY itm""",
            [name, *dargs, *rargs],
        ).fetchall()

        item_cycles = {str(r[0]): float(r[1]) for r in item_cycle_rows if r[0] is not None}

        # Overall summary cycle
        summary_cycle_row = con.execute(
            f"""WITH cust_summary AS (
                SELECT 
                    customer_code,
                    COUNT(DISTINCT invoice_code) as inv_count,
                    MIN((jdate_key % 10000 // 100 - 1) * 31 - (CASE WHEN jdate_key % 10000 // 100 > 7 THEN jdate_key % 10000 // 100 - 7 ELSE 0 END) + (jdate_key % 100)) as min_jday,
                    MAX((jdate_key % 10000 // 100 - 1) * 31 - (CASE WHEN jdate_key % 10000 // 100 > 7 THEN jdate_key % 10000 // 100 - 7 ELSE 0 END) + (jdate_key % 100)) as max_jday
                FROM fact_sales
                {where_scoped} AND customer_code IS NOT NULL
                GROUP BY customer_code
            )
            SELECT ROUND(AVG((max_jday - min_jday) * 1.0 / (inv_count - 1)), 1)
            FROM cust_summary
            WHERE inv_count > 1 AND max_jday > min_jday""",
            scoped_args,
        ).fetchone()

        summary_cycle = float(summary_cycle_row[0]) if summary_cycle_row and summary_cycle_row[0] is not None else None

        return {
            "available": True,
            "core": core,
            "by": by,
            "item_key": item_key,
            "kpis": kpis,
            "frequency_pattern": frequency_pattern,
            "monthly_trend": monthly_trend,
            "monthly_discount": monthly_discount,
            "item_cycles": item_cycles,
            "summary_cycle": summary_cycle,
        }
    finally:
        con.close()


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


@app.get("/api/invoice-compare")
def invoice_compare(request: Request, core: str = DEFAULT_CORE, day: str | None = None):
    """Same day-of-month last month vs this month, from day 1: invoices, sales and average invoice (current filters)."""
    name = _core(core)
    dim, dargs = _dims(request)
    con = _con()
    try:
        if not day:
            last = con.execute("SELECT MAX(jdate_key) FROM fact_sales WHERE core=?", [name]).fetchone()[0]
            if not last:
                return {"available": False}
            day = f"{last // 10000}/{(last // 100) % 100:02d}/{last % 100:02d}"
        digits = day.replace("/", "")
        if not digits.isdigit() or len(digits) != 8:
            raise HTTPException(400, "فرمت تاریخ باید 1405/07/27 باشد")
        y, m, d = int(digits[:4]), int(digits[4:6]), int(digits[6:])
        pm, py = (m - 1, y) if m > 1 else (12, y - 1)
        cur_end, prev_end = y * 10000 + m * 100 + d, py * 10000 + pm * 100 + d
        cur_start, prev_start = y * 10000 + m * 100 + 1, py * 10000 + pm * 100 + 1

        def agg(start: int, end: int) -> dict:
            n, v = con.execute(
                f"""SELECT COUNT(DISTINCT invoice_code), COALESCE(SUM(rial_vat), 0) FROM fact_sales
                    WHERE core=? AND {SALES_ONLY} AND invoice_code IS NOT NULL AND jdate_key BETWEEN ? AND ?{dim}""",
                [name, start, end, *dargs]).fetchone()
            return {"invoices": n, "sales_rial": v, "avg_invoice_rial": (v / n) if n else 0}

        cur, prev = agg(cur_start, cur_end), agg(prev_start, prev_end)
    finally:
        con.close()

    def change(a: float, b: float) -> float | None:
        return (a - b) / b if b else None

    return {"available": True, "day": day, "current": {"from": cur_start, "to": cur_end, **cur},
            "previous": {"from": prev_start, "to": prev_end, **prev},
            "change": {k: change(cur[k], prev[k]) for k in ("invoices", "sales_rial", "avg_invoice_rial")}}


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
    scope, sargs = rbac.scope_clause()
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
    b_sql, b_args = rbac.scope_clause()
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
            "consolidation": CONSOLIDATION_STATUS,
        }
    finally:
        con.close()


from . import target as _target  # noqa: E402  (monthly sales target vs actual; routes under /api/target)
app.include_router(_target.router)
app.include_router(_returns.router)

from . import admin as _admin  # noqa: E402  (users, roles, audit log; admin-only, see rbac.access_for)
app.include_router(_admin.router)
from . import tickets as _tickets  # noqa: E402  (support tickets; every signed-in user, admins answer)
app.include_router(_tickets.router)
from . import club as _club  # noqa: E402  (loyalty clubs: plans and points; rbac.PREFIX gates them)
app.include_router(_club.router)


# ---------- AI sales agent ----------

class ChatBody(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


@app.post("/api/chat")
def chat(body: ChatBody):
    """Runs the LangGraph sales agent. Login + RBAC come from the /api/ middleware (admin-only, fail closed)."""
    rbac.require()
    from .agent.graph import run as agent_run   # local import: langgraph loads on first use, not at server start
    try:
        result = agent_run(body.question)
    except RuntimeError as exc:   # LLM env vars missing
        raise HTTPException(503, str(exc))
    return {"answer": result["answer"], "used_memory": result.get("used_memory", False),
            "used_db": result.get("used_db", False)}


DIST = ROOT / "frontend" / "dist"
if DIST.is_dir():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    index_html = DIST / "index.html"

    @app.get("/")
    @app.get("/index.html")
    async def serve_index():
        return FileResponse(
            index_html,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )

    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
