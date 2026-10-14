import duckdb
from .config import DB_PATH
def connect(read_only=False):
    DB_PATH.parent.mkdir(parents=True,exist_ok=True)
    return duckdb.connect(str(DB_PATH),read_only=read_only)
