# Installation — Raspberry Pi 5 (v1.1)

## 1. Prerequisites

- Raspberry Pi 5 running a **64-bit** OS (Raspberry Pi OS Bookworm 64-bit or Ubuntu 24.04 arm64).
- **8 GB model recommended** (ClickHouse + MongoDB run together). 4 GB works with the bundled low-resource ClickHouse config in `clickhouse/low-resource.xml`.
- ~4 GB free disk for images + data.
- Network access on first build only (to pull base images and packages). Runs fully offline afterwards.

## 2. Install Docker + Compose

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version
```

## 3. Deploy

```bash
unzip analytics-v5.zip
cd analytics
cp .env.example .env     # optional; safe defaults exist
docker compose up -d --build
```

Build takes ~8–15 minutes on a Pi 5 (npm installs, the portal Vite build and the
first ClickHouse image pull). Track progress:

```bash
docker compose logs -f api   # "[clickhouse] schema ready" then "[seed] ... complete"
docker compose ps            # all four services should become healthy
```

## 4. Open the portal

```
http://<your-pi-ip>:8202
```

Find the Pi's IP with `hostname -I`. Click any account to sign in.

## 5. Useful commands

| Action | Command |
|--------|---------|
| Stop | `docker compose down` |
| Stop + wipe data (re-seed next up) | `docker compose down -v` |
| API logs | `docker compose logs -f api` |
| ClickHouse SQL shell | `docker compose exec clickhouse clickhouse-client -u lulafi --password lulafi_ch_password` |
| Row counts | `... clickhouse-client -q "SELECT count() FROM lulafi_analytics.analytics_events_raw"` |
| Re-seed manually | `docker compose exec api npm run seed` |
| API health (both stores) | `curl http://localhost:4000/health` |

## 6. Configuration (optional)

Set in `.env` (all have safe defaults): `PORTAL_PORT` (8202), `MONGO_ROOT_USER/PASSWORD`,
`CLICKHOUSE_DB/USER/PASSWORD`, `JWT_SECRET`. API tuning in `docker-compose.yml`
(`api.environment`): `SEED_MONTHS` (2), `SEED_TIMEZONE`, `SEED_SCALE` (event
volume multiplier — lower to `0.5` for a faster first seed), `MIN_COHORT_DEFAULT`.

ClickHouse tuning lives in `clickhouse/low-resource.xml` (caps memory to 60% of
RAM by default) and is **baked into the ClickHouse image at build time** (so it is
not affected by host file permissions). After editing it, rebuild with
`docker compose build clickhouse && docker compose up -d`.

## 7. Troubleshooting

- **API "degraded" on `/health`** — check which store: the JSON reports `mongo` and `clickhouse` status. On first boot both take a minute; the API retries.
- **ClickHouse won't start** — check `docker compose logs clickhouse`. The tuning config is baked into the image (no bind mount), so host file permissions are not a factor. For very low-RAM boards lower `max_server_memory_usage_to_ram_ratio` in `clickhouse/low-resource.xml` then `docker compose build clickhouse`. Confirm 64-bit OS (`uname -m` → `aarch64`).
- **Seed slow** — event insert + aggregation runs once on first boot. Lower `SEED_SCALE` to `0.5` and `docker compose down -v && docker compose up -d`.
- **`exec format` errors** — 64-bit OS required. MongoDB 7 and ClickHouse both need the Pi 5 (ARMv8.2-A), not the Pi 4.
