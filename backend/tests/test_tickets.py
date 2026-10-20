import pytest

from tests.test_rbac import TEST_PASSWORD, _login, _mkrole, _mkuser, build_client, sales  # noqa: F401


@pytest.fixture()
def client(tmp_path, monkeypatch):
    return build_client(tmp_path, monkeypatch, sales())


def test_user_opens_ticket_admin_replies_other_user_cannot_see(client):
    role = _mkrole(client, "کاربر تیکت", "all")
    _mkuser(client, "ali", role)
    _mkuser(client, "sara", role)
    ali = _login(client.app, "ali")
    sara = _login(client.app, "sara")
    tid = ali.post("/api/tickets", json={"subject": "مشکل گزارش", "body": "صفحه باز نمی‌شود"}).json()["id"]
    assert ali.get("/api/tickets").json()["tickets"][0]["id"] == tid
    assert sara.get("/api/tickets").json()["tickets"] == []
    assert sara.get(f"/api/tickets/{tid}").status_code == 404
    assert sara.post(f"/api/tickets/{tid}/messages", json={"body": "x"}).status_code == 404
    ali.post(f"/api/tickets/{tid}/messages", json={"body": "دوباره امتحان کردم"})
    admin = _login(client.app, "admin")
    assert any(t["id"] == tid for t in admin.get("/api/tickets").json()["tickets"])
    assert admin.post(f"/api/tickets/{tid}/messages", json={"body": "بررسی شد"}).status_code == 200
    t = ali.get(f"/api/tickets/{tid}").json()
    assert t["status"] == "answered"
    assert [m["is_admin"] for m in t["messages"]] == [False, False, True]


def test_admin_closes_user_cannot_reply_and_closed_tickets_purge_after_a_week(client):
    from datetime import datetime, timedelta

    from app import rbac, tickets

    role = _mkrole(client, "کاربر تیکت ۲", "all")
    _mkuser(client, "dara", role)
    dara = _login(client.app, "dara")
    admin = _login(client.app, "admin")
    tid = dara.post("/api/tickets", json={"subject": "بستن تست", "body": "سلام"}).json()["id"]
    assert admin.post(f"/api/tickets/{tid}/status", json={"action": "close"}).status_code == 200
    assert dara.post(f"/api/tickets/{tid}/messages", json={"body": "هنوز؟"}).status_code == 409
    assert dara.post(f"/api/tickets/{tid}/status", json={"action": "reopen"}).status_code == 403
    assert admin.post(f"/api/tickets/{tid}/status", json={"action": "reopen"}).status_code == 200
    assert dara.post(f"/api/tickets/{tid}/messages", json={"body": "حالا بله"}).status_code == 200
    admin.post(f"/api/tickets/{tid}/status", json={"action": "close"})
    old = (datetime.now() - timedelta(days=8)).isoformat(timespec="seconds")
    con = rbac.connect(create=True)
    con.execute("UPDATE tickets SET closed_at=? WHERE id=?", (old, tid))
    con.commit()
    con.close()
    assert admin.get("/api/tickets").status_code == 200
    con = rbac.connect()
    assert con.execute("SELECT COUNT(*) FROM tickets WHERE id=?", (tid,)).fetchone()[0] == 0
    assert con.execute("SELECT COUNT(*) FROM ticket_messages WHERE ticket_id=?", (tid,)).fetchone()[0] == 0
    con.close()
