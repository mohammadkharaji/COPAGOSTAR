from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import api
from app.agent import llm as llm_mod
from app.agent import sales_tool
from app.agent.graph import run


class FakeLLM:
    def __init__(self, text="پاسخ آزمون"):
        self.text = text
        self.calls = 0

    def invoke(self, messages):
        self.calls += 1
        return SimpleNamespace(content=self.text)


def _insight(rule="افزایش فروش در مهر"):
    return SimpleNamespace(rule=rule, question="فروش")


def test_memory_hit_skips_db(monkeypatch):
    monkeypatch.setattr("app.agent.db.search_memories", lambda q, limit=5: [_insight()])

    def boom(*a, **k):
        raise AssertionError("query_sales_db نباید صدا زده شود")

    monkeypatch.setattr(sales_tool, "query_sales_db", boom)
    out = run("فروش مهر", llm=FakeLLM())
    assert out["answer"] == "پاسخ آزمون"
    assert out["used_memory"] is True
    assert not out.get("used_db")


def test_memory_miss_queries_db(monkeypatch):
    monkeypatch.setattr("app.agent.db.search_memories", lambda q, limit=5: [])
    monkeypatch.setattr(sales_tool, "query_sales_db", lambda q: "sales_value_rial=1000 customers=5")
    out = run("فروش مهر", llm=FakeLLM())
    assert out["used_db"] is True
    assert out["answer"] == "پاسخ آزمون"


def test_llm_requires_env(monkeypatch, tmp_path):
    """Missing settings fail loudly. The .env fallback is redirected, so a real backend/.env on the
    developer's machine cannot make this pass silently."""
    monkeypatch.setattr(llm_mod, "ENV_FILE", tmp_path / "absent.env")
    for k in ("AGENT_LLM_API_KEY", "AGENT_LLM_BASE_URL", "AGENT_LLM_MODEL"):
        monkeypatch.delenv(k, raising=False)
    with pytest.raises(RuntimeError):
        llm_mod.get_llm()


def test_llm_reads_backend_env(monkeypatch, tmp_path):
    """backend/.env fills the gaps when the process environment has nothing (the real deployment path)."""
    env = tmp_path / ".env"
    env.write_text("AGENT_LLM_API_KEY=k\nAGENT_LLM_BASE_URL=https://example.test/v1\nAGENT_LLM_MODEL=m\n",
                   encoding="utf-8")
    monkeypatch.setattr(llm_mod, "ENV_FILE", env)
    for k in ("AGENT_LLM_API_KEY", "AGENT_LLM_BASE_URL", "AGENT_LLM_MODEL"):
        monkeypatch.delenv(k, raising=False)
    built = llm_mod.get_llm()
    assert built.model_name == "m"


def test_chat_requires_login():
    client = TestClient(api.app)
    r = client.post("/api/chat", json={"question": "فروش"})
    assert r.status_code == 401
