"""Watch data/raw for new or changed sr_*.tsv extracts and reload DuckDB (Linux server; no Excel involved).

  python scripts/sync.py                # watch forever (poll every 60 s)
  python scripts/sync.py --once         # ingest now if the extracts changed, then exit
  python scripts/sync.py --once --force # ingest now regardless
  python scripts/sync.py --dry-run      # print the plan only
"""
from __future__ import annotations

import argparse
import fcntl
import json
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.config import DATA_DIR, RAW_DIR  # noqa: E402
from app.ingest import ingest_all  # noqa: E402
from app.schema import PRODUCT_FILE, TARGET_GLOB  # noqa: E402

STATUS = DATA_DIR / "sync_status.json"


def extracts() -> list[Path]:
    return sorted([*RAW_DIR.glob("sr_*.tsv"), *RAW_DIR.glob(PRODUCT_FILE), *RAW_DIR.glob(TARGET_GLOB)])


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
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        f.close()
        return None
    return f


def run_sync(dry: bool) -> bool:
    files = [row[0] for row in signature()]
    print(f"فایل‌های هدف: {files}")
    if dry:
        return True
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    lock = acquire_lock()
    if lock is None:
        print("به‌روزرسانی دیگری در حال اجراست؛ این اجرا انجام نشد.", file=sys.stderr)
        return False
    try:
        return _run_locked()
    finally:
        lock.close()


def _run_locked() -> bool:
    write_status(state="running", started_at=datetime.now().isoformat(timespec="seconds"))
    try:
        sig = signature()
        results = ingest_all()
        loaded = sum(r["rows"] for r in results if r["status"] == "loaded")
        write_status(state="ok", finished_at=datetime.now().isoformat(timespec="seconds"), signature=sig,
                     rows_loaded=loaded, error=None)
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
    a = ap.parse_args()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    while True:
        changed = a.force or signature() != read_status().get("signature")
        if changed and (a.dry_run or wait_stable()):
            ok = run_sync(a.dry_run)
            if a.once or a.dry_run:
                return 0 if ok else 1
        elif a.once:
            print("فایلی تغییر نکرده است.")
            return 0
        time.sleep(a.interval)


if __name__ == "__main__":
    sys.exit(main())
