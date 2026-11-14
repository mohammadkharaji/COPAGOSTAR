"""One-time local login setup for the Windows dashboard.

Asks for a password (hidden), then writes auth.local.bat next to start-dashboard.bat with the password hash and a
random session secret. start-dashboard.bat loads that file. Nothing here is committed or sent anywhere.
"""
import getpass
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.auth import hash_password  # noqa: E402


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "auth.local.bat"
    user = "admin"
    pw = getpass.getpass(f"Password for user '{user}' (typing is hidden): ")
    if len(pw) < 8:
        print("Password must be at least 8 characters.")
        return 1
    if getpass.getpass("Repeat password: ") != pw:
        print("Passwords do not match.")
        return 1
    out.write_text(
        "@echo off\n"
        f'set "SR_AUTH_USER={user}"\n'
        f'set "SR_AUTH_PASS_HASH={hash_password(pw)}"\n'
        f'set "SR_AUTH_SECRET={secrets.token_hex(32)}"\n',
        encoding="ascii")
    print(f"Done. Login user: {user}. Saved to {out.name}; keep it private.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
