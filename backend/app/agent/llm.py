"""ChatOpenAI configured from AGENT_LLM_* (real environment first, then backend/.env)."""
from __future__ import annotations

import os
from pathlib import Path

from langchain_openai import ChatOpenAI

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
_KEYS = ("AGENT_LLM_API_KEY", "AGENT_LLM_BASE_URL", "AGENT_LLM_MODEL")


def _read_env(path: Path) -> dict[str, str]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return {}
    out: dict[str, str] = {}
    for line in lines:
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def _setting(name: str) -> str | None:
    """Real environment wins; backend/.env fills the gaps (same file the SQL extractor reads)."""
    value = os.environ.get(name)
    if value:
        return value
    return _read_env(ENV_FILE).get(name) or None


def get_llm() -> ChatOpenAI:
    api_key = _setting("AGENT_LLM_API_KEY")
    base_url = _setting("AGENT_LLM_BASE_URL")
    model = _setting("AGENT_LLM_MODEL")
    missing = [k for k, v in zip(_KEYS, (api_key, base_url, model)) if not v]
    if missing:
        raise RuntimeError("تنظیم نشده: " + " / ".join(missing))
    return ChatOpenAI(api_key=api_key, base_url=base_url, model=model)