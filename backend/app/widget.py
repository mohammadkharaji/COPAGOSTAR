"""Lightweight, fast, RBAC-protected endpoint for Mobile Home-Screen Widget and PWA.

Serves dynamic pulse metrics:
- Executives / Managers: current Jalali month net sales (net_rial_vat), target achievement %,
  end-of-month forecast Rials, active customers count, and latest BI sync timestamp, scoped to RBAC.
- Visitors: active ladder plan name, total score, grade (A/B/C), national & branch rank, prize,
  and 3 activity rings (rial, coverage, basket). Company-wide executive totals are strictly denied.
"""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request

from . import bi_sync_service, club, club_ladder_report, club_store, rbac, widget_tokens
from .jalali import format_jdate

router = APIRouter(prefix="/api/mobile")


@router.post("/widget-token")
def issue_widget_token():
    return widget_tokens.issue(rbac.require())


@router.delete("/widget-token")
def revoke_widget_token():
    widget_tokens.revoke(rbac.require().user)
    return {"revoked": True}


def _freshness():
    sync = bi_sync_service.read_status().get("last_successful_sync")
    age = None
    if sync:
        try:
            stamp = datetime.fromisoformat(sync.replace("Z", "+00:00"))
            stamp = stamp if stamp.tzinfo else stamp.replace(tzinfo=timezone.utc)
            age = max(0, (datetime.now(timezone.utc) - stamp).total_seconds())
        except (TypeError, ValueError):
            pass
    return {"schema_version": 2, "generated_at": datetime.now(timezone.utc).isoformat(),
            "latest_bi_sync": sync, "freshness": "unknown" if age is None else "stale" if age > 86400 else "fresh",
            "refresh_after_seconds": 900}


def _visitor_link(username: str) -> str | None:
    try:
        con = club_store.connect()
        try:
            row = con.execute("SELECT kind, code FROM member_links WHERE username=?", [username]).fetchone()
            if row and row[0] == "visitor":
                return str(row[1])
        finally:
            con.close()
    except Exception as exc:
        raise HTTPException(503, "اطلاعات اتصال باشگاه در دسترس نیست") from exc
    return None


@router.get("/widget-pulse")
def widget_pulse(request: Request, core: str | None = None, month: str | None = None):
    data = _pulse(request, core, month)
    cutoff = data.get("data_cutoff")
    if cutoff:
        data["as_of_date"] = format_jdate(cutoff // 10000, cutoff // 100 % 100, cutoff % 100)
    return {**data, **_freshness()}


def _pulse(request: Request | None = None, core: str | None = None, month: str | None = None):
    """Fast, role-aware summary for mobile home-screen widgets and PWA dashboard."""
    p = rbac.require()
    visitor_code = _visitor_link(p.user)

    # 1. Visitor Role View (Sales Power Club linked accounts)
    if visitor_code:
        plans = club._plans("visitor")
        ladder_plans = club._plan_options([pl for pl in plans if pl.get("plan_type") == "ladder"])
        active_plan = ladder_plans[0] if ladder_plans else None

        if not active_plan:
            return {
                "role_view": "visitor",
                "available": False,
                "reason": "طرح نردبانی برای این حساب ثبت نشده است",
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
        achieved_groups = basket_kpi.get("ratio", 0.0) if basket_kpi else 0.0
        target_groups = max((step[0] for step in (basket_kpi or {}).get("ladder", [])), default=0)
        if target_groups > 0:
            basket_ratio = achieved_groups / target_groups

        rial_pct = round(rial_ratio * 100, 1)
        cov_pct = round(cov_ratio * 100, 1)
        basket_pct = round(basket_ratio * 100, 1)

        return {
            "role_view": "visitor",
            "available": bool(kpis),
            "reason": sc.get("note") or (None if kpis else "داده ماهانه این ویزیتور در دسترس نیست"),
            "visitor_code": visitor_code,
            "visitor_name": sc.get("name") or visitor_code,
            "branch": sc.get("branch"),
            "plan_id": active_plan.get("id"),
            "plan_status": active_plan.get("status"),
            "basket": {"achieved_groups": achieved_groups, "target_groups": target_groups,
                       "progress_pct": round(basket_ratio * 100, 1)},
            "month_provisional": sc.get("month_provisional"),
            "ranking_note": sc.get("ranking_note"),
            "data_cutoff": sc.get("data_cutoff"),
            "plan_name": active_plan.get("name", "نردبان پاداش فروش"),
            "total_score": round(float(sc.get("total", 0.0)), 2),
            "grade": sc.get("grade"),
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
    if not p.is_admin and "overview" not in p.pages:
        return {"role_view": "visitor", "available": False,
                "reason": "حساب شما به ویزیتور متصل نیست یا مجوز پایش مدیریتی ندارد"}
    from . import target
    selected_core = core or next((c for c in target.TARGET_CORES if c in p.cores), next(iter(p.cores), "kg"))
    report = target.build_report(selected_core, month, filters=target._filters(request) if request else {})
    if not report.get("available"):
        return {**report, "role_view": "executive"}
    summary = report["summary"]
    return {
        "role_view": "executive", "available": True,
        "core": selected_core, "month": report["month"], "jalali_month": report["jalali_month"],
        "as_of_date": report["as_of"], "months": report["months"], "filters": report["filters"],
        "summary": summary, "actual_rial": summary["actual_rial"],
        # Compatibility alias for already-installed scripts; this is target actual, not net-after-discounts.
        "net_rial_vat": summary["actual_rial"], "sales_definition": "target_actual_rial_vat",
        "target_rial": summary["target_rial"],
        "target_achievement_pct": summary["achieved_pct"] * 100 if summary["achieved_pct"] is not None else None,
        "eom_forecast_rial": summary["projected_rial"],
        "active_customers_count": report["active_customers_count"],
        "working_days": report["working_days"], "elapsed_working_days": report["elapsed_working_days"],
    }
