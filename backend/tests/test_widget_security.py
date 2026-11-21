"""Widget regression tests using isolated accounts; no sales ingestion required."""
from contextlib import closing
import hashlib
import time

import pytest
from fastapi.testclient import TestClient

from app import auth, config, rbac, widget, widget_tokens
from app.api import app


@pytest.fixture
def session(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    monkeypatch.setenv("SR_AUTH_USER", "admin")
    monkeypatch.setenv("SR_AUTH_PASS_HASH", auth.hash_password("widget-password"))
    monkeypatch.setenv("SR_AUTH_SECRET", "widget-test-secret-12345678901234567890")
    client = TestClient(app, base_url="https://testserver")
    sid = rbac.start_session(auth.username(), "تست", "127.0.0.1")
    client.cookies.set(auth.COOKIE, auth.make_token(auth.username(), sid=sid))
    monkeypatch.setattr(widget, "_pulse", lambda *args: {"available": True})
    return client


def test_widget_token_scope_rotation_revocation_and_hash(session):
    result = session.post("/api/mobile/widget-token")
    assert result.status_code == 200
    token = result.json()["token"]
    headers = {"Authorization": "Bearer " + token}
    anon = TestClient(app, base_url="https://testserver")
    assert anon.get("/api/mobile/widget-pulse", headers=headers).status_code == 200
    for method, path in (("GET", "/api/auth/me"), ("POST", "/api/mobile/widget-token"),
                         ("DELETE", "/api/mobile/widget-token"), ("GET", "/api/overview")):
        assert anon.request(method, path, headers=headers).status_code == 403
    with closing(rbac.connect()) as con:
        row = con.execute("SELECT * FROM widget_tokens").fetchone()
        assert row["digest"] == hashlib.sha256(token.encode()).hexdigest()
        assert row["last_used_at"] is not None
    new = session.post("/api/mobile/widget-token").json()["token"]
    assert anon.get("/api/mobile/widget-pulse", headers=headers).status_code == 401
    headers["Authorization"] = "Bearer " + new
    assert session.delete("/api/mobile/widget-token").status_code == 200
    assert anon.get("/api/mobile/widget-pulse", headers=headers).status_code == 401


def test_widget_token_expiry(session):
    token = session.post("/api/mobile/widget-token").json()["token"]
    with closing(rbac.connect()) as con:
        con.execute("UPDATE widget_tokens SET expires_at=?", (time.time() - 1,))
    assert widget_tokens.resolve(token) is None


def test_widget_token_tracks_account_version_and_ownership(session):
    role = session.post('/api/admin/roles', json={
        'name': 'Widget manager', 'pages': ['overview'], 'cores': ['kg'], 'scope_mode': 'all',
    }).json()['id']
    result = session.post('/api/admin/users', json={
        'username': 'widget.manager', 'password': 'widget-password', 'role_id': role,
    })
    assert result.status_code == 201
    manager = TestClient(session.app, base_url='https://testserver')
    assert manager.post('/api/auth/login', json={
        'username': 'widget.manager', 'password': 'widget-password',
    }).status_code == 200
    token = manager.post('/api/mobile/widget-token').json()['token']
    p = widget_tokens.resolve(token)
    assert p.user == 'widget.manager'
    assert p.pages == ('overview',)
    # Revoking another account's widget must leave this account untouched.
    session.delete('/api/mobile/widget-token')
    assert widget_tokens.resolve(token) is not None
    rbac.revoke_sessions('widget.manager')
    assert widget_tokens.resolve(token) is None


def test_freshness_unknown_and_old_sync(monkeypatch):
    monkeypatch.setattr(widget.bi_sync_service, 'read_status', lambda: {})
    assert widget._freshness()['freshness'] == 'unknown'
    monkeypatch.setattr(widget.bi_sync_service, 'read_status', lambda: {
        'last_successful_sync': '2020-01-01T00:00:00Z',
    })
    assert widget._freshness()['freshness'] == 'stale'


def test_unlinked_club_account_never_gets_executive_data(monkeypatch):
    monkeypatch.setattr(widget, "_visitor_link", lambda user: None)
    ctx = rbac.CURRENT.set(rbac.Principal("visitor", "club", False, ("club_visitor",), ("kg",)))
    try:
        result = widget._pulse()
        assert result["available"] is False
        assert "net_rial_vat" not in result
    finally:
        rbac.CURRENT.reset(ctx)


def test_basket_uses_achieved_groups_and_shared_plan_order(monkeypatch):
    monkeypatch.setattr(widget, "_visitor_link", lambda user: "11")
    monkeypatch.setattr(widget.club, "_plans", lambda kind: [
        {"id": 1, "plan_type": "ladder", "active": True, "start_key": 14000101, "end_key": 14000131},
        {"id": 2, "plan_type": "ladder", "active": True, "start_key": 14000101, "end_key": 14991229}])
    monkeypatch.setattr(widget.club_ladder_report, "scorecard", lambda plan, code, month: {
        "kpis": [{"metric": "basket", "actual": 9999, "target": 9000, "ratio": 2,
                  "ladder": [[0, 0], [5, 100]]}]})
    ctx = rbac.CURRENT.set(rbac.superadmin())
    try:
        result = widget._pulse()
        assert result["plan_id"] == 2
        assert result["basket"] == {"achieved_groups": 2, "target_groups": 5, "progress_pct": 40}
        assert result["rings"]["basket"] == 40
    finally:
        rbac.CURRENT.reset(ctx)