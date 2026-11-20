"""Customer (B2B) and visitor loyalty clubs: plan definitions and points computed from the sales data.

Plans and point snapshots live in club_store (club.duckdb). Sales are read from fact_sales through the read-only sales
connection, so the existing ingest and reports are untouched. Access is enforced by the /api/ middleware via rbac.PREFIX
("/api/club/b2b" -> club_b2b, "/api/club/visitor" -> club_visitor); admins reach everything.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError

from . import club_ladder_report, club_store, rbac
from .club_ladder import LadderConfig
from .config import DB_PATH, DEFAULT_CORE
from .db import connect
from .jalali import days_in_jalali_month, gregorian_to_jalali, jalali_to_gregorian
from .target import TARGET_CORES, _table_exists

router = APIRouter(prefix="/api/club")

# Base filters and SQL aggregates for net sales (deducting returns, ignoring promos)
BASE_SALES = "NOT is_promo"
ACTIVE_SALES = "NOT is_promo AND NOT is_return"
NET_RIAL_SQL = "COALESCE(SUM(CASE WHEN is_return THEN -ABS(rial_vat) ELSE ABS(rial_vat) END), 0)"
NET_QTY_SQL = "COALESCE(SUM(CASE WHEN is_return THEN -ABS(qty) ELSE ABS(qty) END), 0)"


def _con():
    from .api import _con as sales_con   # late import: api.py is still loading when this module is imported
    return sales_con()


def _core(core: str) -> str:
    from .api import _core as sales_core
    return sales_core(core)


KINDS = {"b2b": "customer_code", "visitor": "visitor_code"}


def _first_message(exc: ValidationError) -> str:
    """The first Pydantic error without its "Value error, " prefix, so the Persian validator text reaches the user."""
    return exc.errors()[0]["msg"].removeprefix("Value error, ")


class Rule(BaseModel):
    """One scoring parameter: every `ratio` units of `metric` in the matched rows are worth `factor` points.
    metric: rial = net sales rial, qty = net qty, lines = invoice lines, customers = distinct customers.
    Optional filters narrow the rows: brand, main_group, or only customers whose first purchase is inside the window."""
    label: str = Field("", max_length=120)
    metric: str = Field(pattern="^(rial|qty|lines|customers)$")
    ratio: float = Field(gt=0)
    factor: float = Field(ge=0)
    brand: str | None = Field(None, max_length=120)
    main_group: str | None = Field(None, max_length=120)
    new_customers: bool = False


class PlanBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    core: str = Field(DEFAULT_CORE, max_length=4)
    start_key: int = Field(ge=14000101, le=99991231)
    end_key: int = Field(ge=14000101, le=99991231)
    # Linear plans score rial / rial_per_point; a ladder plan scores weighted KPIs and leaves the rate at 0.
    rial_per_point: float = Field(0, ge=0)
    target_points: int | None = Field(None, ge=0)
    tier_points: list[int] | str | int | None = None
    # Multi-metric scoring, as in the company's gamification workbook: each rule scores one metric of the rows it
    # matches. Empty -> the simple rule "net sales rial / rial_per_point".
    rules: list[Rule] = Field(default_factory=list)
    # Ladder plans are validated in the route so a bad config answers 400 with the Persian validator text, not 422.
    plan_type: Literal["linear", "ladder"] = "linear"
    config: dict | None = None


def _plans(kind: str) -> list[dict]:
    con = club_store.connect()
    try:
        rows = con.execute("SELECT id, name, core, start_key, end_key, rial_per_point, active, created_at, "
                           "target_points, tier_points, rules, plan_type, config FROM plans WHERE kind=? ORDER BY id",
                           [kind]).fetchall()
    finally:
        con.close()
    keys = ("id", "name", "core", "start_key", "end_key", "rial_per_point", "active", "created_at",
            "target_points", "tier_points", "rules", "plan_type", "config")
    out = []
    for r in rows:
        plan = dict(zip(keys, r))
        plan["rules"] = json.loads(plan["rules"]) if plan.get("rules") else []
        plan["plan_type"] = plan["plan_type"] or "linear"
        plan["config"] = json.loads(plan["config"]) if plan.get("config") else None
        if plan.get("tier_points") and isinstance(plan["tier_points"], str):
            try:
                plan["tier_points"] = json.loads(plan["tier_points"])
            except Exception:
                pass
        out.append(plan)
    return out


def _plan_options(plans: list[dict], today: int | None = None) -> list[dict]:
    """Current active plans first, then upcoming plans, then the most recent archive."""
    if today is None:
        y, m, d = gregorian_to_jalali(datetime.now().date())
        today = y * 10000 + m * 100 + d
    options = [{**p, "status": ("inactive" if not p["active"] else
                "upcoming" if p["start_key"] > today else
                "archived" if p["end_key"] < today else "current")} for p in plans]
    priority = {"current": 0, "upcoming": 1, "archived": 2, "inactive": 3}
    return sorted(options, key=lambda p: (priority[p["status"]],
                  p["start_key"] if p["status"] == "upcoming" else -p["start_key"], -p["id"]))


def _sales_by_code(kind: str, core: str, start: int, end: int) -> dict[str, tuple[str, float]]:
    """code -> (display name, net sales rial) for one core inside a Jalali date-key window."""
    col = KINDS[kind]
    name_col = "customer_name" if kind == "b2b" else "visitor"
    sales = _con()
    try:
        rows = sales.execute(
            f"SELECT {col}, MODE({name_col}), {NET_RIAL_SQL} FROM fact_sales "
            f"WHERE core=? AND {col} IS NOT NULL AND {BASE_SALES} AND jdate_key >= ? AND jdate_key <= ? GROUP BY 1",
            [_core(core), start, end]).fetchall()
    finally:
        sales.close()
    return {r[0]: (r[1] or r[0], float(r[2])) for r in rows}


def _rule_where(rule: dict) -> tuple[str, list]:
    sql, args = "", []
    if rule.get("brand"):
        sql += " AND brand = ?"; args.append(rule["brand"])
    if rule.get("main_group"):
        sql += " AND main_group = ?"; args.append(rule["main_group"])
    return sql, args


def _metric_value(con, metric: str, core: str, col: str, start: int, end: int, where: str, args: list):
    base = f"FROM fact_sales WHERE core=? AND {col} IS NOT NULL AND jdate_key>=? AND jdate_key<=?{where}"
    qargs = [core, start, end, *args]
    if metric == "customers":
        return con.execute(f"SELECT {col}, COUNT(DISTINCT customer_code) {base} AND {ACTIVE_SALES} GROUP BY 1", qargs).fetchall()
    if metric == "lines":
        return con.execute(f"SELECT {col}, COUNT(DISTINCT invoice_code || '|' || row_id) {base} AND {ACTIVE_SALES} GROUP BY 1", qargs).fetchall()
    if metric == "qty":
        return con.execute(f"SELECT {col}, {NET_QTY_SQL} {base} AND {BASE_SALES} GROUP BY 1", qargs).fetchall()
    # rial
    return con.execute(f"SELECT {col}, {NET_RIAL_SQL} {base} AND {BASE_SALES} GROUP BY 1", qargs).fetchall()


def _scores(plan: dict, kind: str) -> dict[str, dict]:
    """code -> {name, sales_rial, points, breakdown} for a plan, honouring net sales and gamification rules."""
    if plan.get("plan_type") == "ladder":   # no rial_per_point; the ladder report scores these plans
        return {}
    col = KINDS[kind]
    name_col = "customer_name" if kind == "b2b" else "visitor"
    core = _core(plan["core"])
    rules = plan.get("rules") or []
    con = _con()
    try:
        names = {r[0]: r[1] for r in con.execute(
            f"SELECT {col}, MODE({name_col}) FROM fact_sales WHERE core=? AND {col} IS NOT NULL GROUP BY 1", [core]).fetchall()}
        sales = {r[0]: float(r[1]) for r in con.execute(
            f"SELECT {col}, {NET_RIAL_SQL} FROM fact_sales WHERE core=? AND {col} IS NOT NULL AND {BASE_SALES} "
            f"AND jdate_key>=? AND jdate_key<=? GROUP BY 1", [core, plan["start_key"], plan["end_key"]]).fetchall()}
        if not rules:
            price = plan["rial_per_point"]
            return {c: {"name": names.get(c, c), "sales_rial": v, "points": max(0, int(v // price)), "breakdown": []}
                    for c, v in sales.items() if v != 0}

        # New-customer rules count only customers whose first active purchase in this core falls inside the window.
        new_codes = {r[0] for r in con.execute(
            f"SELECT {col} FROM fact_sales WHERE core=? AND {col} IS NOT NULL AND {ACTIVE_SALES} "
            f"GROUP BY 1 HAVING MIN(jdate_key) >= ? AND MIN(jdate_key) <= ?",
            [core, plan["start_key"], plan["end_key"]]).fetchall()}
        out: dict[str, dict] = {}
        for c, v in sales.items():
            out[c] = {"name": names.get(c, c), "sales_rial": v, "points": 0, "breakdown": []}

        for rule in rules:
            where, args = _rule_where(rule)
            for code, raw in _metric_value(con, rule["metric"], core, col, plan["start_key"], plan["end_key"], where, args):
                if rule.get("new_customers") and code not in new_codes:
                    continue
                raw_val = float(raw or 0)
                pts = max(0, int(raw_val // rule["ratio"] * rule["factor"]))
                if not pts:
                    continue
                row = out.setdefault(code, {"name": names.get(code, code), "sales_rial": sales.get(code, 0.0),
                                            "points": 0, "breakdown": []})
                row["points"] = max(0, row["points"] + pts)
                row["breakdown"].append({"label": rule["label"] or rule["metric"], "points": pts})
        return out
    finally:
        con.close()


def _compute(plan: dict, kind: str) -> list[dict]:
    out = [{"code": c, **v} for c, v in _scores(plan, kind).items()]
    out.sort(key=lambda r: r["points"], reverse=True)
    return out


def _routes(kind: str) -> None:
    base = f"/{kind}"

    @router.get(f"{base}/plans")
    def list_plans(request: Request):
        plans = _plans(kind)
        core = request.query_params.get("core")
        if core:
            _core(core)
            plans = [p for p in plans if p["core"] == core]
        return {"plans": _plan_options(plans)}

    @router.post(f"{base}/plans", status_code=201)
    def create_plan(body: PlanBody):
        principal = rbac.require()
        if not principal.is_admin:
            raise HTTPException(403, "فقط مدیر می‌تواند طرح بسازد")
        if body.end_key < body.start_key:
            raise HTTPException(400, "تاریخ پایان باید بعد از تاریخ شروع باشد")
        try:
            for key in (body.start_key, body.end_key):
                jalali_to_gregorian(key // 10000, key // 100 % 100, key % 100)
        except ValueError:
            raise HTTPException(400, "تاریخ جلالی طرح نامعتبر است")
        _core(body.core)
        if body.plan_type == "ladder":
            if kind != "visitor":
                raise HTTPException(400, "نردبان تحقق فقط برای باشگاه ویزیتورها")
            if body.config is None:
                raise HTTPException(400, "پیکربندی نردبان لازم است")
            try:
                cfg = LadderConfig.model_validate(body.config)
            except ValidationError as exc:
                raise HTTPException(400, _first_message(exc))
            end_y, end_m = body.end_key // 10000, body.end_key // 100 % 100
            if body.start_key % 100 != 1 or body.end_key % 100 != days_in_jalali_month(end_y, end_m):
                raise HTTPException(400, "بازه طرح نردبان باید ماه کامل باشد")
            config_json = json.dumps(cfg.model_dump(), ensure_ascii=False)
        else:
            if body.rial_per_point <= 0:
                raise HTTPException(400, "امتیاز به ازای ریال باید بزرگ‌تر از صفر باشد")
            config_json = None
        tp_str = json.dumps(body.tier_points) if isinstance(body.tier_points, (list, dict)) else str(body.tier_points) if body.tier_points is not None else None
        with club_store.write_lock:
            con = club_store.connect()
            try:
                new_id = con.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM plans").fetchone()[0]
                # Named columns: _migrate appends plan_type/config to files created before they existed, so the
                # physical column count and order differ between a fresh and a migrated club.duckdb.
                con.execute(
                    "INSERT INTO plans (id, kind, name, core, start_key, end_key, rial_per_point, active, created_at, "
                    "target_points, tier_points, rules, plan_type, config) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [new_id, kind, body.name, body.core, body.start_key, body.end_key, body.rial_per_point,
                     True, datetime.now().isoformat(timespec="seconds"), body.target_points, tp_str,
                     json.dumps([r.model_dump() for r in body.rules], ensure_ascii=False) if body.rules else None,
                     body.plan_type, config_json])
            finally:
                con.close()
        rbac.audit(principal.user, "club.plan.create", "club_plan", str(new_id), {"kind": kind, "name": body.name})
        return {"id": new_id}

    @router.delete(f"{base}/plans/{{plan_id}}")
    def delete_plan(plan_id: int):
        principal = rbac.require()
        if not principal.is_admin:
            raise HTTPException(403, "فقط مدیر می‌تواند طرح را حذف کند")
        with club_store.write_lock:
            con = club_store.connect()
            try:
                found = con.execute("SELECT COUNT(*) FROM plans WHERE id=? AND kind=?", [plan_id, kind]).fetchone()[0]
                if not found:
                    raise HTTPException(404, "طرح پیدا نشد")
                con.execute("DELETE FROM points WHERE plan_id=? AND kind=?", [plan_id, kind])
                con.execute("DELETE FROM plans WHERE id=? AND kind=?", [plan_id, kind])
            finally:
                con.close()
        rbac.audit(principal.user, "club.plan.delete", "club_plan", str(plan_id), {"kind": kind})
        return {"ok": True}

    @router.get(f"{base}/points")
    def points(plan_id: int):
        principal = rbac.require()
        own_code = None
        if not principal.is_admin:
            link = _link_for(principal.user)
            if link is None or link[0] != kind:
                raise HTTPException(403, "فقط داده خودتان")
            own_code = link[1]
        plan = next((x for x in _plans(kind) if x["id"] == plan_id), None)
        if plan is None:
            raise HTTPException(404, "طرح پیدا نشد")
        if plan.get("plan_type") == "ladder":
            unavailable = _ladder_unavailable(plan)
            if unavailable:
                return unavailable
            board = club_ladder_report.leaderboard(plan)
            if own_code is not None:
                board = {**board, "rows": [r for r in board["rows"] if r["code"] == own_code]}
            return board
        rows = _compute(plan, kind)
        if own_code is not None:
            rows = [r for r in rows if r["code"] == own_code]
        return {"plan": plan, "rows": rows}


def _month_windows(start: int, end: int) -> list[tuple[str, int, int]]:
    """(YYYYMM, first key, last key) for every Jalali month the window touches. Months are 31/31/.../30 days."""
    sy, sm, sd = start // 10000, start // 100 % 100, start % 100
    ey, em = end // 10000, end // 100 % 100
    out, y, m = [], sy, sm
    while (y, m) <= (ey, em):
        days = 31 if m <= 6 else 30
        first, last = y * 10000 + m * 100 + 1, y * 10000 + m * 100 + days
        out.append((f"{y:04d}{m:02d}", max(first, first if (y, m) != (sy, sm) else start),
                    min(last, last if (y, m) != (ey, em) else end)))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _monthly_points(plan: dict, kind: str, code: str) -> list[dict]:
    """Points earned per month. Each month's points = cumulative points at month end minus the previous month's, so the
    months add up exactly to the plan total (floors are applied on the running sum, never per month)."""
    if plan.get("plan_type") == "ladder":
        return []
    rate = plan["rial_per_point"]
    rows, cumulative_sales, prev_points = [], 0.0, 0
    for key, first, last in _month_windows(plan["start_key"], plan["end_key"]):
        got = _sales_by_code(kind, plan["core"], first, last).get(code)
        m_sales = got[1] if got else 0.0
        cumulative_sales += m_sales
        points = max(0, int(cumulative_sales // rate))
        month_pts = max(0, points - prev_points)
        rows.append({"month": key, "sales_rial": m_sales, "points": month_pts,
                     "cumulative_points": points})
        prev_points = points
    return rows


def _plan_thresholds(plan: dict) -> list[int] | None:
    raw = plan.get("tier_points")
    if raw is not None:
        if isinstance(raw, str):
            raw = raw.strip()
            if raw.startswith("["):
                try:
                    vals = json.loads(raw)
                    if isinstance(vals, list) and len(vals) == 4:
                        return [int(v) for v in vals]
                except Exception:
                    pass
            elif raw.isdigit():
                val = int(raw)
                return [max(1, int(round(val * f))) for f in (0.25, 0.50, 0.75, 1.0)]
        elif isinstance(raw, (list, tuple)) and len(raw) == 4:
            return [int(v) for v in raw]
        elif isinstance(raw, (int, float)) and raw > 0:
            return [max(1, int(round(raw * f))) for f in (0.25, 0.50, 0.75, 1.0)]

    target = plan.get("target_points")
    if target and target > 0:
        return [max(1, int(round(target * f))) for f in (0.25, 0.50, 0.75, 1.0)]
    return None


def _tier(points: int, plan: dict) -> dict:
    """Progress toward target or tier thresholds with 4 gamification levels."""
    points = max(0, int(points))
    target = plan.get("target_points") or 0
    thresholds = _plan_thresholds(plan)
    tiers = ("پله ۱", "پله ۲", "پله ۳", "پله ۴")

    if thresholds and len(thresholds) == 4:
        t1, t2, t3, t4 = thresholds
        if points < t1:
            step = 0
            next_level = "پله ۲"
            points_needed = t1 - points
        elif points < t2:
            step = 1
            next_level = "پله ۳"
            points_needed = t2 - points
        elif points < t3:
            step = 2
            next_level = "پله ۴"
            points_needed = t3 - points
        else:
            step = 3
            next_level = None
            points_needed = max(0, t4 - points) if points < t4 else 0

        max_target = t4
        progress = min(round(points / max_target, 2), 1.0) if max_target > 0 else 1.0
        points_needed_label = f"{points_needed:,} امتیاز تا {next_level}" if (next_level and points_needed > 0) else "بالاترین سطح"
        return {
            "level": tiers[step],
            "step": step,
            "target_points": target or t4,
            "progress": progress,
            "thresholds": thresholds,
            "points_needed": points_needed,
            "next_level": next_level,
            "points_needed_label": points_needed_label,
        }

    return {
        "level": "پله ۱",
        "step": 0,
        "target_points": target,
        "progress": None,
        "thresholds": None,
        "points_needed": 0,
        "next_level": None,
        "points_needed_label": "بدون سقف امتیاز",
    }


def _link_for(username: str) -> tuple[str, str] | None:
    con = club_store.connect()
    try:
        row = con.execute("SELECT kind, code FROM member_links WHERE username=?", [username]).fetchone()
    finally:
        con.close()
    return (row[0], row[1]) if row else None


NOT_LOADED_REASON = "هنوز هیچ تارگتی بارگذاری نشده است."


def _ladder_unavailable(plan: dict) -> dict | None:
    """The degraded answer a ladder plan needs, or None when both the target and the sales data are present.

    Mirrors the Target page: an unsupported core and an absent (or empty) fact_target answer `available: False`, a
    missing sales database is a 503, and no raw DuckDB error ever reaches the client. The gate also guarantees
    fact_sales exists before the ladder data loader calls MAX(jdate_key) on it.
    """
    if plan["core"] not in TARGET_CORES:
        return {"available": False, "months": [], "rows": [], "reason": "تارگت این هسته هنوز تعریف نشده است."}
    if not DB_PATH.exists():
        raise HTTPException(503, "پایگاه داده هنوز ساخته نشده است")
    con = connect(read_only=True)
    try:
        loaded = _table_exists(con, "fact_target") and con.execute(
            "SELECT COUNT(*) FROM fact_target").fetchone()[0]
        if not loaded or not _table_exists(con, "fact_sales"):
            return {"available": False, "months": [], "rows": [], "reason": NOT_LOADED_REASON}
    finally:
        con.close()
    return None


@router.get("/visitor/scorecard")
def visitor_scorecard(plan_id: int, code: str, month: str | None = None):
    """One visitor's ladder scorecard. An admin reads any code; a linked club account only its own."""
    p = rbac.require()
    if not p.is_admin and _link_for(p.user) != ("visitor", code):
        raise HTTPException(403, "فقط کارنامه خودتان")
    plan = next((x for x in _plans("visitor") if x["id"] == plan_id), None)
    if plan is None:
        raise HTTPException(404, "طرح پیدا نشد")
    if plan.get("plan_type") != "ladder":
        raise HTTPException(400, "این طرح نردبان نیست")
    if month is not None and month not in club_ladder_report.plan_months(plan):
        raise HTTPException(400, "ماه انتخاب‌شده خارج از بازه طرح است")
    unavailable = _ladder_unavailable(plan)
    if unavailable:
        return unavailable
    return club_ladder_report.scorecard(plan, code, month)


def _ladder_member_view(plan: dict, code: str, month: str | None = None) -> dict:
    """Member-facing summary of a ladder plan: the same keys a linear plan returns, plus the full scorecard."""
    unavailable = _ladder_unavailable(plan)
    if unavailable is not None:
        return {"points": 0, "sales_rial": 0.0, "breakdown": [], "history": [], "scorecard": None,
                "unavailable_reason": unavailable["reason"],
                "tier": {"level": None, "step": 0, "rank_national": None, "rank_branch": None, "prize": None,
                         "points_needed_label": "هنوز داده‌ای بارگذاری نشده است"}}
    sc = club_ladder_report.scorecard(plan, code, month)
    history = [{"month": m, "points": round(v, 2), "provisional": False} for m, v in sorted(sc["months"].items())]
    if sc["provisional_month"]:
        history.append({"month": sc["provisional_month"]["month"],
                        "points": round(sc["provisional_month"]["score"], 2), "provisional": True})
    return {"points": round(sc["total"], 2), "sales_rial": sc["sales_rial"],
            "breakdown": [{"label": k["label"], "points": round(k["weighted"], 2)} for k in sc["kpis"]],
            "history": history, "scorecard": {**sc, "history": history},
            "tier": {"level": sc["grade"], "step": 0, "rank_national": sc["rank_national"],
                     "rank_branch": sc["rank_branch"], "prize": sc["prize"],
                     "points_needed_label": f"رتبه کشوری {sc['rank_national']}"}}


@router.get("/me")
def my_club():
    """The signed-in user's own club data: the linked code's points on every plan of its club, nothing else."""
    p = rbac.require()
    link = _link_for(p.user)
    if link is None:
        raise HTTPException(404, "این حساب به هیچ کد باشگاه متصل نیست")
    kind, code = link
    plans = []
    for plan in _plans(kind):
        if plan.get("plan_type") == "ladder":
            plans.append({"plan": plan, **_ladder_member_view(plan, code)})
            continue
        mine = _scores(plan, kind).get(code)
        points = mine["points"] if mine else 0
        plans.append({"plan": plan, "points": points, "sales_rial": mine["sales_rial"] if mine else 0.0,
                      "breakdown": mine["breakdown"] if mine else [],
                      "tier": _tier(points, plan), "history": _monthly_points(plan, kind, code)})
    name = _sales_by_code(kind, plans[0]["plan"]["core"], plans[0]["plan"]["start_key"],
                          plans[0]["plan"]["end_key"]).get(code, (code, 0))[0] if plans else code
    return {"kind": kind, "code": code, "name": name, "plans": plans}


def _prev_customers(plan: dict, visitor_code: str) -> int:
    """Distinct buyers this visitor had in the whole month before the plan's current month."""
    windows = _month_windows(plan["start_key"], plan["end_key"])
    if not windows:
        return 0
    month = windows[-1][0]
    y, m = int(month[:4]), int(month[4:])
    y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    from .jalali import days_in_jalali_month
    first, last = y * 10000 + m * 100 + 1, y * 10000 + m * 100 + days_in_jalali_month(y, m)
    con = _con()
    try:
        return con.execute(
            f"SELECT COUNT(DISTINCT customer_code) FROM fact_sales WHERE core=? AND visitor_code=? "
            f"AND customer_code IS NOT NULL AND {ACTIVE_SALES} AND jdate_key>=? AND jdate_key<=?",
            [_core(plan["core"]), visitor_code, first, last]).fetchone()[0] or 0
    finally:
        con.close()


def _team(plan: dict, visitor_code: str) -> list[dict]:
    """Customers whose rows carry this visitor code, with net sales, points, and tier distance."""
    if plan.get("plan_type") == "ladder":
        return []
    price = plan["rial_per_point"]
    sales = _con()
    try:
        rows = sales.execute(
            f"SELECT customer_code, MODE(customer_name), {NET_RIAL_SQL} FROM fact_sales "
            f"WHERE core=? AND visitor_code=? AND customer_code IS NOT NULL AND {BASE_SALES} "
            f"AND jdate_key >= ? AND jdate_key <= ? GROUP BY 1 ORDER BY 3 DESC",
            [_core(plan["core"]), visitor_code, plan["start_key"], plan["end_key"]]).fetchall()
    finally:
        sales.close()
    out = []
    for i, (code, name, rial) in enumerate(rows, 1):
        net_rial = float(rial or 0)
        if net_rial <= 0:
            continue
        pts = max(0, int(net_rial // price))
        t = _tier(pts, plan)
        out.append({
            "rank": i,
            "code": code,
            "name": name or code,
            "sales_rial": net_rial,
            "points": pts,
            "tier": t,
            "points_to_next_tier": t.get("points_needed", 0),
            "next_tier": t.get("next_level") or "بالاترین سطح",
        })
    return out


@router.get("/visitor/team")
def my_team(plan_id: int | None = None, month: str | None = None):
    """The visitor's own progress (matching admin view) plus customer portfolio leaderboard."""
    p = rbac.require()
    link = _link_for(p.user)
    if link is None or link[0] != "visitor":
        raise HTTPException(403, "این صفحه فقط برای حساب ویزیتور است")
    code = link[1]
    plans = _plan_options(_plans("visitor"))
    plan = next((x for x in plans if x["id"] == plan_id), None) if plan_id is not None else (plans[0] if plans else None)
    if plan_id is not None and plan is None:
        raise HTTPException(404, "طرح پیدا نشد")
    if plan is None:
        empty_summary = {"code": code, "name": code, "points": 0, "sales_rial": 0.0, "breakdown": [],
                         "tier": None, "history": [], "customers_count": 0}
        return {"code": code, "plan": None, "visitor_summary": empty_summary, "portfolio_customers": [],
                "team": [], "points": 0, "sales_rial": 0.0, "tier": None, "customers": 0, "history": []}

    if plan.get("plan_type") == "ladder":
        if month is not None and month not in club_ladder_report.plan_months(plan):
            raise HTTPException(400, "ماه انتخاب‌شده خارج از بازه طرح است")
        v = _ladder_member_view(plan, code, month)
        sc = v["scorecard"]
        summary = {"code": code, "name": sc["name"] if sc else code, "points": v["points"], "sales_rial": sc["sales_rial"] if sc else None,
                   "breakdown": v["breakdown"], "tier": v["tier"], "history": v["history"], "customers_count": sc["customers_count"] if sc else None}
        months_list = [{"month": m} for m in club_ladder_report.plan_months(plan)]
        return {"visitor_summary": summary, "portfolio_customers": [], "code": code, "plan": plan,
                "points": v["points"], "sales_rial": summary["sales_rial"], "breakdown": v["breakdown"], "tier": v["tier"],
                "team": [], "customers": summary["customers_count"], "history": v["history"], "scorecard": sc, "months": months_list,
                "plans": plans, "unavailable_reason": v.get("unavailable_reason")}

    # Unified Visitor Summary (aggregated across visitor_code directly with gamification rules)
    v_score = _scores(plan, "visitor").get(code, {})
    v_points = v_score.get("points", 0)
    v_sales = v_score.get("sales_rial", 0.0)
    v_name = v_score.get("name", code)
    v_breakdown = v_score.get("breakdown", [])
    v_tier = _tier(v_points, plan)
    v_history = _monthly_points(plan, "visitor", code)

    # Customer Portfolio under this visitor
    portfolio = _team(plan, code)

    visitor_summary = {
        "code": code,
        "name": v_name,
        "points": v_points,
        "sales_rial": v_sales,
        "breakdown": v_breakdown,
        "tier": v_tier,
        "history": v_history,
        "customers_count": len(portfolio),
        "prev_customers_count": _prev_customers(plan, code),
    }

    return {
        "plans": plans,
        "visitor_summary": visitor_summary,
        "portfolio_customers": portfolio,
        # Backwards-compatible top-level keys
        "code": code,
        "plan": plan,
        "points": v_points,
        "sales_rial": v_sales,
        "breakdown": v_breakdown,
        "tier": v_tier,
        "team": portfolio,
        "customers": len(portfolio),
        "history": v_history,
    }


class LinkBody(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    kind: str = Field(pattern="^(b2b|visitor)$")
    code: str = Field(min_length=1, max_length=40)


@router.put("/link")
def link_account(body: LinkBody):
    """Admin only (rbac.access_for sends /api/admin paths to admins; this path is admin via is_admin in the caller)."""
    p = rbac.require()
    if not p.is_admin:
        raise HTTPException(403, "فقط مدیر می‌تواند حساب را به کد باشگاه متصل کند")
    with club_store.write_lock:
        con = club_store.connect()
        try:
            con.execute("DELETE FROM member_links WHERE username=?", [body.username])
            con.execute("INSERT INTO member_links VALUES (?,?,?,?)",
                        [body.username, body.kind, body.code, datetime.now().isoformat(timespec="seconds")])
        finally:
            con.close()
    return {"ok": True}


def recompute_active_plans() -> int:
    """Recompute point snapshots for all active club plans in club.duckdb after a sales sync."""
    refreshed = 0
    for kind in ("b2b", "visitor"):
        for plan in _plans(kind):
            if plan.get("plan_type") == "ladder":
                continue   # no rial_per_point to divide by; its leaderboard is computed on read
            if plan.get("active"):
                try:
                    _compute(plan, kind)
                    refreshed += 1
                except Exception as exc:
                    logging.getLogger("club").warning("Failed to refresh club plan %s: %s", plan.get("id"), exc)
    return refreshed


_routes("b2b")
_routes("visitor")
