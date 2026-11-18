import pytest

from tests.test_rbac import TEST_PASSWORD, _login, _mkrole, _mkuser, build_client, sales  # noqa: F401


@pytest.fixture()
def client(tmp_path, monkeypatch):
    return build_client(tmp_path, monkeypatch, sales())


def test_user_opens_ticket_admin_replies_other_user_cannot_see(client):
    # `tickets` is a gated page now (rbac.EXACT), so the role must carry it; owner isolation is still enforced in
    # tickets.py for users whose role does.
    role = _mkrole(client, "کاربر تیکت", "all", pages=("overview", "trend", "tickets"))
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

    role = _mkrole(client, "کاربر تیکت ۲", "all", pages=("overview", "trend", "tickets"))
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


def test_tickets_and_chat_are_gated_pages_not_shell():
    """`tickets` and `chat` used to be unreachable as pages: tickets sat in SHELL (open to everyone, so the role
    checkbox was a no-op) and chat fell through to admin-only (so four business roles held a page they could not
    open). Both are now ordinary EXACT entries."""
    from app import rbac
    assert rbac.access_for("GET", "/api/tickets") == ("pages", ("tickets",))
    assert rbac.access_for("POST", "/api/tickets") == ("pages", ("tickets",))
    assert rbac.access_for("GET", "/api/tickets/7") == ("pages", ("tickets",))
    assert rbac.access_for("POST", "/api/tickets/7/messages") == ("pages", ("tickets",))
    assert rbac.access_for("POST", "/api/chat") == ("pages", ("chat",))


def test_every_page_is_reachable_through_some_route():
    """A page listed in PAGES with no EXACT/PREFIX route behind it is a checkbox that grants nothing."""
    from app import rbac
    reachable = set()
    for pages in rbac.EXACT.values():
        reachable.update(pages)
    for _, pages in rbac.PREFIX:
        reachable.update(pages)
    unreachable = [p for p in rbac.PAGES if p not in reachable]
    assert unreachable == [], f"pages with no route: {unreachable}"


def test_data_health_is_admin_only(client):
    """`health` is in rbac.ADMIN_ONLY_PAGES: data-quality counts span the whole dataset, so no scoped role can hold it.
    `/api/health` stays in SHELL as the liveness probe every client calls."""
    from app import rbac
    assert rbac.access_for("GET", "/api/data-health") == ("pages", ("health",))
    assert rbac.access_for("GET", "/api/health") == ("shell", ())

    full_role = _mkrole(client, "مدیر فروش کامل", "all")          # every page a non-admin role can be given
    _mkuser(client, "sina", full_role)
    sina = _login(client.app, "sina")
    assert sina.get("/api/data-health").status_code == 403
    assert sina.get("/api/health").status_code == 200

    club_role = _mkrole(client, "باشگاه", "all", pages=("club_b2b", "club_visitor"))
    _mkuser(client, "nazi", club_role)
    nazi = _login(client.app, "nazi")
    assert nazi.get("/api/data-health").status_code == 403

    assert _login(client.app, "admin").get("/api/data-health").status_code == 200


def test_admin_only_page_cannot_be_assigned_to_a_non_admin_role(client):
    from app import rbac
    assert "health" in rbac.ADMIN_ONLY_PAGES
    r = client.post("/api/admin/roles", json={"name": "نقش با هلث", "pages": ["overview", "health"],
                                              "cores": ["kg"], "scope_mode": "all"})
    assert r.status_code == 400
    assert "health" in r.text
    ok = client.post("/api/admin/roles", json={"name": "نقش بدون هلث", "pages": ["overview"],
                                               "cores": ["kg"], "scope_mode": "all"})
    assert ok.status_code == 201


def test_ticket_role_without_the_page_is_denied(client):
    role = _mkrole(client, "بدون تیکت", "all", pages=("overview",))
    _mkuser(client, "nima", role)
    nima = _login(client.app, "nima")
    assert nima.get("/api/tickets").status_code == 403
    assert nima.post("/api/tickets", json={"subject": "سلام", "body": "متن"}).status_code == 403
