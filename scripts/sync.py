"""Watch data/raw for new or changed sr_*.tsv extracts and reload DuckDB (no Excel involved).

  python scripts/sync.py                # watch forever (poll every 60 s)
  python scripts/sync.py --once         # ingest now if the extracts changed, then exit
  python scripts/sync.py --once --force # ingest now regardless
  python scripts/sync.py --dry-run      # print the plan only
  python scripts/sync.py --sql          # also re-extract the recent months from SQL Server (read-only) every --sql-every minutes
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.config import DATA_DIR, RAW_DIR  # noqa: E402
from app.ingest import ingest_all  # noqa: E402
from app.schema import PRODUCT_FILE, RETURN_GLOB, TARGET_GLOB  # noqa: E402
from app.sql_source import extract_recent  # noqa: E402

STATUS = DATA_DIR / "sync_status.json"


def extracts() -> list[Path]:
    return sorted([*RAW_DIR.glob("sr_*.tsv"), *RAW_DIR.glob(PRODUCT_FILE), *RAW_DIR.glob(TARGET_GLOB),
                   *RAW_DIR.glob(RETURN_GLOB)])


def signature() -> list[list]:
    return [[p.name, p.stat().st_size, p.stat().st_mtime_ns] for p in extracts()]


def wait_stable(seconds: int = 15) -> bool:
    for _ in range(40):
        a = signature()
        time.sleep(seconds)
        if signature() == a:
            return True
    return False


def read_status() -> dict:
    try:
        return json.loads(STATUS.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def write_status(**kw) -> None:
    STATUS.parent.mkdir(parents=True, exist_ok=True)
    STATUS.write_text(json.dumps({**read_status(), **kw}, ensure_ascii=False, indent=2), encoding="utf-8")


def acquire_lock():
    """OS-level exclusive lock released automatically if the process dies; None if another sync holds it."""
    f = open(DATA_DIR / "sync.lock", "a+b")
    try:
        if os.name == "nt":
            import msvcrt
            f.seek(0)
            msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        f.close()
        return None
    return f


def run_sync(dry: bool, sql: bool = False) -> bool:
    files = [row[0] for row in signature()]
    print(f"فایل‌های هدف: {files}")
    if dry:
        if sql:
            print("استخراج از SQL Server: ماه‌های اخیر")
        return True
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    lock = acquire_lock()
    if lock is None:
        print("به‌روزرسانی دیگری در حال اجراست؛ این اجرا انجام نشد.", file=sys.stderr)
        return False
    try:
        return _run_locked(sql)
    finally:
        lock.close()


def _run_locked(sql: bool) -> bool:
    write_status(state="running", started_at=datetime.now().isoformat(timespec="seconds"))
    try:
        extracted = []
        if sql:
            extracted = [r["file"] for r in extract_recent(RAW_DIR)]
            print(f"استخراج از SQL: {extracted}")
        sig = signature()
        results = ingest_all()
        loaded = sum(r["rows"] for r in results if r["status"] == "loaded")
        write_status(state="ok", finished_at=datetime.now().isoformat(timespec="seconds"), signature=sig,
                     rows_loaded=loaded, sql_extracted=extracted, error=None)
        print(f"تمام شد؛ {loaded} ردیف بارگذاری شد")
        return True
    except Exception as e:  # keep serving previous data; surface the failure
        write_status(state="failed", finished_at=datetime.now().isoformat(timespec="seconds"), error=str(e))
        print(f"خطا: {e}", file=sys.stderr)
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--interval", type=int, default=60)
    ap.add_argument("--sql", action="store_true")
    ap.add_argument("--sql-every", type=int, default=60, help="minutes between SQL extracts")
    a = ap.parse_args()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    next_sql = 0.0
    while True:
        sql_due = a.sql and time.monotonic() >= next_sql
        changed = a.force or sql_due or signature() != read_status().get("signature")
        if changed and (a.dry_run or wait_stable()):
            if sql_due:
                next_sql = time.monotonic() + a.sql_every * 60
            ok = run_sync(a.dry_run, sql=a.sql and sql_due)
            if a.once or a.dry_run:
                return 0 if ok else 1
        elif a.once:
            print("فایلی تغییر نکرده است.")
            return 0
        time.sleep(a.interval)


if __name__ == "__main__":
    sys.exit(main())
