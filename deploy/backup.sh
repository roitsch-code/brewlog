#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/brewlog_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

# Dump from running postgres container
docker exec brewlog-postgres-1 pg_dump -U brewlog brewlog | gzip > "$BACKUP_FILE"

# Upload to Storage Box via rclone (configure rclone remote named 'storagebox' once)
rclone copy "$BACKUP_FILE" storagebox:backups/

# Remove local temp file
rm -f "$BACKUP_FILE"

# Prune old backups on Storage Box
rclone delete storagebox:backups/ --min-age "${RETENTION_DAYS}d"

echo "Backup completed: brewlog_${TIMESTAMP}.sql.gz"
