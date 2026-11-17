from app import api, rbac
from starlette.requests import Request


def test_customer_metrics_calculation():
    p = rbac.superadmin()
    ctx = rbac.CURRENT.set(p)
    try:
        req = Request({"type": "http", "query_string": b"", "headers": []})
        res = api.customer_metrics(req, core="kg", target_month="140508", lookback="prev_1m")
        assert res["available"] is True
        assert res["target_month"] in [m["value"] for m in res["available_months"]]
        assert res["lookback"] == "prev_1m"
        m = res["metrics"]
        assert m["total_customers"] > 0
        assert m["total_customers"] >= m["active_customers"]
        assert m["active_customers"] > 0
        assert m["prev_active_customers"] > 0
        assert m["new_customers"] + m["returning_customers"] == m["active_customers"]
        assert m["returning_customers"] + m["churned_customers"] == m["prev_active_customers"]
        assert round(m["returning_rate"] + m["churn_rate"]) == 100
        assert m["clv_qty"] > 0
        assert m["clv_rial"] > 0
        assert len(res["breakdown_brand"]) > 0
        assert len(res["breakdown_category"]) > 0
        assert len(res["by_category"]) > 0
        cat_names = [c["name"] for c in res["breakdown_category"]]
        assert any("ویفر" in n or "بیسکو" in n for n in cat_names)
        c0 = res["breakdown_category"][0]
        assert "churn_rate" in c0
        assert "returning_rate" in c0
        assert "clv_qty" in c0
        assert "avg_order_size" in c0
        assert "avg_sku" in c0
        assert "avg_category" in c0
        assert len(res["breakdown_branch"]) > 0
    finally:
        rbac.CURRENT.reset(ctx)
