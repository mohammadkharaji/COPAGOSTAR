"""Tests for the optional AI agent (removable: delete this file together with backend/app/agent/)."""
import json

import pytest
from fastapi.testclient import TestClient
from test_api import build_client, make_row

ROWS = {"sr_kg_140507": [
    make_row("SRSalesProcedure1405", "1", "A", "1000", "10", "100", "20", "30", "11", "علی رضایی"),
    make_row("SRSalesProcedure1405", "2", "B", "500", "5", vcode="12", vname="علی رضایی", branch="شعبه کرج"),
    make_row("SRDatedSalesReturnProcedurewithVAT1405", "3", "A", "-200", "-2", vcode="11", vname="علی رضایی"),
    make_row("SRPromotionsProcedure1405", "4", "B", "50", "1", vcode="12", vname="علی رضایی")]}


def _enable(monkeypatch, configured=True):
    monkeypatch.setenv("SR_AGENT_ENABLED", "1")
    for k in ("SR_AGENT_BASE_URL", "SR_AGENT_API_KEY", "SR_AGENT_MODEL"):
        if configured:
            monkeypatch.setenv(k, "dummy-" + k.lower())
        else:
            monkeypatch.delenv(k, raising=False)


def _call(name, args, cid="c1"):
    return {"role": "assistant", "content": "", "tool_calls": [
        {"id": cid, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}]}


def _script(monkeypatch, replies):
    """Replace llm.chat with a scripted fake; returns the list of message snapshots it received."""
    from app.agent import llm
    seen, it = [], iter(replies)
    def fake(messages, tools, timeout):
        seen.append(list(messages))
        r = next(it)
        if isinstance(r, Exception):
            raise r
        return r
    monkeypatch.setattr(llm, "chat", fake)
    return seen


@pytest.fixture()
def agent_client(tmp_path, monkeypatch):
    _enable(monkeypatch)
    return build_client(tmp_path, monkeypatch, ROWS)


def test_flag_off_leaves_app_unchanged(tmp_path, monkeypatch):
    monkeypatch.delenv("SR_AGENT_ENABLED", raising=False)
    c = build_client(tmp_path, monkeypatch, ROWS)
    assert c.get("/api/agent/status").status_code == 404
    assert c.post("/api/agent/ask", json={"question": "x"}).status_code in (404, 405)
    assert c.get("/api/overview").status_code == 200


def test_requires_login(agent_client):
    from app import api
    anon = TestClient(api.app)
    assert anon.get("/api/agent/status").status_code == 401
    assert anon.post("/api/agent/ask", json={"question": "x"}).status_code == 401
    assert agent_client.get("/api/agent/status").json() == {"enabled": True, "configured": True}


def test_unconfigured_returns_503(tmp_path, monkeypatch):
    _enable(monkeypatch, configured=False)
    c = build_client(tmp_path, monkeypatch, ROWS)
    assert c.get("/api/agent/status").json() == {"enabled": True, "configured": False}
    assert c.post("/api/agent/ask", json={"question": "x"}).status_code == 503


def test_tool_numbers_match_dashboard(agent_client, monkeypatch):
    seen = _script(monkeypatch, [_call("get_overview", {}), {"role": "assistant", "content": "پاسخ"}])
    r = agent_client.post("/api/agent/ask", json={"question": "فروش چقدر است؟"})
    assert r.status_code == 200
    body = r.json()
    assert body["answer"] == "پاسخ" and body["tools_used"] == ["get_overview"]
    assert body["freshness"]["last_data_date"]
    tool_msg = [m for m in seen[-1] if m["role"] == "tool"][0]
    assert json.loads(tool_msg["content"]) == agent_client.get("/api/overview").json()


def test_filters_and_breakdown_match_dashboard(agent_client, monkeypatch):
    seen = _script(monkeypatch, [
        _call("get_breakdown", {"by": "branch", "filters": {"branch": "شعبه کرج"}}),
        {"role": "assistant", "content": "ok"}])
    agent_client.post("/api/agent/ask", json={"question": "q"})
    got = json.loads([m for m in seen[-1] if m["role"] == "tool"][0]["content"])
    want = agent_client.get("/api/breakdown", params={"by": "branch", "branch": "شعبه کرج", "limit": 30}).json()
    assert got == want


def test_tool_guards(agent_client):
    from app.agent import tools
    bad_filter = json.loads(tools.run_tool("get_overview", {"filters": {"evil": "1"}}))
    assert "error" in bad_filter
    assert "error" in json.loads(tools.run_tool("drop_tables", {}))
    assert "error" in json.loads(tools.run_tool("get_overview", "not-a-dict"))
    assert "error" in json.loads(tools.run_tool("get_breakdown", {"by": "nope"}))
    assert "error" in json.loads(tools.run_tool("get_overview", {"start": "bad"}))
    assert "error" in json.loads(tools.run_tool("get_profile", {"by": "branch"}))  # missing key
    status = json.loads(tools.run_tool("get_data_status", {}))
    assert status["last_data_date"] and status["known_limitations"]


def test_clip_truncates_long_lists():
    from app.agent import tools
    state = {"truncated": False}
    out = tools._clip({"rows": list(range(tools.MAX_ROWS + 10))}, state)
    assert len(out["rows"]) == tools.MAX_ROWS and state["truncated"]


def test_tool_call_cap_and_round_limit(agent_client, monkeypatch):
    from app import agent
    monkeypatch.setattr(agent, "MAX_ROUNDS", 2)
    _script(monkeypatch, [_call("get_data_status", {}), _call("get_data_status", {}, "c2")])
    r = agent_client.post("/api/agent/ask", json={"question": "loop"})
    assert r.status_code == 200 and r.json()["tools_used"] == ["get_data_status"] * 2
    assert "سقف" in r.json()["answer"]


def test_llm_error_is_generic_and_leaks_nothing(agent_client, monkeypatch):
    from app.agent import llm
    _script(monkeypatch, [llm.LLMError("ارتباط با سرویس مدل برقرار نشد")])
    r = agent_client.post("/api/agent/ask", json={"question": "q"})
    assert r.status_code == 502
    assert "dummy-" not in r.text


def test_input_validation(agent_client):
    assert agent_client.post("/api/agent/ask", json={"question": ""}).status_code == 422
    assert agent_client.post("/api/agent/ask", json={"question": "x" * 1001}).status_code == 422
    bad_role = {"question": "x", "history": [{"role": "system", "content": "hi"}]}
    assert agent_client.post("/api/agent/ask", json=bad_role).status_code == 422
