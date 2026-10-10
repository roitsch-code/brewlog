#!/bin/bash
# Nightly Postgres backup → Hetzner Storage Box (rclone remote "storagebox").
#
# Runs from the host crontab (see deploy/README.md), so it executes whatever
# version of this file the VPS checkout carries — a merge to main changes it on
# the next deploy. Verified weekly by .github/workflows/backup-drill.yml, which
# lists the newest dumps, fails when the newest is older than 48 h, and
# restores it into a throwaway Postgres to count the rows.
#
# Hardening (2026-10-10):
#   • the container is resolved through docker compose (project dir = the repo),
#     not the hard-coded name "brewlog-postgres-1" — a compose project rename or
#     a sibling app on the same host (the #574 incident) can't silently point
#     this at the wrong database or at nothing.
#   • the dump is test-decompressed and size-checked BEFORE upload, so a
#     zero-byte or truncated file never overwrites a good night.
#   • retention 7 → 30 days: a backup failure that goes unnoticed for a week
#     used to leave nothing to restore.
#   • a state file records the last successful run for the drill/diagnostics.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/brewlog_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BREWLOG_BACKUP_RETENTION_DAYS:-30}"
STATE_FILE="${BREWLOG_BACKUP_STATE:-$HOME/.brewlog-backup.last}"
MIN_BYTES=10240   # a real dump of this DB is far larger; below this it is broken

cd "$REPO_DIR"

# Dump from the running postgres service (stdin closed: `exec -T` reads it).
docker compose exec -T postgres pg_dump -U brewlog brewlog </dev/null | gzip > "$BACKUP_FILE"

# Integrity before upload.
gzip -t "$BACKUP_FILE"
SIZE=$(stat -c %s "$BACKUP_FILE")
if [ "$SIZE" -lt "$MIN_BYTES" ]; then
  echo "Backup FAILED: dump is only ${SIZE} bytes" >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Upload to Storage Box via rclone (configure rclone remote named 'storagebox' once)
rclone copy "$BACKUP_FILE" storagebox:backups/

# Remove local temp file
rm -f "$BACKUP_FILE"

# Prune old backups on Storage Box
rclone delete storagebox:backups/ --min-age "${RETENTION_DAYS}d"

printf '%s brewlog_%s.sql.gz %s bytes\n' "$(date -Is)" "$TIMESTAMP" "$SIZE" > "$STATE_FILE"
echo "Backup completed: brewlog_${TIMESTAMP}.sql.gz (${SIZE} bytes)"
