def test_health_labels_reconciliation_as_historical(metrics_data):
    response = metrics_data.get("/api/health")
    assert response.status_code == 200
    report = response.json()["consolidation"]
    assert report["status"] == "historical_reference"
    assert report["is_live_verification"] is False
    assert report["last_cutoff"] == "1405/08/24"