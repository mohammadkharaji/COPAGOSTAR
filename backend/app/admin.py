"""Admin API: users, roles and the audit log. Every route here is admin-only (enforced by the middleware in app.api).

Rules kept inside one transaction with the change itself: a role that users still hold cannot be deleted, and no change may
leave the database without an active admin user once it had one (the environment superadmin is not counted, so the last
database admin cannot be removed even though the superadmin could always repair things).
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import closing

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from . import auth, rbac
from .config import CORES, DB_PATH
from .db import connect as connect_sales

router = APIRouter(prefix="/api/admin")


class RoleBody(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    description: str = Field("", max_length=300)
    pages: list[str] = Field(default_factory=list, max_length=64)
    cores: list[str] = Field(default_factory=list, max_length=16)
    scope_mode: str = Field("all", max_length=20)
    is_admin: bool = False


class RolePatch(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=60)
    description: str | None = Field(None, max_length=300)
    pages: list[str] | None = Field(None, max_length=64)
    cores: list[str] | None = Field(None, max_length=16)
    scope_mode: str | None = Field(None, max_length=20)
    is_admin: bool | None = None


class UserBody(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=256)
    role_id: int
    display_name: str = Field("", max_length=100)
    is_active: bool = True
    branches: list[str] = Field(default_factory=list, max_length=500)
    supervisors: list[str] = Field(default_factory=list, max_length=2000)


class UserPatch(BaseModel):
    display_name: str | None = Field(None, max_length=100)
    role_id: int | None = None
    is_active: bool | None = None
    branches: list[str] | None = Field(None, max_length=500)
    supervisors: list[str] | None = Field(None, max_length=2000)


class PasswordBody(BaseModel):
    password: str = Field(max_length=256)


class OwnPasswordBody(BaseModel):
    current_password: str = Field(max_length=256)
    new_password: str = Field(max_length=256)


def _clean(values: list[str], allowed: tuple | None, what: str) -> list[str]:
    out = []
    for v in values:
        v = v.strip()
        if not v or len(v) > 200:
            raise HTTPException(400, f"{what} نامعتبر است")
        if allowed is not None and v not in allowed:
            raise HTTPException(400, f"{what} ناشناخته: {v}")
        if v not in out:
            out.append(v)
    return out


def _role_fields(pages, cores, scope_mode, is_admin) -> dict:
    if scope_mode not in rbac.SCOPE_MODES:
        raise HTTPException(400, "حوزهٔ دسترسی نامعتبر است")
    out = {"pages": _clean(pages, rbac.PAGES, "صفحه"), "cores": _clean(cores, tuple(CORES), "هسته"),
           "scope_mode": scope_mode, "is_admin": bool(is_admin)}
    if not out["is_admin"] and not (out["pages"] and out["cores"]):
        raise HTTPException(400, "نقش غیرمدیر باید دست‌کم یک صفحه و یک هسته داشته باشد")
    return out


def _scope_values() -> tuple[list[str], list[tuple[str, str]]]:
    """Branch names and (branch, supervisor) pairs that exist in the sales, target and returns data."""
    if not DB_PATH.exists():
        return [], []
    con = connect_sales(read_only=True)
    try:
        tables = {r[0] for r in con.execute("SELECT table_name FROM information_schema.tables").fetchall()}
        parts = [f"SELECT branch, supervisor FROM {t}" for t in ("fact_sales", "fact_returns", "fact_target") if t in tables]
        if not parts:
            return [], []
        rows = con.execute(f"SELECT DISTINCT branch, supervisor FROM ({' UNION ALL '.join(parts)}) "
                           "WHERE branch IS NOT NULL OR supervisor IS NOT NULL").fetchall()
    finally:
        con.close()
    branches = sorted({r[0] for r in rows if r[0]})
    pairs = sorted({(r[0] or "", r[1]) for r in rows if r[1]})
    return branches, pairs


def _scope_lists(mode: str, branches: list[str], supervisors: list[str]) -> tuple[list[str], list[str]]:
    """Validate a user's assignment against the data and keep only the list the role's mode uses. The stored names are the
    exact spellings in the data, because queries compare them verbatim."""
    known_b, pairs = _scope_values()
    known_s = {s for _, s in pairs}
    if mode == "branch":
        out = _clean(branches, tuple(known_b) if known_b else None, "شعبه")
        return out, []
    if mode == "supervisor":
        return [], _clean(supervisors, tuple(known_s) if known_s else None, "سرپرست")
    return [], []


def _password(pw: str) -> str:
    if len(pw) < rbac.MIN_PASSWORD:
        raise HTTPException(400, f"رمز عبور دست‌کم {rbac.MIN_PASSWORD} نویسه باشد")
    return auth.hash_password(pw)


def _ip(request: Request) -> str:
    return request.client.host if request.client else ""


def _actor() -> str:
    return rbac.require().user


def _active_admins(con: sqlite3.Connection) -> int:
    return con.execute("""SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
                          WHERE u.is_active = 1 AND r.is_admin = 1""").fetchone()[0]


class _Tx:
    """One write transaction: serialised, committed on success, rolled back on any error, never leaves an admin-less store."""

    def __enter__(self):
        rbac.write_lock.acquire()
        try:
            self.con = rbac.connect(create=True)
            self.con.execute("BEGIN IMMEDIATE")
            self.before = _active_admins(self.con)
        except BaseException:
            rbac.write_lock.release()
            raise
        return self.con

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is None and self.before > 0 and _active_admins(self.con) == 0:
                self.con.execute("ROLLBACK")
                raise HTTPException(409, "حداقل یک مدیر فعال باید باقی بماند")
            self.con.execute("COMMIT" if exc_type is None else "ROLLBACK")
        finally:
            self.con.close()
            rbac.write_lock.release()
        return False


def _unique(fn):
    """Run a write and turn a UNIQUE violation into 409."""
    try:
        return fn()
    except sqlite3.IntegrityError as e:
        raise HTTPException(409, "این مقدار تکراری است") from e


def _user_dict(row: sqlite3.Row) -> dict:
    return {"id": row["id"], "username": row["username"], "display_name": row["display_name"], "role_id": row["role_id"],
            "role": row["role_name"], "is_admin": bool(row["role_is_admin"]), "is_active": bool(row["is_active"]),
            "scope_mode": row["role_scope_mode"], "branches": json.loads(row["branches"]),
            "supervisors": json.loads(row["supervisors"]),
            "created_at": row["created_at"], "updated_at": row["updated_at"], "last_login_at": row["last_login_at"]}


_USER_SQL = """SELECT u.*, r.name AS role_name, r.is_admin AS role_is_admin, r.scope_mode AS role_scope_mode FROM users u
               JOIN roles r ON r.id = u.role_id"""


def _get_user(con, user_id: int) -> sqlite3.Row:
    row = con.execute(f"{_USER_SQL} WHERE u.id=?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "کاربر یافت نشد")
    return row


def _get_role(con, role_id: int) -> sqlite3.Row:
    row = con.execute("SELECT * FROM roles WHERE id=?", (role_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "نقش یافت نشد")
    return row


def _read(sql: str, args=()) -> list[sqlite3.Row]:
    con = rbac.connect()
    if con is None:
        return []
    with closing(con):
        return con.execute(sql, args).fetchall()


# ---------- options ----------

@router.get("/options")
def options():
    """What a role or user can be given: page ids, cores, scope modes and (when the data exists) branches and supervisors."""
    branches, pairs = _scope_values()
    return {"pages": list(rbac.PAGES), "cores": CORES, "scope_modes": list(rbac.SCOPE_MODES), "branches": branches,
            "supervisors": [{"name": s, "branch": b} for b, s in pairs]}


# ---------- roles ----------

@router.get("/roles")
def list_roles():
    counts = {r[0]: r[1] for r in _read("SELECT role_id, COUNT(*) FROM users GROUP BY 1")}
    return [{**rbac.role_dict(r), "user_count": counts.get(r["id"], 0)} for r in _read("SELECT * FROM roles ORDER BY id")]


@router.post("/roles", status_code=201)
def create_role(body: RoleBody, request: Request):
    fields = _role_fields(body.pages, body.cores, body.scope_mode, body.is_admin)
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(400, "نام نقش کوتاه است")
    now = rbac.now_iso()

    def write():
        with _Tx() as con:
            cur = con.execute(
                "INSERT INTO roles(name, description, pages, cores, scope_mode, is_admin, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?,?,?)",
                (name, body.description.strip(), json.dumps(fields["pages"]), json.dumps(fields["cores"]),
                 fields["scope_mode"], int(fields["is_admin"]), now, now))
            rbac.audit_row(con, _actor(), "role.create", "role", name, {"role_id": cur.lastrowid, **fields}, _ip(request))
            return rbac.role_dict(_get_role(con, cur.lastrowid))
    return _unique(write)


@router.patch("/roles/{role_id}")
def update_role(role_id: int, body: RolePatch, request: Request):
    def write():
        with _Tx() as con:
            cur = rbac.role_dict(_get_role(con, role_id))
            merged = {k: (getattr(body, k) if getattr(body, k) is not None else cur[k])
                      for k in ("pages", "cores", "scope_mode", "is_admin")}
            fields = _role_fields(**merged)
            if fields["scope_mode"] != cur["scope_mode"]:
                held = con.execute("SELECT COUNT(*) FROM users WHERE role_id=?", (role_id,)).fetchone()[0]
                if held:
                    raise HTTPException(409, f"حوزهٔ دسترسی نقشی که به {held} کاربر داده شده تغییر نمی‌کند؛ نقش تازه بسازید")
            name = (body.name.strip() if body.name is not None else cur["name"])
            desc = body.description.strip() if body.description is not None else cur["description"]
            if len(name) < 2:
                raise HTTPException(400, "نام نقش کوتاه است")
            con.execute("UPDATE roles SET name=?, description=?, pages=?, cores=?, scope_mode=?, is_admin=?, updated_at=? "
                        "WHERE id=?", (name, desc, json.dumps(fields["pages"]), json.dumps(fields["cores"]),
                                       fields["scope_mode"], int(fields["is_admin"]), rbac.now_iso(), role_id))
            changed = {k: v for k, v in {"name": name, "description": desc, **fields}.items() if cur[k] != v}
            rbac.audit_row(con, _actor(), "role.update", "role", name, {"role_id": role_id, "changed": changed}, _ip(request))
            return rbac.role_dict(_get_role(con, role_id))
    return _unique(write)


_SCOPED_PAGES = [p for p in rbac.PAGES if p != "health"]
DEFAULT_ROLES = (
    ("مدیرعامل", "دسترسی به همهٔ گزارش‌ها و هسته‌ها", list(rbac.PAGES), "all"),
    ("معاونت فروش", "دسترسی به همهٔ گزارش‌ها و هسته‌ها", list(rbac.PAGES), "all"),
    ("مدیر شعبه", "گزارش‌های شعبه‌های واگذارشده", _SCOPED_PAGES, "branch"),
    ("سرپرست شعبه", "گزارش‌های سرپرست‌های زیرمجموعه", _SCOPED_PAGES, "supervisor"),
)


@router.post("/roles/defaults")
def create_default_roles(request: Request):
    """Create the four standard business roles that do not exist yet. Full-report roles are not admins."""
    now, created = rbac.now_iso(), []
    with _Tx() as con:
        for name, desc, pages, mode in DEFAULT_ROLES:
            if con.execute("SELECT 1 FROM roles WHERE name=?", (name,)).fetchone():
                continue
            con.execute("INSERT INTO roles(name, description, pages, cores, scope_mode, is_admin, created_at, updated_at) "
                        "VALUES (?,?,?,?,?,0,?,?)", (name, desc, json.dumps(pages), json.dumps(list(CORES)), mode, now, now))
            created.append(name)
        if created:
            rbac.audit_row(con, _actor(), "role.defaults", "role", "defaults", {"created": created}, _ip(request))
    return {"created": created}


@router.delete("/roles/{role_id}")
def delete_role(role_id: int, request: Request):
    with _Tx() as con:
        role = _get_role(con, role_id)
        users = con.execute("SELECT COUNT(*) FROM users WHERE role_id=?", (role_id,)).fetchone()[0]
        if users:
            raise HTTPException(409, f"این نقش به {users} کاربر داده شده و حذف نمی‌شود")
        con.execute("DELETE FROM roles WHERE id=?", (role_id,))
        rbac.audit_row(con, _actor(), "role.delete", "role", role["name"], {"role_id": role_id}, _ip(request))
    return {"ok": True}


# ---------- users ----------

@router.get("/users")
def list_users():
    return [_user_dict(r) for r in _read(f"{_USER_SQL} ORDER BY u.id")]


@router.post("/users", status_code=201)
def create_user(body: UserBody, request: Request):
    username = body.username.strip()
    if not rbac.USERNAME_RE.fullmatch(username):
        raise HTTPException(400, "نام کاربری باید ۳ تا ۶۴ نویسهٔ انگلیسی، عدد، نقطه، خط تیره یا @ باشد")
    if username.lower() == auth.username().lower():
        raise HTTPException(409, "این نام کاربری برای مدیر ارشد رزرو است")
    pw_hash = _password(body.password)
    now = rbac.now_iso()

    def write():
        with _Tx() as con:
            mode = _get_role(con, body.role_id)["scope_mode"]
            branches, supervisors = _scope_lists(mode, body.branches, body.supervisors)
            cur = con.execute(
                "INSERT INTO users(username, display_name, password_hash, role_id, is_active, branches, supervisors, "
                "created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (username, body.display_name.strip(), pw_hash, body.role_id, int(body.is_active),
                 json.dumps(branches, ensure_ascii=False), json.dumps(supervisors, ensure_ascii=False), now, now))
            rbac.audit_row(con, _actor(), "user.create", "user", username,
                           {"user_id": cur.lastrowid, "role_id": body.role_id, "is_active": body.is_active,
                            "branches": branches, "supervisors": supervisors}, _ip(request))
            return _user_dict(_get_user(con, cur.lastrowid))
    return _unique(write)


@router.patch("/users/{user_id}")
def update_user(user_id: int, body: UserPatch, request: Request):
    with _Tx() as con:
        cur = _get_user(con, user_id)
        role_id = cur["role_id"] if body.role_id is None else body.role_id
        mode = _get_role(con, role_id)["scope_mode"]
        active = cur["is_active"] if body.is_active is None else int(body.is_active)
        name = cur["display_name"] if body.display_name is None else body.display_name.strip()
        old_b, old_s = json.loads(cur["branches"]), json.loads(cur["supervisors"])
        # Assignments sent now are checked against the data; untouched ones are kept, but only the list the role's mode uses.
        if body.branches is None and body.supervisors is None:
            branches = old_b if mode == "branch" else []
            supervisors = old_s if mode == "supervisor" else []
        else:
            branches, supervisors = _scope_lists(mode, old_b if body.branches is None else body.branches,
                                                 old_s if body.supervisors is None else body.supervisors)
        # Deactivating ends the user's open sessions at once.
        bump = 1 if cur["is_active"] and not active else 0
        con.execute("UPDATE users SET display_name=?, role_id=?, is_active=?, branches=?, supervisors=?, "
                    "token_version=token_version+?, updated_at=? WHERE id=?",
                    (name, role_id, active, json.dumps(branches, ensure_ascii=False),
                     json.dumps(supervisors, ensure_ascii=False), bump, rbac.now_iso(), user_id))
        old = {"display_name": cur["display_name"], "role_id": cur["role_id"], "is_active": bool(cur["is_active"]),
               "branches": old_b, "supervisors": old_s}
        new = {"display_name": name, "role_id": role_id, "is_active": bool(active), "branches": branches,
               "supervisors": supervisors}
        changed = {k: v for k, v in new.items() if v != old[k]}
        rbac.audit_row(con, _actor(), "user.update", "user", cur["username"], {"user_id": user_id, "changed": changed},
                       _ip(request))
        return _user_dict(_get_user(con, user_id))


@router.post("/users/{user_id}/deactivate")
def deactivate_user(user_id: int, request: Request):
    with _Tx() as con:
        cur = _get_user(con, user_id)
        con.execute("UPDATE users SET is_active=0, token_version=token_version+1, updated_at=? WHERE id=?",
                    (rbac.now_iso(), user_id))
        rbac.audit_row(con, _actor(), "user.deactivate", "user", cur["username"], {"user_id": user_id}, _ip(request))
        return _user_dict(_get_user(con, user_id))


@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: int, body: PasswordBody, request: Request):
    pw_hash = _password(body.password)
    with _Tx() as con:
        cur = _get_user(con, user_id)
        # Bumping token_version signs the user out everywhere; the password itself is never logged.
        con.execute("UPDATE users SET password_hash=?, token_version=token_version+1, updated_at=? WHERE id=?",
                    (pw_hash, rbac.now_iso(), user_id))
        rbac.audit_row(con, _actor(), "user.reset_password", "user", cur["username"], {"user_id": user_id}, _ip(request))
    return {"ok": True}


@router.post("/me/password")
def change_own_password(body: OwnPasswordBody, request: Request):
    """The signed-in account changes its own password. Only accounts in the users table can; the built-in
    env login has no row and is changed in its config instead."""
    actor = rbac.require()
    if rbac._is_env_user(actor.user):
        raise HTTPException(403, "این حساب از تنظیمات ورود است؛ رمز آن در فایل تنظیمات تغییر می‌کند")
    new_hash = _password(body.new_password)
    with _Tx() as con:
        cur = con.execute("SELECT * FROM users WHERE username=?", (actor.user,)).fetchone()
        if cur is None:
            raise HTTPException(404, "کاربر پیدا نشد")
        if not auth.verify_password(body.current_password, cur["password_hash"]):
            raise HTTPException(400, "رمز فعلی درست نیست")
        con.execute("UPDATE users SET password_hash=?, token_version=token_version+1, updated_at=? WHERE id=?",
                    (new_hash, rbac.now_iso(), cur["id"]))
        rbac.audit_row(con, actor.user, "user.change_own_password", "user", cur["username"], {"user_id": cur["id"]}, _ip(request))
    return {"ok": True, "signed_out_elsewhere": True}


# ---------- audit ----------

@router.get("/audit")
def audit_log(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), actor: str | None = None,
              action: str | None = None):
    where, args = "WHERE 1=1", []
    for col, val in (("actor", actor), ("action", action)):
        if val:
            where += f" AND {col}=?"
            args.append(val)
    count = (_read(f"SELECT COUNT(*) FROM audit_log {where}", args) or [(0,)])[0][0]
    rows = _read(f"SELECT * FROM audit_log {where} ORDER BY id DESC LIMIT ? OFFSET ?", [*args, limit, offset])
    return {"count": count, "limit": limit, "offset": offset,
            "rows": [{"id": r["id"], "ts": r["ts"], "actor": r["actor"], "action": r["action"],
                      "target_type": r["target_type"], "target": r["target"], "detail": json.loads(r["detail"]),
                      "ip": r["ip"]} for r in rows]}
