"""Revocable, hashed-at-rest credentials valid only for the widget GET endpoint."""
from contextlib import closing
import hashlib
import secrets
import time

from . import auth, rbac

DDL = """CREATE TABLE IF NOT EXISTS widget_tokens(
    digest TEXT PRIMARY KEY, username TEXT NOT NULL, version INTEGER,
    expires_at REAL NOT NULL, created_at REAL NOT NULL, last_used_at REAL)"""


def issue(p):
    token = "srw_" + secrets.token_urlsafe(32)
    now = time.time()
    with rbac.write_lock, closing(rbac.connect(create=True)) as con:
        con.execute(DDL)
        con.execute("BEGIN IMMEDIATE")
        con.execute("DELETE FROM widget_tokens WHERE username=? OR expires_at<=?", (p.user, now))
        con.execute("INSERT INTO widget_tokens VALUES(?,?,?,?,?,NULL)",
                    (hashlib.sha256(token.encode()).hexdigest(), p.user, p.token_version, now + 90 * 86400, now))
        con.commit()
    return {"token": token, "expires_at": now + 90 * 86400}


def revoke(username):
    with rbac.write_lock, closing(rbac.connect(create=True)) as con:
        con.execute(DDL)
        con.execute("DELETE FROM widget_tokens WHERE username=?", (username,))


def resolve(token):
    if not token or not token.startswith("srw_") or len(token) > 128:
        return None
    with rbac.write_lock, closing(rbac.connect(create=True)) as con:
        con.execute(DDL)
        digest = hashlib.sha256(token.encode()).hexdigest()
        row = con.execute("SELECT * FROM widget_tokens WHERE digest=? AND expires_at>?", (digest, time.time())).fetchone()
        if row is None:
            return None
        # Re-resolve current role, scopes, active flag and password/session version on every request.
        p = rbac.principal_for(row["username"], row["version"])
        if p is not None:
            con.execute("UPDATE widget_tokens SET last_used_at=? WHERE digest=?", (time.time(), digest))
        return p