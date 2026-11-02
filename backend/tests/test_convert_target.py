"""Tests for the monthly target converter: month from the file name and safe upload (ssh/scp are mocked)."""
import importlib.util
import io
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

import pytest

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("convert_target", ROOT / "tools" / "monthly-target" / "convert_target.py")
ct = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ct)

HEADER = ["شعبه", "Line", "TargetCategory", "گروه", "کد ویزیتوری", "VIS.VIS", "هدف ریالی تارگت کتگوری",
          "نام سرپرست", "نام مدیر"]
ROW = ["شعبه تهران", "لاین سوپرمارکت", "دسته A", "گروه", "11", "علی رضایی", "2000", "سرپرست ۱", "مدیر ۱"]
DEST_NAME = "target_kg_140507.tsv"


def make_workbook(path: Path, rows=None) -> Path:
    """Synthetic .xlsx with the sheet and columns the converter reads; no real workbook is touched."""
    rows = [HEADER, ROW] if rows is None else rows
    strings, index = [], {}

    def sidx(text):
        if text not in index:
            index[text] = len(strings)
            strings.append(text)
        return index[text]

    cols = "ABCDEFGHIJ"
    body = "".join(
        f'<row r="{n}">' + "".join(f'<c r="{cols[i]}{n}" t="s"><v>{sidx(v)}</v></c>' for i, v in enumerate(vals) if v)
        + "</row>" for n, vals in enumerate(rows, start=1))
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    sst = f'<sst xmlns="{ns}">' + "".join(f"<si><t>{escape(s)}</t></si>" for s in strings) + "</sst>"
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/workbook.xml", f'<workbook xmlns="{ns}" xmlns:r="{rel}"><sheets>'
                   f'<sheet name="{ct.SHEET}" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
                   'relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr("xl/sharedStrings.xml", sst)
        z.writestr("xl/worksheets/sheet1.xml", f'<worksheet xmlns="{ns}"><sheetData>{body}</sheetData></worksheet>')
    return path


class FakeRemote:
    """Stands in for subprocess.run. Records every ssh/scp call and answers the remote checks from its settings."""

    def __init__(self, exists=False, probe_rc=None, probe_stdout=None, digest=None, scp_rc=0, swap_rc=0):
        self.exists, self.probe_rc, self.probe_stdout, self.digest = exists, probe_rc, probe_stdout, digest
        self.scp_rc, self.swap_rc = scp_rc, swap_rc
        self.calls = []

    def scripts(self):
        return [c[-1] for c in self.calls if c[0] == "ssh"]

    def scp_calls(self):
        return [c for c in self.calls if c[0] == "scp"]

    def __call__(self, cmd, check=False, **_):
        self.calls.append(cmd)
        if cmd[0] == "scp":
            rc = self.scp_rc
        else:
            script = cmd[-1]
            if script.startswith("if test -e"):
                rc = self.probe_rc if self.probe_rc is not None else 0
                marker = "EXISTS" if self.exists else "MISSING"
                return subprocess.CompletedProcess(cmd, rc, self.probe_stdout if self.probe_stdout is not None else (marker if rc == 0 else ""), "remote error" if rc else "")
            elif script.startswith("sha256sum"):
                digest = self.digest() if callable(self.digest) else self.digest
                return subprocess.CompletedProcess(cmd, 0, f"{digest}  staged.part\n", "")
            elif script.startswith("chown"):
                rc = self.swap_rc
            else:  # rm -f of the staged copy
                rc = 0
        if check and rc:
            raise subprocess.CalledProcessError(rc, cmd)
        return subprocess.CompletedProcess(cmd, rc, "", "remote error" if rc else "")


@pytest.fixture()
def tsv(tmp_path):
    p = tmp_path / DEST_NAME
    p.write_bytes(b"target payload")
    return p


def upload_with(monkeypatch, fake, tsv, confirm=None):
    monkeypatch.setattr(ct.subprocess, "run", fake)
    return ct.upload(tsv, "root@host", None, "/opt/sr/data", confirm_replace=confirm)


# --- month from the file name ---

@pytest.mark.parametrize("name, expected", [("Target.04.xlsx", "1405/04"), ("Target.07.xlsx", "1405/07"),
                                            ("Target.12.xlsx", "1405/12")])
def test_month_comes_from_strict_numbered_name(name, expected):
    assert ct.resolve_month(Path(name), None) == expected


@pytest.mark.parametrize("name", ["Target.xlsx", "Target.7.xlsx", "target.07.xlsx", "Target.13.xlsx",
                                  "Target.00.xlsx", "Target.07.xlsx.bak", "Target 07.xlsx"])
def test_other_names_need_explicit_month(name):
    with pytest.raises(ct.TargetError, match="--month"):
        ct.resolve_month(Path(name), None)


def test_explicit_month_kept_for_legacy_name():
    assert ct.resolve_month(Path("Target.xlsx"), "1405/08") == "1405/08"


def test_explicit_month_must_agree_with_numbered_name():
    assert ct.resolve_month(Path("Target.07.xlsx"), "1405/07") == "1405/07"
    with pytest.raises(ct.TargetError, match="--month 1405/08"):
        ct.resolve_month(Path("Target.07.xlsx"), "1405/08")


def test_check_run_reads_month_from_name_and_writes_nothing(tmp_path, monkeypatch):
    wb = make_workbook(tmp_path / "Target.07.xlsx")
    out = tmp_path / "out"
    monkeypatch.setattr(sys, "argv", ["convert_target.py", str(wb), "--out", str(out), "--check"])
    assert ct.main() == 0
    assert not out.exists()


def test_duplicate_category_rows_are_summed_into_one_row(tmp_path):
    # the same visitor and target category repeated (e.g. three target levels) collapses to one row with the summed rial
    rows = [HEADER,
            ROW,
            ["شعبه تهران", "لاین سوپرمارکت", "دسته A", "گروه", "11", "علی رضایی", "800", "سرپرست ۱", "مدیر ۱"],
            ["شعبه تهران", "لاین سوپرمارکت", "دسته A", "گروه", "11", "علی رضایی", "1200", "سرپرست ۱", "مدیر ۱"]]
    wb = make_workbook(tmp_path / "Target.08.xlsx", rows)
    tsv, rep = ct.convert(wb, "1405/08")
    assert len(tsv) == 1
    assert tsv[0][-1] == "4000.00"
    assert rep["total_rial"] == 4000


def test_totals_are_derived_per_group_and_category(tmp_path):
    rows = [HEADER,
            ["شعبه تهران", "لاین سوپرمارکت", "دسته A", "گروه ز", "11", "علی رضایی", "1000", "سرپرست ۱", "مدیر ۱"],
            ["شعبه تهران", "لاین سوپرمارکت", "دسته B", "گروه ز", "11", "علی رضایی", "2000", "سرپرست ۱", "مدیر ۱"],
            ["شعبه تهران", "لاین سوپرمارکت", "دسته C", "گروه ک", "12", "رضا احمدی", "400", "سرپرست ۱", "مدیر ۱"]]
    wb = make_workbook(tmp_path / "Target.07.xlsx", rows)
    tsv, rep = ct.convert(wb, "1405/07")
    assert rep["group_totals"] == {"گروه ز": 3000, "گروه ک": 400}
    assert rep["category_totals"] == {"دسته A": 1000, "دسته B": 2000, "دسته C": 400}
    assert rep["total_rial"] == 3400


def test_legacy_header_with_goal_column_is_accepted(tmp_path):
    legacy = [["شعبه", "Line", "TargetCategory", "گروه", "کد ویزیتوری", "VIS.VIS", "هدف کل",
               "هدف ریالی تارگت کتگوری", "نام سرپرست", "نام مدیر"],
              ["شعبه تهران", "لاین سوپرمارکت", "دسته A", "گروه", "11", "علی رضایی", "2000", "2000",
               "سرپرست ۱", "مدیر ۱"]]
    wb = make_workbook(tmp_path / "Target.07.xlsx", legacy)
    tsv, rep = ct.convert(wb, "1405/07")
    assert rep["total_rial"] == 2000
    assert tsv[0][-1] == "2000.00"


def test_missing_rial_column_is_reported(tmp_path):
    rows = [["شعبه", "Line", "TargetCategory", "گروه", "کد ویزیتوری", "VIS.VIS", "نام سرپرست", "نام مدیر"],
            ["شعبه تهران", "لاین سوپرمارکت", "دسته A", "گروه", "11", "علی رضایی", "سرپرست ۱", "مدیر ۱"]]
    wb = make_workbook(tmp_path / "Target.08.xlsx", rows)
    with pytest.raises(ct.TargetError, match="هدف ریالی تارگت کتگوری"):
        ct.convert(wb, "1405/08")


def test_write_names_tsv_with_inferred_month(tmp_path, monkeypatch):
    wb = make_workbook(tmp_path / "Target.07.xlsx")
    out = tmp_path / "out"
    monkeypatch.setattr(sys, "argv", ["convert_target.py", str(wb), "--out", str(out)])
    assert ct.main() == 0
    assert (out / DEST_NAME).read_text(encoding="utf-8").startswith("month")


def test_main_rejects_missing_month_for_legacy_name(tmp_path, monkeypatch):
    wb = make_workbook(tmp_path / "Target.xlsx")
    monkeypatch.setattr(sys, "argv", ["convert_target.py", str(wb), "--check"])
    assert ct.main() == 2


# --- upload safety (ssh/scp mocked) ---

def test_new_month_uploads_without_asking(tsv, monkeypatch):
    fake = FakeRemote(exists=False, digest=ct.sha256_file(tsv))
    asked = []
    assert upload_with(monkeypatch, fake, tsv, confirm=lambda: asked.append(1) or True) is True
    assert asked == []
    part = fake.scp_calls()[0][-1].split(":", 1)[1]
    assert part.endswith(".part") and part != f"/opt/sr/data/raw/{DEST_NAME}"
    swap = fake.scripts()[-1]
    assert swap.startswith("chown sr:sr ") and f"&& mv -f {part} /opt/sr/data/raw/{DEST_NAME}" in swap


def test_existing_month_replaced_after_confirmation(tsv, monkeypatch):
    fake = FakeRemote(exists=True, digest=ct.sha256_file(tsv))
    assert upload_with(monkeypatch, fake, tsv, confirm=lambda: True) is True
    assert fake.scp_calls() and "mv -f" in fake.scripts()[-1]


def test_declined_replacement_leaves_server_untouched(tsv, monkeypatch):
    fake = FakeRemote(exists=True, digest=ct.sha256_file(tsv))
    assert upload_with(monkeypatch, fake, tsv, confirm=lambda: False) is False
    assert fake.scp_calls() == []
    assert not any("mv -f" in s for s in fake.scripts())


def test_existing_month_without_confirmation_is_refused(tsv, monkeypatch):
    fake = FakeRemote(exists=True, digest=ct.sha256_file(tsv))
    with pytest.raises(ct.UploadError, match="--yes"):
        upload_with(monkeypatch, fake, tsv, confirm=None)
    assert fake.scp_calls() == []


@pytest.mark.parametrize("rc, stdout", [(255, None), (1, None), (0, "UNKNOWN")])
def test_failed_remote_probe_stops_before_copy(tsv, monkeypatch, rc, stdout):
    fake = FakeRemote(probe_rc=rc, probe_stdout=stdout, digest=ct.sha256_file(tsv))
    with pytest.raises(ct.UploadError, match="بررسی"):
        upload_with(monkeypatch, fake, tsv, confirm=lambda: True)
    assert fake.scp_calls() == []


def test_hash_mismatch_keeps_old_file_and_removes_part(tsv, monkeypatch):
    fake = FakeRemote(exists=True, digest="0" * 64)
    with pytest.raises(ct.UploadError, match="هش"):
        upload_with(monkeypatch, fake, tsv, confirm=lambda: True)
    assert not any("mv -f" in s for s in fake.scripts())
    assert any(s.startswith("rm -f") for s in fake.scripts())


def test_failed_copy_never_reaches_swap(tsv, monkeypatch):
    fake = FakeRemote(exists=True, scp_rc=1, digest=ct.sha256_file(tsv))
    with pytest.raises(ct.UploadError, match="کپی"):
        upload_with(monkeypatch, fake, tsv, confirm=lambda: True)
    assert not any("mv -f" in s for s in fake.scripts())


def test_failed_swap_reports_error_and_removes_part(tsv, monkeypatch):
    fake = FakeRemote(exists=False, swap_rc=1, digest=ct.sha256_file(tsv))
    with pytest.raises(ct.UploadError, match="جایگزینی"):
        upload_with(monkeypatch, fake, tsv)
    assert any(s.startswith("rm -f") for s in fake.scripts())


def test_main_refuses_replacement_without_yes_when_not_interactive(tmp_path, monkeypatch):
    wb = make_workbook(tmp_path / "Target.07.xlsx")
    fake = FakeRemote(exists=True, digest="0" * 64)
    monkeypatch.setattr(ct.subprocess, "run", fake)
    monkeypatch.setattr(sys, "stdin", io.StringIO(""))
    monkeypatch.setattr(sys, "argv", ["convert_target.py", str(wb), "--out", str(tmp_path / "out"),
                                      "--upload", "root@host"])
    assert ct.main() == 1
    assert fake.scp_calls() == []


def test_main_reports_declined_interactive_replacement(tmp_path, monkeypatch, capsys):
    wb = make_workbook(tmp_path / "Target.07.xlsx")
    fake = FakeRemote(exists=True)

    class InteractiveInput(io.StringIO):
        def isatty(self):
            return True

    monkeypatch.setattr(ct.subprocess, "run", fake)
    monkeypatch.setattr(sys, "stdin", InteractiveInput("n\n"))
    monkeypatch.setattr(sys, "argv", ["convert_target.py", str(wb), "--out", str(tmp_path / "out"),
                                      "--upload", "root@host"])
    assert ct.main() == 3
    assert "جایگزینی لغو شد" in capsys.readouterr().out
    assert len(fake.calls) == 1  # only the existence probe; no SCP or mutation
    assert fake.scripts()[0].startswith("if test -e")


def test_main_replaces_existing_month_with_yes(tmp_path, monkeypatch):
    wb = make_workbook(tmp_path / "Target.07.xlsx")
    out = tmp_path / "out"
    fake = FakeRemote(exists=True, digest=lambda: ct.sha256_file(out / DEST_NAME))
    monkeypatch.setattr(ct.subprocess, "run", fake)
    monkeypatch.setattr(sys, "stdin", io.StringIO(""))
    monkeypatch.setattr(sys, "argv", ["convert_target.py", str(wb), "--out", str(out), "--upload", "root@host",
                                      "--yes"])
    assert ct.main() == 0
    assert "mv -f" in fake.scripts()[-1]
