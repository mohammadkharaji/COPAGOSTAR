"""Convert the daily distribution-returns workbook into the delta extract the dashboard loads.

Run each day on the exported workbook:

  python tools/returns/convert_returns.py Returns.xlsx --check
  python tools/returns/convert_returns.py Returns.xlsx --dry-run
  python tools/returns/convert_returns.py Returns.xlsx --out data/raw
  python tools/returns/convert_returns.py Returns.xlsx --upload root@SERVER --key ~/.ssh/sr_deploy

Source columns A-U (header row must match exactly): مرکز فروش، شماره حواله پخش، شماره تور، تاریخ تور، کد مشتری،
نام مشتری، سوپروایزر، ویزیتور، موزع، راننده، زمان تایید درخواست، شماره حواله، تاریخ حواله، مبلغ حواله، شماره فاکتور،
زمان ثبت فاکتور، مبلغ فاکتور، روش تسویه، ريال کل برگشتی، ريال جز برگشتی، دلیل برگشتی.

Writes ret_<core>_<YYYYMMDD>_<HHMM>.tsv (Jalali publish date) with app.schema.RETURN_COLS, \\x1f/\\x1e delimited, holding
only the dispatch orders that are new or changed since the last run. A JSON state file (branch + dispatch_no -> row hash)
remembers what was already emitted; it is updated only after the extract was written locally. Nothing is uploaded
unless --upload is given. --check validates the workbook and reports; --dry-run also shows what the next run would
write; neither writes anything. Standard library only (zipfile + XML); handles shared, inline and rich-text strings.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shlex
import subprocess
import sys
import zipfile
from collections import Counter
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import CORES, DEFAULT_CORE  # noqa: E402
from app.jalali import days_in_jalali_month, format_jdate, gregorian_to_jalali  # noqa: E402
from app.normalize import normalize_text  # noqa: E402
from app.schema import RETURN_COLS, RETURN_NUMERIC  # noqa: E402

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RELNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKGRELNS = "{http://schemas.openxmlformats.org/package/2006/relationships}"

SOURCE_HEADERS = {
    "A": "مرکز فروش", "B": "شماره حواله پخش", "C": "شماره تور", "D": "تاریخ تور", "E": "کد مشتری", "F": "نام مشتری",
    "G": "سوپروایزر", "H": "ویزیتور", "I": "موزع", "J": "راننده", "K": "زمان تایید درخواست", "L": "شماره حواله",
    "M": "تاریخ حواله", "N": "مبلغ حواله", "O": "شماره فاکتور", "P": "زمان ثبت فاکتور", "Q": "مبلغ فاکتور",
    "R": "روش تسویه", "S": "ريال کل برگشتی", "T": "ريال جز برگشتی", "U": "دلیل برگشتی",
}
# RETURN_COLS field -> source column. dispatch_no is column L (unique per row); B is a group number that repeats
# across rows and must not be the key. B, K and P (group number, request / invoice timestamps) are not loaded.
FIELD_COLUMN = {
    "branch": "A", "dispatch_no": "L", "tour_no": "C", "tour_date": "D", "customer_code": "E", "customer_name": "F",
    "supervisor": "G", "visitor": "H", "distributor": "I", "driver": "J", "order_date": "M", "invoice_no": "O",
    "settle_method": "R", "return_reason": "U", "order_rial": "N", "invoice_rial": "Q", "full_return_rial": "S",
    "part_return_rial": "T",
}
assert set(FIELD_COLUMN) == set(RETURN_COLS)
ID_FIELDS = ("dispatch_no", "tour_no", "customer_code", "invoice_no")  # compared and keyed as ASCII-digit text
STATE_VERSION = 1

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_DATE_RE = re.compile(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?!\d)")
_COMPACT_DATE_RE = re.compile(r"(\d{4})(\d{2})(\d{2})")


class ReturnsError(Exception):
    pass


def _ascii_digits(s: str) -> str:
    return s.translate(_DIGITS)


# ---------------------------------------------------------------- workbook reading

def _text_of(el) -> str:
    """Text of a shared/inline string item: plain <t> plus rich-text runs <r><t>, never phonetic <rPh>."""
    parts = []
    for child in el:
        if child.tag == NS + "t":
            parts.append(child.text or "")
        elif child.tag == NS + "r":
            parts.extend(t.text or "" for t in child.findall(NS + "t"))
    return "".join(parts)


def _number_text(raw: str) -> str:
    """Cell number as text: integral values without exponent or '.0' (codes and numbers stored as numeric cells)."""
    try:
        d = Decimal(raw)
    except InvalidOperation:
        return raw
    if d == d.to_integral_value():
        return str(int(d))
    return format(d.normalize(), "f")


def _sheet_path(z: zipfile.ZipFile, wanted: str | None) -> tuple[str, str]:
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    sheets = [s for s in wb.iter(NS + "sheet")]
    if wanted is not None:
        sheet = next((s for s in sheets if s.get("name") == wanted), None)
        if sheet is None:
            raise ReturnsError(f"شیت «{wanted}» در فایل پیدا نشد؛ شیت‌ها: {[s.get('name') for s in sheets]}")
    else:
        sheet = next((s for s in sheets if s.get("state") in (None, "visible")), None)
        if sheet is None:
            raise ReturnsError("هیچ شیت قابل‌مشاهده‌ای در فایل نیست")
    rid = sheet.get(RELNS + "id")
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    target = next((r.get("Target") for r in rels.iter(PKGRELNS + "Relationship") if r.get("Id") == rid), None)
    if target is None:
        raise ReturnsError("مسیر شیت در فایل پیدا نشد")
    return sheet.get("name"), "xl/" + target.lstrip("/").removeprefix("xl/")


def read_rows(path: Path, sheet: str | None = None) -> tuple[str, list[dict[str, str]]]:
    """Return (sheet name, rows). Each row maps column letter -> text; "_row" holds the Excel row number."""
    with zipfile.ZipFile(path) as z:
        name, sheet_file = _sheet_path(z, sheet)
        strings: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            strings = [_text_of(si) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si")]
        rows = []
        for _, el in ET.iterparse(z.open(sheet_file)):
            if el.tag != NS + "row":
                continue
            r: dict[str, str] = {"_row": el.get("r") or str(len(rows) + 1)}
            for pos, c in enumerate(el.findall(NS + "c")):
                m = re.match(r"[A-Z]+", c.get("r") or "")
                col = m.group(0) if m else chr(ord("A") + pos)
                kind, v = c.get("t"), c.find(NS + "v")
                if kind == "inlineStr":
                    is_ = c.find(NS + "is")
                    text = "" if is_ is None else _text_of(is_)
                elif v is None or v.text is None or kind == "e":
                    text = ""
                elif kind == "s":
                    text = strings[int(v.text)]
                elif kind in ("str", "b"):
                    text = v.text
                else:
                    text = _number_text(v.text)
                r[col] = text
            rows.append(r)
            el.clear()
    return name, rows


# ---------------------------------------------------------------- value normalization

def parse_amount(raw: str) -> Decimal:
    s = _ascii_digits(raw).replace(",", "").replace("٬", "").replace("٫", ".").replace(" ", "")
    if s == "":
        return Decimal(0)
    try:
        d = Decimal(s)
    except InvalidOperation:
        raise ValueError(raw) from None
    if not d.is_finite():
        raise ValueError(raw)
    return d


def format_amount(d: Decimal) -> str:
    return str(int(d)) if d == d.to_integral_value() else format(d.normalize(), "f")


def parse_date(raw: str) -> str | None:
    """Jalali YYYY/MM/DD from Jalali text (any digits, / - . separators, optional time), Gregorian text, or an Excel serial."""
    s = _ascii_digits(raw).strip()
    if re.fullmatch(r"\d+(\.\d+)?", s) and 20000 <= float(s) <= 90000:  # Excel serial day number (Gregorian epoch)
        return format_jdate(*gregorian_to_jalali(date(1899, 12, 30) + timedelta(days=int(float(s)))))
    m = _DATE_RE.match(s) or (_COMPACT_DATE_RE.fullmatch(s) if s.isdigit() else None)
    if not m:
        return None
    y, mo, d = (int(g) for g in m.groups())
    try:
        if 1300 <= y <= 1499:
            if not 1 <= mo <= 12 or not 1 <= d <= days_in_jalali_month(y, mo):
                return None
            return format_jdate(y, mo, d)
        if 1900 <= y <= 2100:
            return format_jdate(*gregorian_to_jalali(date(y, mo, d)))
    except ValueError:
        return None
    return None


def row_hash(values: list[str]) -> str:
    return hashlib.sha256("\x1f".join(values).encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- conversion

def convert(path: Path, sheet: str | None = None) -> tuple[list[dict], dict]:
    """Return (records, report). Each record: branch, dispatch_no, values (RETURN_COLS order), hash.

    Raises ReturnsError on anything app.ingest.ingest_returns would reject, so a bad workbook never reaches the server."""
    sheet_name, rows = read_rows(path, sheet)
    if not rows:
        raise ReturnsError("شیت خالی است")
    head = {k: normalize_text(rows[0].get(k) or "") or "" for k in SOURCE_HEADERS}
    bad = {k: (SOURCE_HEADERS[k], head[k]) for k in SOURCE_HEADERS if head[k] != normalize_text(SOURCE_HEADERS[k])}
    if bad:
        raise ReturnsError(f"ستون‌های شیت با قالب انتظار رفته نمی‌خوانند: {bad}")
    records, errors, seen = [], [], {}
    for r in rows[1:]:
        n = r["_row"]
        if not any((r.get(k) or "").strip() for k in SOURCE_HEADERS):
            continue
        v: dict[str, str] = {}
        for field, col in FIELD_COLUMN.items():
            raw = r.get(col) or ""
            if field in RETURN_NUMERIC:
                continue
            v[field] = _ascii_digits(normalize_text(raw) or "") if field in ID_FIELDS else normalize_text(raw) or ""
        amounts = {}
        try:
            for field in RETURN_NUMERIC:
                amounts[field] = parse_amount(r.get(FIELD_COLUMN[field]) or "")
        except ValueError as e:
            errors.append(f"ردیف {n}: مبلغ عددی نیست «{e}»")
            continue
        order_date = parse_date(v["order_date"])
        if not (v["branch"] and v["dispatch_no"]):
            errors.append(f"ردیف {n}: مرکز فروش یا شماره حواله خالی است")
            continue
        if order_date is None:
            errors.append(f"ردیف {n}: تاریخ حواله معتبر نیست «{v['order_date']}»")
            continue
        if amounts["order_rial"] <= 0:
            errors.append(f"ردیف {n}: مبلغ حواله باید بزرگ‌تر از صفر باشد")
            continue
        v["order_date"] = order_date
        v["tour_date"] = parse_date(v["tour_date"]) or v["tour_date"]
        key = (v["branch"], v["dispatch_no"])
        if key in seen:
            errors.append(f"ردیف {n}: شماره حواله تکراری {key} (ردیف {seen[key]})")
            continue
        seen[key] = n
        values = [v[c] if c in v else format_amount(amounts[c]) for c in RETURN_COLS]
        records.append({"branch": key[0], "dispatch_no": key[1], "values": values, "hash": row_hash(values)})
    if errors:
        raise ReturnsError("خطا در داده:\n  " + "\n  ".join(errors[:25])
                           + (f"\n  … و {len(errors) - 25} خطای دیگر" if len(errors) > 25 else ""))
    if not records:
        raise ReturnsError("هیچ ردیفی پیدا نشد")
    col = {c: RETURN_COLS.index(c) for c in RETURN_NUMERIC}
    report = {
        "sheet": sheet_name, "rows": len(records), "branches": Counter(x["branch"] for x in records),
        "order_rial": sum(Decimal(x["values"][col["order_rial"]]) for x in records),
        "return_rial": sum(Decimal(x["values"][col["full_return_rial"]]) + Decimal(x["values"][col["part_return_rial"]])
                           for x in records),
        "first_date": min(x["values"][RETURN_COLS.index("order_date")] for x in records),
        "last_date": max(x["values"][RETURN_COLS.index("order_date")] for x in records),
    }
    return records, report


# ---------------------------------------------------------------- state and delta

def load_state(path: Path, core: str) -> dict[str, dict[str, str]]:
    """branch -> dispatch_no -> row hash. Missing file = first run. A damaged file stops the run instead of re-emitting all."""
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data["version"] != STATE_VERSION or data["core"] != core:
            raise KeyError("version/core")
        orders = data["orders"]
        if not all(isinstance(h, str) for d in orders.values() for h in d.values()):
            raise KeyError("orders")
        return orders
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as e:
        raise ReturnsError(f"فایل وضعیت {path} خراب است یا برای هستهٔ دیگری است ({e}); آن را بررسی یا حذف کنید") from None


def save_state(path: Path, core: str, orders: dict[str, dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".part")
    tmp.write_text(json.dumps({"version": STATE_VERSION, "core": core, "orders": orders}, ensure_ascii=False, indent=1,
                              sort_keys=True), encoding="utf-8")
    tmp.replace(path)


def delta(records: list[dict], state: dict[str, dict[str, str]]) -> tuple[list[dict], dict]:
    out, counts = [], Counter()
    for x in records:
        prev = state.get(x["branch"], {}).get(x["dispatch_no"])
        kind = "new" if prev is None else "changed" if prev != x["hash"] else "unchanged"
        counts[kind] += 1
        if kind != "unchanged":
            out.append(x)
    return out, {k: counts[k] for k in ("new", "changed", "unchanged")}


def merged_state(state: dict[str, dict[str, str]], records: list[dict]) -> dict[str, dict[str, str]]:
    """Old state plus the emitted orders; orders missing from today's workbook are kept (their history stays on the server)."""
    out = {b: dict(d) for b, d in state.items()}
    for x in records:
        out.setdefault(x["branch"], {})[x["dispatch_no"]] = x["hash"]
    return out


# ---------------------------------------------------------------- output

def extract_name(core: str, now: datetime, out_dir: Path) -> Path:
    """ret_<core>_<YYYYMMDD>_<HHMM>.tsv with the Jalali publish date; never reuses an existing name."""
    while True:
        d = format_jdate(*gregorian_to_jalali(now.date())).replace("/", "")
        dest = out_dir / f"ret_{core}_{d}_{now:%H%M}.tsv"
        if not dest.exists():
            return dest
        now += timedelta(minutes=1)


def write_tsv(path: Path, records: list[dict]) -> None:
    tmp = path.with_name(path.name + ".part")
    tmp.write_text("\x1f".join(RETURN_COLS) + "\x1e" + "".join("\x1f".join(x["values"]) + "\x1e" for x in records),
                   encoding="utf-8")
    tmp.replace(path)


def upload(path: Path, server: str, key: str | None, remote: str) -> None:
    ssh = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20"] + (["-i", key] if key else [])
    scp = ["scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20"] + (["-i", key] if key else [])
    dest = f"{remote.rstrip('/')}/raw/{path.name}"
    subprocess.run(scp + [str(path), f"{server}:{dest}.part"], check=True)
    subprocess.run(ssh + [server, f"chown sr:sr {shlex.quote(dest)}.part && mv -f {shlex.quote(dest)}.part {shlex.quote(dest)}"], check=True)


def main(argv: list[str] | None = None, now: datetime | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):  # Windows consoles default to a legacy codepage that cannot print Persian
        stream.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("workbook", type=Path)
    ap.add_argument("--core", default=DEFAULT_CORE, choices=sorted(CORES))
    ap.add_argument("--sheet", help="نام شیت؛ پیش‌فرض اولین شیت قابل‌مشاهده")
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "raw", help="پوشهٔ خروجی (پیش‌فرض data/raw)")
    ap.add_argument("--state", type=Path, help="فایل وضعیت JSON (پیش‌فرض data/returns_state_<core>.json)")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="فقط اعتبارسنجی و گزارش؛ چیزی نوشته نمی‌شود")
    mode.add_argument("--dry-run", action="store_true", help="مثل اجرای واقعی ولی بدون نوشتن فایل خروجی و وضعیت")
    ap.add_argument("--upload", metavar="USER@HOST", help="پس از تبدیل روی سرور بارگذاری شود (فقط با درخواست صریح)")
    ap.add_argument("--key", help="مسیر کلید SSH")
    ap.add_argument("--remote-data", default="/opt/sr/data")
    a = ap.parse_args(argv)
    if a.upload and (a.check or a.dry_run):
        print("--upload با --check یا --dry-run سازگار نیست", file=sys.stderr)
        return 2
    state_path = a.state or ROOT / "data" / f"returns_state_{a.core}.json"
    try:
        records, rep = convert(a.workbook, a.sheet)
        state = {} if a.check else load_state(state_path, a.core)
    except (ReturnsError, OSError, zipfile.BadZipFile, KeyError) as e:
        print(f"ناموفق: {e}", file=sys.stderr)
        return 1
    print(f"هسته {CORES[a.core]}، شیت «{rep['sheet']}»: {rep['rows']:,} حواله، تاریخ {rep['first_date']} تا {rep['last_date']}")
    print(f"جمع مبلغ حواله: {rep['order_rial']:,.0f} ریال؛ جمع برگشتی: {rep['return_rial']:,.0f} ریال")
    for b, n in rep["branches"].most_common():
        print(f"  {b}: {n:,} حواله")
    if a.check:
        print("بررسی تمام شد؛ چیزی نوشته نشد.")
        return 0
    out, counts = delta(records, state)
    print(f"نسبت به آخرین اجرا: {counts['new']:,} جدید، {counts['changed']:,} تغییرکرده، {counts['unchanged']:,} بدون تغییر")
    if not out:
        print("حوالهٔ جدید یا تغییرکرده‌ای نیست؛ فایلی نوشته نشد.")
        return 0
    dest = extract_name(a.core, now or datetime.now(), a.out)
    if a.dry_run:
        print(f"آزمایشی: {len(out):,} ردیف در {dest} نوشته می‌شد؛ چیزی نوشته نشد.")
        return 0
    try:
        a.out.mkdir(parents=True, exist_ok=True)
        write_tsv(dest, out)
        save_state(state_path, a.core, merged_state(state, out))
    except OSError as e:
        print(f"نوشتن ناموفق بود: {e}", file=sys.stderr)
        return 1
    print(f"نوشته شد: {dest} ({len(out):,} ردیف)؛ وضعیت: {state_path}")
    if a.upload:
        try:
            upload(dest, a.upload, a.key, a.remote_data)
        except (subprocess.CalledProcessError, OSError) as e:
            print(f"بارگذاری روی سرور ناموفق بود: {e}\nفایل {dest} حفظ شده و وضعیت به‌روز است؛ بارگذاری را دستی تکرار کنید.",
                  file=sys.stderr)
            return 1
        print("روی سرور بارگذاری شد؛ sr-sync خودکار آن را در پایگاه‌داده وارد می‌کند.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
