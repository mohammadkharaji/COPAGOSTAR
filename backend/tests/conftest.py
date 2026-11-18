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
