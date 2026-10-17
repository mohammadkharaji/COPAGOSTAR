"""Minimal OpenAI-compatible chat-completions client (stdlib only). Key/URL/model come from env only."""
import json
import os
import urllib.error
import urllib.request


def settings() -> dict:
    return {"base": os.environ.get("SR_AGENT_BASE_URL", "").rstrip("/"),
            "key": os.environ.get("SR_AGENT_API_KEY", ""),
            "model": os.environ.get("SR_AGENT_MODEL", "")}


def configured() -> bool:
    s = settings()
    return bool(s["base"] and s["key"] and s["model"])


class LLMError(Exception):
    pass


def chat(messages: list, tools: list, timeout: float) -> dict:
    """One chat-completions call; returns the assistant message dict. Never leaks the key in errors."""
    s = settings()
    body = json.dumps({"model": s["model"], "messages": messages, "tools": tools,
                       "tool_choice": "auto", "temperature": 0}).encode()
    req = urllib.request.Request(f"{s['base']}/chat/completions", data=body, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "Authorization": f"Bearer {s['key']}"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)["choices"][0]["message"]
    except urllib.error.HTTPError as e:
        raise LLMError(f"سرویس مدل خطا برگرداند ({e.code})") from None
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError, OSError):
        raise LLMError("ارتباط با سرویس مدل برقرار نشد") from None
