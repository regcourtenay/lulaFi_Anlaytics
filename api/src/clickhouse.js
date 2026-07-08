// ClickHouse analytics data plane (SDD v1.1 §13). Holds the raw event facts,
// hourly/daily aggregate tables and KPI snapshots. Single-node MergeTree for the
// POC; production uses ReplicatedMergeTree on a managed/replicated cluster (§20.4).
import { createClient } from "@clickhouse/client";

import { CONFIG } from "./config.js";

export const CH_DB = CONFIG.CLICKHOUSE_DB;

// Default database omitted so CREATE DATABASE works before the DB exists; every
// statement uses fully-qualified `lulafi_analytics.<table>` names.
export const ch = createClient({
  url: CONFIG.CLICKHOUSE_URL,
  username: CONFIG.CLICKHOUSE_USER,
  password: CONFIG.CLICKHOUSE_PASSWORD,
  clickhouse_settings: { async_insert: 1, wait_for_async_insert: 1 },
});

export async function chCommand(query) {
  await ch.command({ query });
}

export async function chQuery(query, query_params = {}) {
  const rs = await ch.query({ query, query_params, format: "JSONEachRow" });
  return rs.json();
}

// Insert raw event rows (JSONEachRow). Dimension values are coerced to strings
// (the Map value type is String); booleans/numbers become 'true'/'123'.
export async function chInsertEvents(rows) {
  if (!rows.length) return;
  await ch.insert({
    table: `${CH_DB}.analytics_events_raw`,
    values: rows,
    format: "JSONEachRow",
  });
}

export async function pingClickHouse() {
  const r = await chQuery("SELECT 1 AS ok");
  return r?.[0]?.ok === 1;
}

// 'YYYY-MM-DD HH:MM:SS.mmm' (UTC) for DateTime64(3,'UTC') columns.
export function chDateTime(d) {
  return new Date(d).toISOString().replace("T", " ").replace("Z", "");
}

// Canonical event -> ClickHouse raw row. Dimension values are coerced to strings.
export function toRawEventRow(e) {
  const dims = {};
  for (const [k, v] of Object.entries(e.dimensions || {})) {
    if (v === undefined || v === null) continue;
    dims[k] = String(v);
  }
  return {
    event_id: e.eventId,
    event_name: e.eventName,
    event_version: e.eventVersion ?? 1,
    occurred_at_utc: chDateTime(e.occurredAtUtc ? e.occurredAtUtc : new Date()),
    received_at_utc: chDateTime(new Date()),
    scope_type: e.scopeType || (e.providerRealmId ? "provider" : "platform"),
    provider_realm_id: e.providerRealmId ? String(e.providerRealmId) : "",
    actor_id_token: e.actorIdToken || "",
    actor_type: e.actorType || "end_user",
    session_id_token: e.sessionIdToken || "",
    source_component: e.sourceComponent || "api",
    environment: e.environment || "production",
    correlation_id: e.correlationId || "",
    entity_type: e.entity?.type || "",
    entity_id: e.entity?.id != null ? String(e.entity.id) : "",
    entity_version: e.entity?.version ?? 0,
    result: e.result || "n/a",
    duration_ms: Math.max(0, Math.round(e.durationMs ?? 0)),
    error_code: e.errorCode || "",
    dimensions: dims,
    processed_at_utc: chDateTime(new Date()),
  };
}

export async function chInsertRejections(rows) {
  if (!rows.length) return;
  await ch.insert({ table: `${CH_DB}.analytics_event_rejections`, values: rows, format: "JSONEachRow" });
}

const DDL = [
  `CREATE DATABASE IF NOT EXISTS ${CH_DB}`,

  // ---- Raw event facts (SDD v1.1 §13.2 / T38) ------------------------------
  `CREATE TABLE IF NOT EXISTS ${CH_DB}.analytics_events_raw
   (
     event_id String,
     event_name LowCardinality(String),
     event_version UInt16,
     occurred_at_utc DateTime64(3, 'UTC'),
     received_at_utc DateTime64(3, 'UTC'),
     scope_type Enum8('provider' = 1, 'platform' = 2),
     provider_realm_id String,
     actor_id_token String,
     actor_type LowCardinality(String),
     session_id_token String,
     source_component LowCardinality(String),
     environment LowCardinality(String),
     correlation_id String,
     entity_type LowCardinality(String),
     entity_id String,
     entity_version UInt32,
     result LowCardinality(String),
     duration_ms UInt64,
     error_code LowCardinality(String),
     dimensions Map(LowCardinality(String), String),
     processed_at_utc DateTime64(3, 'UTC')
   )
   ENGINE = MergeTree
   PARTITION BY (environment, toYYYYMM(occurred_at_utc))
   ORDER BY (environment, provider_realm_id, event_name, occurred_at_utc, entity_id, event_id)
   TTL toDateTime(occurred_at_utc) + INTERVAL 90 DAY DELETE
   SETTINGS index_granularity = 8192`,

  // ---- Rejected event metadata (SDD v1.1 §13.5) ----------------------------
  `CREATE TABLE IF NOT EXISTS ${CH_DB}.analytics_event_rejections
   (
     received_at_utc DateTime64(3, 'UTC'),
     event_name LowCardinality(String),
     reason LowCardinality(String),
     event_id String,
     source_component LowCardinality(String)
   )
   ENGINE = MergeTree
   PARTITION BY toYYYYMM(received_at_utc)
   ORDER BY (received_at_utc, event_name)
   TTL toDateTime(received_at_utc) + INTERVAL 30 DAY DELETE`,

  // ---- Hourly aggregate rollup (SDD v1.1 §13.4) ----------------------------
  `CREATE TABLE IF NOT EXISTS ${CH_DB}.analytics_metrics_hourly
   (
     environment LowCardinality(String),
     scope_type Enum8('provider' = 1, 'platform' = 2),
     provider_realm_id String,
     event_name LowCardinality(String),
     hour DateTime('UTC'),
     events UInt64,
     uniq_sessions UInt64,
     computed_at_utc DateTime64(3, 'UTC') DEFAULT now64(3)
   )
   ENGINE = MergeTree
   PARTITION BY (environment, toYYYYMM(hour))
   ORDER BY (environment, scope_type, provider_realm_id, event_name, hour)`,

  // ---- Daily aggregate rollup (SDD v1.1 §13.4) -----------------------------
  `CREATE TABLE IF NOT EXISTS ${CH_DB}.analytics_metrics_daily
   (
     environment LowCardinality(String),
     scope_type Enum8('provider' = 1, 'platform' = 2),
     provider_realm_id String,
     event_name LowCardinality(String),
     day Date,
     events UInt64,
     uniq_sessions UInt64,
     uniq_actors UInt64,
     computed_at_utc DateTime64(3, 'UTC') DEFAULT now64(3)
   )
   ENGINE = MergeTree
   PARTITION BY (environment, toYYYYMM(day))
   ORDER BY (environment, scope_type, provider_realm_id, event_name, day)`,

  // ---- KPI snapshots (SDD v1.1 §13.4 / T37) --------------------------------
  `CREATE TABLE IF NOT EXISTS ${CH_DB}.analytics_metric_snapshots
   (
     environment LowCardinality(String),
     scope_key String,
     scope_type Enum8('provider' = 1, 'platform' = 2),
     provider_realm_id String,
     metric_id LowCardinality(String),
     metric_version LowCardinality(String),
     bucket_start_utc DateTime64(3, 'UTC'),
     bucket_end_utc DateTime64(3, 'UTC'),
     time_zone LowCardinality(String),
     dimension_signature String,
     value Float64,
     numerator Float64,
     denominator Float64,
     coverage Float64,
     sample_count UInt64,
     quality LowCardinality(String),
     last_calculated_utc DateTime64(3, 'UTC') DEFAULT now64(3)
   )
   ENGINE = MergeTree
   PARTITION BY (environment, toYYYYMM(bucket_start_utc))
   ORDER BY (environment, scope_key, metric_id, metric_version, bucket_start_utc, dimension_signature)`,
];

export async function bootstrapClickHouse() {
  for (const stmt of DDL) {
    await chCommand(stmt);
  }
  // eslint-disable-next-line no-console
  console.log(`[clickhouse] schema ready in ${CH_DB}`);
}
