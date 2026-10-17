"""Convert the monthly target workbook (Target.xlsx) into the extract the dashboard loads, and upload it.

Run once a month, when the new target is announced. Separate from publish-to-server (sales data):

  python tools/monthly-target/convert_target.py Target.xlsx --month 1405/08 --check
  python tools/monthly-target/convert_target.py Target.xlsx --month 1405/08 --out data/raw
  python tools/monthly-target/convert_target.py Target.xlsx --month 1405/08 --upload root@SERVER --key ~/.ssh/sr_deploy

Reads the visible sheet «هدف نهایی» (columns: شعبه، Line، TargetCategory، گروه، کد ویزیتوری، VIS.VIS،
هدف کل، هدف ریالی تارگت کتگوری، نام سرپرست، نام مدیر) and writes target_kg_<YYYYMM>.tsv with
columns month, branch, line, target_category, product_group, visitor_code, visitor_name, supervisor, manager,
target_rial. Standard library only; refuses to write anything if the workbook fails validation. Target.xlsx
holds no date, so --month is required. Uploading a month again replaces that month on the server.
"""
from __future__ import annotations

import argparse
import re
import shlex
import subprocess
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.normalize import normalize_text  # noqa: E402
from app.schema import TARGET_COLS  # noqa: E402

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RELNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
SHEET = "هدف نهایی"
CORES = {"kg": "کوپا گستر"}  # chain target comes later
SOURCE_HEADERS = {"A": "شعبه", "B": "Line", "C": "TargetCategory", "D": "گروه", "E": "کد ویزیتوری", "F": "VIS.VIS",
                  "G": "هدف کل", "H": "هدف ریالی تارگت کتگوری", "I": "نام سرپرست", "J": "نام مدیر"}
LINES = {"لاین سوپرمارکت", "لاین داروخانه"}  # same spelling as the sales column SR[GROUP]
ROUND_TOL = 1.0  # rials: per-visitor/group total vs sum of its categories


class TargetError(Exception):
    pass


def _sheet_path(z: zipfile.ZipFile, name: str) -> str:
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rid = next((s.get(RELNS + "id") for s in wb.iter(NS + "sheet") if s.get("name") == name), None)
    if rid is None:
        raise TargetError(f"شیت «{name}» در فایل پیدا نشد")
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    target = next(r.get("Target") for r in rels if r.get("Id") == rid)
    return "xl/" + target.lstrip("/").removeprefix("xl/")


def read_rows(path: Path) -> list[dict[str, str | None]]:
    with zipfile.ZipFile(path) as z:
        strings = [normalize_text("".join(t.text or "" for t in si.iter(NS + "t"))) or ""
                   for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si")]
        rows = []
        for _, el in ET.iterparse(z.open(_sheet_path(z, SHEET))):
            if el.tag != NS + "row":
                continue
            r = {}
            for c in el.findall(NS + "c"):
                v = c.find(NS + "v")
                r[re.match(r"[A-Z]+", c.get("r")).group(0)] = (
                    None if v is None else strings[int(v.text)] if c.get("t") == "s" else v.text)
            rows.append(r)
            el.clear()
    return rows


def convert(path: Path, month: str) -> tuple[list[list[str]], dict]:
    """Return (tsv rows, report). Raises TargetError on anything that would load wrong numbers."""
    rows = read_rows(path)
    if not rows:
        raise TargetError("شیت خالی است")
    head = {k: normalize_text(rows[0].get(k) or "") for k in SOURCE_HEADERS}
    bad = {k: (SOURCE_HEADERS[k], head[k]) for k in SOURCE_HEADERS if head[k] != normalize_text(SOURCE_HEADERS[k])}
    if bad:
        raise TargetError(f"ستون‌های شیت با قالب انتظار رفته نمی‌خوانند: {bad}")
    out, errors, seen = [], [], set()
    for n, r in enumerate(rows[1:], start=2):
        g = {k: normalize_text(r.get(k) or "") or "" for k in SOURCE_HEADERS}
        try:
            rial, total = float(g["H"]), float(g["G"])
        except ValueError:
            errors.append(f"ردیف {n}: مبلغ عددی نیست")
            continue
        line = g["B"] if g["B"] in LINES else None
        if line is None:
            errors.append(f"ردیف {n}: لاین ناشناخته «{g['B']}»")
            continue
        if rial < 0 or total < 0:
            errors.append(f"ردیف {n}: مبلغ منفی")
            continue
        if not (g["A"] and g["C"] and g["F"]):
            errors.append(f"ردیف {n}: شعبه، دسته کالا یا نام ویزیتور خالی است")
            continue
        code = "" if g["E"].upper() in ("", "#N/A", "N/A") else g["E"]
        key = (g["A"], line, g["C"], g["F"])
        if key in seen:
            errors.append(f"ردیف {n}: ردیف تکراری برای {key}")
            continue
        seen.add(key)
        out.append({"branch": g["A"], "line": line, "category": g["C"], "group": g["D"], "code": code, "name": g["F"],
                    "supervisor": g["I"], "manager": g["J"], "rial": rial, "total": total})
    if errors:
        raise TargetError("خطا در داده:\n  " + "\n  ".join(errors[:25]) + (f"\n  … و {len(errors) - 25} خطای دیگر" if len(errors) > 25 else ""))
    if not out:
        raise TargetError("هیچ ردیفی پیدا نشد")
    # هدف کل must equal the sum of that visitor's category targets within the group; otherwise the sheet is inconsistent.
    sums, totals = defaultdict(float), {}
    for x in out:
        k = (x["branch"], x["line"], x["name"], x["group"])
        sums[k] += x["rial"]
        totals[k] = x["total"]
    off = [(k, totals[k], sums[k]) for k in sums if abs(totals[k] - sums[k]) > max(ROUND_TOL, 1e-6 * sums[k])]
    if off:
        raise TargetError("جمع هدف دسته‌ها با «هدف کل» نمی‌خواند:\n  " + "\n  ".join(f"{k}: هدف کل {t:,.0f} ≠ جمع {s:,.0f}" for k, t, s in off[:10]))
    for who in ("supervisor", "manager"):
        if any(not x[who] for x in out):
            raise TargetError(f"نام {'سرپرست' if who == 'supervisor' else 'مدیر'} در بعضی ردیف‌ها خالی است")
    sup = defaultdict(set)
    for x in out:
        sup[(x["branch"], x["name"])].add(x["supervisor"])
    multi = [k for k, v in sup.items() if len(v) > 1]
    if multi:
        raise TargetError(f"یک ویزیتور چند سرپرست دارد: {multi[:5]}")
    ym = month.replace("/", "")
    tsv = [[ym, x["branch"], x["line"], x["category"], x["group"], x["code"], x["name"], x["supervisor"], x["manager"],
            f"{x['rial']:.2f}"] for x in out]
    no_code = {x["name"] for x in out if not x["code"]}
    report = {"rows": len(out), "total_rial": sum(x["rial"] for x in out), "visitors": len({x["name"] for x in out}),
              "visitors_without_code": len(no_code), "rial_without_code": sum(x["rial"] for x in out if not x["code"]),
              "branches": Counter(x["branch"] for x in out), "categories": len({x["category"] for x in out})}
    return tsv, report


def write_tsv(path: Path, rows: list[list[str]]) -> None:
    tmp = path.with_suffix(".tsv.part")
    tmp.write_text("\x1f".join(TARGET_COLS) + "\x1e" + "".join("\x1f".join(r) + "\x1e" for r in rows), encoding="utf-8")
    tmp.replace(path)


def upload(path: Path, server: str, key: str | None, remote: str) -> None:
    ssh = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20"] + (["-i", key] if key else [])
    scp = ["scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20"] + (["-i", key] if key else [])
    dest = f"{remote.rstrip('/')}/raw/{path.name}"
    subprocess.run(scp + [str(path), f"{server}:{dest}.part"], check=True)
    subprocess.run(ssh + [server, f"chown sr:sr {shlex.quote(dest)}.part && mv -f {shlex.quote(dest)}.part {shlex.quote(dest)}"], check=True)


def main() -> int:
    for stream in (sys.stdout, sys.stderr):  # Windows consoles default to a legacy codepage that cannot print Persian
        stream.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("workbook", type=Path)
    ap.add_argument("--month", required=True, help="ماه تارگت، مثل 1405/08")
    ap.add_argument("--core", default="kg", choices=sorted(CORES))
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "raw", help="پوشهٔ خروجی (پیش‌فرض data/raw)")
    ap.add_argument("--check", action="store_true", help="فقط اعتبارسنجی و گزارش؛ چیزی نوشته نمی‌شود")
    ap.add_argument("--upload", metavar="USER@HOST", help="پس از تبدیل روی سرور بارگذاری شود")
    ap.add_argument("--key", help="مسیر کلید SSH")
    ap.add_argument("--remote-data", default="/opt/sr/data")
    a = ap.parse_args()
    if not re.fullmatch(r"\d{4}/(0[1-9]|1[0-2])", a.month):
        print("--month باید مثل 1405/08 باشد", file=sys.stderr)
        return 2
    try:
        rows, rep = convert(a.workbook, a.month)
    except (TargetError, OSError, zipfile.BadZipFile, KeyError) as e:
        print(f"ناموفق: {e}", file=sys.stderr)
        return 1
    print(f"هسته {CORES[a.core]}، ماه {a.month}: {rep['rows']:,} ردیف، {rep['visitors']} ویزیتور، {rep['categories']} دسته کالا")
    print(f"جمع هدف: {rep['total_rial']:,.0f} ریال ({rep['total_rial'] / 1e9:,.1f} میلیارد)")
    print(f"ویزیتور بدون کد در فایل: {rep['visitors_without_code']} (هدف {rep['rial_without_code'] / 1e9:,.1f} میلیارد)؛ در سرور با نام تطبیق داده می‌شوند")
    for b, n in rep["branches"].most_common():
        print(f"  {b}: {n:,} ردیف")
    if a.check:
        print("بررسی تمام شد؛ چیزی نوشته نشد.")
        return 0
    a.out.mkdir(parents=True, exist_ok=True)
    dest = a.out / f"target_{a.core}_{a.month.replace('/', '')}.tsv"
    write_tsv(dest, rows)
    print(f"نوشته شد: {dest}")
    if a.upload:
        try:
            upload(dest, a.upload, a.key, a.remote_data)
        except (subprocess.CalledProcessError, OSError) as e:
            print(f"بارگذاری روی سرور ناموفق بود: {e}", file=sys.stderr)
            return 1
        print("روی سرور بارگذاری شد؛ sr-sync خودکار آن را در پایگاه‌داده وارد می‌کند.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
