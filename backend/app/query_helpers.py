from __future__ import annotations

from fastapi import HTTPException, Request

from . import config, rbac
from .config import CORES, DEFAULT_CORE
from .db import connect


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
DIMS = {
    "sales_type": "sales_type", "region": "region", "state": "state", "city": "city_name", "branch": "branch",
    "office": "account_class",
    "brand": "brand", "group": "group_name", "grade": "grade", "visitor": "visitor",
    "main_group": "main_group", "sub_group": "sub_group", "product": "product_name",
}


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
    scope, sargs = rbac.scope_clause()  # the user's branch scope, applied even when `branch` is skipped
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


BREAKDOWN_BY = {**DIMS, "month": "year_month", "day": "jdate_key", "product": "product_name", "customer": "customer_name"}
SALES_ONLY = "NOT is_promo AND NOT is_return"
