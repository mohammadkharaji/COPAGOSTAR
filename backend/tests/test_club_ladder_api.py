"""Ladder plans on seeded sales + target rows: two visitors, two months."""
import pytest
from test_api import build_client, make_row, product_tsv
from test_target import target_tsv, LINE

S = "SRSalesProcedure1405"; RET = "SRDatedSalesReturnProcedurewithVAT1405"; PROMO = "SRPromotionsProcedure1405"
PRODUCT = product_tsv(("P1", "گروه الف", "ز", "دسته A"), ("P2", "گروه ب", "ز", "دسته B"))
KG = "کوپا گستر"


def trow(month, branch, cat, group, rial, code, name, cov=""):
    return [month, branch, LINE, cat, group, code, name, "سرپرست", "مدیر", str(rial), cov]


def sales():
    return {"sr_kg_140507": [
        make_row(S, "1", "C1", "850", "1", vcode="11", vname="علی", ucode="P1", date="1405/07/05", line=LINE),
        make_row(S, "2", "C2", "100", "1", vcode="11", vname="علی", ucode="P2", date="1405/07/06", line=LINE),
        make_row(PROMO, "3", "C3", "50", "1", vcode="11", vname="علی", ucode="P1", date="1405/07/07", line=LINE),
        make_row(S, "4", "C9", "300", "1", vcode="12", vname="رضا", ucode="P1", date="1405/07/08", line=LINE),
        make_row(RET, "5", "C9", "-500", "-1", vcode="12", vname="رضا", ucode="P1", date="1405/07/09", line=LINE),
    ], "sr_kg_140508": [
        make_row(S, "6", "C1", "1000", "1", vcode="11", vname="علی", ucode="P1", date="1405/08/03", line=LINE),
    ]}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, sales(), product=PRODUCT)
    (tmp_path / "raw" / "target_kg_140507.tsv").write_text(target_tsv(
        trow("140507", "شعبه تهران", "دسته A", "گروه الف", 1000, "11", "علی", "3"),
        trow("140507", "شعبه تهران", "دسته B", "گروه ب", 200, "11", "علی", "3"),
        trow("140507", "شعبه کرج", "دسته A", "گروه الف", 1000, "", "رضا")), encoding="utf-8")
    (tmp_path / "raw" / "target_kg_140508.tsv").write_text(target_tsv(
        trow("140508", "شعبه تهران", "دسته A", "گروه الف", 1000, "11", "علی")), encoding="utf-8")
    from app import ingest
    assert all(r["status"] == "loaded" for r in ingest.ingest_all() if r["file"].startswith("target_"))
    return c


def test_visitor_months_use_target_page_actuals(client):
    from app import club_ladder_data as D
    from app.db import connect
    con = connect(read_only=True)
    try:
        vms = {(v.code, v.month): v for v in D.load_visitor_months(con, KG, ["140506", "140507", "140508"])}
    finally:
        con.close()
    assert set(vms) == {("11", "140507"), ("12", "140507"), ("11", "140508")}   # 140506 has no target file
    ali = vms[("11", "140507")]
    assert ali.rial_targets == {"گروه الف": 1000, "گروه ب": 200, "__all__": 1200}
    assert ali.rial_actuals == {"گروه الف": 900, "گروه ب": 100, "__all__": 1000}   # promo 50 included
    assert ali.coverage_target == 3 and ali.coverage_actual == 2
    reza = vms[("12", "140507")]
    assert reza.branch == "شعبه کرج" and reza.rial_actuals["__all__"] == -200 and reza.coverage_target is None
    assert D.basket_groups(ali, 0.7) == 1          # الف 0.9 passes, ب 0.5 does not
