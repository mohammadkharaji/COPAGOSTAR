"""Support tickets: any signed-in user opens tickets and replies; admins see all and answer. Stored in accounts.sqlite."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from . import rbac

router = APIRouter(prefix="/api/tickets")


class NewTicket(BaseModel):
    subject: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=1, max_length=4000)


class Reply(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


def _is_admin(p: rbac.Principal) -> bool:
    return bool(p.is_admin or p.superadmin)


def _user_id(con, username: str) -> int | None:
    row = con.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
    return row[0] if row else None


def _ticket(con, ticket_id: int) -> dict:
    t = con.execute(
        "SELECT t.id, t.subject, t.status, t.created_at, t.updated_at, u.username FROM tickets t "
        "LEFT JOIN users u ON u.id = t.user_id WHERE t.id=?", (ticket_id,)).fetchone()
    if t is None:
        raise HTTPException(404, "تیکت پیدا نشد")
    msgs = con.execute(
        "SELECT author, is_admin, body, created_at FROM ticket_messages WHERE ticket_id=? ORDER BY id", (ticket_id,)).fetchall()
    return {"id": t[0], "subject": t[1], "status": t[2], "created_at": t[3], "updated_at": t[4], "owner": t[5],
            "messages": [{"author": m[0], "is_admin": bool(m[1]), "body": m[2], "created_at": m[3]} for m in msgs]}


def _check_owner(p: rbac.Principal, owner: str | None) -> None:
    if not _is_admin(p) and owner != p.user:
        raise HTTPException(404, "تیکت پیدا نشد")


@router.get("")
def list_tickets(request: Request):
    p = rbac.require()
    con = rbac.connect()
    try:
        if con is None:
            return {"tickets": []}
        if _is_admin(p):
            rows = con.execute("SELECT t.id, t.subject, t.status, t.updated_at, u.username FROM tickets t "
                               "LEFT JOIN users u ON u.id=t.user_id ORDER BY t.updated_at DESC LIMIT 500").fetchall()
        else:
            rows = con.execute("SELECT t.id, t.subject, t.status, t.updated_at, u.username FROM tickets t "
                               "JOIN users u ON u.id=t.user_id WHERE u.username=? ORDER BY t.updated_at DESC",
                               (p.user,)).fetchall()
    finally:
        con.close()
    return {"tickets": [{"id": r[0], "subject": r[1], "status": r[2], "updated_at": r[3], "owner": r[4]} for r in rows]}


@router.post("")
def open_ticket(body: NewTicket, request: Request):
    p = rbac.require()
    if rbac._is_env_user(p.user):
        raise HTTPException(403, "این حساب از تنظیمات ورود است و تیکت ندارد")
    with rbac.write_lock:
        con = rbac.connect(create=True)
        try:
            con.execute("BEGIN IMMEDIATE")
            uid = _user_id(con, p.user)
            if uid is None:
                raise HTTPException(403, "کاربر در فهرست حساب‌ها نیست")
            now = rbac.now_iso()
            cur = con.execute("INSERT INTO tickets(user_id, subject, status, created_at, updated_at) VALUES (?,?,?,?,?)",
                              (uid, body.subject.strip(), "open", now, now))
            tid = cur.lastrowid
            con.execute("INSERT INTO ticket_messages(ticket_id, author, is_admin, body, created_at) VALUES (?,?,?,?,?)",
                        (tid, p.user, 0, body.body.strip(), now))
            con.commit()
        except Exception:
            con.rollback()
            raise
        finally:
            con.close()
    return {"id": tid}


@router.get("/{ticket_id}")
def get_ticket(ticket_id: int):
    p = rbac.require()
    con = rbac.connect()
    try:
        if con is None:
            raise HTTPException(404, "تیکت پیدا نشد")
        t = _ticket(con, ticket_id)
    finally:
        con.close()
    _check_owner(p, t["owner"])
    return t


@router.post("/{ticket_id}/messages")
def reply(ticket_id: int, body: Reply):
    p = rbac.require()
    admin = _is_admin(p)
    with rbac.write_lock:
        con = rbac.connect(create=True)
        try:
            con.execute("BEGIN IMMEDIATE")
            t = _ticket(con, ticket_id)
            _check_owner(p, t["owner"])
            now = rbac.now_iso()
            con.execute("INSERT INTO ticket_messages(ticket_id, author, is_admin, body, created_at) VALUES (?,?,?,?,?)",
                        (ticket_id, p.user, 1 if admin else 0, body.body.strip(), now))
            status = "answered" if admin else "open"
            con.execute("UPDATE tickets SET status=?, updated_at=? WHERE id=?", (status, now, ticket_id))
            con.commit()
        except Exception:
            con.rollback()
            raise
        finally:
            con.close()
    return {"ok": True}
