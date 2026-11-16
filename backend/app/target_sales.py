"""The Target page's definition of actual sales, shared with the visitor achievement ladder.

Actual = Rial+Vat of every fact_sales row of the month (returns are negative rows, promotions included), grouped by
branch, group, visitor code, the product's TargetCategory and day of month.
"""
from __future__ import annotations


def month_sales(con, core_name: str, ym: str, scope: str = "", scope_args: list | None = None) -> list[tuple]:
    """(branch, group_name, visitor_code, target_category, day, rial) rows of one month."""
    return con.execute(
        f"""SELECT s.branch, s.group_name, s.visitor_code, d.target_category, COALESCE(s.jdate_key, 0) % 100, SUM(s.rial_vat)
           FROM fact_sales s LEFT JOIN dim_product d ON d.unique_product_code = s.unique_product_code
           WHERE s.core=? AND s.year_month=?{scope} GROUP BY 1, 2, 3, 4, 5""", [core_name, ym, *(scope_args or [])]).fetchall()


def visitor_codes_by_name(con, core_name: str) -> dict[str, tuple[str, int]]:
    """visitor name -> (any one of its codes, how many distinct codes it has)."""
    return {n: (c, k) for n, c, k in con.execute(
        """SELECT visitor, ANY_VALUE(visitor_code), COUNT(DISTINCT visitor_code) FROM fact_sales
           WHERE core=? AND visitor IS NOT NULL AND visitor_code IS NOT NULL GROUP BY 1""", [core_name]).fetchall()}


def resolve_code(code: str | None, name: str, by_name: dict) -> str | None:
    """The code itself, else the database code of the same name when that name has exactly one."""
    if code:
        return code
    return by_name[name][0] if name in by_name and by_name[name][1] == 1 else None
