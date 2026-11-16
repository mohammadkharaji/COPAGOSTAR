from app import api, rbac
from starlette.requests import Request


def test_product_metrics_calculation():
    p = rbac.superadmin()
    ctx = rbac.CURRENT.set(p)
    try:
        req = Request({"type": "http", "query_string": b"", "headers": []})
        res = api.product_metrics(req, core="kg", by="brand")
        assert res["available"] is True
        assert res["by"] == "brand"
        
        # Test KPIs
        k = res["kpis"]
        assert k["total_cartons"] > 0
        assert k["total_rial"] > 0
        assert k["unique_customers"] > 0
        assert k["unique_sellers"] > 0
        assert k["last_purchase_date"] is not None

        # Test Frequency Pattern
        freq = res["frequency_pattern"]
        assert len(freq) == 4
        assert sum(f["count"] for f in freq) == k["unique_customers"]

        # Test Monthly Trends
        assert len(res["monthly_trend"]) > 0
        assert len(res["monthly_discount"]) > 0
        assert res["monthly_trend"][0]["unique_customers"] > 0

        # Test Item Cycles
        assert len(res["item_cycles"]) > 0
        assert res["summary_cycle"] is not None and res["summary_cycle"] > 0

        # Test Drilldown filter by item_key
        first_brand = list(res["item_cycles"].keys())[0]
        res_filtered = api.product_metrics(req, core="kg", by="brand", item_key=first_brand)
        assert res_filtered["item_key"] == first_brand
        assert res_filtered["kpis"]["unique_customers"] <= k["unique_customers"]
    finally:
        rbac.CURRENT.reset(ctx)
