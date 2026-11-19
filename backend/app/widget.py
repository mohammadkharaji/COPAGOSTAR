"""Lightweight, fast, RBAC-protected endpoint for Mobile Home-Screen Widget and PWA.

Serves dynamic pulse metrics:
- Executives / Managers: current Jalali month net sales (net_rial_vat), target achievement %,
  end-of-month forecast Rials, active customers count, and latest BI sync timestamp, scoped to RBAC.
- Visitors: active ladder plan name, total score, grade (A/B/C), national & branch rank, prize,
  and 3 activity rings (rial, coverage, basket). Company-wide executive totals are strictly denied.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from . import bi_sync_service, club, club_ladder_report, club_store, rbac
from .config import DB_PATH, HOLIDAYS
from .db import connect
from .jalali import days_in_jalali_month, format_jdate, jalali_to_gregorian, jalali_weekday

router = APIRouter(prefix="/api/mobile")


def _is_working(jy: int, jm: int, d: int) -> bool:
    return jalali_weekday(jalali_to_gregorian(jy, jm, d)) != 6 and format_jdate(jy, jm, d) not in HOLIDAYS


def _table_exists(con, name: str) -> bool:
    try:
        return bool(con.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name=?", [name]).fetchone()[0])
    except Exception:
        return False


def _visitor_link(username: str) -> str | None:
    try:
        con = club_store.connect()
        try:
            row = con.execute("SELECT kind, code FROM member_links WHERE username=?", [username]).fetchone()
            if row and row[0] == "visitor":
                return str(row[1])
        finally:
            con.close()
    except Exception:
        pass
    return None


@router.get("/widget-pulse")
def widget_pulse():
    """Fast, role-aware summary for mobile home-screen widgets and PWA dashboard."""
    p = rbac.require()
    visitor_code = _visitor_link(p.user)

    # 1. Visitor Role View (Sales Power Club linked accounts)
    if visitor_code:
        plans = club._plans("visitor")
        ladder_plans = [pl for pl in plans if pl.get("plan_type") == "ladder"]
        active_plan = next((pl for pl in ladder_plans if pl.get("active")), ladder_plans[0] if ladder_plans else None)

        if not active_plan:
            return {
                "role_view": "visitor",
                "available": True,
                "visitor_code": visitor_code,
                "visitor_name": visitor_code,
                "branch": None,
                "plan_id": None,
                "plan_name": "باشگاه قدرت فروش",
                "total_score": 0.0,
                "grade": "C",
                "rank_national": None,
                "rank_branch": None,
                "prize_amount": 0,
                "rings": {
                    "rial": 0.0,
                    "coverage": 0.0,
                    "basket": 0.0,
                },
                "kpis": [],
                "as_of_month": None,
                "provisional_month": None,
            }

        sc = club_ladder_report.scorecard(active_plan, visitor_code, None)
        kpis = sc.get("kpis") or []

        def _find_kpi(metric_name: str):
            for k in kpis:
                if k.get("metric") == metric_name or k.get("key") == metric_name:
                    return k
                if metric_name == "coverage" and k.get("key") in ("cov", "coverage"):
                    return k
            return None

        rial_kpi = _find_kpi("rial")
        cov_kpi = _find_kpi("coverage")
        basket_kpi = _find_kpi("basket")

        rial_ratio = (rial_kpi.get("ratio") or 0.0) if rial_kpi else 0.0
        cov_ratio = (cov_kpi.get("ratio") or 0.0) if cov_kpi else 0.0

        basket_ratio = 0.0
        if basket_kpi:
            b_target = basket_kpi.get("target")
            b_actual = basket_kpi.get("actual", 0.0)
            if b_target and b_target > 0:
                basket_ratio = b_actual / b_target
            elif b_actual > 0:
                cfg_kpis = active_plan.get("config", {}).get("kpis", []) if isinstance(active_plan.get("config"), dict) else []
                basket_cfg = next((k for k in cfg_kpis if k.get("metric") == "basket"), None)
                ladder = basket_cfg.get("ladder", []) if basket_cfg else []
                top_threshold = ladder[-1][0] if ladder else 5.0
                basket_ratio = min(b_actual / top_threshold, 1.0) if top_threshold > 0 else 0.0

        rial_pct = round(rial_ratio * 100, 1)
        cov_pct = round(cov_ratio * 100, 1)
        basket_pct = round(basket_ratio * 100, 1)

        return {
            "role_view": "visitor",
            "available": True,
            "visitor_code": visitor_code,
            "visitor_name": sc.get("name") or visitor_code,
            "branch": sc.get("branch"),
            "plan_id": active_plan.get("id"),
            "plan_name": active_plan.get("name", "نردبان پاداش فروش"),
            "total_score": round(float(sc.get("total", 0.0)), 2),
            "grade": sc.get("grade") or "C",
            "rank_national": sc.get("rank_national"),
            "rank_branch": sc.get("rank_branch"),
            "prize_amount": sc.get("prize") or 0,
            "rings": {
                "rial": rial_pct,
                "coverage": cov_pct,
                "basket": basket_pct,
            },
            "kpis": kpis,
            "as_of_month": sc.get("month"),
            "provisional_month": sc.get("provisional_month"),
        }

    # 2. Executive / Manager Role View (Admin, Superadmin, Branch/Line Managers)
    if not DB_PATH.exists():
        raise HTTPException(503, "پایگاه داده هنوز ساخته نشده است")

    con = connect(read_only=True)
    try:
        if not _table_exists(con, "fact_sales"):
            st = bi_sync_service.read_status()
            return {
                "role_view": "executive",
                "available": False,
                "reason": "داده‌های فروش هنوز بارگذاری نشده است",
                "net_rial_vat": 0,
                "target_achievement_pct": None,
                "eom_forecast_rial": 0,
                "active_customers_count": 0,
                "latest_bi_sync": st.get("last_successful_sync"),
            }

        c_sql, c_args = rbac.core_clause()
        b_sql, b_args = rbac.scope_clause()
        scope_sql = c_sql + b_sql
        scope_args = [*c_args, *b_args]

        last = con.execute(f"SELECT MAX(jdate_key) FROM fact_sales WHERE 1=1{scope_sql}", scope_args).fetchone()[0]
        if not last:
            st = bi_sync_service.read_status()
            return {
                "role_view": "executive",
                "available": True,
                "month": None,
                "jalali_month": None,
                "as_of_date": None,
                "net_rial_vat": 0,
                "target_achievement_pct": None,
                "eom_forecast_rial": 0,
                "active_customers_count": 0,
                "latest_bi_sync": st.get("last_successful_sync"),
                "working_days": 0,
                "elapsed_working_days": 0,
            }

        jy, jm, jd = last // 10000, last // 100 % 100, last % 100
        current_month = f"{jy}{jm:02d}"
        month_start = last // 100 * 100 + 1
        month_end = last

        row = con.execute(
            f"SELECT COALESCE(SUM(rial_vat), 0), COUNT(DISTINCT customer_code) "
            f"FROM fact_sales WHERE jdate_key >= ? AND jdate_key <= ?{scope_sql}",
            [month_start, month_end, *scope_args],
        ).fetchone()
        net_rial_vat = float(row[0] or 0.0)
        active_customers_count = int(row[1] or 0)

        # Target achievement
        target_rial = 0.0
        if _table_exists(con, "fact_target"):
            t_row = con.execute(
                f"SELECT COALESCE(SUM(target_rial), 0) FROM fact_target WHERE month=?{scope_sql}",
                [current_month, *scope_args],
            ).fetchone()
            target_rial = float(t_row[0] or 0.0)

        target_achievement_pct = round((net_rial_vat / target_rial) * 100, 1) if target_rial > 0 else None

        # EOM Forecast
        month_days = days_in_jalali_month(jy, jm)
        working_days = sum(_is_working(jy, jm, d) for d in range(1, month_days + 1))
        elapsed_days = sum(_is_working(jy, jm, d) for d in range(1, jd + 1))
        eom_forecast_rial = round(net_rial_vat / elapsed_days * working_days) if elapsed_days > 0 else net_rial_vat

        st = bi_sync_service.read_status()
        latest_bi_sync = st.get("last_successful_sync") or st.get("updated_at")

        return {
            "role_view": "executive",
            "available": True,
            "month": current_month,
            "jalali_month": f"{jy}/{jm:02d}",
            "as_of_date": format_jdate(jy, jm, jd),
            "net_rial_vat": net_rial_vat,
            "target_rial": target_rial,
            "target_achievement_pct": target_achievement_pct,
            "eom_forecast_rial": eom_forecast_rial,
            "active_customers_count": active_customers_count,
            "latest_bi_sync": latest_bi_sync,
            "working_days": working_days,
            "elapsed_working_days": elapsed_days,
        }
    finally:
        con.close()
