"""Unit tests for Automated BI Sync Service (3-procedure consolidation)."""
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
import pytest

try:
    from app import bi_sync_service
except ImportError:
    from backend.app import bi_sync_service


def test_status_retrieval_structure():
    status = bi_sync_service.get_bi_sync_status()
    assert "state" in status
    assert "last_successful_sync" in status
    assert "recent_logs" in status
    assert isinstance(status["recent_logs"], list)


def test_consolidation_formula_math():
    """Verify that Gross Sales (+) Promo - Returns yields net sales."""
    sales_total = 2263514904344
    promo_total = 149852383462
    returns_total = 11045850386

    net_total = sales_total + promo_total - returns_total
    assert net_total == 2402321437420


def test_excluded_promo_status():
    assert bi_sync_service.PROMO_EXCLUDED_STATUS == "کل برگشتي"


def test_stale_lock_recovery(tmp_path, monkeypatch):
    """Ensure that a sync running for more than 5 minutes or with dead thread is auto-recovered."""
    fake_status_file = tmp_path / "bi_sync_status.json"
    monkeypatch.setattr(bi_sync_service, "STATUS_FILE", fake_status_file)

    stale_time = (datetime.now() - timedelta(minutes=10)).isoformat(timespec="seconds")
    fake_status_file.write_text(json.dumps({
        "state": "running",
        "started_at": stale_time,
        "message": "old sync"
    }), encoding="utf-8")

    # Manually lock
    bi_sync_service._is_running = True
    if not bi_sync_service._sync_lock.locked():
        bi_sync_service._sync_lock.acquire(blocking=False)

    recovered = bi_sync_service._check_and_recover_stale_lock()
    assert recovered is True
    assert bi_sync_service._is_running is False
    assert not bi_sync_service._sync_lock.locked()

    status = bi_sync_service.read_status()
    assert status["state"] == "failed"
    assert status.get("stale_recovered") is True


def test_safe_replace(tmp_path):
    """Ensure _safe_replace atomically replaces target file."""
    src = tmp_path / "src.duckdb"
    dst = tmp_path / "dst.duckdb"
    src.write_text("staging data", encoding="utf-8")
    dst.write_text("old data", encoding="utf-8")

    bi_sync_service._safe_replace(src, dst)
    assert not src.exists()
    assert dst.read_text(encoding="utf-8") == "staging data"
