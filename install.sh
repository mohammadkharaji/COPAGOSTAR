#!/usr/bin/env bash
# Installs or updates the SR sales dashboard on Ubuntu 22.04+ (re-running it updates in place).
#
#   sudo bash install.sh [--data /path/to/sr.duckdb] [--port 8000]
#
# Installs system packages, Node.js and uv if missing, copies the app to /opt/sr, builds the
# frontend, and starts two systemd services: sr-api (dashboard + API) and sr-sync (watches
# /opt/sr/data/raw for new sr_*.tsv extracts). Python itself is provided by uv.
set -euo pipefail

APP_DIR=/opt/sr
PORT=8000
DATA_FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --data) DATA_FILE="${2:?--data needs a file path}"; shift 2 ;;
    --port) PORT="${2:?--port needs a number}"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo bash install.sh" >&2; exit 1; }
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "--port must be a number" >&2; exit 1; }
[ -z "$DATA_FILE" ] || [ -f "$DATA_FILE" ] || { echo "Data file not found: $DATA_FILE" >&2; exit 1; }

SRC="$(cd "$(dirname "$0")" && pwd)"
[ -f "$SRC/backend/pyproject.toml" ] || { echo "Run this from the project folder (backend/ not found)." >&2; exit 1; }
[ -z "$DATA_FILE" ] || DATA_FILE="$(readlink -f "$DATA_FILE")"
cd /

echo "==> System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates rsync

node_ok() {
  command -v node >/dev/null 2>&1 &&
    [ "$(printf '20.19.0\n%s\n' "$(node -p 'process.versions.node')" | sort -V | head -n1)" = "20.19.0" ]
}
if ! node_ok; then
  echo "==> Node.js 22 (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "==> uv"
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UNMANAGED_INSTALL=1 sh
fi

echo "==> Service user and folders"
id sr >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin sr
mkdir -p "$APP_DIR" /var/lib/sr/python /var/cache/sr/uv /var/cache/sr/npm
systemctl stop sr-api sr-sync 2>/dev/null || true

echo "==> Copying application to $APP_DIR"
rsync -a --delete --exclude data --exclude node_modules --exclude .venv --exclude dist --exclude .git "$SRC"/ "$APP_DIR"/
mkdir -p "$APP_DIR/data/raw"
if [ -n "$DATA_FILE" ]; then
  echo "==> Installing database from $DATA_FILE"
  install -m 640 "$DATA_FILE" "$APP_DIR/data/sr.duckdb"
fi
chown -R sr:sr "$APP_DIR" /var/lib/sr /var/cache/sr

as_sr() {
  sudo -u sr env UV_CACHE_DIR=/var/cache/sr/uv UV_PYTHON_INSTALL_DIR=/var/lib/sr/python \
    npm_config_cache=/var/cache/sr/npm bash -c "$1"
}

echo "==> Backend dependencies"
as_sr "cd $APP_DIR/backend && uv sync --frozen --no-dev"

echo "==> Frontend build"
as_sr "cd $APP_DIR/frontend && npm ci --no-audit --no-fund && npm run build"

echo "==> systemd services (port $PORT)"
install -m 644 "$APP_DIR/deploy/sr-api.service" /etc/systemd/system/sr-api.service
install -m 644 "$APP_DIR/deploy/sr-sync.service" /etc/systemd/system/sr-sync.service
sed -i "s/--port 8000/--port $PORT/" /etc/systemd/system/sr-api.service
systemctl daemon-reload
systemctl enable sr-api sr-sync >/dev/null
systemctl restart sr-api sr-sync

echo "==> Health check"
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/meta" >/dev/null 2>&1; then
    echo "OK: http://<server-ip>:$PORT"
    [ -f "$APP_DIR/data/sr.duckdb" ] || echo "Note: no database yet. Put sr_*.tsv files in $APP_DIR/data/raw (sr-sync loads them) or re-run with --data."
    exit 0
  fi
  sleep 1
done
echo "API did not answer on port $PORT. See: journalctl -u sr-api -n 50" >&2
exit 1
