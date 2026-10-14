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
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "sr_kg_140507.tsv").write_bytes(b"x")
    for name, value in {"DATA_DIR": tmp_path, "STATUS": tmp_path / "sync_status.json", "RAW_DIR": raw}.items():
        monkeypatch.setattr(mod, name, value)
    return mod


def status(mod) -> dict:
    return json.loads(mod.STATUS.read_text(encoding="utf-8"))


def test_signature_changes_when_an_extract_changes(sync):
    first = sync.signature()
    assert [row[0] for row in first] == ["sr_kg_140507.tsv"]
    (sync.RAW_DIR / "sr_kg_140507.tsv").write_bytes(b"xy")
    assert sync.signature() != first


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
    assert s["state"] == "ok" and s["rows_loaded"] == 5 and s["error"] is None and s["signature"]
    lock = sync.acquire_lock()
    assert lock is not None
    lock.close()


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
