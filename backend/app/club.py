"""Customer (B2B) and visitor loyalty clubs: plan definitions and points computed from the sales data.

Plans and point snapshots live in club_store (club.duckdb). Sales are read from fact_sales through the read-only sales
connection, so the existing ingest and reports are untouched. Access is enforced by the /api/ middleware via rbac.PREFIX
("/api/club/b2b" -> club_b2b, "/api/club/visitor" -> club_visitor); admins reach everything.
"""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from . import club_store, rbac
from .config import DEFAULT_CORE

router = APIRouter(prefix="/api/club")
SALES_ONLY = "NOT is_promo AND NOT is_return"   # same definition as api.SALES_ONLY; api imports this module, so no import back


def _con():
    from .api import _con as sales_con   # late import: api.py is still loading when this module is imported
    return sales_con()


def _core(core: str) -> str:
    from .api import _core as sales_core
    return sales_core(core)
KINDS = {"b2b": "customer_code", "visitor": "visitor_code"}


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
    rial_per_point: float = Field(gt=0)
    target_points: int | None = Field(None, ge=0)
    tier_points: int | None = Field(None, ge=0)
    # Multi-metric scoring, as in the company's gamification workbook: each rule scores one metric of the rows it
    # matches. Empty -> the simple rule "net sales rial / rial_per_point".
    rules: list[Rule] = Field(default_factory=list)


def _plans(kind: str) -> list[dict]:
    con = club_store.connect()
    try:
        rows = con.execute("SELECT id, name, core, start_key, end_key, rial_per_point, active, created_at, "
                           "target_points, tier_points, rules FROM plans WHERE kind=? ORDER BY id", [kind]).fetchall()
    finally:
        con.close()
    keys = ("id", "name", "core", "start_key", "end_key", "rial_per_point", "active", "created_at",
            "target_points", "tier_points", "rules")
    out = []
    for r in rows:
        plan = dict(zip(keys, r))
        plan["rules"] = json.loads(plan["rules"]) if plan.get("rules") else []
        out.append(plan)
    return out


def _sales_by_code(kind: str, core: str, start: int, end: int) -> dict[str, tuple[str, float]]:
    """code -> (display name, net sales rial) for one core inside a Jalali date-key window."""
    col = KINDS[kind]
    name_col = "customer_name" if kind == "b2b" else "visitor"
    sales = _con()
    try:
        rows = sales.execute(
            f"SELECT {col}, MODE({name_col}), COALESCE(SUM(rial_vat), 0) FROM fact_sales "
            f"WHERE core=? AND {col} IS NOT NULL AND {SALES_ONLY} AND jdate_key >= ? AND jdate_key <= ? GROUP BY 1",
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
    base = f"FROM fact_sales WHERE core=? AND {col} IS NOT NULL AND {SALES_ONLY} AND jdate_key>=? AND jdate_key<=?{where}"
    qargs = [core, start, end, *args]
    if metric == "customers":
        return con.execute(f"SELECT {col}, COUNT(DISTINCT customer_code) {base} GROUP BY 1", qargs).fetchall()
    col_sql = {"rial": "COALESCE(SUM(rial_vat),0)", "qty": "COALESCE(SUM(qty),0)",
               "lines": "COUNT(DISTINCT invoice_code || '|' || row_id)"}[metric]
    return con.execute(f"SELECT {col}, {col_sql} {base} GROUP BY 1", qargs).fetchall()


def _scores(plan: dict, kind: str) -> dict[str, dict]:
    """code -> {name, sales_rial, points, breakdown} for a plan, honouring its rules when it has any."""
    col = KINDS[kind]
    name_col = "customer_name" if kind == "b2b" else "visitor"
    core = _core(plan["core"])
    rules = plan.get("rules") or []
    con = _con()
    try:
        names = {r[0]: r[1] for r in con.execute(
            f"SELECT {col}, MODE({name_col}) FROM fact_sales WHERE core=? AND {col} IS NOT NULL GROUP BY 1", [core]).fetchall()}
        sales = {r[0]: float(r[1]) for r in con.execute(
            f"SELECT {col}, COALESCE(SUM(rial_vat),0) FROM fact_sales WHERE core=? AND {col} IS NOT NULL AND {SALES_ONLY} "
            f"AND jdate_key>=? AND jdate_key<=? GROUP BY 1", [core, plan["start_key"], plan["end_key"]]).fetchall()}
        if not rules:
            price = plan["rial_per_point"]
            return {c: {"name": names.get(c, c), "sales_rial": v, "points": int(v // price), "breakdown": []}
                    for c, v in sales.items() if v > 0}
        # New-customer rules count only customers whose first purchase in this core falls inside the window.
        new_codes = {r[0] for r in con.execute(
            f"SELECT {col} FROM fact_sales WHERE core=? AND {col} IS NOT NULL AND {SALES_ONLY} "
            f"GROUP BY 1 HAVING MIN(jdate_key) >= ? AND MIN(jdate_key) <= ?",
            [core, plan["start_key"], plan["end_key"]]).fetchall()}
        out: dict[str, dict] = {}
        for rule in rules:
            where, args = _rule_where(rule)
            for code, raw in _metric_value(con, rule["metric"], core, col, plan["start_key"], plan["end_key"], where, args):
                if rule.get("new_customers") and code not in new_codes:
                    continue
                pts = int((raw or 0) // rule["ratio"] * rule["factor"])
                if not pts:
                    continue
                row = out.setdefault(code, {"name": names.get(code, code), "sales_rial": sales.get(code, 0.0),
                                            "points": 0, "breakdown": []})
                row["points"] += pts
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
        return {"plans": _plans(kind)}

    @router.post(f"{base}/plans", status_code=201)
    def create_plan(body: PlanBody):
        if body.end_key < body.start_key:
            raise HTTPException(400, "تاریخ پایان باید بعد از تاریخ شروع باشد")
        _core(body.core)
        with club_store.write_lock:
            con = club_store.connect()
            try:
                new_id = con.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM plans").fetchone()[0]
                con.execute("INSERT INTO plans VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                            [new_id, kind, body.name, body.core, body.start_key, body.end_key, body.rial_per_point,
                             True, datetime.now().isoformat(timespec="seconds"), body.target_points, body.tier_points,
                             json.dumps([r.model_dump() for r in body.rules], ensure_ascii=False) if body.rules else None])
            finally:
                con.close()
        return {"id": new_id}

    @router.get(f"{base}/points")
    def points(plan_id: int):
        plan = next((p for p in _plans(kind) if p["id"] == plan_id), None)
        if plan is None:
            raise HTTPException(404, "طرح پیدا نشد")
        rows = _compute(plan, kind)
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
    rate = plan["rial_per_point"]
    rows, cumulative_sales, prev_points = [], 0.0, 0
    for key, first, last in _month_windows(plan["start_key"], plan["end_key"]):
        got = _sales_by_code(kind, plan["core"], first, last).get(code)
        cumulative_sales += got[1] if got else 0.0
        points = int(cumulative_sales // rate)
        rows.append({"month": key, "sales_rial": got[1] if got else 0.0, "points": points - prev_points,
                     "cumulative_points": points})
        prev_points = points
    return rows


def _tier(points: int, plan: dict) -> dict:
    """Progress toward the plan's target (if any), plus a four-step level for gamification."""
    target = plan.get("target_points") or 0
    progress = min(points / target, 1.0) if target else None
    tiers = ("پله ۱", "پله ۲", "پله ۳", "پله ۴")
    step = 0 if not target else min(int(points / target * 4), 3) if points < target else 3
    return {"level": tiers[step], "step": step, "target_points": target, "progress": progress}


def _link_for(username: str) -> tuple[str, str] | None:
    con = club_store.connect()
    try:
        row = con.execute("SELECT kind, code FROM member_links WHERE username=?", [username]).fetchone()
    finally:
        con.close()
    return (row[0], row[1]) if row else None


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
        mine = _scores(plan, kind).get(code)
        points = mine["points"] if mine else 0
        plans.append({"plan": plan, "points": points, "sales_rial": mine["sales_rial"] if mine else 0.0,
                      "breakdown": mine["breakdown"] if mine else [],
                      "tier": _tier(points, plan), "history": _monthly_points(plan, kind, code)})
    name = _sales_by_code(kind, plans[0]["plan"]["core"], plans[0]["plan"]["start_key"],
                          plans[0]["plan"]["end_key"]).get(code, (code, 0))[0] if plans else code
    return {"kind": kind, "code": code, "name": name, "plans": plans}


def _team(plan: dict, visitor_code: str) -> list[dict]:
    """Customers whose rows carry this visitor code, with their points in the plan window (the visitor's portfolio)."""
    price = plan["rial_per_point"]
    sales = _con()
    try:
        rows = sales.execute(
            f"SELECT customer_code, MODE(customer_name), COALESCE(SUM(rial_vat), 0) FROM fact_sales "
            f"WHERE core=? AND visitor_code=? AND customer_code IS NOT NULL AND {SALES_ONLY} "
            f"AND jdate_key >= ? AND jdate_key <= ? GROUP BY 1 ORDER BY 3 DESC",
            [_core(plan["core"]), visitor_code, plan["start_key"], plan["end_key"]]).fetchall()
    finally:
        sales.close()
    out = []
    for i, (code, name, rial) in enumerate(rows, 1):
        if rial is None or rial <= 0:
            continue
        out.append({"rank": i, "code": code, "name": name or code, "sales_rial": float(rial),
                    "points": int(float(rial) // price)})
    return out


@router.get("/visitor/team")
def my_team(plan_id: int | None = None):
    """The visitor's own progress plus a leaderboard of their customers. Only a linked visitor may call it."""
    p = rbac.require()
    link = _link_for(p.user)
    if link is None or link[0] != "visitor":
        raise HTTPException(403, "این صفحه فقط برای حساب ویزیتور است")
    code = link[1]
    plans = _plans("visitor")
    plan = next((x for x in plans if x["id"] == plan_id), None) or (plans[0] if plans else None)
    if plan is None:
        return {"code": code, "plan": None, "team": [], "points": 0, "sales_rial": 0.0, "tier": None}
    team = _team(plan, code)
    sales_rial = sum(r["sales_rial"] for r in team)
    points = sum(r["points"] for r in team)
    return {"code": code, "plan": plan, "points": points, "sales_rial": sales_rial,
            "tier": _tier(points, plan), "team": team,
            "customers": len(team), "history": _monthly_points(plan, "visitor", code)}


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


_routes("b2b")
_routes("visitor")
