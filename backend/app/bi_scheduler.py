"""BI scheduling, separate from HTTP routing and report calculations."""
import asyncio
import logging
import os
import time
from datetime import datetime

from . import bi_sync_service

logger = logging.getLogger(__name__)


async def run():
    """Sync nightly at 00:30 and hourly during business hours."""
    if "PYTEST_CURRENT_TEST" in os.environ:
        return
    last_hourly = time.time()
    last_nightly = None
    while True:
        try:
            await asyncio.sleep(30)
            now = datetime.now()
            if now.hour == 0 and 30 <= now.minute <= 35 and last_nightly != now.date():
                last_nightly = now.date()
                bi_sync_service.trigger_sync_background()
            elif 8 <= now.hour <= 18 and time.time() - last_hourly >= 3600:
                last_hourly = time.time()
                bi_sync_service.trigger_sync_background()
        except Exception:
            logger.exception("BI scheduler iteration failed")
            await asyncio.sleep(60)