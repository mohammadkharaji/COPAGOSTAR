"""Load extracted Power Pivot partitions (sr_*.tsv, \x1f/\x1e delimited) into DuckDB, idempotently."""
from __future__ import annotations

import csv
import hashlib
import tempfile
import time
from pathlib import Path

from .config import RAW_DIR
from .db import connect
from .normalize import normalize_text
from .schema import COLUMN_MAP, NUMERIC, PRODUCT_DIMS, PRODUCT_FILE, PRODUCT_MAP, TEXT

FACT_DDL = (
    "CREATE TABLE IF NOT EXISTS fact_sales (chunk_id VARCHAR, jdate_key INTEGER, is_promo BOOLEAN, is_return BOOLEAN, "
    + ", ".join(f"{c} VARCHAR" for c in TEXT)
    + ", " + ", ".join(f"{c} DOUBLE" for c in NUMERIC) + ", " + ", ".join(f"{c} VARCHAR" for c in PRODUCT_DIMS) + ")"
)
PRODUCT_DDL = "CREATE TABLE IF NOT EXISTS dim_product (unique_product_code VARCHAR, main_group VARCHAR, sub_group VARCHAR)"
MANIFEST_DDL = ("CREATE TABLE IF NOT EXISTS ingest_manifest (file_name VARCHAR PRIMARY KEY, sha256 VARCHAR, "
                "row_count BIGINT, loaded_at VARCHAR)")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _iter_rows(path: Path):
    header, sep, body = path.read_text(encoding="utf-8").partition("\x1e")
    if not sep:
        raise ValueError(f"{path.name}: missing header terminator (truncated extract?)")
    cols = header.split("\x1f")
    missing = [c for c in COLUMN_MAP if c not in cols]
    if missing:
        raise ValueError(f"{path.name}: missing expected columns {missing}")
    idx = {COLUMN_MAP[c]: cols.index(c) for c in COLUMN_MAP}
    for line in body.split("\x1e"):
        if not line:
            continue
        vals = line.split("\x1f")
        if len(vals) != len(cols):
            raise ValueError(f"{path.name}: row has {len(vals)} fields, expected {len(cols)}")
        yield {k: vals[i] for k, i in idx.items()}


def initialize(con) -> None:
    base = ["chunk_id", "jdate_key", "is_promo", "is_return", *TEXT, *NUMERIC]
    existing = [r[0] for r in con.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name='fact_sales' ORDER BY ordinal_position").fetchall()]
    if existing == base:  # database from before product groups existed: add the columns, keep the loaded data
        for c in PRODUCT_DIMS:
            con.execute(f"ALTER TABLE fact_sales ADD COLUMN {c} VARCHAR")
    elif existing and existing != [*base, *PRODUCT_DIMS]:
        con.execute("DROP TABLE fact_sales")
        con.execute("DROP TABLE IF EXISTS ingest_manifest")
    con.execute(FACT_DDL)
    con.execute(MANIFEST_DDL)
    con.execute(PRODUCT_DDL)


def ingest_file(con, path: Path) -> dict:
    sha = _sha256(path)
    prev = con.execute("SELECT sha256 FROM ingest_manifest WHERE file_name=?", [path.name]).fetchone()
    if prev and prev[0] == sha:
        return {"file": path.name, "status": "skipped", "rows": 0}
    out_cols = ["chunk_id", "jdate_key", "is_promo", "is_return", *TEXT, *NUMERIC]
    n = 0
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, newline="", encoding="utf-8") as tmp:
        w = csv.writer(tmp)
        for r in _iter_rows(path):
            src = r["source_table"]
            digits = (r["invoice_date"] or "").replace("/", "")
            row = [path.stem, digits if digits.isdigit() else "", "Promotion" in src, "Return" in src]
            row += [normalize_text(r[c]) or "" for c in TEXT]
            row += [r[c] for c in NUMERIC]
            w.writerow(row)
            n += 1
        tmp_name = tmp.name
    try:
        con.execute("BEGIN")
        con.execute("DELETE FROM fact_sales WHERE chunk_id=?", [path.stem])
        con.execute(
            "INSERT INTO fact_sales SELECT chunk_id, TRY_CAST(jdate_key AS INTEGER), is_promo::BOOLEAN, is_return::BOOLEAN, "
            + ", ".join(f"NULLIF({c},'')" for c in TEXT) + ", " + ", ".join(f"TRY_CAST(NULLIF({c},'') AS DOUBLE)" for c in NUMERIC)
            + ", NULL::VARCHAR, NULL::VARCHAR FROM read_csv(?, header=false, all_varchar=true, columns={"
            + ", ".join(f"'{c}': 'VARCHAR'" for c in out_cols) + "})",
            [tmp_name],
        )
        con.execute("INSERT OR REPLACE INTO ingest_manifest VALUES (?,?,?,?)",
                    [path.name, sha, n, time.strftime("%Y-%m-%d %H:%M:%S")])
        con.execute("COMMIT")
    except Exception:
        con.execute("ROLLBACK")
        raise
    finally:
        Path(tmp_name).unlink(missing_ok=True)
    return {"file": path.name, "status": "loaded", "rows": n}


def ingest_product(con, path: Path) -> dict:
    """Load the product dimension (code -> main group / sub group). Skipped when the file is unchanged."""
    sha = _sha256(path)
    prev = con.execute("SELECT sha256 FROM ingest_manifest WHERE file_name=?", [path.name]).fetchone()
    if prev and prev[0] == sha:
        return {"file": path.name, "status": "skipped", "rows": 0}
    header, sep, body = path.read_text(encoding="utf-8").partition("\x1e")
    cols = header.split("\x1f")
    missing = [c for c in PRODUCT_MAP if c not in cols]
    if not sep or missing:
        raise ValueError(f"{path.name}: truncated extract or missing expected columns {missing}")
    idx = {PRODUCT_MAP[c]: cols.index(c) for c in PRODUCT_MAP}
    seen = {}
    for line in body.split("\x1e"):
        if not line:
            continue
        vals = line.split("\x1f")
        if len(vals) != len(cols):
            raise ValueError(f"{path.name}: row has {len(vals)} fields, expected {len(cols)}")
        code = normalize_text(vals[idx["unique_product_code"]])
        if code:
            seen[code] = [code, *(normalize_text(vals[idx[c]]) or "" for c in PRODUCT_DIMS)]
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, newline="", encoding="utf-8") as tmp:
        csv.writer(tmp).writerows(seen.values())
        tmp_name = tmp.name
    try:
        con.execute("BEGIN")
        con.execute("DELETE FROM dim_product")
        con.execute("INSERT INTO dim_product SELECT unique_product_code, NULLIF(main_group,''), NULLIF(sub_group,'') "
                    "FROM read_csv(?, header=false, all_varchar=true, columns={'unique_product_code': 'VARCHAR', "
                    "'main_group': 'VARCHAR', 'sub_group': 'VARCHAR'})", [tmp_name])
        con.execute("INSERT OR REPLACE INTO ingest_manifest VALUES (?,?,?,?)",
                    [path.name, sha, len(seen), time.strftime("%Y-%m-%d %H:%M:%S")])
        con.execute("COMMIT")
    except Exception:
        con.execute("ROLLBACK")
        raise
    finally:
        Path(tmp_name).unlink(missing_ok=True)
    return {"file": path.name, "status": "loaded", "rows": 0, "products": len(seen)}


def apply_product_groups(con, chunk_ids: list[str] | None = None) -> None:
    """Copy main_group/sub_group from dim_product onto fact rows (all rows, or only the given chunks)."""
    where, args = "", []
    if chunk_ids is not None:
        if not chunk_ids:
            return
        where = f" AND fact_sales.chunk_id IN ({','.join('?' * len(chunk_ids))})"
        args = chunk_ids
    con.execute("UPDATE fact_sales SET main_group=d.main_group, sub_group=d.sub_group FROM dim_product d "
                f"WHERE fact_sales.unique_product_code=d.unique_product_code{where}", args)


def ingest_all(raw_dir: Path = RAW_DIR) -> list[dict]:
    con = connect()
    try:
        initialize(con)
        results = []
        product = raw_dir / PRODUCT_FILE
        product_changed = False
        if product.exists():
            results.append(ingest_product(con, product))
            product_changed = results[0]["status"] == "loaded"
        results += [ingest_file(con, p) for p in sorted(raw_dir.glob("sr_*.tsv"))]
        loaded = [Path(r["file"]).stem for r in results if r["status"] == "loaded" and r["file"] != PRODUCT_FILE]
        apply_product_groups(con, None if product_changed else loaded)
        return results
    finally:
        con.close()


if __name__ == "__main__":
    for r in ingest_all():
        print(r)
