"""Read sales and promotion rows from SQL Server (SELECT only) and write sr_<core>_<YYYYMM>.tsv extracts.

The extracts use the workbook column layout, so ingest.ingest_file loads them unchanged and replaces the month's chunk.
Returns (مرجوعی) are not read from SQL: the workbook rows already in the month's file are kept as they are.

  cd backend && .venv\\Scripts\\python.exe -m app.sql_source               # current and previous Jalali month
  cd backend && .venv\\Scripts\\python.exe -m app.sql_source 140505 --out DIR
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
from datetime import date
from pathlib import Path
from typing import Callable

from .config import CORES, RAW_DIR
from .jalali import gregorian_to_jalali
from .schema import COLUMN_MAP, NUMERIC

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
DRIVER = "ODBC Driver 18 for SQL Server"
CORE = "kg"  # the SQL objects have no Core column; they hold the kg rows only

SALES_TABLE = "SRSalesProcedure1405"
PROMO_TABLE = "SRPromotionsProcedure1405"
RETURNS_TABLE = "SRDatedSalesReturnProcedurewithVAT1405"
# Promotion rows with this status are not counted as promotions in the workbook model.
PROMO_EXCLUDED_STATUS = "کل برگشتي"


def _sum(*cols: str) -> str:
    return " + ".join(f"ISNULL({c}, 0)" for c in cols)


# Each source maps a fact field to a SQL expression. Phone and address columns are never selected.
_TEXT_FROM_SALES = {
    "product_name": "ProductName", "brand": "Brand", "main_unit": "MainUnit", "invoice_code": "InvoiceCode",
    "year_month": "MonthOfInsert", "invoice_date": "InvoiceInvsertDateTime", "customer_code": "CustomerCode",
    "customer_name": "CustomerName", "visitor": "Visitor", "visitor_code": "VisitorCode", "supervisor": "Superviser",
    "branch": "Branch", "branch_code": "BranchCode", "distributor": "Movaze", "region": "Mantaghe",
    "city_name": "CityName", "state": "State", "guild": "Guild", "sales_point_name": "SalesPointName",
    "group_name": "[GROUP]", "grade": "[گرید بندی]", "account_class": "[طبقه حساب مشتری]", "sales_type": "SalesType",
    "is_formal": "IsFormal", "product_code": "ProductCode", "status": "Status", "record_kind": "RecordKind",
}
SALES_SPEC = {
    **_TEXT_FROM_SALES, "row_id": "ID", "rial_vat": _sum("Total", "Tax", "Toll"), "qty": "Quantity",
    "total": "Total", "tax": "Tax", "toll": "Toll", "total_discount": "TotalDiscount", "discount": "0",
    "settlement_discount": "TotalDiscountBySettlementInInvoiceRecord",
}
# Promotion rows carry only Total (no Tax/Toll columns), so their rial_vat is Total.
PROMO_SPEC = {
    **_TEXT_FROM_SALES, "row_id": "NULL", "rial_vat": "ISNULL(Total, 0)", "qty": "Quantity", "total": "Total",
    "tax": "0", "toll": "0", "total_discount": "TotalDiscount", "discount": "0",
    "settlement_discount": "TotalDiscountBySettlementInInvoiceRecord",
}
# Returns rows from SRDatedSalesReturnProcedurewithVAT1405 (with negative amounts for net consolidation)
_TEXT_FROM_RETURNS = {
    "product_name": "Product_Name", "brand": "Brand_Name", "main_unit": "UnitPacking_Name",
    "invoice_code": "InvoiceCode", "year_month": "MonthOfInsert", "invoice_date": "DateFactor",
    "customer_code": "CustomerCode", "customer_name": "CustomerName", "visitor": "Salesman",
    "visitor_code": "SalesmanCode", "supervisor": "Supervisore", "branch": "OperationBranches",
    "branch_code": "MasoulBranch", "distributor": "Movaze", "region": "Mantaghe",
    "city_name": "NULL", "state": "NULL", "guild": "Guild", "sales_point_name": "SalesPointName",
    "group_name": "[GROUP]", "grade": "[گرید بندی]", "account_class": "[طبقه حساب مشتری]",
    "sales_type": "BusinessType", "is_formal": "NULL", "product_code": "Product_Code",
    "status": "N'مرجوعی'", "record_kind": "NULL",
}
RETURNS_SPEC = {
    **_TEXT_FROM_RETURNS, "row_id": "CODE",
    "rial_vat": "- (" + _sum("TotalPrice", "Tax", "Toll") + ")",
    "qty": "- ISNULL(Quantity, 0)", "total": "- ISNULL(TotalPrice, 0)",
    "tax": "- ISNULL(Tax, 0)", "toll": "- ISNULL(Toll, 0)",
    "total_discount": "- ISNULL(DISCOUNT, 0)", "discount": "ISNULL(DISCOUNT, 0)",
    "settlement_discount": "0",
}
SOURCES = {SALES_TABLE: SALES_SPEC, PROMO_TABLE: PROMO_SPEC}

Fetch = Callable[[str, dict, str], list[dict]]


def recent_months(today: date) -> list[str]:
    jy, jm, _ = gregorian_to_jalali(today)
    prev_y, prev_m = (jy - 1, 12) if jm == 1 else (jy, jm - 1)
    return [f"{prev_y}{prev_m:02d}", f"{jy}{jm:02d}"]


def _read_env(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def connect():
    import pyodbc

    env = _read_env(ENV_FILE)
    if not env.get("BI_DB_HOST"):
        root_env = Path(__file__).resolve().parents[2] / ".env"
        if root_env.exists():
            env.update(_read_env(root_env))

    avail = pyodbc.drivers()
    driver = DRIVER
    for d in ["ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "ODBC Driver 13 for SQL Server", "SQL Server"]:
        if d in avail:
            driver = d
            break

    pwd = "{" + env["BI_DB_PASSWORD"].replace("}", "}}") + "}"
    host = env["BI_DB_HOST"]
    port = env.get("BI_DB_PORT", "1433")
    server = f"{host},{port}" if ("," not in host and ":" not in host and port) else host

    trust_cert = "yes" if env.get("BI_DB_TRUST_CERT", "no").strip().lower() in ("1", "yes", "true") else "no"
    conn_str = (f"DRIVER={{{driver}}};SERVER={server};DATABASE={env['BI_DB_NAME']};UID={env['BI_DB_USER']};"
                f"PWD={pwd};Encrypt=yes;TrustServerCertificate={trust_cert};ApplicationIntent=ReadOnly;Connection Timeout=15")
    return pyodbc.connect(conn_str, readonly=True)


def fetch_table(cur, table: str, spec: dict, ym: str) -> list[dict]:
    select = ", ".join(f"({expr}) AS {field}" for field, expr in spec.items())
    excluded = f" AND Status <> N'{PROMO_EXCLUDED_STATUS}'" if table == PROMO_TABLE else ""
    cur.execute(f"SELECT {select} FROM dbo.{table} WHERE MonthOfInsert = ?{excluded}", ym)
    names = [d[0] for d in cur.description]
    return [dict(zip(names, row)) for row in cur.fetchall()]


def _cell(field: str, value) -> str:
    if value is None:
        return ""
    if field in NUMERIC:
        return repr(float(value))
    return re.sub(r"[\x1e\x1f\r\n]", " ", str(value))


def extract_month(fetch: Fetch, ym: str, out_dir: Path) -> dict:
    if not re.fullmatch(r"14\d{4}", ym):
        raise ValueError(f"month must be YYYYMM in the 1400s, got {ym!r}")
    core_name = CORES[CORE]
    rows, counts = [], {}
    for table, spec in SOURCES.items():
        fetched = fetch(table, spec, ym)
        counts[table] = len(fetched)
        for r in fetched:
            r["source_table"] = table
            r["core"] = core_name
            rows.append(r)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"sr_{CORE}_{ym}.tsv"
    header, kept = _workbook_layout_and_returns(ym)
    cols = header.split("\x1f")
    body = []
    for r in rows:
        line = [""] * len(cols)
        for col, field in COLUMN_MAP.items():
            line[cols.index(col)] = _cell(field, r.get(field))
        body.append("\x1f".join(line) + "\x1e")
    tmp = out_dir / f"{target.name}.part"
    with tmp.open("w", encoding="utf-8", newline="") as f:
        f.write(header + "\x1e" + "".join(body) + "".join(kept))
    if target.exists():
        shutil.copy2(target, target.with_name(target.name + ".bak"))
    os.replace(tmp, target)
    return {"month": ym, "file": target.name, "rows": len(rows) + len(kept),
            "by_table": {**counts, RETURNS_TABLE: len(kept)}}


def _workbook_layout_and_returns(ym: str) -> tuple[str, list[str]]:
    """Header and return rows (مرجوعی) of the month, always read from the workbook: SQL does not supply returns and an
    older month file may hold stale or empty returns."""
    hdr, body = _workbook_returns_dax(ym)
    kept = [line + "\x1e" for line in body.split("\x1e") if line]
    return hdr, kept


def _workbook_returns_dax(ym: str) -> tuple[str, str]:
    """Run one DAX query on the workbook for this month's return rows; returns (header, body) in the extract layout."""
    import subprocess
    import tempfile

    root = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryDirectory() as qdir, tempfile.TemporaryDirectory() as odir:
        (Path(qdir) / "returns.dax").write_text(
            f'EVALUATE FILTER(SR, SR[Core]="{CORES[CORE]}" && SR[Year/Month]="{ym}" && SR[SourceTable]="{RETURNS_TABLE}")',
            encoding="utf-8")
        ps = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(root / "scripts" / "run_dax.ps1"),
             "-QueryDir", qdir, "-OutDir", odir, "-Workbook", str(root / "SR-1405.xlsx")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
        out = Path(odir) / "returns.tsv"
        if ps.returncode != 0 or not out.exists():
            raise RuntimeError(f"workbook return rows for {ym} could not be read: {ps.stderr.strip()[:300]}")
        hdr, _, body = out.read_text(encoding="utf-8").partition("\x1e")
        return hdr, body


def extract_months(months: list[str], out_dir: Path) -> list[dict]:
    con = connect()
    try:
        cur = con.cursor()
        return [extract_month(lambda t, s, y: fetch_table(cur, t, s, y), ym, out_dir) for ym in months]
    finally:
        con.close()


def extract_recent(out_dir: Path = RAW_DIR) -> list[dict]:
    return extract_months(recent_months(date.today()), out_dir)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Write sr_kg_YYYYMM.tsv extracts from SQL Server (read-only).")
    ap.add_argument("months", nargs="*", help="Jalali months as YYYYMM; default: previous and current month")
    ap.add_argument("--out", type=Path, default=RAW_DIR)
    a = ap.parse_args(argv)
    for r in (extract_months(a.months, a.out) if a.months else extract_recent(a.out)):
        print(r)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
