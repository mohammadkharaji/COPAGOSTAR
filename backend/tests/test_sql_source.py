from datetime import date

import duckdb
import pytest

from app import sql_source
from app.ingest import ingest_file, initialize
from app.schema import COLUMN_MAP

PII_COLUMNS = {"Telephone", "Address", "SalesPointAddress", "CustomerTelephoneNumber", "CustomerSalesPointAddress"}
RETURN_TABLE = "SRDatedSalesReturnProcedurewithVAT1405"


def _fake_fetch(rows_by_table):
    def fetch(table, spec, ym):
        return [{field: raw.get(field) for field in spec} for raw in rows_by_table.get(table, [])]
    return fetch


def _sales_row(**kw):
    base = {"row_id": "1", "rial_vat": 110.0, "qty": 2, "total": 100, "tax": 6, "toll": 4, "total_discount": 5,
            "discount": 0, "settlement_discount": 1, "invoice_code": "I1", "year_month": "140505",
            "invoice_date": "1405/05/10", "branch": "B1", "customer_code": "C1", "product_code": "P1",
            "status": "ok", "record_kind": "x", "is_formal": "1"}
    return {**base, **kw}


def _workbook_return_line(amount: float) -> str:
    values = {c: "" for c in COLUMN_MAP}
    values["SR[SourceTable]"] = RETURN_TABLE
    values["SR[Rial+Vat]"] = repr(amount)
    values["SR[Year/Month]"] = "140505"
    return "\x1f".join(values[c] for c in COLUMN_MAP) + "\x1e"


def _write_existing(path, return_lines):
    header = "\x1f".join(COLUMN_MAP)  # the sales/returns header written by the workbook export has the same names
    path.write_text(header + "\x1e" + "".join(return_lines), encoding="utf-8")


def test_recent_months_crosses_year_boundary():
    assert sql_source.recent_months(date(2026, 3, 21)) == ["140412", "140501"]
    assert sql_source.recent_months(date(2026, 10, 13)) == ["140506", "140507"]


def test_no_pii_column_is_selected():
    exprs = [expr for spec in sql_source.SOURCES.values() for expr in spec.values()]
    assert not any(pii in expr for pii in PII_COLUMNS for expr in exprs)
    assert not any(col in PII_COLUMNS for col in COLUMN_MAP)


def test_returns_are_not_read_from_sql():
    assert RETURN_TABLE not in sql_source.SOURCES


def test_promo_rows_use_total_only():
    assert sql_source.PROMO_SPEC["rial_vat"] == "ISNULL(Total, 0)"
    assert sql_source.PROMO_SPEC["tax"] == "0" and sql_source.PROMO_SPEC["toll"] == "0"


def test_extract_keeps_workbook_return_rows_and_writes_backup(tmp_path, monkeypatch):
    target = tmp_path / "sr_kg_140505.tsv"
    _write_existing(target, [])
    monkeypatch.setattr(sql_source, "_workbook_returns_dax", lambda ym: ("".join(COLUMN_MAP), _workbook_return_line(-21.0)))
    result = sql_source.extract_month(_fake_fetch({sql_source.SALES_TABLE: [_sales_row()]}), "140505", tmp_path)
    assert result["file"] == "sr_kg_140505.tsv" and result["rows"] == 2
    assert result["by_table"][RETURN_TABLE] == 1
    header, _, body = target.read_text(encoding="utf-8").partition("\x1e")
    assert header.split("\x1f") == list(COLUMN_MAP)
    assert body.count("\x1e") == 2
    assert (tmp_path / "sr_kg_140505.tsv.bak").exists()


def test_new_month_takes_return_rows_from_workbook_when_no_file(tmp_path, monkeypatch):
    workbook_return = _workbook_return_line(-9.0)
    header = "\x1f".join(COLUMN_MAP)
    monkeypatch.setattr(sql_source, "_workbook_returns_dax", lambda ym: (header, workbook_return))
    result = sql_source.extract_month(_fake_fetch({sql_source.SALES_TABLE: [_sales_row()]}), "140508", tmp_path)
    assert result["rows"] == 2 and result["by_table"][RETURN_TABLE] == 1
    text = (tmp_path / "sr_kg_140508.tsv").read_text(encoding="utf-8")
    assert RETURN_TABLE in text


def test_extract_loads_through_ingest_and_keeps_returns(tmp_path, monkeypatch):
    con = duckdb.connect(":memory:")
    initialize(con)
    target = tmp_path / "sr_kg_140505.tsv"
    _write_existing(target, [])
    monkeypatch.setattr(sql_source, "_workbook_returns_dax", lambda ym: ("".join(COLUMN_MAP), _workbook_return_line(-21.0)))
    fetch = _fake_fetch({
        sql_source.SALES_TABLE: [_sales_row()],
        sql_source.PROMO_TABLE: [{"total": 40, "total_discount": 3, "settlement_discount": 0, "rial_vat": 40,
                                  "year_month": "140505", "invoice_code": "P9", "invoice_date": "1405/05/11"}],
    })
    sql_source.extract_month(fetch, "140505", tmp_path)
    ingest_file(con, target)
    gross, returns, promo_rows = con.execute(
        "SELECT SUM(rial_vat), SUM(rial_vat) FILTER (WHERE is_return), SUM(rial_vat) FILTER (WHERE is_promo) "
        "FROM fact_sales").fetchone()
    assert gross == 110 - 21 + 40
    assert returns == -21 and promo_rows == 40


def test_short_month_is_rejected():
    with pytest.raises(ValueError):
        sql_source.extract_month(_fake_fetch({}), "1405", None)


def test_extract_recent_writes_previous_and_current_month(tmp_path, monkeypatch):
    seen = []
    monkeypatch.setattr(sql_source, "connect", lambda: _FakeConn())
    monkeypatch.setattr(sql_source, "fetch_table", lambda cur, t, s, y: seen.append((t, y)) or [])
    monkeypatch.setattr(sql_source, "recent_months", lambda today: ["140504", "140505"])
    _write_existing(tmp_path / "sr_kg_140504.tsv", [])
    _write_existing(tmp_path / "sr_kg_140505.tsv", [])
    results = sql_source.extract_recent(tmp_path)
    assert [r["file"] for r in results] == ["sr_kg_140504.tsv", "sr_kg_140505.tsv"]
    assert {y for _, y in seen} == {"140504", "140505"}


class _FakeConn:
    def cursor(self):
        return None

    def close(self):
        pass
