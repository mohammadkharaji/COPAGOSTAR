import importlib
import json
from datetime import datetime

import pytest
from fastapi.testclient import TestClient


COLS = ["SR[ID]", "SR[ProductName]", "SR[Brand]", "SR[MainUnit]", "SR[InvoiceCode]", "SR[Year/Month]",
        "SR[InvoiceDate]", "SR[CustomerCode]", "SR[CustomerName]", "SR[Visitor]", "SR[VisitorCode]",
        "SR[Superviser]", "SR[Branch]", "SR[BranchCode]", "SR[Movaze]", "SR[Mantaghe]", "SR[CityName]",
        "SR[State]", "SR[Guild]", "SR[SalesPointName]", "SR[GROUP]", "SR[گرید بندی]", "SR[طبقه حساب مشتری]",
        "SR[SalesType]", "SR[IsFormal]", "SR[UniqueProductCode]", "SR[ProductCodeOrginal]", "SR[Status]",
        "SR[SourceTable]", "SR[RecordKind]", "SR[Core]", "SR[Rial+Vat]", "SR[QTY]", "SR[Total]",
        "SR[Tax]", "SR[Toll]", "SR[TotalDiscount]", "SR[DISCOUNT]",
        "SR[TotalDiscountBySettlementInInvoiceRecord]"]


def make_row(src, inv, cust, rv, qty, disc="0", d2="0", settle="0", vcode="", vname="", date="1405/07/18",
             branch="شعبه تهران", brand=""):
    d = dict.fromkeys(COLS, "")
    d.update({"SR[SourceTable]": src, "SR[InvoiceCode]": inv, "SR[CustomerCode]": cust, "SR[InvoiceDate]": date,
              "SR[Year/Month]": date[:4] + date[5:7], "SR[Core]": "کوپا گستر", "SR[Rial+Vat]": rv, "SR[QTY]": qty,
              "SR[TotalDiscount]": disc, "SR[DISCOUNT]": d2, "SR[TotalDiscountBySettlementInInvoiceRecord]": settle,
              "SR[Branch]": branch, "SR[CityName]": "تهران", "SR[State]": "منطقه ۱", "SR[Movaze]": "غرب",
              "SR[VisitorCode]": vcode, "SR[Visitor]": vname, "SR[Brand]": brand})
    return "\x1f".join(d[c] for c in COLS)


def build_client(tmp_path, monkeypatch, chunks):
    raw = tmp_path / "raw"
    raw.mkdir()
    for name, rows in chunks.items():
        (raw / f"{name}.tsv").write_text("\x1f".join(COLS) + "\x1e" + "\x1e".join(rows) + "\x1e", encoding="utf-8")
    monkeypatch.setenv("SR_RAW_DIR", str(raw))
    monkeypatch.setenv("SR_DB_PATH", str(tmp_path / "t.duckdb"))
    from app import config, db, ingest, api
    for m in (config, db, ingest, api):
        importlib.reload(m)
    assert sum(r["rows"] for r in ingest.ingest_all()) == sum(len(r) for r in chunks.values())
    return TestClient(api.app)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    row = make_row
    return build_client(tmp_path, monkeypatch, {"sr_kg_140507": [
        row("SRSalesProcedure1405", "1", "A", "1000", "10", "100", "20", "30", "11", "علی رضایی"),
        row("SRSalesProcedure1405", "2", "B", "500", "5", vcode="12", vname="علی رضایی"),
        row("SRDatedSalesReturnProcedurewithVAT1405", "3", "A", "-200", "-2", vcode="11", vname="علی رضایی"),
        row("SRPromotionsProcedure1405", "4", "B", "50", "1", vcode="12", vname="علی رضایی")]})


@pytest.fixture()
def growth_client(tmp_path, monkeypatch):
    s = "SRSalesProcedure1405"
    return build_client(tmp_path, monkeypatch, {
        "sr_kg_140505": [make_row(s, "a1", "C1", "400", "4", date="1405/05/15", brand="A")],
        "sr_kg_140506": [make_row(s, "b1", "C1", "1000", "10", date="1405/06/10", brand="A"),
                         make_row(s, "b2", "C2", "500", "5", date="1405/06/25", branch="شعبه کرج", brand="B")],
        "sr_kg_140507": [make_row(s, "c1", "C1", "1500", "15", date="1405/07/05", brand="A"),
                         make_row(s, "c2", "C2", "600", "6", date="1405/07/18", branch="شعبه کرج", brand="B")]})


@pytest.fixture()
def lines_client(tmp_path, monkeypatch):
    s = "SRSalesProcedure1405"
    return build_client(tmp_path, monkeypatch, {
        "sr_kg_140506": [make_row(s, "L0", "C1", "100", "1", date="1405/06/20", vcode="11", vname="علی")],
        "sr_kg_140507": [
            make_row(s, "L1", "C1", "300", "3", date="1405/07/05", vcode="11", vname="علی"),
            make_row(s, "L1", "C1", "200", "2", date="1405/07/05", vcode="11", vname="علی"),
            make_row(s, "L1", "C1", "100", "1", date="1405/07/05", vcode="11", vname="علی"),
            make_row("SRPromotionsProcedure1405", "L1", "C1", "50", "1", date="1405/07/05", vcode="11", vname="علی"),
            make_row("SRDatedSalesReturnProcedurewithVAT1405", "L1", "C1", "-40", "-1", date="1405/07/06", vcode="11", vname="علی"),
            make_row(s, "L2", "C2", "400", "4", date="1405/07/06", vcode="12", vname="رضا"),
            make_row(s, "L3", "C2", "250", "2", date="1405/07/07", branch="شعبه کرج", vcode="12", vname="رضا"),
            make_row(s, "L3", "C2", "150", "1", date="1405/07/07", branch="شعبه کرج", vcode="12", vname="رضا")]})


def test_invoice_lines_count_only_sales_rows(lines_client):
    j = lines_client.get("/api/invoice-lines").json()
    assert j["total_invoices"] == 4 and j["total_lines"] == 7
    assert j["avg_lines_per_invoice"] == pytest.approx(7 / 4) and j["sales_rial"] == 1500
    assert j["avg_rial_per_line"] == pytest.approx(1500 / 7)
    assert [(b["lines"], b["invoices"], b["line_count"]) for b in j["buckets"]] == [(1, 2, 2), (2, 1, 2), (3, 1, 3)]
    assert j["buckets"][-1]["cum_invoice_share"] == pytest.approx(1) and not j["buckets"][0]["open_ended"]
    assert [(m["year_month"], m["lines"], m["invoices"]) for m in j["months"]] == [("140506", 1, 1), ("140507", 6, 3)]
    assert j["months"][1]["avg_lines_per_invoice"] == pytest.approx(2)
    scoped = lines_client.get("/api/invoice-lines", params={"branch": "شعبه کرج"}).json()
    assert scoped["total_invoices"] == 1 and scoped["total_lines"] == 2 and scoped["avg_lines_per_invoice"] == 2
    ranged = lines_client.get("/api/invoice-lines", params={"start": "1405/07/01", "end": "1405/07/31"}).json()
    assert ranged["total_invoices"] == 3 and ranged["total_lines"] == 6
    assert lines_client.get("/api/invoice-lines", params={"branch": "x"}).json()["avg_lines_per_invoice"] is None
    assert lines_client.get("/api/invoice-lines", params={"core": "ch"}).json()["total_lines"] == 0
    assert lines_client.get("/api/invoice-lines", params={"core": "zz"}).status_code == 400
    assert lines_client.get("/api/invoice-lines", params={"start": "bad"}).status_code == 400


def test_invoice_lines_in_profiles(lines_client):
    v = lines_client.get("/api/visitor/11").json()
    assert v["sales_invoices"] == 2 and v["sales_lines"] == 4 and v["avg_lines_per_invoice"] == 2
    b = lines_client.get("/api/profile/branch/شعبه کرج").json()
    assert b["sales_lines"] == 2 and b["sales_invoices"] == 1 and b["avg_lines_per_invoice"] == 2
    empty = lines_client.get("/api/profile/branch/شعبه کرج", params={"start": "1405/06/01", "end": "1405/06/30"}).json()
    assert empty["sales_lines"] == 0 and empty["avg_lines_per_invoice"] is None


def test_overview_matches_pivot_definitions(client):
    j = client.get("/api/overview").json()
    assert j["sum_rial_vat"] == 1350 and j["sum_qty"] == 14 and j["invoice_count"] == 4
    assert j["promison_rial"] == 120 and j["settlement_discount_rial"] == 30 and j["promo_kala_rial"] == 0
    assert j["promo_total_rial"] == 150 and j["net_rial"] == 1200
    assert abs(j["promo_percent"] - 150 / 1350) < 1e-9
    assert j["returns_rial"] == -200 and j["promo_rows_rial"] == 50


def test_calendar_matches_workbook_example(client):
    j = client.get("/api/calendar", params={"on": "1405/07/19"}).json()
    assert (j["weekday_name"], j["working_days"], j["days_passed"], j["days_remaining"]) == ("یکشنبه", 26, 15, 11)


def test_trend_and_validation(client):
    assert client.get("/api/trend").json()[0]["date"] == "1405/07/18"
    assert client.get("/api/overview", params={"start": "bad"}).status_code == 400
    assert client.get("/api/overview", params={"core": "zz"}).status_code == 400


def test_dimension_filter_and_breakdown(client):
    assert client.get("/api/overview", params={"branch": "شعبه تهران"}).json()["sum_rial_vat"] == 1350
    assert client.get("/api/overview", params={"branch": "x"}).json()["sum_rial_vat"] == 0
    assert client.get("/api/overview", params={"branch": "x' OR '1'='1"}).json()["sum_rial_vat"] == 0
    rows = client.get("/api/breakdown", params={"by": "branch"}).json()
    assert rows[0]["key"] == "شعبه تهران" and rows[0]["sum_rial_vat"] == 1350
    assert rows[0]["sales_rial"] == 1500 and abs(rows[0]["return_percent"] - 200 / 1500) < 1e-9
    assert client.get("/api/breakdown", params={"by": "bad; DROP TABLE x"}).status_code == 400
    assert client.get("/api/filters").json()["branch"] == ["شعبه تهران"]


def test_geo_filter_options_follow_selected_branch(client):
    allopts = client.get("/api/filters").json()
    assert allopts["city"] == ["تهران"] and allopts["state"] == ["منطقه ۱"]
    tehran = client.get("/api/filters", params={"branch": "شعبه تهران"}).json()
    assert tehran["city"] == ["تهران"] and tehran["state"] == ["منطقه ۱"] and tehran["region"] == allopts["region"]
    other = client.get("/api/filters", params={"branch": "شعبه اصفهان"}).json()
    assert other["city"] == [] and other["state"] == [] and other["region"] == []
    assert other["branch"] == allopts["branch"]
    assert client.get("/api/filters", params={"branch": "x' OR '1'='1"}).json()["city"] == []
    assert client.get("/api/filters", params={"city": "اصفهان"}).json()["state"] == []


def test_pareto_and_invoice_bands(client):
    p = client.get("/api/pareto", params={"by": "customer", "threshold": 0.5}).json()
    assert p["total_rial"] == 1500 and p["count"] == 2 and p["pareto_count"] == 1
    assert p["items"][0]["code"] == "A" and abs(p["items"][0]["cum_share"] - 1000 / 1500) < 1e-9
    b = client.get("/api/invoice-bands", params={"step": 600}).json()
    assert b["total_invoices"] == 2 and [x["invoices"] for x in b["bands"]] == [1, 1]
    assert client.get("/api/customer/A").json()["months"][0]["sales_rial"] == 1000
    assert client.get("/api/customer/ZZ").status_code == 404


def test_visitors_are_keyed_by_code_not_name(client):
    rows = client.get("/api/visitors").json()
    assert [r["code"] for r in rows] == ["11", "12"]
    assert all(r["name"] == "علی رضایی" for r in rows)
    assert sum(r["sum_rial_vat"] for r in rows) == client.get("/api/overview").json()["sum_rial_vat"] == 1350
    v11, v12 = rows
    assert v11["sum_rial_vat"] == 800 and v11["sales_rial"] == 1000 and v11["rank"] == 1
    assert v11["promison_rial"] == 120 and v11["net_rial"] == 650 and v11["returns_rial"] == -200
    assert abs(v11["return_percent"] - 200 / 1000) < 1e-9
    assert v12["sum_rial_vat"] == 550 and v12["sales_rial"] == 500
    assert abs(v11["share"] - 1000 / 1500) < 1e-9 and v11["branch_count"] == 1
    assert client.get("/api/visitors", params={"core": "ch"}).json() == []
    assert client.get("/api/visitors", params={"branch": "x"}).json() == []
    assert client.get("/api/visitors", params={"start": "bad"}).status_code == 400


def test_visitor_profile_metrics_filters_and_errors(client):
    j = client.get("/api/visitor/11").json()
    assert j["code"] == "11" and j["names"] == ["علی رضایی"] and j["all_branches"] == ["شعبه تهران"]
    assert j["sales_rial"] == 1000 and j["sales_invoices"] == 1 and j["buying_customers"] == 1 and j["active_days"] == 1
    assert j["avg_invoice_rial"] == 1000 and j["avg_customer_rial"] == 1000 and j["avg_active_day_rial"] == 1000
    assert j["rank"] == 1 and j["visitor_count"] == 2 and abs(j["share"] - 1000 / 1500) < 1e-9
    assert (j["first_sale"], j["last_sale"]) == ("1405/07/18", "1405/07/18")
    assert j["months"] == [{"year_month": "140507", "sales_rial": 1000, "invoices": 1, "customers": 1}]
    assert j["days"][0]["date"] == "1405/07/18" and j["branches"][0]["sales_rial"] == 1000
    assert j["customers"][0]["code"] == "A" and j["customers"][0]["sales_rial"] == 1000
    assert client.get("/api/visitor/12").json()["rank"] == 2
    empty = client.get("/api/visitor/11", params={"start": "1405/06/01", "end": "1405/06/31"}).json()
    assert empty["sales_rial"] == 0 and empty["rank"] is None and empty["avg_invoice_rial"] is None
    assert client.get("/api/visitor/11", params={"branch": "x"}).json()["sales_rial"] == 0
    assert client.get("/api/visitor/ZZ").status_code == 404
    assert client.get("/api/visitor/11", params={"core": "ch"}).status_code == 404
    assert client.get("/api/visitor/11' OR '1'='1").status_code == 404
    assert client.get("/api/visitor/11", params={"core": "zz"}).status_code == 400


def test_pareto_by_branch_and_day(growth_client):
    b = growth_client.get("/api/pareto", params={"by": "branch"}).json()
    assert b["total_rial"] == 4000 and b["count"] == 2
    assert (b["items"][0]["code"], b["items"][0]["sales_rial"]) == ("شعبه تهران", 2900)
    d = growth_client.get("/api/pareto", params={"by": "day", "threshold": 0.5}).json()
    assert d["count"] == 5 and d["items"][0]["code"] == "1405/07/05" and d["items"][0]["name"] == "1405/07/05"
    assert d["items"][0]["sales_rial"] == 1500 and d["pareto_count"] == 2
    assert growth_client.get("/api/pareto", params={"by": "day", "branch": "شعبه کرج"}).json()["count"] == 2


def test_growth_month_compares_complete_and_same_span(growth_client):
    j = growth_client.get("/api/growth", params={"kind": "month"}).json()
    assert j["last_date"] == "1405/07/18"
    mordad, shahrivar, mehr = j["periods"]
    assert mordad["key"] == "140505" and mordad["complete"] and mordad["compare"] is None
    assert shahrivar["complete"] and shahrivar["sum_rial_vat"] == 1500
    assert shahrivar["compare"]["sum_rial_vat"] == 400
    assert shahrivar["compare"]["growth"]["sum_rial_vat"] == pytest.approx(1500 / 400 - 1)
    assert not mehr["complete"] and (mehr["start"], mehr["end"]) == ("1405/07/01", "1405/07/18")
    assert mehr["sum_rial_vat"] == 2100
    c = mehr["compare"]
    assert (c["start"], c["end"]) == ("1405/06/01", "1405/06/18") and c["sum_rial_vat"] == 1000
    assert c["growth"]["sum_rial_vat"] == pytest.approx(2100 / 1000 - 1) and c["delta"]["sum_rial_vat"] == 1100
    assert c["growth"]["invoice_count"] == pytest.approx(2 / 1 - 1)
    only_karaj = growth_client.get("/api/growth", params={"kind": "month", "branch": "شعبه کرج"}).json()["periods"]
    assert only_karaj[-1]["sum_rial_vat"] == 600 and only_karaj[-1]["compare"]["sum_rial_vat"] == 0
    assert only_karaj[-1]["compare"]["growth"]["sum_rial_vat"] is None


def test_growth_season_and_half_flag_partial_coverage(growth_client):
    seasons = growth_client.get("/api/growth", params={"kind": "season"}).json()["periods"]
    assert [p["label"] for p in seasons] == ["تابستان 1405", "پاییز 1405"]
    summer, autumn = seasons
    assert summer["complete"] and not summer["full_coverage"] and summer["sum_rial_vat"] == 1900
    assert not autumn["complete"] and autumn["full_coverage"] and autumn["compare"] is None
    halves = growth_client.get("/api/growth", params={"kind": "half"}).json()["periods"]
    assert [p["label"] for p in halves] == ["نیمهٔ اول 1405", "نیمهٔ دوم 1405"]
    assert halves[0]["complete"] and not halves[0]["full_coverage"] and halves[1]["compare"] is None
    assert growth_client.get("/api/growth", params={"kind": "bad"}).status_code == 400
    assert growth_client.get("/api/growth", params={"core": "zz"}).status_code == 400


def test_dimension_profile_branch_and_brand(growth_client):
    j = growth_client.get("/api/profile/branch/شعبه تهران").json()
    assert j["sales_rial"] == 2900 and j["sales_invoices"] == 3 and j["buying_customers"] == 1
    assert j["share"] == pytest.approx(2900 / 4000) and j["avg_invoice_rial"] == pytest.approx(2900 / 3)
    assert [m["year_month"] for m in j["months"]] == ["140505", "140506", "140507"]
    assert [m["complete"] for m in j["months"]] == [True, True, False]
    assert "split_branch" not in j and j["split_brand"][0]["name"] == "A"
    assert j["customers"][0]["code"] == "C1" and j["customers"][0]["sales_rial"] == 2900
    scoped = growth_client.get("/api/profile/branch/شعبه تهران", params={"start": "1405/07/01", "end": "1405/07/31"}).json()
    assert scoped["sales_rial"] == 1500 and len(scoped["months"]) == 3
    assert growth_client.get("/api/profile/branch/شعبه تهران", params={"branch": "شعبه کرج"}).json()["sales_rial"] == 2900
    b = growth_client.get("/api/profile/brand/B").json()
    assert b["sales_rial"] == 1100 and b["split_branch"][0]["name"] == "شعبه کرج" and "split_brand" not in b
    assert growth_client.get("/api/profile/brand/B", params={"branch": "شعبه تهران"}).json()["sales_rial"] == 0
    assert growth_client.get("/api/profile/branch/ZZ").status_code == 404
    assert growth_client.get("/api/profile/branch/x' OR '1'='1").status_code == 404
    assert growth_client.get("/api/profile/bad/x").status_code == 400
    assert growth_client.get("/api/profile/branch/شعبه تهران", params={"core": "ch"}).status_code == 404


def test_health_reports_partial_and_reingest_is_idempotent(client):
    h = client.get("/api/health").json()
    assert h["status"] == "partial" and "sr_kg_140501" in h["missing_kg_chunks"]
    assert h["last_data_date"] == "1405/07/18"
    from app import ingest
    assert ingest.ingest_all()[0]["status"] == "skipped"


def test_pace_projects_month_end_by_working_days(client):
    j = client.get("/api/pace").json()
    assert j["year_month"] == "140507" and j["last_date"] == "1405/07/18"
    assert (j["working_days"], j["elapsed_working_days"], j["remaining_working_days"]) == (26, 15, 11)
    assert j["month_days"] == 30 and j["last_day"] == 18
    assert j["sum_rial_vat"] == 1350 and j["net_rial"] == 1200
    assert j["projected_sum_rial_vat"] == pytest.approx(1350 / 15 * 26)
    assert j["projected_net_rial"] == pytest.approx(1200 / 15 * 26)
    assert client.get("/api/pace", params={"branch": "x"}).json()["sum_rial_vat"] == 0
    assert client.get("/api/pace", params={"core": "zz"}).status_code == 400


def test_sync_status_states_and_conflict(client):
    from app import api
    path = api.DB_PATH.parent / "sync_status.json"
    path.unlink(missing_ok=True)
    assert client.get("/api/sync-status").json() == {"state": "never"}
    path.write_text(json.dumps({"state": "running", "started_at": "2000-01-01T00:00:00"}), encoding="utf-8")
    stale = client.get("/api/sync-status").json()
    assert stale["state"] == "failed" and stale["error"]
    now = datetime.now().isoformat(timespec="seconds")
    path.write_text(json.dumps({"state": "running", "started_at": now}), encoding="utf-8")
    assert client.get("/api/sync-status").json()["state"] == "running"
    assert client.post("/api/sync").status_code == 409
    path.write_text(json.dumps({"state": "ok", "finished_at": now, "rows_loaded": 3}), encoding="utf-8")
    done = client.get("/api/sync-status").json()
    assert done["state"] == "ok" and done["rows_loaded"] == 3
