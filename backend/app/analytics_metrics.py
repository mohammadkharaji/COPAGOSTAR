from __future__ import annotations

from fastapi import APIRouter, Query, Request

from . import rbac
from .config import CORES, DEFAULT_CORE
from .jalali import JALALI_MONTHS
from .query_helpers import _con, _core, _dims, _range, BREAKDOWN_BY, SALES_ONLY

router = APIRouter()


def _format_month_label(ym: str) -> str:
    if len(ym) == 6 and ym.isdigit():
        m_idx = int(ym[4:6]) - 1
        y = ym[:4]
        if 0 <= m_idx < len(JALALI_MONTHS):
            return f"{JALALI_MONTHS[m_idx]} {y}"
    return ym


@router.get("/api/analytics/customer-metrics")
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
        tables_res = {r[0].lower() for r in con.execute("SHOW TABLES").fetchall()}
        has_dim_prod = "dim_product" in tables_res
        fs_cols = {c[0].lower() for c in con.execute("DESCRIBE fact_sales").fetchall()}
        has_fs_main_group = "main_group" in fs_cols

        pdim_cte = ""
        pdim_join = ""
        if has_dim_prod and has_fs_main_group:
            pdim_cte = """pdim AS (
                    SELECT SUBSTRING(unique_product_code, 1, 10) AS pcode,
                           FIRST(main_group) AS main_group
                    FROM dim_product
                    WHERE main_group IS NOT NULL
                    GROUP BY 1
                ),"""
            pdim_join = "LEFT JOIN pdim p ON f.product_code = p.pcode"
            cat_expr = "TRIM(REPLACE(COALESCE(NULLIF(f.main_group, ''), p.main_group, 'سایر'), 'گروه', ''))"
        elif has_dim_prod:
            pdim_cte = """pdim AS (
                    SELECT SUBSTRING(unique_product_code, 1, 10) AS pcode,
                           FIRST(main_group) AS main_group
                    FROM dim_product
                    WHERE main_group IS NOT NULL
                    GROUP BY 1
                ),"""
            pdim_join = "LEFT JOIN pdim p ON f.product_code = p.pcode"
            cat_expr = "TRIM(REPLACE(COALESCE(p.main_group, 'سایر'), 'گروه', ''))"
        elif has_fs_main_group:
            cat_expr = "TRIM(REPLACE(COALESCE(NULLIF(f.main_group, ''), 'سایر'), 'گروه', ''))"
        else:
            cat_expr = "'سایر'"

        cat_curr_rows = con.execute(
            f"""WITH {pdim_cte}
                scat AS (
                    SELECT f.customer_code,
                           f.invoice_code,
                           f.product_code,
                           f.qty,
                           f.rial_vat,
                           {cat_expr} AS category_name
                    FROM fact_sales f
                    {pdim_join}
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
                f"""WITH {pdim_cte}
                    curr AS (
                        SELECT DISTINCT
                               {cat_expr} AS category_name,
                               f.customer_code
                        FROM fact_sales f
                        {pdim_join}
                        WHERE f.core=? AND f.year_month=? AND {SALES_ONLY} AND f.rial_vat > 0 AND f.customer_code IS NOT NULL{dim}
                    ),
                    prev AS (
                        SELECT DISTINCT
                               {cat_expr} AS category_name,
                               f.customer_code
                        FROM fact_sales f
                        {pdim_join}
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
            f"""WITH {pdim_cte}
                cust_total AS (
                    SELECT f.customer_code,
                           COUNT(DISTINCT COALESCE(NULLIF(f.brand, ''), 'نامشخص')) AS brand_cnt
                    FROM fact_sales f
                    WHERE f.core=? AND f.year_month=? AND {SALES_ONLY} AND f.rial_vat > 0 AND f.customer_code IS NOT NULL{dim}
                    GROUP BY 1
                )
                SELECT {cat_expr} AS category_name,
                       AVG(ct.brand_cnt)
                FROM fact_sales f
                {pdim_join}
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


@router.get("/api/analytics/product-metrics")
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
