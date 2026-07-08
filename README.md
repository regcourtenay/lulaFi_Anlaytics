# lulaFi Analytics — Raspberry Pi 5 POC (v1.1, ClickHouse)

A self-contained, Dockerised proof-of-concept of the **lulaFi Analytics** capability
described in **LULAFI-SDD-ANL-001, v1.1 (Second Circulation)**. It runs entirely
offline on a Raspberry Pi 5 (arm64) with a single command, seeds **2 months** of
analytics data, and lets you sign in as the accounts from the supplied user list
to explore provider- and admin-scoped dashboards.

> One Platform. One Experience. No Repetition.

## What changed in v1.1

SDD v1.1 re-platforms the analytics store to a **dual-store architecture**:

- **ClickHouse is the analytics data plane** — raw event facts, hourly/daily
  aggregate tables and KPI snapshots (`analytics_events_raw`,
  `analytics_metrics_hourly`, `analytics_metrics_daily`, `analytics_metric_snapshots`).
- **MongoDB is the control plane** — governed metric definitions, saved views,
  export jobs, schedules, alert rules, data-quality runs and audit — plus the
  operational data (users, provider realms, forms).

This POC implements that split. The metric engine now compiles approved
calculation templates into **parameterised ClickHouse SQL** (`count`,
`uniqExact`, `sum`, `quantileExact`, grouped breakdowns, time-series) and selects
a query plan — KPI snapshots for card values, bounded raw-event queries for
time-series/breakdown/drill (SDD v1.1 §11, §14, §18.5). The Portal API contract
is unchanged, so the React/MUI portal is the same.

> Single-node adaptation: the SDD DDL uses `ReplicatedMergeTree` on a
> replicated/managed cluster for production (§20.4). For a single Pi node this POC
> uses `MergeTree` (the SDD's documented development topology). The event-table
> columns, partitioning, ordering keys and TTL match the SDD.

## What this POC is (and isn't)

The three shipped repositories depend on **private `@hubnet-systems` npm packages**
and external services (Authentik OIDC, AWS, Meilisearch, OneSignal, XMPP, hosted
AI), so they can't be built offline. This POC is a **fresh implementation of the
v1.1 Analytics design**, reusing the same data shapes, routes, theme and
governance model.

| Area | This POC | Production design (SDD v1.1) |
|------|----------|------------------------------|
| Analytics data plane | ClickHouse (single-node MergeTree) | ClickHouse (ReplicatedMergeTree, managed/replicated) |
| Control plane + operational | MongoDB 7 | MongoDB |
| Auth | Local passphrase → JWT | Authentik / OIDC bearer (§16) |
| Portal | React 18 + MUI 5 + Recharts | React + MUI + RTK Query |
| Stream coordination | In-process ingestion | Redis consumer groups + workers |

## Quick start (Raspberry Pi 5)

Requires Docker Engine + the Compose plugin (see `INSTALL.md`). **8 GB Pi 5
recommended** (ClickHouse + MongoDB); 4 GB works with the bundled low-resource
ClickHouse config.

```bash
unzip analytics-v5.zip
cd analytics
docker compose up -d --build
```

First boot builds the images, starts MongoDB + ClickHouse, bootstraps the
ClickHouse schema, and the API **seeds ~2 months of data on its own** (watch with
`docker compose logs -f api`). When the API health check is green, open:

```
http://<your-pi-ip>:8202
```

Click any account on the login screen to sign straight in.

To stop: `docker compose down`  ·  To wipe data and re-seed: `docker compose down -v`.

## Seeded login accounts (from the supplied user list)

| Logon | Passphrase | Seeded state | What you'll see |
|-------|-----------|--------------|-----------------|
| `admin` | amber falcon rides the midnight tide | Administrator / super user | Full Global Admin analytics + all governance |
| `operator` | quiet baobab guards the winter road | Take-on operator | Global overview, platform reliability, data quality |
| `approver` | silver protea opens at first light | Approver / overrides | Admin + provider-detail drill, metric catalogue, sensitive detail |
| `thabo.mokoena` | green kudu jumps over seven hills | Active provider | Kudu Health Services — full provider analytics |
| `ansie.vdm` | rooibos harvest waits for morning mist | Active provider | Rooibos Wellness Co — full provider analytics |
| `priya.naidoo` | cardamom clouds drift over durban bay | Active provider | Cardamom Financial — full provider analytics |
| `sipho.dlamini` | copper pipes sing when water runs | Active provider | Copperworks Utilities — full provider analytics |
| `charlotte.baloyi` | paper lanterns light the limpopo sky | Active provider | Limpopo Lanterns — full provider analytics |

All five provider accounts are active and seeded with 2 months of data, so every
login shows a populated dashboard. The seed also creates ~12 additional active
provider realms, so the global cohort, ranking, platform and data-quality views are
rich.

See `docs/ARCHITECTURE.md` for the design-to-code mapping and `docs/API.md` for
the endpoint catalogue.

## Services

| Container | Image | Port | Role |
|-----------|-------|------|------|
| `lulafi-analytics-mongo` | mongo:7.0 | 127.0.0.1:27017 | Control plane + operational data |
| `lulafi-analytics-clickhouse` | clickhouse/clickhouse-server:24.8 | 127.0.0.1:8123 | Analytics data plane |
| `lulafi-analytics-api` | built from `./api` | 127.0.0.1:4000 | Analytics API + CH bootstrap + self-seed |
| `lulafi-analytics-portal` | built from `./portal` | `:8202` | React/MUI SPA (nginx, proxies `/api`) |

All base images are multi-arch and run natively on the Pi 5 (arm64/v8).

> **Hardware:** MongoDB 7 and ClickHouse both require ARMv8.2-A. The Pi **5**
> (Cortex-A76) meets this; the Pi 4 does not. Use a 64-bit OS.
