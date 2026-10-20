"""Authorization tests: per-user branch/supervisor scope, fail-closed access, admin CRUD, and schema migration."""
import json
import sqlite3
from contextlib import closing

import pytest
from fastapi.testclient import TestClient
from test_api import TEST_PASSWORD, build_client, make_row

S = "SRSalesProcedure1405"


def sales():
    """Two branches, two supervisors each with one visitor, so branch/supervisor scope can be told apart."""
    return {"sr_kg_140507": [
        make_row(S, "1", "A", "1000", "10", vcode="11", vname="علی رضایی", branch="شعبه تهران", sup="سرپرست ۱"),
        make_row(S, "2", "B", "2000", "20", vcode="12", vname="رضا احمدی", branch="شعبه تهران", sup="سرپرست ۲"),
        make_row(S, "3", "C", "4000", "40", vcode="13", vname="ویزیتور کرج", branch="شعبه کرج", sup="سرپرست ۳"),
    ]}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    return build_client(tmp_path, monkeypatch, sales())


def _mkrole(c, name, mode, pages=("overview", "trend")):
    r = c.post("/api/admin/roles", json={"name": name, "pages": list(pages), "cores": ["kg"], "scope_mode": mode})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _mkuser(c, username, role_id, branches=None, supervisors=None):
    body = {"username": username, "password": TEST_PASSWORD, "role_id": role_id}
    if branches is not None:
        body["branches"] = branches
    if supervisors is not None:
        body["supervisors"] = supervisors
    r = c.post("/api/admin/users", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _login(app, username) -> TestClient:
    c2 = TestClient(app)
    r = c2.post("/api/auth/login", json={"username": username, "password": TEST_PASSWORD})
    assert r.status_code == 200, r.text
    return c2


def test_branch_scope_isolates_data(client):
    role = _mkrole(client, "مدیر شعبه", "branch")
    _mkuser(client, "manager.tehran", role, branches=["شعبه تهران"])
    c2 = _login(client.app, "manager.tehran")
    j = c2.get("/api/overview", params={"core": "kg"}).json()
    assert j["sum_rial_vat"] == 3000   # only the two تهران rows (1000 + 2000)


def test_supervisor_scope_isolates_data(client):
    role = _mkrole(client, "سرپرست شعبه", "supervisor")
    _mkuser(client, "sup2", role, supervisors=["سرپرست ۲"])
    c2 = _login(client.app, "sup2")
    j = c2.get("/api/overview", params={"core": "kg"}).json()
    assert j["sum_rial_vat"] == 2000


def test_empty_scope_denies_everything_not_widens(client):
    role = _mkrole(client, "بدون انتساب", "branch")
    _mkuser(client, "noscope", role)   # no branches/supervisors assigned
    c2 = _login(client.app, "noscope")
    j = c2.get("/api/overview", params={"core": "kg"}).json()
    assert j["sum_rial_vat"] == 0


def test_url_filter_cannot_widen_branch_scope(client):
    role = _mkrole(client, "مدیر شعبه ۲", "branch")
    _mkuser(client, "manager.tehran2", role, branches=["شعبه تهران"])
    c2 = _login(client.app, "manager.tehran2")
    # Explicitly asking for the other branch must not leak its rows.
    j = c2.get("/api/overview", params={"core": "kg", "branch": "شعبه کرج"}).json()
    assert j["sum_rial_vat"] == 0


def test_all_scope_role_sees_every_branch_without_admin(client):
    role = _mkrole(client, "مدیرعامل", "all")
    user = _mkuser(client, "ceo", role)
    assert user["is_admin"] is False
    c2 = _login(client.app, "ceo")
    assert c2.get("/api/overview", params={"core": "kg"}).json()["sum_rial_vat"] == 7000
    assert c2.get("/api/admin/users").status_code == 403   # full reports != account management


def test_unknown_role_scope_mode_is_rejected(client):
    r = client.post("/api/admin/roles", json={"name": "bad", "pages": ["overview"], "cores": ["kg"], "scope_mode": "nope"})
    assert r.status_code == 400


def test_scope_assignment_is_validated_against_real_data(client):
    role = _mkrole(client, "مدیر شعبه ۳", "branch")
    r = client.post("/api/admin/users", json={"username": "bad.branch", "password": TEST_PASSWORD, "role_id": role,
                                               "branches": ["شعبه اهواز"]})
    assert r.status_code == 400
    role2 = _mkrole(client, "سرپرست ۴", "supervisor")
    r = client.post("/api/admin/users", json={"username": "bad.sup", "password": TEST_PASSWORD, "role_id": role2,
                                               "supervisors": ["سرپرست ناشناخته"]})
    assert r.status_code == 400


def test_role_scope_mode_locked_while_assigned(client):
    role = _mkrole(client, "مدیر شعبه ۴", "branch")
    _mkuser(client, "manager.locked", role, branches=["شعبه تهران"])
    r = client.patch(f"/api/admin/roles/{role}", json={"scope_mode": "supervisor"})
    assert r.status_code == 409


def test_scope_change_applies_on_next_request(client):
    role = _mkrole(client, "مدیر شعبه ۵", "branch")
    user = _mkuser(client, "manager.live", role, branches=["شعبه تهران"])
    c2 = _login(client.app, "manager.live")
    assert c2.get("/api/overview", params={"core": "kg"}).json()["sum_rial_vat"] == 3000
    client.patch(f"/api/admin/users/{user['id']}", json={"branches": ["شعبه کرج"]})
    assert c2.get("/api/overview", params={"core": "kg"}).json()["sum_rial_vat"] == 4000


def test_deactivation_invalidates_existing_session(client):
    role = _mkrole(client, "مدیر شعبه ۶", "branch")
    user = _mkuser(client, "manager.bye", role, branches=["شعبه تهران"])
    c2 = _login(client.app, "manager.bye")
    assert c2.get("/api/auth/me").status_code == 200
    client.post(f"/api/admin/users/{user['id']}/deactivate")
    assert c2.get("/api/auth/me").status_code == 401


def test_default_roles_are_created_once(client):
    r = client.post("/api/admin/roles/defaults")
    assert r.status_code == 200
    created = set(r.json()["created"])
    assert created == {"مدیرعامل", "معاونت فروش", "مدیر شعبه", "سرپرست شعبه"}
    roles = {r["name"]: r for r in client.get("/api/admin/roles").json()}
    assert roles["مدیرعامل"]["scope_mode"] == "all" and roles["مدیرعامل"]["is_admin"] is False
    assert roles["مدیر شعبه"]["scope_mode"] == "branch"
    assert roles["سرپرست شعبه"]["scope_mode"] == "supervisor"
    # Running it again creates nothing new.
    r2 = client.post("/api/admin/roles/defaults")
    assert r2.json()["created"] == []


def test_helper_queries_respect_scope(client):
    """Visitor profile and inactive-customer helper queries must not leak another branch's data."""
    role = _mkrole(client, "مدیر شعبه ۷", "branch", pages=("visitor", "inactive"))
    _mkuser(client, "manager.helpers", role, branches=["شعبه تهران"])
    c2 = _login(client.app, "manager.helpers")
    # Visitor code 13 only sold in Karaj; a Tehran-scoped manager must see it as not found, not leaked.
    r = c2.get("/api/visitor/13", params={"core": "kg"})
    assert r.status_code == 404
    j = c2.get("/api/inactive-customers", params={"core": "kg", "days": 7}).json()
    assert j["available"] is False or j.get("total_customers", 0) <= 2   # never counts the Karaj customer


def test_old_schema_migrates_branches_into_users(tmp_path, monkeypatch):
    """A pre-scope accounts.sqlite (role-level `branches`, no scope_mode/users.branches) must migrate: a role that had a
    branch list becomes scope `branch` and its existing users inherit that list."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    path = data_dir / "accounts.sqlite"
    OLD_SCHEMA = """
    CREATE TABLE roles(
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, description TEXT NOT NULL DEFAULT '',
        pages TEXT NOT NULL DEFAULT '[]', cores TEXT NOT NULL DEFAULT '[]', branches TEXT NOT NULL DEFAULT '[]',
        is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE users(
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL, role_id INTEGER NOT NULL REFERENCES roles(id), is_active INTEGER NOT NULL DEFAULT 1,
        token_version INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT);
    CREATE TABLE audit_log(
        id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
        target_type TEXT NOT NULL DEFAULT '', target TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '{}',
        ip TEXT NOT NULL DEFAULT '');
    """
    with closing(sqlite3.connect(path)) as con:
        con.executescript(OLD_SCHEMA)
        con.execute("INSERT INTO roles(name, pages, cores, branches, is_admin, created_at, updated_at) "
                    "VALUES ('مدیر شعبه', '[\"overview\"]', '[\"kg\"]', '[\"شعبه تهران\"]', 0, 't', 't')")
        con.execute("INSERT INTO users(username, display_name, password_hash, role_id, created_at, updated_at) "
                    "VALUES ('legacy.mgr', '', 'x', 1, 't', 't')")
        con.commit()

    monkeypatch.setenv("SR_DATA_DIR", str(data_dir))
    import importlib
    from app import config, rbac
    importlib.reload(config)
    importlib.reload(rbac)
    rbac.ensure_store()

    with closing(sqlite3.connect(path)) as con:
        con.row_factory = sqlite3.Row
        role = con.execute("SELECT * FROM roles WHERE name='مدیر شعبه'").fetchone()
        user = con.execute("SELECT * FROM users WHERE username='legacy.mgr'").fetchone()
    assert role["scope_mode"] == "branch"
    assert json.loads(user["branches"]) == ["شعبه تهران"]
    assert json.loads(user["supervisors"]) == []


def test_every_report_route_requires_a_permitted_page(client):
    """Route-coverage: every report endpoint denies a principal without the owning page, and the admin page/report
    split means report access alone never unlocks /api/admin."""
    role = _mkrole(client, "فقط بازگشتی‌ها", "all", pages=("returns",))
    _mkuser(client, "returns.only", role)
    c2 = _login(client.app, "returns.only")
    for path in ("/api/overview", "/api/trend", "/api/monthly", "/api/growth", "/api/pareto", "/api/visitors",
                 "/api/branch", "/api/invoice-bands", "/api/inactive-customers"):
        assert c2.get(path, params={"core": "kg"}).status_code == 403, path
    assert c2.get("/api/returns/summary", params={"core": "kg"}).status_code == 200
    assert c2.get("/api/admin/roles").status_code == 403


def test_user_changes_own_password_and_old_session_is_revoked(client):
    role = _mkrole(client, "کاربر عادی", "all")
    _mkuser(client, "ali", role)
    c2 = _login(client.app, "ali")
    assert c2.post("/api/admin/me/password", json={"current_password": "wrong-pass", "new_password": "NewPass-1234"}).status_code == 400
    assert c2.post("/api/admin/me/password", json={"current_password": TEST_PASSWORD, "new_password": "short"}).status_code == 400
    assert c2.post("/api/admin/me/password", json={"current_password": TEST_PASSWORD, "new_password": "NewPass-1234"}).status_code == 200
    assert c2.get("/api/overview", params={"core": "kg"}).status_code == 401
    r = TestClient(client.app).post("/api/auth/login", json={"username": "ali", "password": "NewPass-1234"})
    assert r.status_code == 200, r.text

