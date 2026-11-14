"""Points on real seeded sales rows, plus own-code isolation for club accounts."""
from app import club, club_store

from test_api import build_client, make_row

S = "SRSalesProcedure1405"
PROMO = "SRPromotionsProcedure1405"
RET = "SRDatedSalesReturnProcedurewithVAT1405"


def seeded(tmp_path, monkeypatch):
    rows = [
        make_row(S, "i1", "C1", "1000000", "10", vcode="V1", vname="ویزیتور یک", date="1405/07/05"),
        make_row(S, "i2", "C1", "500000", "5", vcode="V1", vname="ویزیتور یک", date="1405/07/20"),
        make_row(PROMO, "p1", "C1", "900000", "9", vcode="V1", vname="ویزیتور یک", date="1405/07/10"),  # promo: excluded
        make_row(RET, "r1", "C1", "-200000", "-2", vcode="V1", vname="ویزیتور یک", date="1405/07/12"),  # return: excluded
        make_row(S, "i3", "C2", "300000", "3", vcode="V2", vname="ویزیتور دو", date="1405/07/08"),
        make_row(S, "i4", "C2", "100000", "1", vcode="V2", vname="ویزیتور دو", date="1405/06/30"),     # before window
    ]
    return build_client(tmp_path, monkeypatch, {"sr_kg_140507": rows})


def test_points_match_hand_computed_values(tmp_path, monkeypatch):
    c = seeded(tmp_path, monkeypatch)
    # Plan July 1405, 500,000 Rial per point.
    r = c.post("/api/club/b2b/plans", json={"name": "تیر ۱۴۰۵", "core": "kg", "start_key": 14050701,
                                             "end_key": 14050731, "rial_per_point": 500000})
    assert r.status_code == 201
    plan_id = r.json()["id"]
    rows = {x["code"]: x for x in c.get("/api/club/b2b/points", params={"plan_id": plan_id}).json()["rows"]}
    # C1: 1,000,000 + 500,000 sales - 200,000 return = 1,300,000 net sales -> 2 points. Promo excluded, return deducted.
    assert rows["C1"]["sales_rial"] == 1300000 and rows["C1"]["points"] == 2
    # C2: 300,000 in window (the 100,000 before 1405/07/01 is out) -> 0 points, still listed with its sales.
    assert rows["C2"]["sales_rial"] == 300000 and rows["C2"]["points"] == 0


def test_points_floor_on_partial_block(tmp_path, monkeypatch):
    c = seeded(tmp_path, monkeypatch)
    r = c.post("/api/club/b2b/plans", json={"name": "صد هزار", "core": "kg", "start_key": 14050701,
                                             "end_key": 14050731, "rial_per_point": 400000})
    rows = {x["code"]: x for x in c.get("/api/club/b2b/points", params={"plan_id": r.json()["id"]}).json()["rows"]}
    # 1,300,000 / 400,000 = 3.25 -> 3 (floor, no partial points).
    assert rows["C1"]["points"] == 3


def test_club_account_sees_only_its_own_code(tmp_path, monkeypatch):
    c = seeded(tmp_path, monkeypatch)
    c.post("/api/club/b2b/plans", json={"name": "تیر", "core": "kg", "start_key": 14050701,
                                         "end_key": 14050731, "rial_per_point": 500000})
    # Create a club account through the admin API, then link it to C1.
    c.post("/api/admin/roles/defaults")
    role = next(x for x in c.get("/api/admin/roles").json() if x["name"] == "CustomerClub")
    assert c.post("/api/admin/users", json={"username": "cust1", "password": "password-123",
                                             "role_id": role["id"]}).status_code == 201
    assert c.put("/api/club/link", json={"username": "cust1", "kind": "b2b", "code": "C1"}).status_code == 200
    # Log in as the club user with a fresh client (cookies are per client).
    from fastapi.testclient import TestClient
    from app.api import app
    u = TestClient(app)
    assert u.post("/api/auth/login", json={"username": "cust1", "password": "password-123"}).status_code == 200
    me = u.get("/api/club/me")
    assert me.status_code == 200
    body = me.json()
    assert body["code"] == "C1" and body["kind"] == "b2b"
    assert body["plans"][0]["points"] == 2
    # Isolation: the club user cannot reach the sales pages or another customer's data.
    assert u.get("/api/customer/C2").status_code == 403
    assert u.get("/api/admin/users").status_code == 403
    assert u.put("/api/club/link", json={"username": "cust1", "kind": "b2b", "code": "C2"}).status_code == 403


def _visitor_client(tmp_path, monkeypatch):
    """Seeded portfolio: V1 owns C1 and C2, V2 owns C3. Two months so history can be checked."""
    rows = [
        make_row(S, "a1", "C1", "1000000", "10", vcode="V1", vname="ویزیتور یک", date="1405/07/05"),
        make_row(S, "a2", "C1", "500000", "5", vcode="V1", vname="ویزیتور یک", date="1405/08/10"),
        make_row(S, "a3", "C2", "300000", "3", vcode="V1", vname="ویزیتور یک", date="1405/08/12"),
        make_row(S, "a4", "C3", "200000", "2", vcode="V2", vname="ویزیتور دو", date="1405/08/12"),
    ]
    c = build_client(tmp_path, monkeypatch, {"sr_kg_140507": rows})
    c.post("/api/admin/roles/defaults")
    role = next(x for x in c.get("/api/admin/roles").json() if x["name"] == "Sales Power Club")
    c.post("/api/admin/users", json={"username": "visitor1", "password": "password-123", "role_id": role["id"]})
    c.put("/api/club/link", json={"username": "visitor1", "kind": "visitor", "code": "V1"})
    c.post("/api/club/visitor/plans", json={"name": "مرداد-شهریور", "core": "kg", "start_key": 14050701,
                                             "end_key": 14050831, "rial_per_point": 250000, "target_points": 10})
    return c


def test_visitor_team_is_own_portfolio_and_months_add_up(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from app.api import app
    _visitor_client(tmp_path, monkeypatch)
    u = TestClient(app)
    assert u.post("/api/auth/login", json={"username": "visitor1", "password": "password-123"}).status_code == 200
    t = u.get("/api/club/visitor/team").json()
    # Sections check:
    assert "visitor_summary" in t and "portfolio_customers" in t
    # C1 1,500,000 -> 6, C2 300,000 -> 1 at 250,000/point; C3 belongs to V2 and must not appear.
    assert t["code"] == "V1" and t["customers"] == 2
    assert [(r["code"], r["points"]) for r in t["portfolio_customers"]] == [("C1", 6), ("C2", 1)]
    assert t["visitor_summary"]["points"] == 7 and t["visitor_summary"]["sales_rial"] == 1800000
    assert t["points"] == 7 and t["sales_rial"] == 1800000
    # Tier: 7 of a 10-point target -> 70% progress, third step (پله ۳).
    assert t["tier"]["progress"] == 0.7 and t["tier"]["level"] == "پله ۳"
    assert t["tier"]["points_needed"] == 1 and t["tier"]["next_level"] == "پله ۴"
    # Month buckets sum to the total (floor applied on the running sum, not per month).
    assert [h["points"] for h in t["history"]] == [4, 3] and sum(h["points"] for h in t["history"]) == 7


def test_custom_tier_points_array(tmp_path, monkeypatch):
    c = seeded(tmp_path, monkeypatch)
    # 4 explicit thresholds: [2, 4, 6, 8]
    r = c.post("/api/club/b2b/plans", json={"name": "پله‌های سفارشی", "core": "kg", "start_key": 14050701,
                                             "end_key": 14050731, "rial_per_point": 500000, "tier_points": [2, 4, 6, 8]})
    assert r.status_code == 201
    plan_id = r.json()["id"]
    pts = c.get("/api/club/b2b/points", params={"plan_id": plan_id}).json()
    p = pts["plan"]
    assert p["tier_points"] == [2, 4, 6, 8]
    # C1 has 2 points -> matches threshold t1 -> advances to "پله ۲"
    tier_info = club._tier(2, p)
    assert tier_info["level"] == "پله ۲"
    assert tier_info["step"] == 1
    assert tier_info["points_needed"] == 2 # 4 - 2 = 2 to reach پله ۳


def test_points_cannot_be_negative(tmp_path, monkeypatch):
    # If returns exceed sales, points must floor at 0
    rows = [
        make_row(S, "s1", "C9", "100000", "1", vcode="V1", vname="ویزیتور یک", date="1405/07/05"),
        make_row(RET, "r9", "C9", "-500000", "-5", vcode="V1", vname="ویزیتور یک", date="1405/07/06"),
    ]
    c = build_client(tmp_path, monkeypatch, {"sr_kg_140507": rows})
    r = c.post("/api/club/b2b/plans", json={"name": "برگشتی بیش از فروش", "core": "kg", "start_key": 14050701,
                                             "end_key": 14050731, "rial_per_point": 100000})
    rows_resp = {x["code"]: x for x in c.get("/api/club/b2b/points", params={"plan_id": r.json()["id"]}).json()["rows"]}
    assert rows_resp["C9"]["points"] == 0


def test_non_visitor_cannot_read_team(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from app.api import app
    c = _visitor_client(tmp_path, monkeypatch)
    c.post("/api/admin/roles/defaults")
    role = next(x for x in c.get("/api/admin/roles").json() if x["name"] == "CustomerClub")
    c.post("/api/admin/users", json={"username": "cust2", "password": "password-123", "role_id": role["id"]})
    c.put("/api/club/link", json={"username": "cust2", "kind": "b2b", "code": "C1"})
    u = TestClient(app)
    assert u.post("/api/auth/login", json={"username": "cust2", "password": "password-123"}).status_code == 200
    assert u.get("/api/club/visitor/team").status_code == 403


def test_multi_rule_scoring_matches_gamification_workbook(tmp_path, monkeypatch):
    """Base rule 100,000 Rial -> 1 point, focus brand at 3X: the shape of the company's GAMIFICATION sheet."""
    from test_api import product_tsv
    rows = [
        make_row(S, "g1", "C1", "1000000", "10", ucode="P1", brand="ویفر", date="1405/07/05"),
        make_row(S, "g2", "C1", "500000", "5", ucode="P1", brand="ویفر", date="1405/07/09"),
        make_row(S, "g3", "C2", "300000", "3", ucode="P2", brand="شامپو", date="1405/07/12"),
    ]
    c = build_client(tmp_path, monkeypatch, {"sr_kg_140507": rows},
                     product=product_tsv(("P1", "خوراکی", "ویفر"), ("P2", "بهداشتی", "شامپو")))
    rules = [{"label": "فروش پایه", "metric": "rial", "ratio": 100000, "factor": 1},
             {"label": "کالای تمرکزی ۳X", "metric": "rial", "ratio": 100000, "factor": 3, "brand": "ویفر"}]
    r = c.post("/api/club/b2b/plans", json={"name": "گیمیفیکیشن", "core": "kg", "start_key": 14050701,
                                             "end_key": 14050731, "rial_per_point": 1, "rules": rules})
    got = {x["code"]: x for x in c.get("/api/club/b2b/points", params={"plan_id": r.json()["id"]}).json()["rows"]}
    # C1 1,500,000 Rial: base 15 + focus 45 = 60. C2 300,000: base 3 only.
    assert got["C1"]["points"] == 60 and got["C2"]["points"] == 3
    assert [b["points"] for b in got["C1"]["breakdown"]] == [15, 45]
