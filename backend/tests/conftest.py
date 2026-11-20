"""Restore backend module state between tests.

`test_api.build_client` reloads `config`, `db`, `ingest`, `rbac`, `admin`, `club_store`, `club` and `api` against a
`tmp_path`, and the reload rebinds `config.DB_PATH` / `DATA_DIR` / `RAW_DIR` for the rest of the process. Every
endpoint reads those attributes at call time, so a later test that touches the real database (the customer and
product metrics tests do) then queries the previous test's temp directory — or a path that no longer exists.

Restoring the three attributes is enough, and it does not matter whether it runs before or after `monkeypatch`
teardown: this fixture writes the values back directly rather than relying on the environment.
"""
import pytest

from app import config


@pytest.fixture(autouse=True)
def restore_backend_config():
    original = (config.DATA_DIR, config.RAW_DIR, config.DB_PATH)
    yield
    config.DATA_DIR, config.RAW_DIR, config.DB_PATH = original


@pytest.fixture
def metrics_data(tmp_path, monkeypatch):
    """Small, deterministic sales history; never query the developer's database."""
    from test_api import build_client, make_row, product_tsv

    source = "SRSalesProcedure1405"
    rows = [
        make_row(source, "I1", "C1", "100", "10", date="1405/07/01", brand="برند نمونه", ucode="P1", vcode="V1", vname="ویزیتور نمونه"),
        make_row(source, "I2", "C2", "200", "20", date="1405/07/02", brand="برند نمونه", ucode="P1", vcode="V1", vname="ویزیتور نمونه"),
        make_row(source, "I3", "C1", "300", "30", date="1405/08/01", brand="برند نمونه", ucode="P1", vcode="V1", vname="ویزیتور نمونه"),
        make_row(source, "I4", "C3", "400", "40", date="1405/08/02", brand="برند نمونه", ucode="P1", vcode="V1", vname="ویزیتور نمونه"),
    ]
    client = build_client(tmp_path, monkeypatch, {"sr_kg_140508": rows},
                          product=product_tsv(("P1", "گروه بیسکویت", "بیسکویت")))
    yield client
    client.close()
