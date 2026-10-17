"""Tests for the monthly target report (GET /api/target) and its loader."""
import pytest
from test_api import build_client, make_row, product_tsv

from app.schema import TARGET_COLS

S = "SRSalesProcedure1405"
RET = "SRDatedSalesReturnProcedurewithVAT1405"
PRODUCT = product_tsv(("P1", "گروه الف", "زیر ۱", "دسته A"), ("P2", "گروه الف", "زیر ۲", "دسته B"),
                      ("P3", "گروه ب", "زیر ۱", "دسته C"))
LINE = "لاین سوپرمارکت"


def trow(branch, cat, rial, code, name, sup="سرپرست ۱", mgr="مدیر ۱", month="140507", line=LINE):
    return [month, branch, line, cat, "گروه", code, name, sup, mgr, str(rial)]


def target_tsv(*rows):
    return "\x1f".join(TARGET_COLS) + "\x1e" + "".join("\x1f".join(r) + "\x1e" for r in rows)


def sales():
    return {"sr_kg_140507": [
        make_row(S, "1", "A", "1000", "10", vcode="11", vname="علی رضایی", ucode="P1", date="1405/07/05", line=LINE),
        make_row(S, "2", "B", "500", "5", vcode="12", vname="رضا احمدی", ucode="P2", date="1405/07/10", line=LINE),
        make_row(RET, "3", "A", "-200", "-2", vcode="11", vname="علی رضایی", ucode="P1", date="1405/07/11", line=LINE),
        make_row(S, "4", "B", "300", "3", vcode="13", vname="بدون تارگت", ucode="P1", date="1405/07/12", line=LINE),
        make_row(S, "5", "A", "70", "1", vcode="11", vname="علی رضایی", ucode="NOPE", date="1405/07/12", line=LINE),  # no target category
        make_row("SRPromotionsProcedure1405", "6", "B", "50", "1", vcode="12", vname="رضا احمدی", ucode="P2", date="1405/07/13", line=LINE)]}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, sales(), product=PRODUCT)
    (tmp_path / "raw" / "target_kg_140507.tsv").write_text(target_tsv(
        trow("شعبه تهران", "دسته A", 2000, "11", "علی رضایی"),
        trow("شعبه تهران", "دسته B", 1000, "12", "رضا احمدی", sup="سرپرست ۲"),
        # no code in the file: matched through its unique name in the sales data
        trow("شعبه تهران", "دسته C", 400, "", "رضا احمدی", sup="سرپرست ۲"),
        # no code and no such name in sales: counted for branch / manager / supervisor only
        trow("شعبه کرج", "دسته A", 600, "", "ویزیتور جدید", sup="سرپرست ۳", mgr="مدیر ۲")), encoding="utf-8")
    from app import ingest
    assert any(r["file"] == "target_kg_140507.tsv" and r["status"] == "loaded" for r in ingest.ingest_all())
    return c


def get(c, **p):
    r = c.get("/api/target", params={"month": "140507", **p})
    assert r.status_code == 200, r.text
    return r.json()


def test_totals_follow_sales_rules(client):
    j = get(client)
    s = j["summary"]
    assert s["target_rial"] == 3400 + 600
    # same number as the overview: promotion rows count, the return is netted, products without a target category are included
    # 1000 - 200 + 500 + 300 + 70 (no target category) + 50 (promotion)
    assert s["actual_rial"] == 1720 and j["quality"]["sales_outside_target_categories_rial"] == 70
    assert s["achieved_pct"] == pytest.approx(0.43)
    assert j["quality"]["visitors_in_target"] == 3
    cats = {r["label"] for r in get(client, by="category")["rows"]}
    assert cats == {"دسته A", "دسته B", "دسته C", "سایر (بدون تارگت)"}
    assert next(r for r in get(client, by="category")["rows"] if r["label"] == "سایر (بدون تارگت)")["actual_rial"] == 70


def test_grouping_by_branch_manager_supervisor(client):
    by = lambda k: {r["label"]: (r["target_rial"], r["actual_rial"]) for r in get(client, by=k)["rows"]}  # noqa: E731
    assert by("branch") == {"شعبه تهران": (3400, 1720), "شعبه کرج": (600, 0)}
    assert by("manager") == {"مدیر ۱": (3400, 1720), "مدیر ۲": (600, 0)}
    assert by("supervisor")["سرپرست ۲"][0] == 1400


def test_visitor_matching_by_code_then_unique_name(client):
    j = get(client, by="visitor")
    rows = {r["label"]: r for r in j["rows"]}
    assert rows["علی رضایی"]["target_rial"] == 2000 and rows["علی رضایی"]["actual_rial"] == 870
    # the file row without a code is attached to that name's code (12)
    assert rows["رضا احمدی"]["target_rial"] == 1400 and rows["رضا احمدی"]["actual_rial"] == 550
    nocode = next(r for r in j["rows"] if r["key"] == "__no_code__")
    assert nocode["target_rial"] == 600 and nocode["actual_rial"] == 0 and nocode["status"] is None
    other = next(r for r in j["rows"] if r["key"] == "__other__")
    assert other["target_rial"] == 0 and other["actual_rial"] == 300  # sold by a visitor that has no target
    assert j["quality"]["visitors_without_code"] == 1  # only the one that could not be matched by name


def test_filters_and_cascading_options(client):
    j = get(client, by="visitor", branch="شعبه کرج")
    assert j["summary"]["target_rial"] == 600 and j["options"]["branch"] == ["شعبه تهران", "شعبه کرج"]
    assert j["options"]["supervisor"] == ["سرپرست ۳"]
    assert get(client, supervisor="سرپرست ۲")["summary"]["target_rial"] == 1400


def test_expected_share_uses_dashboard_working_day_rule(client, monkeypatch):
    j = get(client)
    # last day with data is 1405/07/13 (the promotion row); Mehr has 30 days, Fridays are off
    assert j["as_of"] == "1405/07/13" and j["working_days"] == 26
    assert j["expected_pct"] == pytest.approx(j["elapsed_working_days"] / 26)
    assert j["daily"][-1]["expected_cum_rial"] == pytest.approx(4000)
    cum = [d["actual_cum_rial"] for d in j["daily"] if d["actual_cum_rial"] is not None]
    assert len(cum) == 13 and cum[-1] == 1720  # the day-11 return lowers the running total
    from app import target
    monkeypatch.setattr(target, "HOLIDAYS", ("1405/07/20",))
    assert get(client)["working_days"] == 25


def test_status_thresholds():
    from app import target
    assert target._status(100, 100) == "ahead" and target._status(95, 100) == "near"
    assert target._status(80, 100) == "behind" and target._status(1, 0) is None


def test_reloading_a_month_replaces_it_and_bad_requests(client, tmp_path):
    from app import ingest
    (tmp_path / "raw" / "target_kg_140507.tsv").write_text(target_tsv(
        trow("شعبه تهران", "دسته A", 500, "11", "علی رضایی")), encoding="utf-8")
    assert [r["status"] for r in ingest.ingest_all() if r["file"].startswith("target_")] == ["loaded"]
    assert get(client)["summary"]["target_rial"] == 500
    assert client.get("/api/target", params={"month": "140601"}).status_code == 404
    assert client.get("/api/target", params={"by": "nope"}).status_code == 400
    assert client.get("/api/target", params={"month": "abc"}).status_code == 400


def test_bad_file_is_rejected_without_touching_loaded_data(client, tmp_path):
    from app import ingest
    bad = tmp_path / "raw" / "target_kg_140508.tsv"
    bad.write_text(target_tsv(trow("شعبه تهران", "دسته A", 500, "11", "علی رضایی", month="140507")), encoding="utf-8")
    with pytest.raises(ValueError, match="does not match the file name"):
        ingest.ingest_all()
    bad.write_text("x\x1fy\x1e", encoding="utf-8")
    with pytest.raises(ValueError, match="unexpected columns"):
        ingest.ingest_all()
    bad.unlink()
    assert get(client)["summary"]["target_rial"] == 4000


def test_no_target_loaded_reports_unavailable(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, sales(), product=PRODUCT)
    j = c.get("/api/target").json()
    assert j["available"] is False and j["months"] == [] and "بارگذاری" in j["reason"]
    assert c.get("/api/target", params={"core": "ch"}).json()["available"] is False
