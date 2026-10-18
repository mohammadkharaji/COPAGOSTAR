"""Accounts, roles and audit log (a small writable SQLite file) plus the access rules the API enforces.

The dashboard data stays in sr.duckdb (opened read-only). Accounts live apart, in `<SR_DATA_DIR>/accounts.sqlite`, which
is created on the first admin write. The environment user (SR_AUTH_USER / SR_AUTH_PASS_HASH) is always the superadmin: it
needs no row here, cannot be edited or locked out through the API, and still works if the file is missing or damaged.

A role carries `pages`, `cores`, `branches` (empty = every branch) and `is_admin`. An admin role sees every page, core and
branch and may use /api/admin. The scope of the current request travels in a ContextVar, so the shared query helpers
are scoped without every function taking a user argument.
"""
from __future__ import annotations

import hmac
import json
import re
import sqlite3
import threading
from contextlib import closing
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException

from . import auth, config
from .config import CORES

PAGES = ("overview", "trend", "monthly", "growth", "target", "branch", "product", "profile", "pareto", "invoice",
         "customer", "visitor", "returns", "health")
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.@-]{3,64}$")
MIN_PASSWORD = 8

SCHEMA = """
CREATE TABLE IF NOT EXISTS roles(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT NOT NULL DEFAULT '',
    pages TEXT NOT NULL DEFAULT '[]',
    cores TEXT NOT NULL DEFAULT '[]',
    branches TEXT NOT NULL DEFAULT '[]',
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active INTEGER NOT NULL DEFAULT 1,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT);
CREATE TABLE IF NOT EXISTS audit_log(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT '',
    target TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '{}',
    ip TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS audit_ts ON audit_log(ts);
"""

write_lock = threading.Lock()   # admin rules are check-then-write (last admin, role in use): one writer at a time
_ready: set[str] = set()


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


# ---------- store ----------

def accounts_path() -> Path:
    return Path(config.DATA_DIR) / "accounts.sqlite"


def ensure_store() -> Path:
    path = accounts_path()
    if str(path) not in _ready:
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(path, timeout=10)) as con:
            con.executescript(SCHEMA)
        _ready.add(str(path))
    return path


def connect(create: bool = False) -> sqlite3.Connection | None:
    """A connection with autocommit off-by-default disabled (explicit transactions), or None when reading and no store."""
    path = ensure_store() if create else accounts_path()
    if not create and not path.exists():
        return None
    con = sqlite3.connect(path, timeout=10, isolation_level=None)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con


def audit_row(con: sqlite3.Connection, actor: str, action: str, target_type: str = "", target: str = "",
              detail: dict | None = None, ip: str = "") -> None:
    con.execute("INSERT INTO audit_log(ts, actor, action, target_type, target, detail, ip) VALUES (?,?,?,?,?,?,?)",
                (now_iso(), actor, action, target_type, str(target), json.dumps(detail or {}, ensure_ascii=False), ip))


def audit(actor: str, action: str, target_type: str = "", target: str = "", detail: dict | None = None,
          ip: str = "") -> None:
    """Best-effort audit entry outside an admin transaction (logins). Never raises: an audit failure must not block login."""
    try:
        with write_lock, closing(connect(create=True)) as con:
            audit_row(con, actor, action, target_type, target, detail, ip)
    except (sqlite3.Error, OSError):
        pass


def role_dict(row: sqlite3.Row) -> dict:
    return {"id": row["id"], "name": row["name"], "description": row["description"], "pages": json.loads(row["pages"]),
            "cores": json.loads(row["cores"]), "branches": json.loads(row["branches"]), "is_admin": bool(row["is_admin"]),
            "created_at": row["created_at"], "updated_at": row["updated_at"]}


# ---------- principal ----------

@dataclass(frozen=True)
class Principal:
    user: str
    role: str
    is_admin: bool
    pages: tuple[str, ...]
    cores: tuple[str, ...]
    branches: tuple[str, ...] | None      # None = every branch
    superadmin: bool = False
    display_name: str = ""
    token_version: int | None = None      # None for the environment superadmin

    def me(self) -> dict:
        return {"user": self.user, "display_name": self.display_name, "role": self.role, "is_admin": self.is_admin,
                "superadmin": self.superadmin, "pages": list(self.pages), "cores": list(self.cores),
                "branches": list(self.branches or ()), "all_branches": self.branches is None}


def superadmin() -> Principal:
    return Principal(auth.username(), "superadmin", True, PAGES, tuple(CORES), None, superadmin=True)


def _principal(user: sqlite3.Row, role: sqlite3.Row) -> Principal:
    r = role_dict(role)
    if r["is_admin"]:
        pages, cores, branches = PAGES, tuple(CORES), None
    else:
        pages = tuple(p for p in PAGES if p in r["pages"])
        cores = tuple(c for c in CORES if c in r["cores"])
        branches = tuple(r["branches"]) or None
    return Principal(user["username"], r["name"], r["is_admin"], pages, cores, branches,
                     display_name=user["display_name"], token_version=user["token_version"])


def _is_env_user(name: str) -> bool:
    return hmac.compare_digest(name.encode(), auth.username().encode())


def _load(username: str) -> tuple[sqlite3.Row, sqlite3.Row] | None:
    try:
        con = connect()
        if con is None:
            return None
        with closing(con):
            user = con.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
            role = user and con.execute("SELECT * FROM roles WHERE id=?", (user["role_id"],)).fetchone()
    except sqlite3.Error:
        return None
    return (user, role) if user and role else None


_dummy_hash: str | None = None


def authenticate(username: str, password: str) -> Principal | None:
    """Env user -> superadmin; otherwise an active database user. One scrypt run either way, so timing does not reveal
    which user names exist."""
    global _dummy_hash
    if _is_env_user(username):
        return superadmin() if auth.check_login(username, password) else None
    found = _load(username)
    if _dummy_hash is None:
        _dummy_hash = auth.hash_password("dummy")
    password_ok = auth.verify_password(password, found[0]["password_hash"] if found else _dummy_hash)
    if not (auth.configured() and found and password_ok and found[0]["is_active"]):
        return None
    principal = _principal(*found)
    try:
        with write_lock, closing(connect(create=True)) as con:
            con.execute("UPDATE users SET last_login_at=? WHERE id=?", (now_iso(), found[0]["id"]))
    except (sqlite3.Error, OSError):
        pass
    return principal


def principal_from_token(token: str | None) -> Principal | None:
    got = auth.verify_signed(token)
    if got is None:
        return None
    user, version = got
    if _is_env_user(user):
        return superadmin() if version is None else None
    found = _load(user)
    if not found or version is None or not found[0]["is_active"] or found[0]["token_version"] != version:
        return None
    return _principal(*found)


# ---------- the current request's scope ----------

CURRENT: ContextVar[Principal | None] = ContextVar("sr_principal", default=None)


def require() -> Principal:
    p = CURRENT.get()
    if p is None:
        raise HTTPException(401, "نیاز به ورود")
    return p


def check_core(key: str) -> None:
    if key not in require().cores:
        raise HTTPException(403, "دسترسی به این هسته مجاز نیست")


def branch_clause(col: str = "branch") -> tuple[str, list]:
    """` AND col IN (...)` limiting a query to the user's branches; empty when the user sees every branch."""
    branches = require().branches
    if branches is None:
        return "", []
    return f" AND {col} IN ({','.join('?' * len(branches))})", list(branches)


def core_clause(col: str = "core") -> tuple[str, list]:
    """` AND col IN (...)` for queries that do not filter one core themselves."""
    cores = require().cores
    if set(cores) >= set(CORES):
        return "", []
    return f" AND {col} IN ({','.join('?' * len(cores))})", [CORES[c] for c in cores]


# ---------- which page an endpoint belongs to ----------

# Open to every logged-in user: the app shell (sidebar, filter bar, data freshness, calendar, sync state). Anything about
# sales numbers in them is still limited to the user's cores and branches.
SHELL = {"/api/auth/me", "/api/auth/logout", "/api/health", "/api/meta", "/api/data-health", "/api/calendar",
         "/api/sync-status", "/api/filters"}
# Endpoint -> pages that may use it (several pages share some endpoints, e.g. /overview is also on the visitor page).
EXACT = {
    "/api/overview": ("overview", "visitor"), "/api/monthly": ("monthly", "overview"), "/api/growth": ("growth", "overview"),
    "/api/trend": ("trend",), "/api/pace": ("overview",), "/api/pareto": ("pareto",), "/api/visitors": ("visitor",),
    "/api/breakdown": ("overview", "branch", "product", "profile"),
    "/api/invoice-bands": ("invoice",), "/api/invoice-lines": ("invoice",),
}
PREFIX = (("/api/visitor", ("visitor",)), ("/api/customer", ("customer",)), ("/api/profile", ("profile",)),
          ("/api/returns", ("returns",)), ("/api/target", ("target",)))


def access_for(method: str, path: str) -> tuple[str, tuple[str, ...]]:
    """('shell' | 'admin' | 'pages', pages). Anything not listed is admin-only (fail closed)."""
    if path in SHELL:
        return "shell", ()
    if path == "/api/admin" or path.startswith("/api/admin/") or (path == "/api/sync" and method != "GET"):
        return "admin", ()
    if path in EXACT:
        return "pages", EXACT[path]
    for prefix, pages in PREFIX:
        if path.startswith(prefix + "/"):
            return "pages", pages
    if path in dict(PREFIX):
        return "pages", dict(PREFIX)[path]
    return "admin", ()


def allowed(p: Principal, method: str, path: str) -> bool:
    kind, pages = access_for(method, path)
    if kind == "shell":
        return True
    return p.is_admin or (kind == "pages" and any(pg in p.pages for pg in pages))

