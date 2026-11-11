"""Hypothetical sales-query tool. Always read-only and scoped to the current principal's cores/branches."""
from __future__ import annotations

from .. import rbac
from ..db import connect


def query_sales_db(question: str) -> str:
    """Aggregate sales for what the current user may see; fails closed (1=0) when scoped but unassigned."""
    rbac.require()
    scope, sargs = rbac.scope_clause()
    cores, cargs = rbac.core_clause("core")
    con = connect(read_only=True)
    try:
        row = con.execute(
            f"SELECT COALESCE(SUM(rial_vat), 0) AS value, COUNT(DISTINCT customer_code) AS customers "
            f"FROM fact_sales WHERE 1=1{scope}{cores}",
            [*sargs, *cargs]).fetchone()
    finally:
        con.close()
    return f"sales_value_rial={row[0]:,.0f} customers={row[1]}"
