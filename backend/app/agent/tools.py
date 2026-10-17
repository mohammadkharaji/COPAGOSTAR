"""Allow-listed, read-only tools for the AI agent (removable feature: see backend/app/agent/README.txt).

Every tool calls an existing dashboard route function, so the agent reports exactly the numbers the
dashboard shows. There is no free-form SQL, no file/shell access and nothing that writes.
"""
import json
from urllib.parse import urlencode

from fastapi import HTTPException
from starlette.requests import Request

MAX_ROWS = 40          # list items kept per tool result
MAX_CHARS = 14_000     # serialized size cap per tool result

FILTER_KEYS = ["sales_type", "region", "state", "city", "branch", "brand", "group", "grade", "visitor"]
_COMMON = {
    "core": {"type": "string", "enum": ["kg", "ch"], "description": "kg = کوپا گستر (پیش‌فرض)، ch = زنجیره‌ای"},
    "start": {"type": "string", "description": "شروع بازه شمسی، مثل 1405/07/01"},
    "end": {"type": "string", "description": "پایان بازه شمسی، مثل 1405/07/30"},
    "filters": {"type": "object", "description": "فیلتر اختیاری؛ کلیدهای مجاز: " + ", ".join(FILTER_KEYS)
                                                  + "؛ مقدار رشته یا فهرست رشته"},
}


def _schema(desc, props=None, required=(), common=True):
    p = {**(_COMMON if common else {}), **(props or {})}
    return {"description": desc, "parameters": {"type": "object", "properties": p, "required": list(required)}}


_BY = ["month", "day", "product", "customer", *FILTER_KEYS]
TOOLS = {
    "get_overview": _schema("شاخص‌های کلی دوره: فروش ناخالص، پروموشن، فروش خالص، مرجوعی، تعداد فاکتور و مشتری فعال."),
    "get_breakdown": _schema("تفکیک شاخص‌ها بر اساس یک بعد (مثلاً شعبه، برند، ماه، محصول).",
                             {"by": {"type": "string", "enum": _BY},
                              "limit": {"type": "integer", "minimum": 1, "maximum": 100}}, ["by"]),
    "get_trend": _schema("روند روزانه فروش در بازه."),
    "get_monthly": _schema("فروش ماهانه (بدون بازه زمانی)."),
    "get_growth": _schema("رشد نسبت به دوره قبل؛ دوره ناقص با همان بازه گذشته‌ی دوره قبل مقایسه می‌شود.",
                          {"kind": {"type": "string", "enum": ["month", "season", "half"]}}),
    "get_pareto": _schema("تمرکز فروش (پارتو) برای مشتری/محصول/ویزیتور/شعبه/روز.",
                          {"by": {"type": "string", "enum": ["customer", "product", "visitor", "branch", "day"]},
                           "threshold": {"type": "number", "minimum": 0.1, "maximum": 1},
                           "limit": {"type": "integer", "minimum": 1, "maximum": 100}}),
    "get_visitors": _schema("عملکرد ویزیتورها."),
    "get_profile": _schema("پروفایل عملکرد یک شعبه/برند/گروه/محصول مشخص.",
                           {"by": {"type": "string", "enum": ["branch", "brand", "group", "product"]},
                            "key": {"type": "string", "description": "نام دقیق مورد نظر، همان‌طور که در داده آمده"}},
                           ["by", "key"]),
    "get_invoice_lines": _schema("تحلیل اقلام فاکتور (فقط فروش عادی)."),
    "get_invoice_bands": _schema("توزیع فاکتورها بر اساس بازه مبلغ.",
                                 {"step": {"type": "number", "description": "عرض بازه به ریال"}}),
    "get_pace": _schema("پیش‌بینی پایان ماه بر اساس میانگین روزهای کاری؛ فقط برآورد است، نه عدد قطعی.",
                        {"core": _COMMON["core"]}, common=False),
    "get_data_status": _schema("آخرین تاریخ داده، وضعیت به‌روزرسانی و محدودیت‌های شناخته‌شده داده.", common=False),
}
OPENAI_TOOLS = [{"type": "function", "function": {"name": n, **s}} for n, s in TOOLS.items()]


def _request(filters) -> Request:
    pairs = []
    if filters is not None and not isinstance(filters, dict):
        raise HTTPException(400, "filters باید شیء باشد")
    for key, val in (filters or {}).items():
        if key not in FILTER_KEYS:
            raise HTTPException(400, f"فیلتر نامعتبر: {key}")
        vals = val if isinstance(val, list) else [val]
        pairs += [(key, str(v)) for v in vals if v not in (None, "")]
    return Request({"type": "http", "method": "GET", "query_string": urlencode(pairs).encode(), "headers": []})


def _clip(obj, state):
    if isinstance(obj, list):
        if len(obj) > MAX_ROWS:
            state["truncated"] = True
        return [_clip(x, state) for x in obj[:MAX_ROWS]]
    if isinstance(obj, dict):
        return {k: _clip(v, state) for k, v in obj.items()}
    return obj


def _dispatch(name: str, a: dict):
    from .. import api  # lazy: api imports this package at its end

    core, start, end = a.get("core") or "kg", a.get("start"), a.get("end")
    req = _request(a.get("filters"))
    # Every argument is passed explicitly: Query(...) defaults are objects, not values, on direct calls.
    if name == "get_overview":
        return api.overview(req, core, start, end)
    if name == "get_breakdown":
        return api.breakdown(req, a["by"], core, start, end, max(1, min(int(a.get("limit") or 30), 100)))
    if name == "get_trend":
        return api.trend(req, core, start, end)
    if name == "get_monthly":
        return api.monthly(req, core)
    if name == "get_growth":
        return api.growth(req, a.get("kind") or "month", core)
    if name == "get_pareto":
        return api.pareto(req, a.get("by") or "customer", core, start, end,
                          float(a.get("threshold") or 0.8), max(1, min(int(a.get("limit") or 30), 100)))
    if name == "get_visitors":
        return api.visitors(req, core, start, end)
    if name == "get_profile":
        return api.dimension_profile(a["by"], a["key"], req, core, start, end)
    if name == "get_invoice_lines":
        return api.invoice_lines(req, core, start, end)
    if name == "get_invoice_bands":
        return api.invoice_bands(req, core, start, end, float(a.get("step") or 10_000_000))
    if name == "get_pace":
        return api.pace(_request(None), core)
    if name == "get_data_status":
        return freshness()
    raise HTTPException(400, "ابزار ناشناخته")


def freshness() -> dict:
    """Data freshness + known limitations, taken from the same sources the dashboard uses."""
    from .. import api
    from ..schema import LIMITATIONS

    h, s = api.health(), api.sync_status()
    return {"last_data_date": h.get("last_data_date"), "data_status": h.get("status"),
            "missing_chunks": h.get("missing_kg_chunks"),
            "sync": {k: s.get(k) for k in ("state", "finished_at", "rows_loaded")},
            "known_limitations": LIMITATIONS}


def run_tool(name: str, args) -> str:
    """Run one allow-listed tool; always returns a JSON string (errors included) for the model."""
    if name not in TOOLS or not isinstance(args, dict):
        return json.dumps({"error": "ابزار یا پارامتر نامعتبر"}, ensure_ascii=False)
    try:
        state = {"truncated": False}
        out = _clip(_dispatch(name, args), state)
        if state["truncated"]:
            out = {"result": out, "note": f"فهرست‌ها به {MAX_ROWS} ردیف اول کوتاه شده‌اند"}
        text = json.dumps(out, ensure_ascii=False, default=str)
        if len(text) > MAX_CHARS:
            text = json.dumps({"error": "نتیجه بیش از حد بزرگ است؛ بازه یا فیلتر را محدودتر کنید"}, ensure_ascii=False)
        return text
    except HTTPException as e:
        return json.dumps({"error": str(e.detail)}, ensure_ascii=False)
    except (KeyError, ValueError, TypeError) as e:
        return json.dumps({"error": f"پارامتر نامعتبر: {e}"}, ensure_ascii=False)
