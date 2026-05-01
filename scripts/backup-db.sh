#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$(dirname "$SCRIPT_DIR")"
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="/tmp/brewlog-backup-${DATE}.sql.gz"

echo "[$(date)] Starting BrewLog database backup..."

# Dump and compress
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T postgres \
  pg_dump -U brewlog brewlog | gzip > "$BACKUP_FILE"

echo "[$(date)] Dump complete. Sending email..."

# Send via email
python3 "$SCRIPT_DIR/backup-email.py" "$BACKUP_FILE"

# Cleanup
rm "$BACKUP_FILE"

echo "[$(date)] Backup complete."
