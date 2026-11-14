from app import rbac


def test_club_pages_routed_only_to_their_page():
    assert rbac.access_for("GET", "/api/club/b2b/plans") == ("pages", ("club_b2b",))
    assert rbac.access_for("GET", "/api/club/visitor/points") == ("pages", ("club_visitor",))
    assert rbac.access_for("POST", "/api/club/b2b/plans") == ("pages", ("club_b2b",))


def test_club_pages_registered():
    assert "club_b2b" in rbac.PAGES and "club_visitor" in rbac.PAGES

