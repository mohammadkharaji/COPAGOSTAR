import asyncio
from datetime import datetime

import pytest

from app import bi_scheduler


def test_scheduler_does_not_sync_during_tests(monkeypatch):
    monkeypatch.setenv("PYTEST_CURRENT_TEST", "scheduler")
    monkeypatch.setattr(bi_scheduler.bi_sync_service, "trigger_sync_background",
                        lambda: pytest.fail("must not sync in tests"))
    asyncio.run(bi_scheduler.run())


def test_nightly_sync_runs_once_and_cancellation_propagates(monkeypatch):
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    calls = []

    class Clock:
        @staticmethod
        def now():
            return datetime(2026, 11, 20, 0, 31)

    sleeps = 0

    async def sleep(seconds):
        nonlocal sleeps
        sleeps += 1
        if sleeps == 3:
            raise asyncio.CancelledError

    monkeypatch.setattr(bi_scheduler, "datetime", Clock)
    monkeypatch.setattr(bi_scheduler.asyncio, "sleep", sleep)
    monkeypatch.setattr(bi_scheduler.bi_sync_service, "trigger_sync_background", lambda: calls.append(True))
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(bi_scheduler.run())
    assert calls == [True]