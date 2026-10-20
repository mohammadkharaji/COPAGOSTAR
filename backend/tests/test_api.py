import importlib
import json
from datetime import datetime

import pytest
from fastapi.testclient import TestClient


TEST_PASSWORD = "test-password-123"

COLS = ["SR[ID]", "SR[ProductName]", "SR[Brand]", "SR[MainUnit]", "SR[InvoiceCode]", "SR[Year/Month]",
        "SR[InvoiceDate]", "SR[CustomerCode]", "SR[CustomerName]", "SR[Visitor]", "SR[VisitorCode]",
        "SR[Superviser]", "SR[Branch]", "SR[BranchCode]", "SR[Movaze]", "SR[Mantaghe]", "SR[CityName]",
        "SR[State]", "SR[Guild]", "SR[SalesPointName]", "SR[GROUP]", "SR[گرید بندی]", "SR[طبقه حساب مشتری]",
        "SR[SalesType]", "SR[IsFormal]", "SR[UniqueProductCode]", "SR[ProductCodeOrginal]", "SR[Status]",
        "SR[SourceTable]", "SR[RecordKind]", "SR[Core]", "SR[Rial+Vat]", "SR[QTY]", "SR[Total]",
        "SR[Tax]", "SR[Toll]", "SR[TotalDiscount]", "SR[DISCOUNT]",
        "SR[TotalDiscountBySettlementInInvoiceRecord]"]


def make_row(src, inv, cust, rv, qty, disc="0", d2="0", settle="0", vcode="", vname="", date="1405/07/18",
             branch="شعبه تهران", brand="", ucode="", line="", sup=""):
    d = dict.fromkeys(COLS, "")
    d.update({"SR[SourceTable]": src, "SR[InvoiceCode]": inv, "SR[CustomerCode]": cust, "SR[InvoiceDate]": date,
              "SR[Year/Month]": date[:4] + date[5:7], "SR[Core]": "کوپا گستر", "SR[Rial+Vat]": rv, "SR[QTY]": qty,
              "SR[TotalDiscount]": disc, "SR[DISCOUNT]": d2, "SR[TotalDiscountBySettlementInInvoiceRecord]": settle,
              "SR[Branch]": branch, "SR[CityName]": "تهران", "SR[State]": "منطقه ۱", "SR[Movaze]": "غرب",
              "SR[VisitorCode]": vcode, "SR[Visitor]": vname, "SR[Brand]": brand, "SR[UniqueProductCode]": ucode,
              "SR[GROUP]": line, "SR[Superviser]": sup})
    return "\x1f".join(d[c] for c in COLS)


PRODUCT_COLS = ["Product[UniqueProductCode]", "Product[گروه کالای اصلی]", "Product[ProductGroup]", "Product[TargetCategory]",
                "Product[Brand]"]


def product_tsv(*products):
    """products: (unique code, main group, sub group[, target category]) tuples -> product.tsv text in the extract format."""
    return "\x1f".join(PRODUCT_COLS) + "\x1e" + "".join(
        "\x1f".join([*p, *[""] * (4 - len(p)), "b"]) + "\x1e" for p in products)


def build_client(tmp_path, monkeypatch, chunks, product=None):
    raw = tmp_path / "raw"
    raw.mkdir()
    if product:
        (raw / "product.tsv").write_text(product, encoding="utf-8")
    for name, rows in chunks.items():
        (raw / f"{name}.tsv").write_text("\x1f".join(COLS) + "\x1e" + "\x1e".join(rows) + "\x1e", encoding="utf-8")
    monkeypatch.setenv("SR_RAW_DIR", str(raw))
    monkeypatch.setenv("SR_DB_PATH", str(tmp_path / "t.duckdb"))
    monkeypatch.setenv("SR_DATA_DIR", str(tmp_path / "data"))
    from app import auth, config, db, ingest, api, rbac, admin
    monkeypatch.setenv("SR_AUTH_USER", "admin")
    monkeypatch.setenv("SR_AUTH_PASS_HASH", auth.hash_password(TEST_PASSWORD))
    monkeypatch.setenv("SR_AUTH_SECRET", "t" * 40)
    for m in (config, db, ingest, rbac, admin, api):
        importlib.reload(m)
    assert sum(r["rows"] for r in ingest.ingest_all()) == sum(len(r) for r in chunks.values())
    c = TestClient(api.app)
    assert c.post("/api/auth/login", json={"username": "admin", "password": TEST_PASSWORD}).status_code == 200
    return c


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


def test_product_group_filters_and_sub_group_follows_main_group(tmp_path, monkeypatch):
    s = "SRSalesProcedure1405"
    c = build_client(tmp_path, monkeypatch, {"sr_kg_140507": [
        make_row(s, "1", "A", "1000", "10", ucode="P1"), make_row(s, "2", "B", "500", "5", ucode="P2"),
        make_row(s, "3", "A", "200", "2", ucode="P3"), make_row(s, "4", "B", "70", "1", ucode="NOPE")]},
        product=product_tsv(("P1", "گروه الف", "زیر ۱"), ("P2", "گروه الف", "زیر ۲"), ("P3", "گروه ب", "زیر ۱")))
    opts = c.get("/api/filters").json()
    assert sorted(opts["main_group"]) == ["گروه الف", "گروه ب"] and sorted(opts["sub_group"]) == ["زیر ۱", "زیر ۲"]
    assert sorted(c.get("/api/filters", params={"main_group": "گروه الف"}).json()["sub_group"]) == ["زیر ۱", "زیر ۲"]
    assert c.get("/api/filters", params={"main_group": "گروه ب"}).json()["sub_group"] == ["زیر ۱"]
    assert c.get("/api/filters", params={"main_group": "x' OR '1'='1"}).json()["sub_group"] == []
    assert c.get("/api/filters", params={"main_group": "گروه الف"}).json()["main_group"] == opts["main_group"]
    total = lambda **p: c.get("/api/overview", params=p).json()["sum_rial_vat"]  # noqa: E731
    assert total() == 1770 and total(main_group="گروه الف") == 1500 and total(main_group="گروه ب") == 200
    assert total(sub_group="زیر ۱") == 1200 and total(main_group="گروه ب", sub_group="زیر ۱") == 200
    by = {r["key"]: r["sum_rial_vat"] for r in c.get("/api/breakdown", params={"by": "main_group"}).json()}
    assert by == {"گروه الف": 1500, "گروه ب": 200}


def test_product_groups_reapplied_when_product_file_changes(tmp_path, monkeypatch):
    s = "SRSalesProcedure1405"
    c = build_client(tmp_path, monkeypatch, {"sr_kg_140507": [make_row(s, "1", "A", "1000", "10", ucode="P1")]},
                     product=product_tsv(("P1", "گروه الف", "زیر ۱")))
    assert c.get("/api/filters").json()["main_group"] == ["گروه الف"]
    from app import ingest
    (tmp_path / "raw" / "product.tsv").write_text(product_tsv(("P1", "گروه ج", "زیر ۹")), encoding="utf-8")
    assert [r["status"] for r in ingest.ingest_all()] == ["loaded", "skipped"]
    opts = c.get("/api/filters").json()
    assert opts["main_group"] == ["گروه ج"] and opts["sub_group"] == ["زیر ۹"]


def test_no_product_file_means_empty_group_options(client):
    opts = client.get("/api/filters").json()
    assert opts["main_group"] == [] and opts["sub_group"] == []


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


# ---------- ورود و دسترسی ----------

def fresh(client):
    from fastapi.testclient import TestClient
    from app import api
    return TestClient(api.app)


def test_every_api_route_requires_login(client):
    from app import api
    anon = fresh(client)
    paths = sorted({r.path for r in api.app.routes if getattr(r, "path", "").startswith("/api/")
                    and r.path != "/api/auth/login" and "{" not in r.path})
    assert "/api/overview" in paths and "/api/invoice-lines" in paths
    for path in paths:
        for method in ("get", "post"):
            res = getattr(anon, method)(path)
            assert res.status_code in (401, 405) and res.status_code != 200, (method, path)
        assert anon.get(path).status_code == 401, path
    assert anon.get("/api/customer/A").status_code == 401
    assert anon.get("/api/nope-not-a-route").status_code == 401
    assert anon.post("/api/sync").status_code == 401


def test_login_sets_httponly_strict_cookie_and_grants_access(client):
    anon = fresh(client)
    res = anon.post("/api/auth/login", json={"username": "admin", "password": TEST_PASSWORD})
    assert res.status_code == 200
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "sr_session=" in cookie
    assert anon.get("/api/overview").status_code == 200
    assert anon.get("/api/overview").headers["cache-control"] == "no-store"


@pytest.mark.parametrize("user,password", [("admin", "wrong"), ("root", TEST_PASSWORD), ("", ""), ("admin", "")])
def test_wrong_credentials_are_rejected(client, user, password):
    anon = fresh(client)
    res = anon.post("/api/auth/login", json={"username": user, "password": password})
    assert res.status_code == 401
    assert "set-cookie" not in res.headers
    assert anon.get("/api/overview").status_code == 401


def test_logout_ends_the_session(client):
    assert client.get("/api/overview").status_code == 200
    assert client.post("/api/auth/logout").status_code == 200
    client.cookies.clear()
    assert client.get("/api/overview").status_code == 401


def test_forged_tampered_and_expired_tokens_are_rejected(client):
    from app import auth
    good = auth.make_token("admin")
    payload, sig = good.split(".")
    other = auth.make_token("admin", now=1)
    for bad in ("", "x", "a.b", good + "x", payload + "." + sig[::-1], payload, other, auth.make_token("root")):
        anon = fresh(client)
        anon.cookies.set("sr_session", bad)
        assert anon.get("/api/overview").status_code == 401, bad
    assert auth.verify_token(good) == "admin"
    assert auth.verify_token(good, now=10**12) is None


def test_token_signed_with_another_secret_is_rejected(client, monkeypatch):
    from app import auth
    monkeypatch.setenv("SR_AUTH_SECRET", "z" * 40)
    forged = auth.make_token("admin")
    monkeypatch.setenv("SR_AUTH_SECRET", "t" * 40)
    anon = fresh(client)
    anon.cookies.set("sr_session", forged)
    assert anon.get("/api/overview").status_code == 401


def test_lockout_after_repeated_failures(client):
    anon = fresh(client)
    codes = [anon.post("/api/auth/login", json={"username": "admin", "password": "x"}).status_code for _ in range(6)]
    assert codes[:5] == [401] * 5 and codes[5] == 429
    assert anon.post("/api/auth/login", json={"username": "admin", "password": TEST_PASSWORD}).status_code == 429
    assert anon.get("/api/overview").status_code == 401


def test_unconfigured_auth_fails_closed(client, monkeypatch):
    monkeypatch.delenv("SR_AUTH_PASS_HASH")
    anon = fresh(client)
    assert anon.post("/api/auth/login", json={"username": "admin", "password": TEST_PASSWORD}).status_code == 503
    assert client.get("/api/overview").status_code == 401
    monkeypatch.setenv("SR_AUTH_PASS_HASH", "garbage")
    assert fresh(client).post("/api/auth/login", json={"username": "admin", "password": "garbage"}).status_code == 401


def test_short_secret_fails_closed(client, monkeypatch):
    monkeypatch.setenv("SR_AUTH_SECRET", "short")
    assert client.get("/api/overview").status_code == 401


def test_password_hash_roundtrip(client):
    from app import auth
    h = auth.hash_password("pässwörd@@")
    assert "pässwörd" not in h and h.startswith("scrypt:")
    assert auth.verify_password("pässwörd@@", h) and not auth.verify_password("pässwörd@", h)
    assert auth.hash_password("a") != auth.hash_password("a")


@pytest.fixture()
def inactive_client(tmp_path, monkeypatch):
    s, promo, ret = "SRSalesProcedure1405", "SRPromotionsProcedure1405", "SRDatedSalesReturnProcedurewithVAT1405"
    return build_client(tmp_path, monkeypatch, {
        "sr_kg_140503": [make_row(s, "d1", "D", "400", "4", date="1405/03/01", vcode="11", vname="علی", branch="شعبه کرج")],
        "sr_kg_140504": [make_row(s, "c1", "C", "300", "3", date="1405/04/01", vcode="11", vname="علی"),
                         make_row(s, "f1", "F", "500", "5", date="1405/04/10", vcode="11", vname="علی"),
                         make_row(s, "f2", "F", "600", "6", date="1405/04/20", vcode="12", vname="رضا")],
        "sr_kg_140505": [make_row(s, "a1", "A", "100", "1", date="1405/05/20", vcode="11", vname="علی"),
                         make_row(s, "b1", "B", "200", "2", date="1405/05/21", vcode="12", vname="رضا")],
        "sr_kg_140507": [make_row(promo, "e1", "E", "70", "1", date="1405/07/05", vcode="11", vname="علی"),
                         make_row(ret, "d2", "D", "-100", "-1", date="1405/07/01", vcode="11", vname="علی", branch="شعبه کرج"),
                         make_row(promo, "c2", "C", "30", "1", date="1405/07/10", vcode="11", vname="علی"),
                         make_row(s, "g1", "G", "50", "1", date="1405/07/18", vcode="12", vname="رضا")]})


def test_inactive_customers_use_paid_sales_before_the_window(inactive_client):
    j = inactive_client.get("/api/inactive-customers").json()
    assert j["available"] and j["as_of"] == "1405/07/18" and j["window_start"] == "1405/05/21" and j["days"] == 60
    # B bought exactly on the first window day, G on the last day: both active. E has promotion rows only: never a customer.
    assert [i["code"] for i in j["items"]] == ["F", "D", "C", "A"]
    assert (j["total_customers"], j["active_customers"], j["inactive_customers"]) == (6, 2, 4)
    assert j["lost_sales_rial"] == 1100 + 400 + 300 + 100 and j["inactive_percent"] == pytest.approx(4 / 6)
    by = {i["code"]: i for i in j["items"]}
    # promotion (C) and return (D) rows after the last purchase do not make a customer active
    assert by["C"]["last_purchase"] == "1405/04/01" and by["D"]["last_purchase"] == "1405/03/01"
    assert by["D"]["sales_rial"] == 400 and by["D"]["branch"] == "شعبه کرج"
    # the visitor shown is the one on the last paid purchase
    assert by["F"]["visitor_code"] == "12" and by["F"]["invoices"] == 2 and by["F"]["sales_rial"] == 1100
    assert by["A"]["days_since"] == 59 + 1 and by["F"]["share"] == pytest.approx(1100 / 1900)
    assert {v["code"]: v["customers"] for v in j["by_visitor"]} == {"11": 3, "12": 1}
    assert j["by_visitor"][0]["code"] == "12" and j["by_visitor"][0]["sales_rial"] == 1100


def test_inactive_window_length_filters_and_core(inactive_client):
    assert [i["code"] for i in inactive_client.get("/api/inactive-customers", params={"days": 30}).json()["items"]] \
        == ["F", "D", "C", "B", "A"]
    assert [i["code"] for i in inactive_client.get("/api/inactive-customers", params={"branch": "شعبه کرج"}).json()["items"]] == ["D"]
    assert inactive_client.get("/api/inactive-customers", params={"days": 3}).status_code == 422
    assert inactive_client.get("/api/inactive-customers", params={"core": "zz"}).status_code == 400
    assert inactive_client.get("/api/inactive-customers", params={"core": "ch"}).json()["available"] is False
    assert inactive_client.get("/api/inactive-customers/export", params={"core": "ch"}).status_code == 404


def test_inactive_customers_export_is_a_valid_xlsx(inactive_client):
    import io
    import zipfile
    from xml.etree import ElementTree

    r = inactive_client.get("/api/inactive-customers/export")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert "inactive-customers-kg-1405-07-18.xlsx" in r.headers["content-disposition"]
    z = zipfile.ZipFile(io.BytesIO(r.content))
    for name in z.namelist():
        if name.endswith(".xml") or name.endswith(".rels"):
            ElementTree.fromstring(z.read(name))
    sheet = z.read("xl/worksheets/sheet1.xml").decode()
    assert 'rightToLeft="1"' in sheet and "<v>1100</v>" in sheet and sheet.count("<row ") == 5
    assert "مشتریان غیرفعال" in z.read("xl/workbook.xml").decode()
    assert "<v>1900</v>" in z.read("xl/worksheets/sheet2.xml").decode()


def test_inactive_report_needs_login_and_its_own_page(inactive_client):
    from app import rbac
    anon = fresh(inactive_client)
    assert anon.get("/api/inactive-customers").status_code == 401
    assert anon.get("/api/inactive-customers/export").status_code == 401
    assert rbac.access_for("GET", "/api/inactive-customers/export") == ("pages", ("inactive",))
    assert rbac.access_for("GET", "/api/inactive-customers") == ("pages", ("inactive",))


def test_invoice_compare_same_day_last_month(tmp_path, monkeypatch):
    s = "SRSalesProcedure1405"
    c = build_client(tmp_path, monkeypatch, {
        "sr_kg_140506": [make_row(s, "p1", "C1", "1000", "10", date="1405/06/10", brand="A")],
        "sr_kg_140507": [
            make_row(s, "c1", "C1", "3000", "30", date="1405/07/05", brand="A"),
            make_row(s, "c2", "C2", "1000", "10", date="1405/07/20", brand="A"),
            make_row(s, "c3", "C3", "9999", "99", date="1405/07/28", brand="A")],
    })
    body = c.get("/api/invoice-compare", params={"core": "kg", "day": "1405/07/27"}).json()
    assert body["available"] is True
    assert body["current"]["from"] == 14050701 and body["current"]["to"] == 14050727
    assert body["previous"]["from"] == 14050601 and body["previous"]["to"] == 14050627
    assert body["current"]["invoices"] == 2
    assert body["previous"]["invoices"] == 1
    assert body["change"]["invoices"] == 1.0
    assert body["change"]["sales_rial"] == (body["current"]["sales_rial"] - body["previous"]["sales_rial"]) / body["previous"]["sales_rial"]
