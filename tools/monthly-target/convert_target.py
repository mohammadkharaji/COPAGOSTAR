"""Convert the monthly target workbook (Target.xlsx) into the extract the dashboard loads, and upload it.

Run once a month, when the new target is announced. Separate from publish-to-server (sales data):

  python tools/monthly-target/convert_target.py Target.07.xlsx --check                 # month 1405/07 from the file name
  python tools/monthly-target/convert_target.py Target.07.xlsx --out data/raw
  python tools/monthly-target/convert_target.py Target.07.xlsx --upload root@SERVER --key ~/.ssh/sr_deploy
  python tools/monthly-target/convert_target.py Target.xlsx --month 1405/08 --check    # legacy name: --month required

Reads the visible sheet «هدف نهایی» (columns: شعبه، Line، TargetCategory، گروه، کد ویزیتوری، VIS.VIS،
هدف ریالی تارگت کتگوری، نام سرپرست، نام مدیر) and writes target_kg_<YYYYMM>.tsv with
columns month, branch, line, target_category, product_group, visitor_code, visitor_name, supervisor, manager,
target_rial. Columns are found by their header names, so a «هدف کل» column may be present or deleted; it is never
read. The total for a month is the sum of «هدف ریالی تارگت کتگوری» and is derived at both the product-group
(گروه کالایی) and target-category levels. Rows with the same branch, line, category and visitor are summed into
one row (the monthly file may repeat a category at several levels). Standard library only; refuses to write
anything if the workbook fails validation. Target.xlsx holds no date: a strict Target.MM.xlsx name gives the month
(year 1405); the legacy Target.xlsx needs --month. An upload to a month that already exists on the server asks
before replacing it (--yes skips the question, and is required when no terminal is attached). The server keeps the
old file until the new one is hash-checked.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import shlex
import subprocess
import sys
import uuid
import zipfile
from collections import Counter, defaultdict
from collections.abc import Callable
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
REQUIRED_HEADERS = {
    "شعبه": "branch", "Line": "line", "TargetCategory": "category", "گروه": "group",
    "کد ویزیتوری": "code", "VIS.VIS": "name", "هدف ریالی تارگت کتگوری": "rial",
    "نام سرپرست": "supervisor", "نام مدیر": "manager",
}
LINES = {"لاین سوپرمارکت", "لاین داروخانه"}  # same spelling as the sales column SR[GROUP]
TARGET_YEAR = "1405"
MONTH_FILE = re.compile(r"Target\.(0[1-9]|1[0-2])\.xlsx")  # strict: Target.07.xlsx, not Target.7.xlsx or Target.07.xlsx.bak


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


def _column_map(header: dict[str, str | None]) -> dict[str, str]:
    """Map logical fields to letters so deleting or reordering optional columns is safe."""
    columns = {field: None for field in REQUIRED_HEADERS.values()}
    for letter, value in header.items():
        name = normalize_text(value or "")
        field = REQUIRED_HEADERS.get(name)
        if field and columns[field] is None:
            columns[field] = letter
    missing = [name for name, field in REQUIRED_HEADERS.items() if columns[field] is None]
    if missing:
        raise TargetError(f"ستون‌های لازم در شیت پیدا نشد: {', '.join(missing)}")
    return columns  # type: ignore[return-value]


def _format_errors(errors: list[str]) -> str:
    return "خطا در داده:\n  " + "\n  ".join(errors[:25]) + (f"\n  … و {len(errors) - 25} خطای دیگر" if len(errors) > 25 else "")


def convert(path: Path, month: str) -> tuple[list[list[str]], dict]:
    """Return TSV rows and totals derived only from category-rial values."""
    rows = read_rows(path)
    if not rows:
        raise TargetError("شیت خالی است")
    columns = _column_map(rows[0])
    aggregated: dict[tuple[str, str, str, str], dict] = {}
    errors = []
    for n, row in enumerate(rows[1:], start=2):
        fields = {field: normalize_text(row.get(letter) or "") or "" for field, letter in columns.items()}
        try:
            rial = float(fields["rial"])
        except ValueError:
            errors.append(f"ردیف {n}: مبلغ عددی نیست")
            continue
        line = fields["line"] if fields["line"] in LINES else None
        if line is None:
            errors.append(f"ردیف {n}: لاین ناشناخته «{fields['line']}»")
            continue
        if rial < 0:
            errors.append(f"ردیف {n}: مبلغ منفی")
            continue
        if not (fields["branch"] and fields["category"] and fields["name"]):
            errors.append(f"ردیف {n}: شعبه، دسته کالا یا نام ویزیتور خالی است")
            continue
        code = "" if fields["code"].upper() in ("", "#N/A", "N/A") else fields["code"]
        key = (fields["branch"], line, fields["category"], fields["name"])
        previous = aggregated.get(key)
        if previous is None:
            aggregated[key] = {"branch": fields["branch"], "line": line, "category": fields["category"],
                               "group": fields["group"], "code": code, "name": fields["name"],
                               "supervisor": fields["supervisor"], "manager": fields["manager"], "rial": rial}
        else:
            if previous["group"] != fields["group"]:
                errors.append(f"ردیف {n}: گروه کالا برای همین دسته و ویزیتور متفاوت است")
                continue
            previous["rial"] += rial
    if errors:
        raise TargetError(_format_errors(errors))
    out = list(aggregated.values())
    if not out:
        raise TargetError("هیچ ردیفی پیدا نشد")
    for who in ("supervisor", "manager"):
        if any(not x[who] for x in out):
            raise TargetError(f"نام {'سرپرست' if who == 'supervisor' else 'مدیر'} در بعضی ردیف‌ها خالی است")
    sup = defaultdict(set)
    for x in out:
        sup[(x["branch"], x["name"])].add(x["supervisor"])
    multi = [key for key, values in sup.items() if len(values) > 1]
    if multi:
        raise TargetError(f"یک ویزیتور چند سرپرست دارد: {multi[:5]}")
    ym = month.replace("/", "")
    tsv = [[ym, x["branch"], x["line"], x["category"], x["group"], x["code"], x["name"], x["supervisor"], x["manager"],
            f"{x['rial']:.2f}"] for x in out]
    group_totals = defaultdict(float)
    category_totals = defaultdict(float)
    for x in out:
        group_totals[x["group"]] += x["rial"]
        category_totals[x["category"]] += x["rial"]
    no_code = {x["name"] for x in out if not x["code"]}
    report = {"rows": len(out), "total_rial": sum(x["rial"] for x in out), "visitors": len({x["name"] for x in out}),
              "visitors_without_code": len(no_code), "rial_without_code": sum(x["rial"] for x in out if not x["code"]),
              "branches": Counter(x["branch"] for x in out), "categories": len(category_totals),
              "group_totals": dict(sorted(group_totals.items(), key=lambda item: (-item[1], item[0]))),
              "category_totals": dict(sorted(category_totals.items(), key=lambda item: (-item[1], item[0])))}
    return tsv, report


def write_tsv(path: Path, rows: list[list[str]]) -> None:
    tmp = path.with_suffix(".tsv.part")
    tmp.write_text("\x1f".join(TARGET_COLS) + "\x1e" + "".join("\x1f".join(r) + "\x1e" for r in rows), encoding="utf-8")
    tmp.replace(path)


class UploadError(Exception):
    pass


def resolve_month(workbook: Path, month: str | None) -> str:
    """Month from the explicit --month, or from a strict Target.MM.xlsx name. The two must agree."""
    m = MONTH_FILE.fullmatch(workbook.name)
    from_name = f"{TARGET_YEAR}/{m.group(1)}" if m else None
    if month is None:
        if from_name is None:
            raise TargetError(f"نام «{workbook.name}» الگوی Target.MM.xlsx ندارد (مثلاً Target.07.xlsx)؛ --month را بدهید، مثل 1405/07")
        return from_name
    if from_name is not None and month != from_name:
        raise TargetError(f"--month {month} با نام فایل {workbook.name} ({from_name}) نمی‌خواند")
    return month


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def replace_policy(assume_yes: bool) -> Callable[[], bool] | None:
    """How to answer 'replace the file already on the server?': yes with --yes, a question in a terminal, else refuse (None)."""
    if assume_yes:
        return lambda: True
    if not sys.stdin.isatty():
        return None
    return lambda: input("روی سرور فایل این ماه هست و جایگزین می‌شود. ادامه می‌دهید؟ (y/N): ").strip().lower() in ("y", "yes")


def _ssh(server: str, key: str | None, script: str, port: int | None = None) -> subprocess.CompletedProcess:
    ssh = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20"] + (["-i", key] if key else [])
    if port:
        ssh += ["-p", str(port)]
    return subprocess.run(ssh + [server, script], capture_output=True, text=True)


def upload(path: Path, server: str, key: str | None, remote: str,
           confirm_replace: Callable[[], bool] | None = None,
           port: int | None = None) -> bool:
    """Copy to a unique .part next to the destination, check its SHA256, then swap it in atomically.

    Returns False when the operator declines a replacement; the server is untouched in that case.
    """
    scp = ["scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20"] + (["-i", key] if key else [])
    if port:
        scp += ["-P", str(port)]
    dest = f"{remote.rstrip('/')}/raw/{path.name}"
    q = shlex.quote(dest)
    probe = _ssh(server, key, f"if test -e {q}; then printf 'EXISTS'; else printf 'MISSING'; fi", port)
    if probe.returncode != 0 or probe.stdout not in ("EXISTS", "MISSING"):
        raise UploadError(f"بررسی فایل روی سرور ناموفق بود (کد {probe.returncode}): {probe.stderr.strip()}")
    if probe.stdout == "EXISTS":
        if confirm_replace is None:
            raise UploadError("روی سرور فایل این ماه هست؛ برای جایگزینی در حالت غیرتعاملی --yes بدهید")
        if not confirm_replace():
            return False
    part = f"{dest}.{uuid.uuid4().hex[:12]}.part"
    qp = shlex.quote(part)
    try:
        try:
            subprocess.run(scp + [str(path), f"{server}:{part}"], check=True)
        except subprocess.CalledProcessError as e:
            raise UploadError(f"کپی فایل روی سرور ناموفق بود (کد {e.returncode})") from e
        remote_sum = _ssh(server, key, f"sha256sum {qp}", port)
        if remote_sum.returncode != 0:
            raise UploadError(f"محاسبه هش روی سرور ناموفق بود: {remote_sum.stderr.strip()}")
        if remote_sum.stdout.split()[:1] != [sha256_file(path)]:
            raise UploadError("هش فایل روی سرور با فایل محلی نمی‌خواند؛ فایل قبلی دست‌نخورده ماند")
        swap = _ssh(server, key, f"chown sr:sr {qp} && mv -f {qp} {q}", port)
        if swap.returncode != 0:
            raise UploadError(f"جایگزینی فایل روی سرور ناموفق بود: {swap.stderr.strip()}")
    except BaseException:
        try:  # best effort: remove the staged copy; the destination was never written to
            _ssh(server, key, f"rm -f {qp}", port)
        except OSError:
            pass
        raise
    return True


def main() -> int:
    for stream in (sys.stdout, sys.stderr):  # Windows consoles default to a legacy codepage that cannot print Persian
        stream.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("workbook", type=Path)
    ap.add_argument("--month", help="ماه تارگت، مثل 1405/08؛ برای نام Target.MM.xlsx لازم نیست")
    ap.add_argument("--core", default="kg", choices=sorted(CORES))
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "raw", help="پوشهٔ خروجی (پیش‌فرض data/raw)")
    ap.add_argument("--check", action="store_true", help="فقط اعتبارسنجی و گزارش؛ چیزی نوشته نمی‌شود")
    ap.add_argument("--upload", metavar="USER@HOST", help="پس از تبدیل روی سرور بارگذاری شود")
    ap.add_argument("--key", help="مسیر کلید SSH")
    ap.add_argument("--port", type=int, default=22, help="پورت SSH سرور (پیش‌فرض 22)")
    ap.add_argument("--yes", action="store_true", help="فایل موجود روی سرور را بدون پرسش جایگزین کن")
    ap.add_argument("--remote-data", default="/opt/sr/data")
    a = ap.parse_args()
    try:
        a.month = resolve_month(a.workbook, a.month)
    except TargetError as e:
        print(str(e), file=sys.stderr)
        return 2
    if not re.fullmatch(r"\d{4}/(0[1-9]|1[0-2])", a.month):
        print("--month باید مثل 1405/08 باشد", file=sys.stderr)
        return 2
    try:
        rows, rep = convert(a.workbook, a.month)
    except (TargetError, OSError, zipfile.BadZipFile, KeyError) as e:
        print(f"ناموفق: {e}", file=sys.stderr)
        return 1
    print(f"هسته {CORES[a.core]}، ماه {a.month}: {rep['rows']:,} ردیف، {rep['visitors']} ویزیتور، {rep['categories']} دسته کالا")
    print(f"جمع هدف (مجموع هدف ریالی تارگت کتگوری): {rep['total_rial']:,.0f} ریال ({rep['total_rial'] / 1e9:,.1f} میلیارد)")
    print("جمع هدف به تفکیک گروه کالایی:")
    for group, total in rep["group_totals"].items():
        print(f"  {group}: {total:,.0f} ریال")
    print("جمع هدف به تفکیک تارگت کتگوری:")
    for category, total in rep["category_totals"].items():
        print(f"  {category}: {total:,.0f} ریال")
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
            done = upload(dest, a.upload, a.key, a.remote_data, confirm_replace=replace_policy(a.yes),
                          port=a.port)
        except (UploadError, subprocess.CalledProcessError, OSError) as e:
            print(f"بارگذاری روی سرور ناموفق بود: {e}", file=sys.stderr)
            return 1
        if not done:
            print("جایگزینی لغو شد؛ فایل روی سرور تغییری نکرد.")
            return 3
        print("روی سرور بارگذاری شد؛ sr-sync خودکار آن را در پایگاه‌داده وارد می‌کند.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
