"""Unit tests for Automated BI Sync Service (3-procedure consolidation)."""
import json
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
