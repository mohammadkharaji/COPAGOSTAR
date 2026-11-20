"""Tests for the Mobile Home-Screen Widget Pulse API (/api/mobile/widget-pulse)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api import app
from test_api import build_client, make_row, product_tsv
from test_club_ladder_api import LAD, cfg, ladder_plan
from test_target import LINE, target_tsv

S = "SRSalesProcedure1405"
RET = "SRDatedSalesReturnProcedurewithVAT1405"
PROMO = "SRPromotionsProcedure1405"
PRODUCT = product_tsv(("P1", "گروه الف", "ز", "دسته A"), ("P2", "گروه ب", "ز", "دسته B"))
KG = "کوپا گستر"


def trow(month, branch, cat, group, rial, code, name, cov=""):
    return [month, branch, LINE, cat, group, code, name, "سرپرست", "مدیر", str(rial), cov]


def sample_sales():
    return {
        "sr_kg_140507": [
            make_row(S, "1", "C1", "850", "1", vcode="11", vname="علی", ucode="P1", date="1405/07/05", line=LINE, branch="شعبه تهران"),
            make_row(S, "2", "C2", "100", "1", vcode="11", vname="علی", ucode="P2", date="1405/07/06", line=LINE, branch="شعبه تهران"),
            make_row(PROMO, "3", "C3", "50", "1", vcode="11", vname="علی", ucode="P1", date="1405/07/07", line=LINE, branch="شعبه تهران"),
            make_row(S, "4", "C9", "300", "1", vcode="12", vname="رضا", ucode="P1", date="1405/07/08", line=LINE, branch="شعبه کرج"),
        ],
        "sr_kg_140508": [
            make_row(S, "6", "C1", "1000", "1", vcode="11", vname="علی", ucode="P1", date="1405/08/03", line=LINE, branch="شعبه تهران"),
            make_row(S, "7", "C8", "400", "1", vcode="12", vname="رضا", ucode="P2", date="1405/08/04", line=LINE, branch="شعبه کرج"),
        ],
    }


@pytest.fixture()
def client(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, sample_sales(), product=PRODUCT)
    (tmp_path / "raw" / "target_kg_140507.tsv").write_text(
        target_tsv(
            trow("140507", "شعبه تهران", "دسته A", "گروه الف", 1000, "11", "علی", "3"),
            trow("140507", "شعبه تهران", "دسته B", "گروه ب", 200, "11", "علی", "3"),
            trow("140507", "شعبه کرج", "دسته A", "گروه الف", 1000, "12", "رضا", "2"),
        ),
        encoding="utf-8",
    )
    (tmp_path / "raw" / "target_kg_140508.tsv").write_text(
        target_tsv(
            trow("140508", "شعبه تهران", "دسته A", "گروه الف", 1000, "11", "علی"),
            trow("140508", "شعبه کرج", "دسته B", "گروه ب", 500, "12", "رضا"),
        ),
        encoding="utf-8",
    )
    from app import ingest
    ingest.ingest_all()
    return c


def test_widget_pulse_unauthenticated_fails(client):
    anon = TestClient(app, base_url="https://testserver")
    r = anon.get("/api/mobile/widget-pulse")
    assert r.status_code == 401


def test_widget_pulse_executive_view(client):
    r = client.get("/api/mobile/widget-pulse")
    assert r.status_code == 200
    data = r.json()
    assert data["role_view"] == "executive"
    assert data["available"] is True
    assert data["month"] == "140508"
    assert "jalali_month" in data
    # 140508 has 1000 (Ali, Tehran) + 400 (Reza, Karaj) = 1400
    assert data["net_rial_vat"] == 1400.0
    assert data["active_customers_count"] == 2
    assert data["eom_forecast_rial"] > 0
    assert data["target_achievement_pct"] is not None
    assert "latest_bi_sync" in data


def test_widget_sales_definition_matches_dashboard(client):
    from app import db
    con = db.connect(read_only=False)
    try:
        con.execute("UPDATE fact_sales SET total_discount=100, discount=20, settlement_discount=30 "
                    "WHERE year_month='140508' AND visitor_code='11'")
    finally:
        con.close()
    pulse = client.get('/api/mobile/widget-pulse').json()
    report = client.get('/api/target', params={'core': 'kg'}).json()
    assert pulse['actual_rial'] == report['summary']['actual_rial'] == 1400
    assert pulse['target_rial'] == report['summary']['target_rial']
    assert pulse['target_achievement_pct'] == report['summary']['achieved_pct'] * 100
    assert pulse['eom_forecast_rial'] == report['summary']['projected_rial']


@pytest.mark.parametrize('params', [
    {'core': 'kg', 'month': '140507'},
    {'core': 'kg', 'month': '140508', 'branch': 'شعبه تهران'},
    {'core': 'kg', 'month': '140507', 'visitor': ['11', '12']},
    {'core': 'kg', 'month': '140507', 'category': 'دسته A'},
])
def test_widget_matches_target_for_same_selection(client, params):
    report = client.get('/api/target', params=params).json()
    response = client.get('/api/mobile/widget-pulse', params=params)
    assert response.status_code == 200
    pulse = response.json()
    assert pulse['month'] == report['month']
    assert pulse['core'] == report['core']
    assert pulse['summary'] == report['summary']
    assert pulse['as_of_date'] == report['as_of']


def test_widget_pulse_branch_scoped_executive(client):
    client.post("/api/admin/roles/defaults")
    r_role = client.post(
        "/api/admin/roles",
        json={
            "name": "Tehran Manager",
            "description": "Branch manager",
            "pages": ["overview"],
            "cores": ["kg"],
            "scope_mode": "branch",
        },
    )
    assert r_role.status_code == 201
    role_id = r_role.json()["id"]

    r_user = client.post(
        "/api/admin/users",
        json={
            "username": "tehran_mgr",
            "password": "password-mgr-123",
            "role_id": role_id,
            "branches": ["شعبه تهران"],
        },
    )
    assert r_user.status_code == 201

    mgr_client = TestClient(app, base_url="https://testserver")
    login = mgr_client.post("/api/auth/login", json={"username": "tehran_mgr", "password": "password-mgr-123"})
    assert login.status_code == 200

    r = mgr_client.get("/api/mobile/widget-pulse")
    assert r.status_code == 200
    data = r.json()
    assert data["role_view"] == "executive"
    # In 140508, Tehran has only Ali's 1000 sale, while Karaj has 400
    assert data["net_rial_vat"] == 1000.0
    assert data["active_customers_count"] == 1
    # Target in Tehran for 140508 is 1000 -> 100%
    assert data["target_achievement_pct"] == 100.0


def test_widget_pulse_visitor_view_and_cannot_access_executive_totals(client):
    ladder_plan(client)

    client.post("/api/admin/roles/defaults")
    roles = client.get("/api/admin/roles").json()
    vrole = next(x for x in roles if x["name"] == "Sales Power Club")

    client.post(
        "/api/admin/users",
        json={
            "username": "visitor_ali",
            "password": "ali-password-123",
            "role_id": vrole["id"],
        },
    )
    client.put("/api/club/link", json={"username": "visitor_ali", "kind": "visitor", "code": "11"})

    vis_client = TestClient(app, base_url="https://testserver")
    login = vis_client.post("/api/auth/login", json={"username": "visitor_ali", "password": "ali-password-123"})
    assert login.status_code == 200

    r = vis_client.get("/api/mobile/widget-pulse")
    assert r.status_code == 200
    data = r.json()

    # Visitor Role View Assertions
    assert data["role_view"] == "visitor"
    assert data["visitor_code"] == "11"
    assert data["plan_name"] == "نردبان"
    assert data["total_score"] > 0
    assert data["grade"] in ("A", "B", "C")
    assert data["rank_national"] == 1
    assert data["prize_amount"] == 100
    assert "rings" in data
    assert "rial" in data["rings"]
    assert "coverage" in data["rings"]
    assert "basket" in data["rings"]

    # Security Assertion: Visitors CANNOT access executive company totals
    assert "net_rial_vat" not in data
    assert "eom_forecast_rial" not in data
    assert "active_customers_count" not in data
    assert "target_rial" not in data
