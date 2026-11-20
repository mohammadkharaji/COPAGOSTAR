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


# ---------- ladder plans: creation, leaderboard, scorecard ----------

LAD = [[0.6, 8.75], [0.7, 11.38], [0.8, 14.79], [0.9, 19.23], [1.05, 25]]


def cfg(**over):
    base = {"kpis": [{"key": "rial", "label": "ریالی کل", "metric": "rial", "weight": 0.6, "ladder": LAD},
                     {"key": "cov", "label": "پوشش", "metric": "coverage", "weight": 0.4, "ladder": LAD}],
            "grade_bands": [{"grade": "C", "min_rial": 0}, {"grade": "B", "min_rial": 500}],
            "prize_table": [{"rank_from": 1, "rank_to": 1, "amount": 100}]}
    return {**base, **over}


def ladder_plan(c, **over):
    body = {"name": "نردبان", "core": "kg", "start_key": 14050701, "end_key": 14050830, "plan_type": "ladder",
            "config": cfg(), **over}
    return c.post("/api/club/visitor/plans", json=body)


def test_ladder_plan_rejects_bad_weights_and_unaligned_window(client):
    bad = cfg()
    bad["kpis"][0]["weight"] = 0.5
    assert ladder_plan(client, config=bad).status_code == 400
    assert ladder_plan(client, start_key=14050702).status_code == 400
    assert ladder_plan(client, end_key=14050829).status_code == 400
    # name needs 2+ characters (PlanBody.min_length), or FastAPI answers 422 before the route's ladder-kind rule runs
    assert client.post("/api/club/b2b/plans", json={"name": "xy", "core": "kg", "start_key": 14050701,
                                                    "end_key": 14050730, "plan_type": "ladder",
                                                    "config": cfg()}).status_code == 400


def test_leaderboard_scores_grades_and_ranks(client):
    pid = ladder_plan(client).json()["id"]
    body = client.get("/api/club/visitor/points", params={"plan_id": pid}).json()
    assert [m["month"] for m in body["months"]] == ["140507", "140508"]
    assert [m["completed"] for m in body["months"]] == [True, False]        # last sales day is 1405/08/03
    rows = {r["code"]: r for r in body["rows"]}
    ali, reza = rows["11"], rows["12"]
    # Ali 140507: rial 1000/1200 = 0.833 -> 14.79*0.6 = 8.874 ; coverage 2/3 = 0.667 -> 8.75*0.4 = 3.5
    assert ali["months"]["140507"] == pytest.approx(12.374)
    assert ali["total"] == pytest.approx(12.374) and ali["tenure"] == 1          # 140508 provisional, not counted
    assert ali["provisional_month"]["month"] == "140508"
    # Ali 140508: rial 1000/1000 = 1.0 -> 19.23*0.6 ; no coverage target -> 0
    assert ali["provisional_month"]["score"] == pytest.approx(11.538)
    assert reza["months"]["140507"] == 0 and reza["total"] == 0               # negative rial, no coverage target
    assert ali["rank_national"] == 1 and reza["rank_national"] == 2 and ali["prize"] == 100 and reza["prize"] is None
    assert ali["grade"] == "C" and reza["grade"] == "C"                        # no sales before 1405/07


def test_scorecard_kpis_and_note(client):
    pid = ladder_plan(client).json()["id"]
    sc = client.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11", "month": "140507"}).json()
    kp = {k["key"]: k for k in sc["kpis"]}
    assert kp["rial"]["target"] == 1200 and kp["rial"]["actual"] == 1000 and kp["rial"]["score"] == 14.79
    assert kp["cov"]["target"] == 3 and kp["cov"]["actual"] == 2 and kp["cov"]["weighted"] == pytest.approx(3.5)
    assert sc["ladder_max"] == 25 and sc["note"] is None
    assert sc["sales_rial"] == 1000
    assert sc["customers_count"] == 2
    sc2 = client.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "12", "month": "140508"}).json()
    assert sc2["kpis"] == [] and "هدفی" in sc2["note"]
    assert sc2["sales_rial"] is None and sc2["customers_count"] is None


def test_rial_achievement_equals_target_page(client):
    pid = ladder_plan(client).json()["id"]
    sc = client.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11", "month": "140507"}).json()
    tgt = client.get("/api/target", params={"month": "140507", "by": "visitor"}).json()
    row = next(r for r in tgt["rows"] if r.get("code") == "11")
    rial = next(k for k in sc["kpis"] if k["key"] == "rial")
    assert rial["ratio"] == pytest.approx(row["achieved_pct"])


def test_club_account_reads_only_its_own_scorecard(client):
    pid = ladder_plan(client).json()["id"]
    client.post("/api/admin/roles/defaults")
    role = next(x for x in client.get("/api/admin/roles").json() if x["name"] == "Sales Power Club")
    assert client.post("/api/admin/users", json={"username": "vis11", "password": "password-123",
                                                 "role_id": role["id"]}).status_code == 201
    assert client.put("/api/club/link", json={"username": "vis11", "kind": "visitor", "code": "11"}).status_code == 200
    from fastapi.testclient import TestClient
    from app.api import app
    u = TestClient(app, base_url="https://testserver")
    assert u.post("/api/auth/login", json={"username": "vis11", "password": "password-123"}).status_code == 200
    assert u.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11"}).status_code == 200
    assert u.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "12"}).status_code == 403


# ---------- A4 gates: degrade, never leak a raw DuckDB error ----------

def test_ladder_plan_degrades_without_target_files(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, sales())
    pid = ladder_plan(c).json()["id"]
    body = c.get("/api/club/visitor/points", params={"plan_id": pid}).json()
    assert body["available"] is False and "بارگذاری" in body["reason"] and body["rows"] == []
    sc = c.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11"}).json()
    assert sc["available"] is False and "بارگذاری" in sc["reason"]


def test_ladder_plan_degrades_for_unsupported_core(client):
    pid = ladder_plan(client, core="ch").json()["id"]
    body = client.get("/api/club/visitor/points", params={"plan_id": pid}).json()
    assert body["available"] is False and "تعریف نشده" in body["reason"]


def test_ladder_plan_reports_missing_database(client, tmp_path):
    pid = ladder_plan(client).json()["id"]
    (tmp_path / "t.duckdb").unlink()
    r = client.get("/api/club/visitor/points", params={"plan_id": pid})
    assert r.status_code == 503
    assert client.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11"}).status_code == 503


def test_ladder_plan_degrades_without_fact_sales(client):
    pid = ladder_plan(client).json()["id"]
    from app.db import connect
    con = connect()
    try:
        con.execute("DROP TABLE fact_sales")
    finally:
        con.close()
    body = client.get("/api/club/visitor/points", params={"plan_id": pid}).json()
    assert body["available"] is False and "بارگذاری" in body["reason"]


# ---------- A7: deferred Minors from Task 4 ----------

def test_return_only_customer_is_not_coverage(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, {"sr_kg_140507": [
        make_row(S, "1", "C1", "1000", "1", vcode="11", vname="علی", ucode="P1", date="1405/07/05", line=LINE),
        make_row(RET, "2", "C2", "-50", "-1", vcode="11", vname="علی", ucode="P1", date="1405/07/06", line=LINE),
        make_row(PROMO, "3", "C3", "10", "1", vcode="11", vname="علی", ucode="P1", date="1405/07/07", line=LINE),
    ]}, product=PRODUCT)
    (tmp_path / "raw" / "target_kg_140507.tsv").write_text(target_tsv(
        trow("140507", "شعبه تهران", "دسته A", "گروه الف", 1000, "11", "علی", "3")), encoding="utf-8")
    from app import ingest
    ingest.ingest_all()
    from app import club_ladder_data as D
    from app.db import connect
    con = connect(read_only=True)
    try:
        vm = D.load_visitor_months(con, KG, ["140507"])[0]
    finally:
        con.close()
    # C2's only row is a return and C3's only row is a promotion: neither is a covered customer
    assert vm.coverage_actual == 1 and vm.coverage_target == 3


def test_coverage_target_takes_the_maximum_of_duplicate_rows(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, sales(), product=PRODUCT)
    (tmp_path / "raw" / "target_kg_140507.tsv").write_text(target_tsv(
        trow("140507", "شعبه تهران", "دسته A", "گروه الف", 500, "11", "علی", "2"),
        trow("140507", "شعبه تهران", "دسته B", "گروه ب", 500, "11", "علی", "5")), encoding="utf-8")
    from app import ingest
    ingest.ingest_all()
    from app import club_ladder_data as D
    from app.db import connect
    con = connect(read_only=True)
    try:
        vm = next(v for v in D.load_visitor_months(con, KG, ["140507"]) if v.code == "11")
    finally:
        con.close()
    assert vm.coverage_target == 5


def test_basket_groups_skip_zero_target_groups():
    from app import club_ladder_data as D
    vm = D.VisitorMonth(
        code="11", name="علی", branch="شعبه تهران", month="140507",
        rial_targets={"گروه الف": 0.0, "گروه ب": 100.0, D.ALL: 100.0},
        rial_actuals={"گروه الف": 50.0, "گروه ب": 100.0, D.ALL: 150.0},
        coverage_target=None, coverage_actual=0)
    # a zero target must not divide by zero, and must never count as a reached group, whatever the threshold
    assert D.basket_groups(vm, 0.5) == 1
    assert D.basket_groups(vm, 0.0) == 1


def test_member_routes_survive_a_ladder_plan(client):
    """A ladder plan stores rial_per_point=0; the linear scoring paths must not divide by it."""
    ladder_plan(client)
    client.post("/api/admin/roles/defaults")
    role = next(x for x in client.get("/api/admin/roles").json() if x["name"] == "Sales Power Club")
    client.post("/api/admin/users", json={"username": "vis11", "password": "password-123", "role_id": role["id"]})
    client.put("/api/club/link", json={"username": "vis11", "kind": "visitor", "code": "11"})
    from fastapi.testclient import TestClient
    from app.api import app
    u = TestClient(app, base_url="https://testserver")
    assert u.post("/api/auth/login", json={"username": "vis11", "password": "password-123"}).status_code == 200
    assert u.get("/api/club/me").status_code == 200
    assert u.get("/api/club/visitor/team").status_code == 200


def test_member_team_endpoint_carries_ladder_summary(client):
    pid = ladder_plan(client).json()["id"]
    client.post("/api/admin/roles/defaults")
    role = next(x for x in client.get("/api/admin/roles").json() if x["name"] == "Sales Power Club")
    client.post("/api/admin/users", json={"username": "vis11", "password": "password-123", "role_id": role["id"]})
    client.put("/api/club/link", json={"username": "vis11", "kind": "visitor", "code": "11"})
    from fastapi.testclient import TestClient
    from app.api import app
    u = TestClient(app, base_url="https://testserver")
    u.post("/api/auth/login", json={"username": "vis11", "password": "password-123"})
    body = u.get("/api/club/visitor/team", params={"plan_id": pid}).json()
    s = body["visitor_summary"]
    assert s["points"] == pytest.approx(12.37, abs=0.01) and s["tier"]["level"] == "C" and s["tier"]["rank_national"] == 1
    assert [h["month"] for h in s["history"]] == ["140507", "140508"] and s["history"][1]["provisional"] is True
    assert body["scorecard"]["month"] == "140508" and body["plan"]["plan_type"] == "ladder"
    assert body["plans"][0]["id"] == pid
    assert s["sales_rial"] == 1000 and s["customers_count"] == 1
    previous = u.get("/api/club/visitor/team", params={"plan_id": pid, "month": "140507"})
    assert previous.status_code == 200
    assert previous.json()["scorecard"]["month_provisional"] is False
    assert previous.json()["visitor_summary"]["customers_count"] == 2
    assert u.get("/api/club/visitor/team", params={"plan_id": 9999}).status_code == 404
    assert u.get("/api/club/visitor/team", params={"plan_id": pid, "month": "140509"}).status_code == 400
    assert u.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "12"}).status_code == 403
    me = u.get("/api/club/me").json()
    assert me["plans"][0]["tier"]["level"] == "C" and me["plans"][0]["points"] == pytest.approx(12.37, abs=0.01)


def test_scorecard_next_steps_and_missing_targets(client):
    pid = ladder_plan(client).json()["id"]
    sc = client.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11", "month": "140507"}).json()
    rial = next(k for k in sc["kpis"] if k["metric"] == "rial")
    assert rial["next_step"]["additional"] == pytest.approx(80)
    assert rial["next_step"]["weighted_gain"] == pytest.approx((19.23 - 14.79) * .6)
    assert sc["data_cutoff"] == 14050803
    latest = client.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11"}).json()
    coverage = next(k for k in latest["kpis"] if k["metric"] == "coverage")
    assert coverage["target_missing"] is True and coverage["next_step"] is None
    assert client.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11", "month": "140513"}).status_code == 400


def test_plan_dates_must_be_real_jalali_dates(client):
    assert ladder_plan(client, start_key=14051301).status_code == 400
    assert ladder_plan(client, end_key=14050831).status_code == 400


def test_plan_options_prioritize_current_then_upcoming_then_archive():
    from app.club import _plan_options
    def plan(id, start, end, active=True):
        return {"id": id, "start_key": start, "end_key": end, "active": active}
    plans = [plan(1, 14050101, 14050231), plan(2, 14050801, 14050830),
             plan(3, 14050901, 14050930), plan(4, 14050801, 14050830, False)]
    options = _plan_options(plans, today=14050820)
    assert [p["id"] for p in options] == [2, 3, 1, 4]
    assert [p["status"] for p in options] == ["current", "upcoming", "archived", "inactive"]
