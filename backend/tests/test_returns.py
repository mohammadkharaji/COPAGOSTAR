"""Tests for the distribution-order returns source: loader (upsert by dispatch order) and, later, its report."""
import pytest
from test_api import build_client, make_row

from app.schema import RETURN_COLS

S = "SRSalesProcedure1405"
TEHRAN, KARAJ = "شعبه تهران", "شعبه کرج"


def rrow(branch, no, cust, order, full=0, part=0, date="1405/07/10", visitor="علی رضایی", reason="", invoice=None,
         sup="سرپرست ۱"):
    r = {"branch": branch, "dispatch_no": no, "tour_no": "T" + no, "tour_date": date, "customer_code": cust,
         "customer_name": "مشتری " + cust, "supervisor": sup, "visitor": visitor, "distributor": "موزع ۱", "driver": "راننده ۱",
         "order_date": date, "invoice_no": invoice if invoice is not None else ("" if full else "F" + no), "settle_method": "نقد",
         "return_reason": reason, "order_rial": str(order), "invoice_rial": str(order - full - part),
         "full_return_rial": str(full), "part_return_rial": str(part)}
    return [r[c] for c in RETURN_COLS]


def ret_tsv(*rows):
    return "\x1f".join(RETURN_COLS) + "\x1e" + "".join("\x1f".join(r) + "\x1e" for r in rows)


def write(tmp_path, name, *rows):
    (tmp_path / "raw" / f"{name}.tsv").write_text(ret_tsv(*rows), encoding="utf-8")


def table(ingest_mod=None):
    from app import ingest
    con = ingest.connect()
    try:
        return con.execute("SELECT branch, dispatch_no, return_rial, return_status, year_month, jdate_key, core "
                           "FROM fact_returns ORDER BY branch, dispatch_no").fetchall()
    finally:
        con.close()


@pytest.fixture()
def client(tmp_path, monkeypatch):
    return build_client(tmp_path, monkeypatch, {"sr_kg_140507": [make_row(S, "1", "A", "1000", "10")]})


def load():
    from app import ingest
    return [r for r in ingest.ingest_all() if r["file"].startswith("ret_")]


def test_status_amounts_and_derived_columns(client, tmp_path):
    write(tmp_path, "ret_kg_14050710_0900",
          rrow(TEHRAN, "1", "C1", 1000, full=1000, reason="لغو سفارش"),
          rrow(TEHRAN, "2", "C2", 2000, part=300),
          rrow(KARAJ, "3", "C3", 500),
          rrow(TEHRAN, "4", "C4", 400, part=-50))  # a negative partial (correction) is kept, not dropped
    assert [r["status"] for r in load()] == ["loaded"]
    assert table() == [(TEHRAN, "1", 1000, "full", "140507", 14050710, "کوپا گستر"),
                       (TEHRAN, "2", 300, "partial", "140507", 14050710, "کوپا گستر"),
                       (TEHRAN, "4", -50, "partial", "140507", 14050710, "کوپا گستر"),
                       (KARAJ, "3", 0, "none", "140507", 14050710, "کوپا گستر")]


def test_delta_upserts_by_dispatch_order_and_keeps_history(client, tmp_path):
    write(tmp_path, "ret_kg_14050710_0900", rrow(TEHRAN, "1", "C1", 1000), rrow(TEHRAN, "2", "C2", 2000, part=300))
    load()
    # next day: order 2 changed (now fully returned), order 5 is new, order 1 is absent -> kept as it was
    write(tmp_path, "ret_kg_14050711_0900", rrow(TEHRAN, "2", "C2", 2000, full=2000), rrow(TEHRAN, "5", "C5", 700, part=70))
    assert [r["status"] for r in load()] == ["skipped", "loaded"]
    assert [(r[1], r[2], r[3]) for r in table()] == [("1", 0, "none"), ("2", 2000, "full"), ("5", 70, "partial")]
    # unchanged files are not applied again, even after a newer file changed the same order
    assert [r["status"] for r in load()] == ["skipped", "skipped"]
    assert len(table()) == 3


def test_same_dispatch_number_in_two_branches_is_two_orders(client, tmp_path):
    write(tmp_path, "ret_kg_14050710_0900", rrow(TEHRAN, "7", "C1", 100, full=100), rrow(KARAJ, "7", "C2", 200))
    load()
    assert [(r[0], r[2]) for r in table()] == [(TEHRAN, 100), (KARAJ, 0)]


@pytest.mark.parametrize("name, rows, message", [
    ("ret_kg_14050710_0900", [rrow(TEHRAN, "1", "C1", 100), rrow(TEHRAN, "1", "C1", 100)], "duplicate dispatch order"),
    ("ret_kg_14050710_0900", [rrow(TEHRAN, "1", "C1", 0)], "invalid returns row"),
    ("ret_kg_14050710_0900", [rrow(TEHRAN, "1", "C1", 100, date="1405-07-10")], "invalid returns row"),
    ("ret_kg_14050710_0900", [rrow("", "1", "C1", 100)], "invalid returns row"),
    ("ret_xx_14050710_0900", [rrow(TEHRAN, "1", "C1", 100)], "unexpected returns file name"),
    ("ret_kg_1405_0900", [rrow(TEHRAN, "1", "C1", 100)], "unexpected returns file name"),
    ("ret_kg_14050710_0900", [], "no returns rows"),
])
def test_bad_file_is_rejected_without_touching_loaded_data(client, tmp_path, name, rows, message):
    write(tmp_path, "ret_kg_14050701_0900", rrow(TEHRAN, "1", "C1", 1000, full=1000))
    load()
    write(tmp_path, name, *rows)
    with pytest.raises(ValueError, match=message):
        load()
    (tmp_path / "raw" / f"{name}.tsv").unlink()
    assert [(r[1], r[2]) for r in table()] == [("1", 1000)]


def test_truncated_and_non_numeric_files_are_rejected(client, tmp_path):
    raw = tmp_path / "raw" / "ret_kg_14050710_0900.tsv"
    raw.write_text("x\x1fy\x1e", encoding="utf-8")
    with pytest.raises(ValueError, match="unexpected columns"):
        load()
    bad = rrow(TEHRAN, "1", "C1", 100)
    bad[RETURN_COLS.index("full_return_rial")] = "abc"
    write(tmp_path, "ret_kg_14050710_0900", bad)
    with pytest.raises(ValueError, match="non-numeric"):
        load()
    assert table() == []


def test_text_is_normalized_like_sales(client, tmp_path):
    write(tmp_path, "ret_kg_14050710_0900", rrow(TEHRAN, "1", "C1", 100, visitor="  علي   رضايي "))
    load()
    from app import ingest
    con = ingest.connect()
    try:
        assert con.execute("SELECT visitor FROM fact_returns").fetchone()[0] == "علی رضایی"
    finally:
        con.close()


# --- API: summary, list, profiles ---

def api_client(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, {"sr_kg_140507": [
        make_row(S, "1", "C1", "1000", "10", vcode="11", vname="علی رضایی"),
        make_row(S, "2", "C2", "500", "5", vcode="12", vname="رضا احمدی"),
        make_row(S, "3", "C3", "300", "3", vcode="13", vname="نام مشترک"),
        make_row(S, "4", "C4", "300", "3", vcode="14", vname="نام مشترک")]})
    write(tmp_path, "ret_kg_14050710_0900",
          rrow(TEHRAN, "1", "C1", 1000, full=1000, reason="لغو سفارش"),
          rrow(TEHRAN, "2", "C1", 3000, part=300, reason="تحویل ناقص", date="1405/06/20"),
          rrow(TEHRAN, "3", "C2", 2000),
          rrow(KARAJ, "4", "C3", 4000, full=400, visitor="نام مشترک", reason="لغو سفارش"),
          rrow(KARAJ, "5", "C4", 1000, part=-50, visitor="نام مشترک"))
    assert [r["status"] for r in load()] == ["loaded"]
    return c


def test_summary_totals_and_percent(tmp_path, monkeypatch):
    c = api_client(tmp_path, monkeypatch)
    j = c.get("/api/returns/summary").json()
    t = j["total"]
    assert t["orders"] == 5 and t["returned_orders"] == 4 and t["full_orders"] == 2 and t["partial_orders"] == 2
    assert t["order_rial"] == 11000 and t["return_rial"] == 1000 + 300 + 400 - 50
    assert t["return_percent"] == pytest.approx(1650 / 11000)
    assert [m["year_month"] for m in j["months"]] == ["140506", "140507"]
    assert sum(m["return_rial"] for m in j["months"]) == t["return_rial"]
    assert sum(b["return_rial"] for b in j["branches"]) == t["return_rial"]
    assert {r["reason"]: r["orders"] for r in j["reasons"]} == {"لغو سفارش": 2, "تحویل ناقص": 1, "نامشخص": 1}
    assert j["quality"]["negative_return_orders"] == 1 and j["first_date"] == 14050620 and j["last_date"] == 14050710


def test_summary_filters_and_validation(tmp_path, monkeypatch):
    c = api_client(tmp_path, monkeypatch)
    get = lambda **p: c.get("/api/returns/summary", params=p).json()  # noqa: E731
    assert get(branch=KARAJ)["total"]["return_rial"] == 350
    assert get(start="1405/07/01")["total"]["orders"] == 4
    assert get(end="1405/06/30")["total"]["return_rial"] == 300
    assert get(branch=KARAJ, start="1405/07/01", end="1405/07/10")["total"]["orders"] == 2
    assert get(core="ch")["available"] is False
    # filters that exist only on sales pages are reported, not silently applied
    assert get(brand="x")["ignored_filters"] == ["brand"] and get(brand="x")["total"]["orders"] == 5
    assert c.get("/api/returns/summary", params={"core": "zz"}).status_code == 400
    assert c.get("/api/returns/summary", params={"start": "bad"}).status_code == 400
    assert c.get("/api/returns/summary", params={"status": "nope"}).status_code == 400


def test_list_pages_only_returned_orders(tmp_path, monkeypatch):
    c = api_client(tmp_path, monkeypatch)
    j = c.get("/api/returns/list").json()
    assert j["count"] == 4 and [r["dispatch_no"] for r in j["rows"]] == ["1", "4", "5", "2"]  # newest first
    assert {r["status"] for r in j["rows"]} == {"full", "partial"}
    assert c.get("/api/returns/list", params={"all_orders": "true"}).json()["count"] == 5
    page = c.get("/api/returns/list", params={"limit": 1, "offset": 1}).json()
    assert page["count"] == 4 and [r["dispatch_no"] for r in page["rows"]] == ["4"]
    assert c.get("/api/returns/list", params={"status": "full"}).json()["count"] == 2
    assert c.get("/api/returns/list", params={"limit": 0}).status_code == 422


def test_overview_and_sales_figures_are_untouched(tmp_path, monkeypatch):
    c = api_client(tmp_path, monkeypatch)
    j = c.get("/api/overview").json()
    assert j["sum_rial_vat"] == 2100 and j["returns_rial"] == 0  # SR rows only; dispatch returns are never added in


def test_customer_profile_has_dispatch_returns(tmp_path, monkeypatch):
    c = api_client(tmp_path, monkeypatch)
    r = c.get("/api/customer/C1").json()["dispatch_returns"]
    assert r["total"]["orders"] == 2 and r["total"]["return_rial"] == 1300
    assert r["total"]["return_percent"] == pytest.approx(1300 / 4000)
    assert [x["dispatch_no"] for x in r["recent"]] == ["1", "2"]
    none = c.get("/api/customer/C2").json()["dispatch_returns"]
    assert none["total"]["orders"] == 1 and none["total"]["return_rial"] == 0 and none["recent"] == []


def test_visitor_profile_matches_by_name_and_flags_shared_names(tmp_path, monkeypatch):
    c = api_client(tmp_path, monkeypatch)
    r = c.get("/api/visitor/11").json()["dispatch_returns"]
    assert r["matched_names"] == ["علی رضایی"] and r["ambiguous_names"] == []
    assert r["total"]["orders"] == 3 and r["total"]["return_rial"] == 1300  # orders 1-3 carry that name
    # one name under two visitor codes cannot be attributed to either: reported, left out of the totals
    shared = c.get("/api/visitor/13").json()["dispatch_returns"]
    assert shared["ambiguous_names"] == ["نام مشترک"] and shared["matched_names"] == []
    assert shared["total"]["orders"] == 0 and shared["total"]["return_rial"] == 0


def test_profiles_without_any_returns_loaded(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, {"sr_kg_140507": [make_row(S, "1", "C1", "1000", "10", vcode="11", vname="علی")]})
    assert c.get("/api/customer/C1").json()["dispatch_returns"]["total"]["orders"] == 0
    assert c.get("/api/returns/summary").json()["available"] is False
    assert c.get("/api/returns/list").json()["rows"] == []


def test_reason_filter_applies_to_summary_and_profiles(tmp_path, monkeypatch):
    c = api_client(tmp_path, monkeypatch)
    s = c.get("/api/returns/summary", params={"core": "kg", "reason": "لغو سفارش"}).json()
    assert s["total"]["orders"] == 2
    assert s["total"]["return_rial"] == 1000 + 400
    assert {r["reason"] for r in s["reasons"]} == {"لغو سفارش"}
    cust = c.get("/api/customer/C1", params={"reason": "تحویل ناقص"}).json()["dispatch_returns"]
    assert cust["total"]["orders"] == 1 and cust["total"]["return_rial"] == 300
    assert [x["dispatch_no"] for x in cust["recent"]] == ["2"]
    vis = c.get("/api/visitor/11", params={"reason": "لغو سفارش"}).json()["dispatch_returns"]
    assert all(x["reason"] == "لغو سفارش" for x in vis["recent"])


def test_reason_filter_matches_unknown_reason(tmp_path, monkeypatch):
    c = api_client(tmp_path, monkeypatch)
    s = c.get("/api/returns/summary", params={"core": "kg", "reason": "نامشخص"}).json()
    assert s["total"]["orders"] >= 1
    assert all(r["reason"] == "نامشخص" for r in s["reasons"])
