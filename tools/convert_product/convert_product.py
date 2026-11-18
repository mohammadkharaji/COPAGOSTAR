"""
convert_product.py  –  بات تبدیل Product.xlsx به product.tsv
==============================================================
این اسکریپت فایل Product.xlsx را می‌خواند و یک product.tsv
سازگار با سیستم SR تولید می‌کند.

منطق:
  - شیت "Product" (شیت 2):
      A  = UniqueProductCode      ← کلید ردیف فروش (fact_sales.unique_product_code)
      B  = Parent Hamkaran Code
      C  = ERP Code
      D  = کد همکاران
      E  = ProductCode            ← کلید جایگزین (fact_sales.product_code)؛ تنها ستونی
                                     که ۱۰۰٪ کدهای فروش را پوشش می‌دهد
      F  = SystemName
      G  = SalesUnit (رشته‌ای مثل "بسته 1 کیلویی")
      H  = SalesUnitMultiplyer  (ضریب فروش)
      I  = ضریب موجودی
      J  = تعداد در کارتن    ← کلیدی برای محاسبه کارتن
      K  = تعداد در پک تامین
      L  = SalesQTY
      T  = گروه کالای اصلی   (main_group در داشبورد)
      V  = ProductCategory    (sub_group پایه)
      W  = ProductType        (نوع محصول – با Brand ترکیب می‌شود)
      R  = Brand
      AP = Packaging
      AS = SupplyPackageMultiplier
      AU = تعداد در کارتن مادر/نسبت به دیتای SR
      AV = تعداد در کارتن مادر
      AD = Target Category 1404  (TargetCategory)
      BP = ProductName
      BQ = SKU Name

فقط گروه‌های کالایی موجود در داشبورد SR فیلتر می‌شوند.

فرمت خروجی: همان TSV با جداکننده‌های 0x1f/0x1e که ingest.py می‌خواند.
"""

from __future__ import annotations
import argparse
import shlex
import subprocess
import sys
import tempfile
import zipfile
import re
import os
from pathlib import Path
from xml.etree import ElementTree as ET

# ---------------------------------------------------------------------------
# گروه‌های کالایی موجود در داشبورد (از product.tsv راستی‌آزمایی شد)
# ---------------------------------------------------------------------------
DASHBOARD_GROUPS = frozenset({
    # DISTINCT main_group in fact_sales (19 groups)
    "گروه ویفر",
    "گروه آرایشی و بهداشتی",
    "گروه بیسکوییت",
    "گروه نودالیت",
    "گروه آدامس",
    "گروه توت سوییت",
    "گروه قهوه",
    "گروه عصاره",
    "گروه سوپ",
    "گروه دراژه",
    "گروه شکلات صبحانه",
    "گروه ادویه و چاشنی",
    "گروه غلات صبحانه",
    "گروه دسر",
    "گروه تبلیغاتی",
    "گروه پاستا",
    "گروه قهوه دان",
    "گروه پرک و بلغور",
    "گروه پوره سیب زمینی",
})

# ستون‌های خروجی (همان PRODUCT_MAP در schema.py + ستون‌های اضافی کارتن)
OUTPUT_COLS = [
    "Product[UniqueProductCode]",
    "Product[ProductCode]",              # کلید join دوم در apply_product_groups
    "Product[گروه کالای اصلی]",         # main_group
    "Product[ProductCategory]",          # sub_group پایه
    "Product[TargetCategory]",           # target_category
    "Product[Brand]",
    "Product[ProductType]",
    # --- ستون‌های بسته‌بندی و کارتن (جدید) ---
    "Product[SalesUnit]",
    "Product[SalesUnitMultiplyer]",
    "Product[تعداد در کارتن]",
    "Product[تعداد در کارتن مادر]",
    "Product[Packaging]",
    "Product[SupplyPackageMultiplier]",
    "Product[SalesQTY]",
    "Product[ProductName]",
    "Product[SystemName]",
]

# نگاشت نام ستون Excel → ایندکس حرف ستون (بر اساس ردیف header)
# این نگاشت در زمان اجرا از ردیف اول شیت Product خوانده می‌شود
COL_NAME_TO_EXCEL_HEADER = {
    "Product[UniqueProductCode]":       "UniqueProductCode",
    "Product[ProductCode]":              "ProductCode",
    "Product[گروه کالای اصلی]":         "گروه کالای اصلی",
    "Product[ProductCategory]":          "ProductCategory",
    "Product[TargetCategory]":           "TargetCategory",
    "Product[Brand]":                    "Brand",
    "Product[ProductType]":              "ProductType",
    "Product[SalesUnit]":                "SalesUnit",
    "Product[SalesUnitMultiplyer]":      "SalesUnitMultiplyer",
    "Product[تعداد در کارتن]":           "تعداد در کارتن",
    "Product[تعداد در کارتن مادر]":      "تعداد در کارتن مادر",
    "Product[Packaging]":                "Packaging",
    "Product[SupplyPackageMultiplier]":  "SupplyPackageMultiplier",
    "Product[SalesQTY]":                 "SalesQTY",
    "Product[ProductName]":              "ProductName",
    "Product[SystemName]":               "SystemName",
}

FS = "\x1f"   # field separator
RS = "\x1e"   # record separator


# ---------------------------------------------------------------------------
# تبدیل حرف ستون Excel (A, B, ... Z, AA, AB, ...) به ایندکس 0-based
# ---------------------------------------------------------------------------
def col_to_idx(col: str) -> int:
    col = col.upper()
    idx = 0
    for ch in col:
        idx = idx * 26 + (ord(ch) - ord('A') + 1)
    return idx - 1


# ---------------------------------------------------------------------------
# خواندن SharedStrings از xlsx
# ---------------------------------------------------------------------------
def load_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    with zf.open("xl/sharedStrings.xml") as f:
        raw = f.read()
    # حذف namespace برای سادگی
    raw = raw.replace(b' xmlns=', b' _xmlns=')
    root = ET.fromstring(raw)
    strings = []
    for si in root.iter('si'):
        parts = []
        for t in si.iter('t'):
            if t.text:
                parts.append(t.text)
        strings.append("".join(parts))
    return strings


# ---------------------------------------------------------------------------
# خواندن یک شیت و برگرداندن list[dict] با مقادیر متنی
# ---------------------------------------------------------------------------
def read_sheet(zf: zipfile.ZipFile, sheet_path: str, shared: list[str]) -> list[dict]:
    with zf.open(sheet_path) as f:
        raw = f.read()
    raw = raw.replace(b' xmlns=', b' _xmlns=')
    root = ET.fromstring(raw)

    rows_data: list[dict] = []
    for row_el in root.iter('row'):
        row_num = int(row_el.get('r', 0))
        cells: dict[int, str] = {}
        for c in row_el:
            ref = c.get('r', '')
            # استخراج حرف ستون
            m = re.match(r'([A-Z]+)', ref)
            if not m:
                continue
            col_letter = m.group(1)
            col_idx = col_to_idx(col_letter)
            t = c.get('t', '')
            v_el = c.find('v')
            if v_el is None or v_el.text is None:
                v = ''
            else:
                raw_v = v_el.text
                if t == 's':
                    v = shared[int(raw_v)] if int(raw_v) < len(shared) else ''
                else:
                    v = raw_v
            cells[col_idx] = v.strip()
        rows_data.append({'row': row_num, 'cells': cells})
    return rows_data


# ---------------------------------------------------------------------------
# تبدیل اصلی
# ---------------------------------------------------------------------------
def convert(xlsx_path: Path, output_path: Path, filter_groups: set[str] | None = None) -> int:
    if filter_groups is None:
        filter_groups = DASHBOARD_GROUPS

    with zipfile.ZipFile(xlsx_path, 'r') as zf:
        # لیست شیت‌ها از workbook.xml
        with zf.open("xl/workbook.xml") as f:
            wb_raw = f.read().replace(b' xmlns=', b' _xmlns=')
        wb = ET.fromstring(wb_raw)
        sheets = {}
        for s in wb.iter('sheet'):
            name = s.get('name', '')
            rid = s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id') or \
                  s.get('r:id', '')
            sheets[name] = rid

        # _rels برای پیدا کردن path شیت‌ها
        with zf.open("xl/_rels/workbook.xml.rels") as f:
            rels_raw = f.read().replace(b' xmlns=', b' _xmlns=')
        rels_root = ET.fromstring(rels_raw)
        rid_to_target = {}
        for rel in rels_root.iter('Relationship'):
            rid_to_target[rel.get('Id', '')] = rel.get('Target', '')

        shared = load_shared_strings(zf)

        # شیت Product
        prod_rid = sheets.get('Product', '')
        prod_target = rid_to_target.get(prod_rid, '')
        if not prod_target.startswith('worksheets'):
            prod_target = 'worksheets/' + prod_target.lstrip('/')
        prod_rows = read_sheet(zf, f"xl/{prod_target}", shared)

    if not prod_rows:
        raise ValueError("Product sheet is empty")

    # ردیف اول: header → پیدا کردن ایندکس هر ستون
    header_row = prod_rows[0]['cells']
    header_name_to_idx: dict[str, int] = {v: k for k, v in header_row.items()}

    # ایجاد نگاشت نام ستون خروجی → ایندکس ستون در Excel
    col_idx_map: dict[str, int] = {}
    for out_col, excel_header in COL_NAME_TO_EXCEL_HEADER.items():
        idx = header_name_to_idx.get(excel_header)
        if idx is not None:
            col_idx_map[out_col] = idx
        else:
            print(f"[WARN] Column '{excel_header}' not found in Product sheet header")

    main_group_idx = col_idx_map.get("Product[گروه کالای اصلی]")

    # پردازش ردیف‌های داده
    seen_codes: set[str] = set()
    output_rows: list[list[str]] = []
    skipped_group = 0
    skipped_dup = 0
    skipped_no_code = 0

    for r in prod_rows[1:]:
        cells = r['cells']
        if not cells:
            continue

        # فیلتر گروه کالایی
        if main_group_idx is not None:
            grp = cells.get(main_group_idx, '').strip()
            if filter_groups and grp not in filter_groups:
                skipped_group += 1
                continue
        else:
            grp = ''

        # کد محصول
        code_idx = col_idx_map.get("Product[UniqueProductCode]")
        code = cells.get(code_idx, '').strip() if code_idx is not None else ''
        if not code:
            skipped_no_code += 1
            continue

        # حذف تکراری (اولین رکورد هر کد نگه داشته می‌شود)
        if code in seen_codes:
            skipped_dup += 1
            continue
        seen_codes.add(code)

        # ساخت ردیف خروجی
        row: list[str] = []
        for out_col in OUTPUT_COLS:
            idx = col_idx_map.get(out_col)
            val = cells.get(idx, '').strip() if idx is not None else ''
            row.append(val)

        output_rows.append(row)

    print(f"[INFO] Product rows: {len(output_rows)} written, "
          f"{skipped_group} skipped (wrong group), "
          f"{skipped_dup} skipped (duplicate code), "
          f"{skipped_no_code} skipped (no code)")

    # نوشتن TSV
    header_line = FS.join(OUTPUT_COLS)
    lines = [header_line]
    for row in output_rows:
        lines.append(FS.join(row))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(RS.join(lines) + RS, encoding='utf-8')
    print(f"[OK] Written to: {output_path}")
    return len(output_rows)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def upload(path: Path, server: str, key: str | None, remote: str, port: int | None = None) -> None:
    """Copy product.tsv to <remote>/raw/ atomically (upload as .part, then mv)."""
    ssh = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20"] + (["-i", key] if key else [])
    scp = ["scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20"] + (["-i", key] if key else [])
    if port:
        ssh += ["-p", str(port)]
        scp += ["-P", str(port)]
    dest = f"{remote.rstrip('/')}/raw/{path.name}"
    q = shlex.quote(dest)
    subprocess.run(scp + [str(path), f"{server}:{dest}.part"], check=True)
    subprocess.run(ssh + [server, f"chown sr:sr {q}.part && mv -f {q}.part {q}"], check=True)
    print(f"[OK] Uploaded to {server}:{dest}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Convert Product.xlsx to product.tsv for the SR dashboard server")
    p.add_argument("xlsx", nargs="?", default="Product.xlsx", help="path to Product.xlsx")
    p.add_argument("-o", "--output", default=None, help="output path (default: product.tsv next to the workbook)")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="validate the workbook only; nothing is kept")
    mode.add_argument("--dry-run", action="store_true", help="convert to a temp file, report, delete it")
    p.add_argument("--upload", metavar="USER@HOST", default=None, help="upload product.tsv to this server")
    p.add_argument("--key", default=None, help="SSH private key path")
    p.add_argument("--port", type=int, default=None, help="SSH port")
    p.add_argument("--remote-data", default="/opt/sr/data", help="data dir on the server (default /opt/sr/data)")
    p.add_argument("--all-groups", action="store_true", help="export every product group (no dashboard filter)")
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if (args.check or args.dry_run) and args.upload:
        parser.error("--check/--dry-run cannot be combined with --upload")

    xlsx_path = Path(args.xlsx)
    if not xlsx_path.is_file():
        print(f"[ERROR] File not found: {xlsx_path}", file=sys.stderr)
        return 1
    groups = None if args.all_groups else DASHBOARD_GROUPS

    if args.check or args.dry_run:
        with tempfile.TemporaryDirectory() as tmp:
            n = convert(xlsx_path, Path(tmp) / "product.tsv", groups)
        if n == 0:
            print("[ERROR] No products matched the dashboard groups", file=sys.stderr)
            return 1
        label = "CHECK" if args.check else "DRY-RUN"
        print(f"[{label}] {n} products would be exported (temp file removed)")
        return 0

    out_path = Path(args.output) if args.output else xlsx_path.parent / "product.tsv"
    n = convert(xlsx_path, out_path, groups)
    if n == 0:
        print("[ERROR] No products matched the dashboard groups", file=sys.stderr)
        return 1
    print(f"[DONE] {n} products exported -> {out_path}")

    if args.upload:
        try:
            upload(out_path, args.upload, args.key, args.remote_data, args.port)
        except subprocess.CalledProcessError as exc:
            print(f"[ERROR] Upload failed (exit {exc.returncode})", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
