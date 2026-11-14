"""Club (loyalty points) tables in their own DuckDB file, `<SR_DATA_DIR>/club.duckdb`.

Kept apart from the sales database so club writes never contend with the read-only sales connection, and so the sales
extracts and sync never touch these tables. Single writer per process, guarded by `write_lock`.
"""
from __future__ import annotations

import threading

import duckdb

from . import config

write_lock = threading.Lock()

DDL = (
    "CREATE TABLE IF NOT EXISTS plans (id INTEGER PRIMARY KEY, kind VARCHAR, name VARCHAR, core VARCHAR, "
    "start_key INTEGER, end_key INTEGER, rial_per_point DOUBLE, active BOOLEAN, created_at VARCHAR)",

    # Which login belongs to which customer code (kind b2b) or visitor code (kind visitor). One code per login.
    "CREATE TABLE IF NOT EXISTS member_links(username VARCHAR PRIMARY KEY, kind VARCHAR, code VARCHAR, linked_at VARCHAR)",
    # Snapshot history written by an admin: one row per plan, code and computation time.
    "CREATE TABLE IF NOT EXISTS points (plan_id INTEGER, kind VARCHAR, code VARCHAR, name VARCHAR, "
    "sales_rial DOUBLE, points BIGINT, computed_at VARCHAR)",
)


def _migrate(con: duckdb.DuckDBPyConnection) -> None:
    """Additive columns for files created before a field existed; existing rows keep working. DuckDB's PRAGMA can report
    the pre-DDL schema inside one connection, so a duplicate-column error means the column is already there."""
    for col, typ in (("target_points", "BIGINT"), ("tier_points", "VARCHAR"), ("rules", "VARCHAR")):
        try:
            con.execute(f"ALTER TABLE plans ADD COLUMN {col} {typ}")
        except duckdb.CatalogException:
            pass
    try:
        con.execute("ALTER TABLE plans ALTER COLUMN tier_points TYPE VARCHAR")
    except duckdb.CatalogException:
        pass


def path():
    return config.DATA_DIR / "club.duckdb"


def connect() -> duckdb.DuckDBPyConnection:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(path()))
    for stmt in DDL:
        con.execute(stmt)
    _migrate(con)
    return con
