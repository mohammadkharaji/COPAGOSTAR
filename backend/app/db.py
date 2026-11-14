import duckdb
from . import config
def connect(read_only=False):
    config.DB_PATH.parent.mkdir(parents=True,exist_ok=True)
    return duckdb.connect(str(config.DB_PATH),read_only=read_only)
