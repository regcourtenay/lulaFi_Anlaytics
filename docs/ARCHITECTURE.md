# Architecture & design-to-code mapping (v1.1)

This POC implements the Analytics design in **LULAFI-SDD-ANL-001 v1.1**, whose
headline change is a **dual-store architecture**: ClickHouse data plane + MongoDB
control plane.

## Runtime topology

```
 Browser -> portal (nginx :80) --/api--> api (Express :4000)
                                            |-> ClickHouse  (data plane: analytics_events_raw,
                                            |                 analytics_metrics_hourly/daily,
                                            |                 analytics_metric_snapshots, rejections)
                                            |-> MongoDB      (control plane: metric_definitions, saved_views,
                                            |                 export_jobs, report_schedules, alert_rules,
                                            |                 data_quality_runs, audit)
                                            \-> MongoDB      (operational: users, providers, forms)
```

In production the Event Gateway, Analytics Processor, Outbox Dispatcher and
Export/Schedule workers are separate containers coordinated via Redis (SDD v1.1
§23.1 / T69). For the POC they run in-process behind the API image (permitted at
low volume). Single node uses `MergeTree`; production uses `ReplicatedMergeTree`
on a managed/replicated cluster (§20.4).

## SDD v1.1 -> code

| SDD section | Design element | Code |
|-------------|----------------|------|
| §13.2 / T38 | ClickHouse raw event table DDL | `api/src/clickhouse.js` (`analytics_events_raw`) |
| §13.4 / T37 | Hourly/daily aggregate + KPI snapshot tables | `api/src/clickhouse.js`; populated in `seed/seed.js` |
| §13.5 / T40 | Partitioning, ORDER BY keys, TTL | `clickhouse.js` DDL |
| §13.3 | MongoDB metric-definition control plane | `models/analytics.js` (`MetricDefinition`) |
| §13.1 / T37 | MongoDB control-plane collections | `models/analytics.js` (views, jobs, schedules, alerts, DQ, audit) |
| §11 / §14 / §18.5 | MetricEngineService: compile templates to parameterised ClickHouse SQL; query-plan selection | `metrics/engine.js` |
| §12.4 / §17.1 | Event gateway: prohibited-field rejection, server-derived realm, ClickHouse insert | `routes/analytics.js` (`ingestEvents`), `clickhouse.js` (`toRawEventRow`) |
| §12.5 | Idempotent, duplicate-tolerant batch insert | `routes/analytics.js`, `clickhouse.js` |
| §14.3 | Time-zone bucketing, comparison, `no_baseline` | `lib/time.js`, `lib/query.js` |
| §14.4 | Percentiles via `quantileExact` | `metrics/engine.js` |
| §15.2 / T45 | Endpoint catalogue `/api/v1/analytics` | `routes/analytics.js` |
| §16.1 / §16.3 / T50 | Server-derived AnalyticsAccessContext, scope enforcement | `lib/auth.js`, `lib/query.js` |
| §17.3 / §17.4 | Minimum-cohort suppression; export formula neutralisation | `metrics/engine.js`, `lib/export.js` |
| §18.1 / §18.2 | Allow-listed filters (no SQL/operators); signed drill descriptor | `lib/query.js`, `routes/analytics.js` `/drill` |
| §21 | Data-quality reconciliation runs | `models/analytics.js`, `routes` `/data-quality` |
| §7–§10 | Left-nav launch, AnalyticsShell, filter bar, cards/charts/tables | `portal/src/*` (unchanged API contract) |

## Metric engine (ClickHouse SQL)

Each catalogue entry (`metrics/catalogue.js`) declares a `calculationType`
(`count | rate | ratio | percentile`), source event spec(s), dimensions and a
minimum-cohort threshold. `metrics/engine.js` compiles these into **parameterised**
ClickHouse SQL — never arbitrary expressions — using `{name:Type}` query
parameters for every value. Dimension keys are validated against an allow-list and
inlined; all values are bound parameters.

- **Card value** (`resolveMetricValue`): reads `analytics_metric_snapshots`
  (aggregate/snapshot fast path) when a snapshot exists for the metric+scope,
  else computes from raw events. Both use the same SQL primitives.
- **Time-series** (`resolveTimeseries`): one grouped `toStartOfInterval(...)`
  query per aggregate (rate = numerator + denominator queries combined).
- **Breakdown / drill** (`resolveBreakdown`): `GROUP BY dimensions['<dim>']`
  with per-group minimum-cohort suppression.
- **Aggregate tables** (`analytics_metrics_hourly/daily`): populated from raw via
  `INSERT ... SELECT` on seed (SDD §13.4 aggregate layer).

Column casting notes: `dimensions` is `Map(LowCardinality(String), String)`, so
booleans/numbers are stored as strings and cast in SQL (`toFloat64OrZero(dimensions['amount'])`).
`scope_type` is an `Enum8('provider','platform')` and `provider_realm_id` a
`String` (the Mongo realm id) — string equality, no ObjectId casting needed.

## Scope & security

- Provider users are locked to their realm; a provider client cannot supply or
  override `provider_realm_id` (server-derived on ingest and query).
- Global (vendor) users are aggregate (`scope_type='platform'`) unless they hold
  `analytics.admin.provider_detail` and select a named provider.
- Minimum-cohort suppression withholds values and export rows (§17.3). Sensitive
  drill-downs and exports are audited to the MongoDB control plane.

## Event taxonomy (seeded into ClickHouse)

`form.viewed/started/step_completed/submitted/abandoned`, `workflow.created/completed`,
`conversation.started`, `message.sent/delivered/failed/responded`,
`notification.sent/delivered/opened/actioned/failed`, `connector.call`,
`ad.impression/click/conversion`, `billing.usage`, `http.request` (platform).
