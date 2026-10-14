#!/usr/bin/env bash
# Run as root on Ubuntu from the project folder:  sudo bash deploy/install.sh
# Needs: python3 (>=3.11), node (>=20.19) + npm, uv (https://docs.astral.sh/uv/).
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST=/opt/sr

id sr >/dev/null 2>&1 || useradd --system --home "$DEST" --shell /usr/sbin/nologin sr
mkdir -p "$DEST"
rsync -a --delete --exclude data --exclude node_modules --exclude .venv --exclude dist "$SRC"/ "$DEST"/
mkdir -p "$DEST/data/raw"
chown -R sr:sr "$DEST"

sudo -u sr bash -c "cd $DEST/backend && uv sync --frozen"
sudo -u sr bash -c "cd $DEST/frontend && npm ci && npm run build"

install -m 644 "$DEST/deploy/sr-api.service" /etc/systemd/system/sr-api.service
install -m 644 "$DEST/deploy/sr-sync.service" /etc/systemd/system/sr-sync.service
systemctl daemon-reload
systemctl enable --now sr-api sr-sync
echo "Dashboard: http://<server-ip>:8000  (put *.tsv extracts in $DEST/data/raw)"
