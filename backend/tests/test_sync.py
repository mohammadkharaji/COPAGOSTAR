import importlib.util
import json
from pathlib import Path

import pytest

SYNC_PY = Path(__file__).resolve().parents[2] / "scripts" / "sync.py"


@pytest.fixture()
def sync(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("sr_sync_under_test", SYNC_PY)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for name, value in {"DATA_DIR": tmp_path, "STATUS": tmp_path / "sync_status.json",
                        "RAW_DIR": tmp_path / "raw"}.items():
        monkeypatch.setattr(mod, name, value)
    return mod


def status(mod) -> dict:
    return json.loads(mod.STATUS.read_text(encoding="utf-8"))


def test_lock_is_exclusive_and_released(sync):
    first = sync.acquire_lock()
    assert first is not None
    assert sync.acquire_lock() is None
    first.close()
    again = sync.acquire_lock()
    assert again is not None
    again.close()


def test_successful_run_records_ok_and_releases_lock(sync, monkeypatch):
    monkeypatch.setattr(sync, "ingest_all", lambda: [{"status": "loaded", "rows": 5}, {"status": "skipped", "rows": 0}])
    assert sync.run_sync(False) is True
    s = status(sync)
    assert s["state"] == "ok" and s["rows_loaded"] == 5 and s["error"] is None and s["signature"] is not None
    lock = sync.acquire_lock()
    assert lock is not None
    lock.close()


def test_sql_run_extracts_before_ingest(sync, monkeypatch):
    order = []
    monkeypatch.setattr(sync, "extract_recent", lambda out: order.append("sql") or [{"file": "sr_kg_140505.tsv"}])
    monkeypatch.setattr(sync, "ingest_all", lambda: order.append("ingest") or [{"status": "loaded", "rows": 1}])
    assert sync.run_sync(False, sql=True) is True
    assert order == ["sql", "ingest"]
    assert status(sync)["sql_extracted"] == ["sr_kg_140505.tsv"]


def test_failed_sql_extract_keeps_previous_data_and_records_error(sync, monkeypatch):
    def boom(out):
        raise RuntimeError("login failed")
    ingested = []
    monkeypatch.setattr(sync, "extract_recent", boom)
    monkeypatch.setattr(sync, "ingest_all", lambda: ingested.append(1) or [])
    assert sync.run_sync(False, sql=True) is False
    assert ingested == []
    s = status(sync)
    assert s["state"] == "failed" and "login failed" in s["error"]


def test_failed_run_records_error_and_keeps_serving(sync, monkeypatch):
    def boom():
        raise RuntimeError("boom")
    monkeypatch.setattr(sync, "ingest_all", boom)
    assert sync.run_sync(False) is False
    s = status(sync)
    assert s["state"] == "failed" and "boom" in s["error"]
    lock = sync.acquire_lock()
    assert lock is not None
    lock.close()


def test_concurrent_run_is_refused_without_touching_status(sync, monkeypatch):
    calls = []
    monkeypatch.setattr(sync, "ingest_all", lambda: calls.append(1) or [])
    held = sync.acquire_lock()
    try:
        assert sync.run_sync(False) is False
    finally:
        held.close()
    assert calls == [] and not sync.STATUS.exists()
