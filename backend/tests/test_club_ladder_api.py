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
        make_row(PROMO, "3", "C3", "50", "1", vcode="11", vname="علی", ucode="P1", date="1405/07/07", line=LINE),  # promo counts in rial, not coverage
        make_row(S, "4", "C9", "300", "1", vcode="12", vname="رضا", ucode="P1", date="1405/07/08", line=LINE),
        make_row(RET, "5", "C9", "-500", "-1", vcode="12", vname="رضا", ucode="P1", date="1405/07/09", line=LINE),  # net negative
        # رضا sells a group he holds no target for: 60 in دسته B (گروه ب) while his only target is دسته A
        make_row(S, "7", "C9", "60", "1", vcode="12", vname="رضا", ucode="P2", date="1405/07/10", line=LINE),
    ], "sr_kg_140508": [
        make_row(S, "6", "C1", "1000", "1", vcode="11", vname="علی", ucode="P1", date="1405/08/03", line=LINE),
    ]}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, sales(), product=PRODUCT)
    (tmp_path / "raw" / "target_kg_140507.tsv").write_text(target_tsv(
        trow("140507", "شعبه تهران", "دسته A", "گروه الف", 1000, "11", "علی", "3"),
        trow("140507", "شعبه تهران", "دسته B", "گروه ب", 200, "11", "علی", "3"),
        trow("140507", "شعبه کرج", "دسته A", "گروه الف", 1000, "", "رضا")), encoding="utf-8")  # no code: matched by unique name
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
    # 300 - 500 + 60 (the دسته B sale, which has no target row for رضا)
    assert reza.branch == "شعبه کرج" and reza.rial_actuals["__all__"] == -140 and reza.coverage_target is None
    assert D.basket_groups(ali, 0.7) == 1          # الف 0.9 passes, ب 0.5 does not


def test_sold_groups_without_a_target_are_keyed_and_add_up(client):
    from app import club_ladder_data as D
    from app.db import connect
    con = connect(read_only=True)
    try:
        vms = {(v.code, v.month): v for v in D.load_visitor_months(con, KG, ["140507"])}
        last = D.last_sales_key(con, KG)
    finally:
        con.close()
    ali, reza = vms[("11", "140507")], vms[("12", "140507")]

    # the group lines add up to __all__ for both visitors
    for vm in (ali, reza):
        assert sum(v for g, v in vm.rial_actuals.items() if g != D.ALL) == vm.rial_actuals[D.ALL]

    # رضا sold 60 in دسته B (گروه ب) but holds no target row for it: the sale keeps its own line
    assert reza.rial_actuals["گروه ب"] == 60
    assert reza.rial_actuals["گروه الف"] == -200 and reza.rial_actuals[D.ALL] == -140
    assert "گروه ب" not in reza.rial_targets        # a sale never invents a target
    assert ali.rial_actuals["گروه ب"] == 100        # targeted groups keep their line

    assert last == 14050803                         # MAX(jdate_key), the 1405/08/03 sale


def test_kpi_inputs_shapes_and_a_mixed_group_kpi_reads_the_sale():
    """Pure: the (target, actual) contract, and why the untargeted sale must keep its group key."""
    from dataclasses import replace

    from app import club_ladder_data as D
    from app.club_ladder import Kpi, LadderConfig, month_score
    vm = D.VisitorMonth(
        code="12", name="رضا", branch="شعبه کرج", month="140507",
        rial_targets={"گروه الف": 1000.0, D.ALL: 1000.0},
        rial_actuals={"گروه الف": -200.0, "گروه ب": 900.0, D.ALL: 700.0},
        coverage_target=None, coverage_actual=2)
    lad = [[0.6, 8.75]]

    def kpi(key, metric, **kw):
        return Kpi(key=key, label=key, metric=metric, weight=1.0, ladder=lad, **kw)

    assert D.kpi_inputs(vm, kpi("r", "rial")) == (1000.0, 700.0)      # no filter -> __all__
    assert D.kpi_inputs(vm, kpi("g", "rial", product_groups=["گروه ب"])) == (0.0, 900.0)
    assert D.kpi_inputs(vm, kpi("c", "coverage")) == (None, 2.0)      # no target -> None
    assert D.kpi_inputs(vm, kpi("b", "basket")) == (None, 0.0)

    # a KPI over a targeted and an untargeted group: the untargeted sale moves the ratio AND the score
    mixed = kpi("m", "rial", product_groups=["گروه الف", "گروه ب"])
    cfg = LadderConfig(kpis=[mixed], grade_bands=[], prize_table=[])
    score, rows = month_score(cfg, {"m": D.kpi_inputs(vm, mixed)}, 0)
    assert rows[0]["ratio"] == 0.7 and score == 8.75                  # (-200 + 900) / 1000

    # the shape before this fix: the sale had no group key, so it was invisible to the same KPI
    hidden = replace(vm, rial_actuals={"گروه الف": -200.0, D.ALL: -200.0})
    assert month_score(cfg, {"m": D.kpi_inputs(hidden, mixed)}, 0)[0] == 0.0
