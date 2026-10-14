"""Login for the dashboard: scrypt-hashed password, HMAC-signed session cookie, brute-force lockout.

Credentials come from the environment (never from the repository):
  SR_AUTH_USER       login name (default: admin)
  SR_AUTH_PASS_HASH  output of `python -m app.auth hash`
  SR_AUTH_SECRET     random string, >= 32 chars, signs session cookies
If the hash or secret is missing, nothing can log in (fail closed).
"""
from __future__ import annotations

import base64
import getpass
import hashlib
import hmac
import os
import secrets
import sys
import time

COOKIE = "sr_session"
SESSION_SECONDS = 12 * 3600
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1
MIN_SECRET = 32


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32)
    return f"scrypt:{SCRYPT_N}:{SCRYPT_R}:{SCRYPT_P}:{_b64(salt)}:{_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, want = stored.split(":")
        if scheme != "scrypt":
            return False
        got = hashlib.scrypt(password.encode(), salt=_unb64(salt), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(got, _unb64(want))
    except (ValueError, TypeError):
        return False


def username() -> str:
    return os.environ.get("SR_AUTH_USER", "admin")


def pass_hash() -> str:
    return os.environ.get("SR_AUTH_PASS_HASH", "")


def secret() -> str:
    return os.environ.get("SR_AUTH_SECRET", "")


def configured() -> bool:
    return bool(pass_hash()) and len(secret()) >= MIN_SECRET


def check_login(user: str, password: str) -> bool:
    """Always runs the password hash so timing does not reveal whether the user name was right."""
    stored = pass_hash() or hash_password("")
    password_ok = verify_password(password, stored)
    user_ok = hmac.compare_digest(user.encode(), username().encode())
    return configured() and user_ok and password_ok


def _sign(payload: str) -> str:
    return _b64(hmac.new(secret().encode(), payload.encode(), hashlib.sha256).digest())


def make_token(user: str, now: float | None = None) -> str:
    payload = _b64(f"{user}|{int((now or time.time()) + SESSION_SECONDS)}".encode())
    return f"{payload}.{_sign(payload)}"


def verify_token(token: str | None, now: float | None = None) -> str | None:
    if not token or not configured() or token.count(".") != 1:
        return None
    payload, sig = token.split(".")
    if not hmac.compare_digest(sig.encode(), _sign(payload).encode()):
        return None
    try:
        user, exp = _unb64(payload).decode().rsplit("|", 1)
        if int(exp) < (now or time.time()):
            return None
    except (ValueError, UnicodeDecodeError):
        return None
    return user if hmac.compare_digest(user.encode(), username().encode()) else None


class LoginLimiter:
    """Blocks an address for `lock` seconds after `limit` failed logins within that window."""

    def __init__(self, limit: int = 5, lock: int = 900):
        self.limit, self.lock = limit, lock
        self.failures: dict[str, list[float]] = {}

    def _recent(self, key: str, now: float) -> list[float]:
        recent = [t for t in self.failures.get(key, []) if now - t < self.lock]
        self.failures[key] = recent
        return recent

    def blocked(self, key: str, now: float | None = None) -> bool:
        return len(self._recent(key, now or time.time())) >= self.limit

    def fail(self, key: str, now: float | None = None) -> None:
        now = now or time.time()
        self._recent(key, now).append(now)

    def ok(self, key: str) -> None:
        self.failures.pop(key, None)


if __name__ == "__main__":
    if sys.argv[1:] == ["hash"]:
        pw = sys.stdin.readline().rstrip("\n") if not sys.stdin.isatty() else getpass.getpass("Password: ")
        if not pw:
            sys.exit("empty password")
        print(hash_password(pw))
    elif sys.argv[1:] == ["secret"]:
        print(secrets.token_hex(32))
    else:
        sys.exit("usage: python -m app.auth hash|secret")
