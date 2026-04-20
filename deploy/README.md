# BrewLog — Hetzner Deployment Runbook

## Server details

- **VPS**: Hetzner CX33, Helsinki `hel1`, IP `89.167.31.219`
- **OS**: Ubuntu 24.04
- **Docker Compose** manages: `app`, `postgres`, `caddy`, `ofelia`

---

## First-time server setup

```bash
ssh root@89.167.31.219

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Install rclone (for backups)
curl https://rclone.org/install.sh | bash

# Clone repo
git clone https://github.com/roitsch-code/brewlog.git /opt/brewlog
cd /opt/brewlog
git checkout main

# Create .env from example
cp .env.example .env
nano .env  # fill in all values

# Configure rclone for Storage Box
rclone config
# → new remote named "storagebox" → SFTP → your storage box hostname + credentials

# Build and start
docker compose pull  # or: docker compose build
docker compose up -d

# Run DB migrations (first time only)
docker compose exec app node -e "
  const { pool } = require('./src/lib/db/client.js');
  const fs = require('fs');
  const sql = fs.readFileSync('./src/lib/db/migrations/0000_init.sql', 'utf8');
  pool.query(sql).then(() => { console.log('done'); pool.end(); });
"
```

---

## Deploy a new version

```bash
cd /opt/brewlog
git pull origin main
docker compose build app
docker compose up -d app
```

Or if using a pre-built image from GitHub Container Registry:

```bash
IMAGE_TAG=abc1234 docker compose pull app && docker compose up -d app
```

---

## Check logs

```bash
docker compose logs -f app        # Next.js app
docker compose logs -f postgres   # database
docker compose logs -f caddy      # TLS / proxy
docker compose logs -f ofelia     # cron jobs
```

---

## Restart a service

```bash
docker compose restart app
```

---

## Restore from backup

```bash
# List backups on Storage Box
rclone ls storagebox:backups/

# Download a backup
rclone copy storagebox:backups/brewlog_20250101_060000.sql.gz /tmp/

# Restore into running postgres
gunzip -c /tmp/brewlog_20250101_060000.sql.gz | \
  docker exec -i brewlog-postgres-1 psql -U brewlog brewlog
```

---

## Manual cron trigger

```bash
# Research cron
curl -X POST http://localhost:3000/api/research \
  -H "Authorization: Bearer $CRON_SECRET"

# Coffee compact cron
curl -X POST http://localhost:3000/api/coffees/compact \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Nightly backup cron (set up once on host)

```bash
crontab -e
# Add:
0 2 * * * /opt/brewlog/deploy/backup.sh >> /var/log/brewlog-backup.log 2>&1
```

---

## DNS cutover

1. In your domain registrar, set:
   - `A` record: `bettertastethansorry.com` → `89.167.31.219`
   - `AAAA` record: `bettertastethansorry.com` → VPS IPv6
   - TTL: 300
2. Caddy automatically issues a Let's Encrypt cert on first HTTPS hit.
3. Verify: `curl -I https://bettertastethansorry.com`
