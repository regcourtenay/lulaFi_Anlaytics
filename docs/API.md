# API reference (POC v1.1)

> Analytics reads/writes resolve against the **ClickHouse** data plane; metric
> definitions, saved views, jobs, schedules, alerts and audit live in the
> **MongoDB** control plane. The HTTP contract below is unchanged from v1.0.

Base URL: `/api/v1`. All `/analytics/*` routes require `Authorization: Bearer <token>`.

## Auth

| Method | Path | Notes |
|--------|------|-------|
| GET | `/auth/accounts` | List demo login accounts (no passphrases) |
| POST | `/auth/login` | Body `{ logon, passphrase }` -> `{ token, user }` |
| GET | `/auth/me` | Current resolved user/context |

## Analytics (SDD §15.2 / T45)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/analytics/context` | Resolved scope, permissions, modules, time zones, allowed filters |
| GET | `/analytics/overview` | Provider or global overview (cards, series, breakdown) |
| GET | `/analytics/forms` | Form funnel + performance |
| GET | `/analytics/forms/:formId` | Per-form drill-down (funnel, cards, breakdown) |
| GET | `/analytics/operations` | Workflow / backlog / SLA |
| GET | `/analytics/messaging` | Conversation & delivery |
| GET | `/analytics/notifications` | Delivery / open / action |
| GET | `/analytics/connectors` | Success / latency / usage |
| GET | `/analytics/advertising` | Viewability / CTR / conversions / revenue share |
| GET | `/analytics/platform` | Availability / latency / errors (needs `analytics.operations.view`) |
| GET | `/analytics/commercial` | Billed usage & revenue (global) |
| GET | `/analytics/providers` | Cohorts + provider ranking (needs `analytics.admin.view`) |
| GET | `/analytics/data-quality` | Freshness / completeness / reconciliation |
| GET | `/analytics/metrics/:id` | Single metric value + comparison |
| GET | `/analytics/metrics/:id/timeseries` | Bucketed series |
| GET | `/analytics/metrics/:id/breakdown` | Grouped values for one dimension |
| GET | `/analytics/drill` | Resolve a signed drill descriptor |
| GET / POST | `/analytics/metric-definitions` | Read catalogue / create draft (needs `analytics.metric.manage`) |
| GET / POST | `/analytics/saved-views` | List / create saved views |
| POST | `/analytics/exports` | Create export job (csv/xlsx/pdf) |
| GET | `/analytics/exports/:jobId` | Job status + short-lived download link |
| GET / POST | `/analytics/report-schedules` | Scheduled reports |
| GET / POST | `/analytics/alert-rules` | Threshold alerts |
| POST | `/analytics/events/batch` | Client/service event ingestion |
| POST | `/analytics/internal/events` | Internal service event ingestion |

## Common query parameters (SDD §15.3 / T46)

`preset` (`today|last_7_days|last_30_days|last_90_days|this_month`) or explicit
`start`/`end`; `timeZone` (IANA); `granularity` (`day|week|month`); `compare`
(`none|previous_period|prior_year`); `filters` (JSON of allow-listed dimensions);
`dimension`; `providerRealmId` (global users with `provider_detail` only).

## Examples

```bash
# Log in
TOKEN=$(curl -s localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"logon":"thabo.mokoena","passphrase":"green kudu jumps over seven hills"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# Provider overview, last 30 days, vs previous period
curl -s "localhost:4000/api/v1/analytics/overview?preset=last_30_days&compare=previous_period" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Filtered conversion breakdown (mobile only)
curl -s "localhost:4000/api/v1/analytics/forms?filters=%7B%22channel%22%3A%5B%22mobile%22%5D%7D" \
  -H "Authorization: Bearer $TOKEN"
```

## Standard responses

Metric values follow the SDD §15.4 envelope (now computed by parameterised ClickHouse SQL) (metric id/version, scope, period,
value, numerator/denominator, comparison, quality, coverage, applied filters,
drill). Errors follow RFC-7807 (`type`, `title`, `status`, `correlationId`);
unauthorised resource existence is never disclosed (SDD §15.1).
