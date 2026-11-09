"""Tests for tools/returns/convert_returns.py: workbook reading, validation, delta state, and compatibility with app.ingest."""
import importlib.util
import itertools
import json
import os
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape

import pytest
from test_api import build_client, make_row

from app.schema import RETURN_COLS

_SPEC = importlib.util.spec_from_file_location(
    "convert_returns", Path(__file__).resolve().parents[2] / "tools" / "returns" / "convert_returns.py")
cr = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(cr)

HEADERS = list(cr.SOURCE_HEADERS.values())
COLS = list(cr.SOURCE_HEADERS)
TEHRAN, KARAJ = "شعبه تهران", "شعبه کرج"
S = "SRSalesProcedure1405"


def line(branch, no, order=1000, full=0, part=0, cust="C1", date="1405/07/10", reason="", name="مشتری", visitor="علی رضایی"):
    """One source row, columns A-U."""
    return [branch, "5", "T" + no, date, cust, name, "سرپرست ۱", visitor, "موزع ۱", "راننده ۱", "1405/07/10 08:00", no,
            date, order, "F" + no, "1405/07/10 09:00", order - full - part, "نقد", full, part, reason]


def _cell(col, row, v, shared):
    ref = f"{col}{row}"
    if isinstance(v, (int, float)):
        return f'<c r="{ref}"><v>{v}</v></c>'
    if shared is not None and v.startswith("~"):  # rich-text shared string: two runs plus a phonetic hint that must be ignored
        shared.append(f'<si><r><rPr><b/></rPr><t>{escape(v[1:3])}</t></r><r><t xml:space="preserve">{escape(v[3:])}</t></r>'
                      f'<rPh sb="0" eb="1"><t>IGNORED</t></rPh></si>')
        return f'<c r="{ref}" t="s"><v>{len(shared) - 1}</v></c>'
    return f'<c r="{ref}" t="inlineStr"><is><t>{escape(v)}</t></is></c>'


def make_xlsx(path, rows, headers=None, sheet_name="Sheet1"):
    shared = []
    body = ""
    for n, vals in enumerate([headers or HEADERS, *rows], start=1):
        body += f'<row r="{n}">' + "".join(_cell(c, n, v, shared) for c, v in zip(COLS, vals)) + "</row>"
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                   '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                   '</Types>')
        z.writestr("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr("xl/workbook.xml", f'<workbook xmlns="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                   f'<sheets><sheet name="{sheet_name}" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr("xl/worksheets/sheet1.xml", f'<worksheet xmlns="{ns}"><sheetData>{body}</sheetData></worksheet>')
        if shared:
            z.writestr("xl/sharedStrings.xml", f'<sst xmlns="{ns}">{"".join(shared)}</sst>')
    return path


@pytest.fixture()
def env(tmp_path):
    return tmp_path


_MINUTES = itertools.count()


def run(env, book, *flags):
    now = datetime(2026, 10, 18, 9, next(_MINUTES) % 60)  # a fresh HHMM per run so delta files never collide
    return cr.main([str(book), "--out", str(env / "out"), "--state", str(env / "state.json"), *flags], now=now)


def publish(env, book, *flags):
    """A run whose upload was confirmed: write the delta, then commit the pending state (what the publish step does)."""
    assert run(env, book, *flags) == 0
    return cr.main(["--state", str(env / "state.json"), "--commit-state"], now=datetime(2026, 10, 18, 9, 59))


def outputs(env):
    return sorted((env / "out").glob("ret_*.tsv")) if (env / "out").exists() else []


def parse(path):
    head, _, body = path.read_text(encoding="utf-8").partition("\x1e")
    cols = head.split("\x1f")
    return cols, [dict(zip(cols, r.split("\x1f"))) for r in body.split("\x1e") if r]


def test_columns_mapping_and_normalization(env):
    book = make_xlsx(env / "a.xlsx", [
        line(TEHRAN, "7", 1000, full=1000, reason="~لغ‌و سفارش", date="2026/10/02"),   # Gregorian date -> Jalali
        line(KARAJ, "8", 2500.5, part=300, cust="۱۲۳", name="  علي   رضايي ", date="14050711"),
    ])
    assert run(env, book) == 0
    (f,) = outputs(env)
    assert f.name.startswith("ret_kg_14050726_") and f.suffix == ".tsv"
    cols, rows = parse(f)
    assert cols == list(RETURN_COLS)
    a, b = rows
    assert (a["branch"], a["dispatch_no"], a["order_date"], a["tour_date"]) == (TEHRAN, "7", "1405/07/10", "1405/07/10")
    assert a["order_rial"] == "1000" and a["full_return_rial"] == "1000" and a["part_return_rial"] == "0"
    assert a["return_reason"] == "لغ و سفارش"  # rich text runs joined, phonetic hint dropped, ZWNJ normalized
    assert b["order_date"] == "1405/07/11" and b["customer_code"] == "123" and b["customer_name"] == "علی رضایی"
    assert b["order_rial"] == "2500.5" and b["invoice_rial"] == "2200.5"
    assert "IGNORED" not in f.read_text(encoding="utf-8")


def test_numeric_cells_keep_codes_as_integers(env):
    rows = [line(TEHRAN, "12345", 1000)]
    rows[0][11] = 12345
    rows[0][4] = 98765
    book = make_xlsx(env / "a.xlsx", rows)
    assert run(env, book) == 0
    row = parse(outputs(env)[0])[1][0]
    assert row["dispatch_no"] == "12345"
    assert row["customer_code"] == "98765"


def test_reader_skips_trailing_empty_excel_row(env):
    book = make_xlsx(env / "a.xlsx", [line(TEHRAN, "1", 1000), [""] * len(COLS)])
    sheet, rows = cr.read_rows(book)
    assert sheet == "Sheet1"
    assert len(rows) == 2
    assert rows[1]["_row"] == "2"
    assert cr.convert(book)[1]["rows"] == 1


def test_first_run_emits_all_then_only_new_or_changed(env):
    book = make_xlsx(env / "a.xlsx", [line(TEHRAN, "1", 1000), line(TEHRAN, "2", 2000, part=300)])
    assert publish(env, book) == 0
    assert [r["dispatch_no"] for r in parse(outputs(env)[0])[1]] == ["1", "2"]
    state = json.loads((env / "state.json").read_text(encoding="utf-8"))
    assert state["core"] == "kg" and set(state["orders"][TEHRAN]) == {"1", "2"}

    assert run(env, book) == 0  # nothing changed: no file, state untouched
    assert len(outputs(env)) == 1

    book2 = make_xlsx(env / "b.xlsx", [line(TEHRAN, "1", 1000), line(TEHRAN, "2", 2000, full=2000), line(KARAJ, "1", 500)])
    assert run(env, book2) == 0
    assert cr.main(["--state", str(env / "state.json"), "--commit-state"], now=datetime(2026, 10, 18, 9, 58)) == 0
    second = outputs(env)[1]
    assert [(r["branch"], r["dispatch_no"]) for r in parse(second)[1]] == [(TEHRAN, "2"), (KARAJ, "1")]  # changed + new
    state = json.loads((env / "state.json").read_text(encoding="utf-8"))
    assert set(state["orders"]) == {TEHRAN, KARAJ} and set(state["orders"][TEHRAN]) == {"1", "2"}  # same number, two branches


def test_orders_missing_from_a_later_workbook_stay_in_state(env):
    publish(env, make_xlsx(env / "a.xlsx", [line(TEHRAN, "1", 1000), line(TEHRAN, "2", 2000)]))
    publish(env, make_xlsx(env / "b.xlsx", [line(TEHRAN, "2", 2000), line(TEHRAN, "3", 300)]))
    assert [r["dispatch_no"] for r in parse(outputs(env)[1])[1]] == ["3"]
    assert set(json.loads((env / "state.json").read_text(encoding="utf-8"))["orders"][TEHRAN]) == {"1", "2", "3"}


def test_check_and_dry_run_write_nothing(env, capsys):
    book = make_xlsx(env / "a.xlsx", [line(TEHRAN, "1", 1000)])
    assert run(env, book, "--check") == 0
    assert run(env, book, "--dry-run") == 0
    assert not outputs(env) and not (env / "state.json").exists()
    assert "ret_kg_" in capsys.readouterr().out  # dry run names the file it would write
    publish(env, book)  # a real run, then dry-run again: still nothing new and the state is unchanged
    before = (env / "state.json").read_text(encoding="utf-8")
    assert run(env, book, "--dry-run") == 0 and (env / "state.json").read_text(encoding="utf-8") == before


def test_pending_state_waits_for_publish_confirmation(env):
    book = make_xlsx(env / "a.xlsx", [line(TEHRAN, "1", 1000)])
    pending = env / "pending.json"
    args = [str(book), "--out", str(env / "out"), "--state", str(env / "state.json"), "--pending-state", str(pending)]
    assert cr.main(args, now=datetime(2026, 10, 18, 9, 0)) == 0
    assert len(outputs(env)) == 1
    assert not (env / "state.json").exists()
    assert json.loads(pending.read_text(encoding="utf-8"))["orders"][TEHRAN] == {"1": cr.row_hash([parse(outputs(env)[0])[1][0][c] for c in RETURN_COLS])}
    pending.replace(env / "state.json")
    assert cr.main(args, now=datetime(2026, 10, 18, 9, 1)) == 0
    assert len(outputs(env)) == 1
    assert not pending.exists()


@pytest.mark.skipif(os.name != "nt", reason="requires Windows PowerShell")
def test_returns_only_preflight_does_not_require_sales_or_contact_server(env):
    book = make_xlsx(env / "returns.xlsx", [line(TEHRAN, "test-only", 1000)])
    key = env / "fake-key"
    key.write_text("test", encoding="utf-8")
    (env / "ssh.cmd").write_text('@echo off\r\necho called > "%~dp0ssh-called"\r\nexit /b 42\r\n', encoding="ascii")
    env_vars = {**os.environ, "PATH": str(env) + os.pathsep + os.environ["PATH"]}
    script = Path(__file__).resolve().parents[2] / "scripts" / "publish_to_server.ps1"
    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script),
         "-ReturnsOnly", "-ReturnsWorkbook", str(book), "-SalesWorkbook", str(env / "absent.xlsx"),
         "-KeyFile", str(key), "-CheckOnly"],
        env=env_vars, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "check only" in result.stdout
    assert not (env / "ssh-called").exists()


@pytest.mark.skipif(os.name != "nt", reason="requires Windows cmd")
def test_returns_launcher_check_only_forwards_workbook_without_upload(env):
    root = Path(__file__).resolve().parents[2]
    launcher = env / "publish-returns-only.bat"
    launcher.write_bytes((root / launcher.name).read_bytes())
    book = make_xlsx(env / "returns.xlsx", [line(TEHRAN, "test-only", 1000)])
    (env / "scripts").mkdir()
    (env / "scripts" / "publish_to_server.ps1").write_text(
        'param([switch]$ReturnsOnly, [string]$ReturnsWorkbook, [switch]$CheckOnly)\n'
        "if (-not $ReturnsOnly -or -not $CheckOnly -or (Split-Path -Leaf $ReturnsWorkbook) -ne 'returns.xlsx' -or -not (Test-Path -LiteralPath $ReturnsWorkbook)) { exit 17 }\n"
        "Write-Output 'RETURN_CHECK'\nexit 0\n", encoding="utf-8",
    )
    result = subprocess.run(
        [str(launcher), "-CheckOnly", str(book)],
        stdin=subprocess.DEVNULL, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "RETURN_CHECK" in result.stdout
    assert "Returns publish completed" not in result.stdout
    (env / "scripts" / "publish_to_server.ps1").write_text("exit 17\n", encoding="ascii")
    failure = subprocess.run(
        [str(launcher), "-CheckOnly", str(book)],
        stdin=subprocess.DEVNULL, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20,
    )
    assert failure.returncode != 0, failure.stdout + failure.stderr


@pytest.mark.skipif(os.name != "nt", reason="requires Windows cmd")
def test_sales_launcher_propagates_preflight_failure(env):
    root = Path(__file__).resolve().parents[2]
    launcher = env / "publish-recent-months.bat"
    launcher.write_bytes((root / launcher.name).read_bytes())
    (env / "scripts").mkdir()
    (env / "scripts" / "publish_to_server.ps1").write_text(
        'param([string]$SalesWorkbook, [string]$Scope, [switch]$CheckOnly)\n'
        'if ($CheckOnly -and $Scope -eq "recent" -and (Split-Path -Leaf $SalesWorkbook) -eq "sales.xlsx") { exit 23 }\n'
        'exit 24\n', encoding="utf-8",
    )
    book = env / "sales.xlsx"
    book.write_bytes(b"placeholder; never opened")
    result = subprocess.run(
        [str(launcher), "-CheckOnly", str(book)],
        stdin=subprocess.DEVNULL, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20,
    )
    assert result.returncode == 23, result.stdout + result.stderr


@pytest.mark.skipif(os.name != "nt", reason="requires Windows PowerShell")
def test_sales_preflight_rejects_queries_without_sales_month(env):
    root = Path(__file__).resolve().parents[2]
    (env / "scripts").mkdir()
    (env / "scripts" / "publish_to_server.ps1").write_bytes(
        (root / "scripts" / "publish_to_server.ps1").read_bytes()
    )
    queries = env / "data" / "queries"
    queries.mkdir(parents=True)
    (queries / "product.dax").write_text("test-only", encoding="ascii")
    (queries / "salesunit.dax").write_text("test-only", encoding="ascii")
    workbook = env / "sales.xlsx"
    workbook.write_bytes(b"test-only; never opened")
    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
         str(env / "scripts" / "publish_to_server.ps1"), "-Scope", "recent",
         "-SalesWorkbook", str(workbook), "-CheckOnly"],
        stdin=subprocess.DEVNULL, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20,
    )
    assert result.returncode != 0, result.stdout + result.stderr
    assert "sales month" in result.stderr


@pytest.mark.skipif(os.name != "nt", reason="requires Windows PowerShell")
def test_sales_preflight_requires_both_cores_for_each_recent_month(env):
    root = Path(__file__).resolve().parents[2]
    (env / "scripts").mkdir()
    (env / "scripts" / "publish_to_server.ps1").write_bytes((root / "scripts" / "publish_to_server.ps1").read_bytes())
    queries = env / "data" / "queries"
    queries.mkdir(parents=True)
    for name in ("product", "salesunit", "sr_kg_140507", "sr_ch_140507"):
        (queries / f"{name}.dax").write_text("test-only", encoding="ascii")
    workbook = env / "sales.xlsx"
    workbook.write_bytes(b"test-only; never opened")
    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
         str(env / "scripts" / "publish_to_server.ps1"), "-Scope", "recent",
         "-SalesWorkbook", str(workbook), "-CheckOnly"],
        stdin=subprocess.DEVNULL, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20,
    )
    assert result.returncode != 0, result.stdout + result.stderr
    assert "missing sales month" in result.stderr


@pytest.mark.skipif(os.name != "nt", reason="requires Windows PowerShell")
def test_sales_publish_confirms_only_sync_tracked_files(env):
    root = Path(__file__).resolve().parents[2]
    scripts = env / "scripts"
    scripts.mkdir()
    (scripts / "publish_to_server.ps1").write_bytes((root / "scripts" / "publish_to_server.ps1").read_bytes())
    (scripts / "run_dax.ps1").write_text(
        "param($QueryDir,$OutDir,$Workbook)\n"
        "Get-ChildItem -LiteralPath $QueryDir -Filter '*.dax' | ForEach-Object { "
        "Set-Content -LiteralPath (Join-Path $OutDir ($_.BaseName + '.tsv')) -Value 'fixture' }\n",
        encoding="ascii",
    )
    queries = env / "data" / "queries"
    queries.mkdir(parents=True)
    for name in ("product", "salesunit", "sr_kg_140507", "sr_ch_140507"):
        (queries / f"{name}.dax").write_text("fixture", encoding="ascii")
    workbook = env / "sales.xlsx"
    workbook.write_bytes(b"fixture never opened")
    key = env / "test-key"
    key.write_text("fixture", encoding="ascii")
    (env / "fake_ssh.py").write_text(
        "import glob, hashlib, json, pathlib, sys\n"
        "cmd = ' '.join(sys.argv[1:])\n"
        "if '-n' not in sys.argv[1:] or 'ServerAliveInterval=15' not in cmd or 'ServerAliveCountMax=2' not in cmd:\n"
        "    sys.exit('ssh must close stdin and bound stalled connections')\n"
        "if 'sha256sum' in cmd:\n"
        "    for name in glob.glob(str(pathlib.Path(__file__).parent / 'data/export_*/tsv/*.tsv')):\n"
        "        p = pathlib.Path(name)\n"
        "        print(hashlib.sha256(p.read_bytes()).hexdigest(), p.name)\n"
        "elif 'date +%' in cmd: print('2026-10-24T00:00:00')\n"
        "elif 'sync_status.json' in cmd:\n"
        "    print(json.dumps({'state':'ok','started_at':'2026-10-24T00:00:01',"
        "'signature':[[n,1,1] for n in ('product.tsv','sr_kg_140507.tsv','sr_ch_140507.tsv')]}))\n",
        encoding="ascii",
    )
    (env / "ssh.cmd").write_text(
        f'@echo off\r\n"{sys.executable}" -I "%~dp0fake_ssh.py" %*\r\n', encoding="ascii"
    )
    (env / "scp.cmd").write_bytes(b"@echo off\r\nexit /b 0\r\n")
    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
         str(scripts / "publish_to_server.ps1"), "-SalesWorkbook", str(workbook),
         "-KeyFile", str(key), "-WaitMinutes", "0"],
        env={**os.environ, "PATH": str(env) + os.pathsep + os.environ["PATH"]},
        stdin=subprocess.DEVNULL, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=70,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "3 sync-tracked" in result.stdout


@pytest.mark.skipif(os.name != "nt", reason="requires Windows PowerShell")
def test_returns_only_with_no_delta_skips_server_and_state(env):
    root = Path(__file__).resolve().parents[2]
    (env / "scripts").mkdir()
    (env / "scripts" / "publish_to_server.ps1").write_bytes(
        (root / "scripts" / "publish_to_server.ps1").read_bytes()
    )
    (env / "tools" / "returns").mkdir(parents=True)
    (env / "tools" / "returns" / "convert_returns.py").write_text(
        "import sys\nif '--commit-state' in sys.argv: sys.exit(99)\n", encoding="utf-8"
    )
    venv = env / "backend" / ".venv"
    venv.parent.mkdir()
    subprocess.run([sys._base_executable, "-m", "venv", str(venv)], check=True, timeout=60)
    workbook = env / "returns.xlsx"
    workbook.write_bytes(b"test-only; converter stub never opens this")
    key = env / "test-key"
    key.write_text("test-only", encoding="ascii")
    (env / "ssh.cmd").write_bytes(b'@echo off\r\necho called>>"%~dp0ssh-calls"\r\nexit /b 0\r\n')
    (env / "scp.cmd").write_bytes(b'@echo off\r\necho called>>"%~dp0scp-calls"\r\nexit /b 42\r\n')
    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
         str(env / "scripts" / "publish_to_server.ps1"), "-ReturnsOnly",
         "-ReturnsWorkbook", str(workbook), "-KeyFile", str(key)],
        env={**os.environ, "PATH": str(env) + os.pathsep + os.environ["PATH"]},
        stdin=subprocess.DEVNULL, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=40,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert not (env / "ssh-calls").exists()
    assert not (env / "scp-calls").exists()
    assert not (env / "data" / "returns_state_kg.json").exists()


def test_upload_is_explicit_and_refused_with_check_or_dry_run(env, monkeypatch):
    calls = []
    monkeypatch.setattr(cr, "upload", lambda *a: calls.append(a))
    book = make_xlsx(env / "a.xlsx", [line(TEHRAN, "1", 1000)])
    assert run(env, book) == 0 and calls == []
    assert run(env, book, "--dry-run", "--upload", "u@h") == 2 and calls == []
    book2 = make_xlsx(env / "b.xlsx", [line(TEHRAN, "2", 1000)])
    assert run(env, book2, "--upload", "u@h", "--key", "k") == 0
    assert len(calls) == 1 and calls[0][0].name == outputs(env)[1].name and calls[0][1:3] == ("u@h", "k")


@pytest.mark.parametrize("rows,headers,message", [
    ([line(TEHRAN, "1", 100), line(TEHRAN, "1", 100)], None, "تکراری"),
    ([line(TEHRAN, "1", 0)], None, "از صفر"),
    ([line("", "1", 100)], None, "خالی"),
    ([line(TEHRAN, "1", 100, date="1405-13-45")], None, "تاریخ حواله"),
    ([line(TEHRAN, "1", 100)], None, "AMOUNT_TEXT"),
    ([line(TEHRAN, "1", 100)], ["x"] + HEADERS[1:], "ستون"),
])
def test_invalid_workbook_writes_nothing(env, rows, headers, message, capsys):
    if message == "AMOUNT_TEXT":  # text in the amount column
        rows[0][13], message = "abc", "عددی نیست"
    book = make_xlsx(env / "a.xlsx", rows, headers)
    assert run(env, book) == 1
    assert not outputs(env) and not (env / "state.json").exists()
    if message:
        assert message in capsys.readouterr().err


def test_corrupt_state_and_wrong_core_fail_without_output(env):
    book = make_xlsx(env / "a.xlsx", [line(TEHRAN, "1", 1000)])
    (env / "state.json").write_text("{not json", encoding="utf-8")
    assert run(env, book) == 1 and not outputs(env)
    (env / "state.json").write_text(json.dumps({"version": 1, "core": "ch", "orders": {}}), encoding="utf-8")
    assert run(env, book) == 1 and not outputs(env)


def test_unknown_sheet_and_not_a_zip(env):
    book = make_xlsx(env / "a.xlsx", [line(TEHRAN, "1", 1000)])
    assert run(env, book, "--sheet", "Missing") == 1
    junk = env / "j.xlsx"
    junk.write_bytes(b"not a zip")
    assert run(env, junk) == 1


def test_converted_files_load_through_app_ingest(tmp_path, monkeypatch):
    build_client(tmp_path, monkeypatch, {"sr_kg_140507": [make_row(S, "1", "A", "1000", "10")]})
    out, state = tmp_path / "raw", tmp_path / "state.json"
    first = make_xlsx(tmp_path / "a.xlsx", [line(TEHRAN, "1", 1000, full=1000, reason="لغو"), line(KARAJ, "2", 2000, part=300)])
    assert cr.main([str(first), "--out", str(out), "--state", str(state)], now=datetime(2026, 10, 18, 9, 0)) == 0
    assert cr.main(["--state", str(state), "--commit-state"], now=datetime(2026, 10, 18, 9, 1)) == 0
    second = make_xlsx(tmp_path / "b.xlsx", [line(TEHRAN, "1", 1000, full=1000, reason="لغو"), line(KARAJ, "2", 2000, full=2000)])
    assert cr.main([str(second), "--out", str(out), "--state", str(state)], now=datetime(2026, 10, 18, 9, 5)) == 0
    assert cr.main(["--state", str(state), "--commit-state"], now=datetime(2026, 10, 18, 9, 6)) == 0

    from app import ingest
    res = [r for r in ingest.ingest_all() if r["file"].startswith("ret_")]
    assert [r["status"] for r in res] == ["loaded", "loaded"]
    con = ingest.connect()
    try:
        got = con.execute("SELECT branch, dispatch_no, return_rial, return_status, year_month, source_file FROM fact_returns "
                          "ORDER BY branch, dispatch_no").fetchall()
    finally:
        con.close()
    assert got == [(TEHRAN, "1", 1000, "full", "140507", "ret_kg_14050726_0900.tsv"),
                   (KARAJ, "2", 2000, "full", "140507", "ret_kg_14050726_0905.tsv")]


def test_same_dispatch_number_on_different_dates_is_two_orders(env):
    a = line(TEHRAN, "1918", 1000, date="1405/04/20", cust="C1")
    b = line(TEHRAN, "1918", 2000, date="1404/11/25", cust="C2")
    book = make_xlsx(env / "a.xlsx", [a, b])
    assert run(env, book) == 0
    assert [r["dispatch_no"] for r in parse(outputs(env)[0])[1]] == ["1918", "1918"]


def test_exact_duplicate_order_is_still_rejected(env):
    a = line(TEHRAN, "1918", 1000, date="1405/04/20", cust="C1")
    book = make_xlsx(env / "a.xlsx", [a, list(a)])
    assert run(env, book) == 1
