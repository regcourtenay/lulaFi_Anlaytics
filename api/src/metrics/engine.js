// Metric Engine (SDD v1.1 §11, §14, §18.5) — MetricEngineService.
// Compiles approved calculation templates into PARAMETERISED ClickHouse SQL and
// selects a query plan: KPI snapshots (aggregate/snapshot path) for card values,
// bounded raw-event queries for time-series, breakdown and drill detail.
// No arbitrary user expressions or SQL are ever executed.
import crypto from "node:crypto";

import { CH_DB, chQuery } from "../clickhouse.js";
import { dayBuckets } from "../lib/time.js";

export function scopeKey({ scopeType, providerRealmId, environment = "production" }) {
  const raw = `${scopeType}|${providerRealmId ?? "all"}|${environment}`;
  return crypto.createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

const SAFE_KEY = (k) => String(k).replace(/[^a-zA-Z0-9_]/g, "");
const dimKey = (k) => (String(k).startsWith("dimensions.") ? String(k).slice(11) : String(k));
function colFor(distinctBy) {
  if (distinctBy === "sessionIdToken") return "session_id_token";
  if (distinctBy === "actorIdToken") return "actor_id_token";
  return "session_id_token";
}
const GRAN_UNIT = { day: "DAY", week: "WEEK", month: "MONTH" };

// Build a parameterised WHERE for one numerator/denominator spec + scope + window.
function buildWhere(spec, ctx) {
  const clauses = [
    "environment = {env:String}",
    "event_name = {ev:String}",
    "occurred_at_utc >= fromUnixTimestamp64Milli({s:Int64})",
    "occurred_at_utc < fromUnixTimestamp64Milli({e:Int64})",
  ];
  const params = {
    env: ctx.environment || "production",
    ev: spec.eventName,
    s: String(ctx.startUtc.getTime()),
    e: String(ctx.endUtc.getTime()),
  };
  if (ctx.scopeType === "provider") {
    clauses.push("scope_type = 'provider'");
    clauses.push("provider_realm_id = {realm:String}");
    params.realm = String(ctx.providerRealmId);
  }
  // Global/admin scope aggregates across ALL provider realms plus the platform
  // stream: no scope_type/realm filter is applied. Each event_name belongs to a
  // single domain (e.g. form.* are provider events, http.request is platform),
  // so there is no cross-contamination.
  if (spec.result) { clauses.push("result = {res:String}"); params.res = spec.result; }
  if (spec.where) {
    let i = 0;
    for (const [k, v] of Object.entries(spec.where)) {
      const p = `w${i++}`;
      clauses.push(`dimensions['${SAFE_KEY(dimKey(k))}'] = {${p}:String}`);
      params[p] = String(v);
    }
  }
  if (ctx.filters) {
    let i = 0;
    for (const [k, vals] of Object.entries(ctx.filters)) {
      if (!Array.isArray(vals) || !vals.length) continue;
      const p = `flt${i++}`;
      clauses.push(`dimensions['${SAFE_KEY(k)}'] IN {${p}:Array(String)}`);
      params[p] = vals.map(String);
    }
  }
  if (ctx.dimensionEquals) {
    let i = 0;
    for (const [k, v] of Object.entries(ctx.dimensionEquals)) {
      const p = `de${i++}`;
      clauses.push(`dimensions['${SAFE_KEY(k)}'] = {${p}:String}`);
      params[p] = String(v);
    }
  }
  return { where: clauses.join(" AND "), params };
}

function aggExpr(spec) {
  if (spec.sumField) return `sum(toFloat64OrZero(dimensions['${SAFE_KEY(spec.sumField)}']))`;
  if (spec.distinctBy) return `uniqExact(${colFor(spec.distinctBy)})`;
  return "count()";
}

export async function countEvents(spec, ctx) {
  return (await aggregateSpec(spec, ctx)).value;
}

async function aggregateSpec(spec, ctx) {
  const { where, params } = buildWhere(spec, ctx);
  const rows = await chQuery(
    `SELECT ${aggExpr(spec)} AS v FROM ${CH_DB}.analytics_events_raw WHERE ${where}`,
    params,
  );
  const v = Number(rows?.[0]?.v ?? 0);
  return { value: v, sample: spec.sumField ? 0 : v };
}

async function percentileSpec(spec, ctx) {
  const { where, params } = buildWhere(spec, ctx);
  const rows = await chQuery(
    `SELECT quantileExact(0.5)(duration_ms) AS p50, quantileExact(0.95)(duration_ms) AS p95, count() AS n
     FROM ${CH_DB}.analytics_events_raw WHERE ${where} AND duration_ms > 0`,
    params,
  );
  const r = rows?.[0] || {};
  return {
    p50: r.p50 == null ? null : Number(r.p50),
    p95: r.p95 == null ? null : Number(r.p95),
    sample: Number(r.n || 0),
  };
}

function round(v, dp = 2) {
  if (v === null || v === undefined) return v;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

// Full metric result from raw events (cards, breakdown groups, drill).
export async function computeFromEvents(metric, ctx) {
  const minDen = metric.suppression?.minimumDenominator ?? 0;
  if (metric.calculationType === "percentile" || metric.calculationType === "duration") {
    const { p50, p95, sample } = await percentileSpec(metric.numerator, ctx);
    const suppressed = minDen > 0 && sample < minDen;
    return { value: suppressed ? null : p50, p50, p95, numerator: sample, denominator: sample, sample, suppressed };
  }
  if (metric.calculationType === "rate" || metric.calculationType === "ratio") {
    const num = await aggregateSpec(metric.numerator, ctx);
    const den = await aggregateSpec(metric.denominator, ctx);
    const suppressed = den.value < Math.max(minDen, 1);
    const factor = metric.calculationType === "rate" ? 100 : 1;
    const value = den.value > 0 ? (num.value / den.value) * factor : null;
    return { value: suppressed ? null : round(value, 2), numerator: num.value, denominator: den.value, sample: den.value, suppressed };
  }
  const num = await aggregateSpec(metric.numerator, ctx);
  let value = num.value;
  let den = 0;
  if (metric.diffMode && metric.denominator) {
    const d = await aggregateSpec(metric.denominator, ctx);
    den = d.value;
    value = num.value - d.value;
  }
  const suppressed = minDen > 0 && num.sample > 0 && num.sample < minDen;
  return { value: suppressed ? null : value, numerator: num.value, denominator: den, sample: num.sample, suppressed };
}

function combineValue(metric, numerator, denominator, source, ctx) {
  const minDen = metric.suppression?.minimumDenominator ?? 0;
  let value;
  if (metric.calculationType === "rate") value = denominator > 0 ? round((numerator / denominator) * 100, 2) : null;
  else if (metric.calculationType === "ratio") value = denominator > 0 ? round(numerator / denominator, 2) : null;
  else if (metric.diffMode) value = numerator - denominator;
  else value = numerator;
  const suppressed = minDen > 0 && denominator > 0 && denominator < minDen;
  return { value: suppressed ? null : value, numerator, denominator, sample: denominator || numerator, suppressed, source, quality: qualityFor(ctx) };
}

function qualityFor(ctx) {
  const ageMs = Date.now() - ctx.endUtc.getTime();
  return ageMs < 24 * 3600 * 1000 ? "current" : "reconciled";
}

// Card value: KPI snapshot aggregate path when available, else raw events.
export async function resolveMetricValue(metric, ctx) {
  const needsEvents =
    metric.calculationType === "percentile" ||
    (ctx.filters && Object.keys(ctx.filters).length) ||
    ctx.dimensionEquals;
  if (!needsEvents) {
    try {
      const sk = scopeKey(ctx);
      const rows = await chQuery(
        `SELECT sum(numerator) AS num, sum(denominator) AS den, count() AS c
         FROM ${CH_DB}.analytics_metric_snapshots
         WHERE environment = {env:String} AND scope_key = {sk:String} AND metric_id = {m:String}
           AND dimension_signature = '@all'
           AND bucket_start_utc >= fromUnixTimestamp64Milli({s:Int64})
           AND bucket_start_utc < fromUnixTimestamp64Milli({e:Int64})`,
        { env: ctx.environment || "production", sk, m: metric.metricId, s: String(ctx.startUtc.getTime()), e: String(ctx.endUtc.getTime()) },
      );
      if (Number(rows?.[0]?.c || 0) > 0) {
        return combineValue(metric, Number(rows[0].num || 0), Number(rows[0].den || 0), "snapshot", ctx);
      }
    } catch {
      // fall through to raw events
    }
  }
  const r = await computeFromEvents(metric, ctx);
  return { ...r, source: "events", quality: qualityFor(ctx) };
}

// Grouped-by-bucket aggregate over raw events (one query). Returns Map(label->number).
async function groupedSeries(spec, ctx, unit, exprOverride) {
  const { where, params } = buildWhere(spec, ctx);
  params.tz = ctx.timeZone || "Africa/Johannesburg";
  const expr = exprOverride || aggExpr(spec);
  const rows = await chQuery(
    `SELECT toString(toStartOfInterval(occurred_at_utc, INTERVAL 1 ${unit}, {tz:String})) AS bucket, ${expr} AS v
     FROM ${CH_DB}.analytics_events_raw WHERE ${where}
     GROUP BY bucket ORDER BY bucket`,
    params,
  );
  const m = new Map();
  for (const r of rows) m.set(String(r.bucket).slice(0, unit === "MONTH" ? 7 : 10), Number(r.v || 0));
  return m;
}

export async function resolveTimeseries(metric, ctx, granularity = "day") {
  const unit = GRAN_UNIT[granularity] || "DAY";
  if (metric.calculationType === "percentile" || metric.calculationType === "duration") {
    const { where, params } = buildWhere(metric.numerator, ctx);
    params.tz = ctx.timeZone || "Africa/Johannesburg";
    const rows = await chQuery(
      `SELECT toString(toStartOfInterval(occurred_at_utc, INTERVAL 1 ${unit}, {tz:String})) AS bucket,
              quantileExact(0.5)(duration_ms) AS p50, quantileExact(0.95)(duration_ms) AS p95
       FROM ${CH_DB}.analytics_events_raw WHERE ${where} AND duration_ms > 0
       GROUP BY bucket ORDER BY bucket`,
      params,
    );
    return rows.map((r) => ({ bucket: String(r.bucket).slice(0, 10), value: r.p50 == null ? null : Number(r.p50), p95: r.p95 == null ? null : Number(r.p95), numerator: 0, denominator: 0 }));
  }
  if (metric.calculationType === "rate" || metric.calculationType === "ratio") {
    const num = await groupedSeries(metric.numerator, ctx, unit);
    const den = await groupedSeries(metric.denominator, ctx, unit);
    const factor = metric.calculationType === "rate" ? 100 : 1;
    const labels = [...new Set([...num.keys(), ...den.keys()])].sort();
    return labels.map((b) => {
      const n = num.get(b) || 0; const d = den.get(b) || 0;
      return { bucket: b, value: d > 0 ? round((n / d) * factor, 2) : null, numerator: n, denominator: d };
    });
  }
  const series = await groupedSeries(metric.numerator, ctx, unit);
  return [...series.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([b, v]) => ({ bucket: b, value: v, numerator: v, denominator: 0 }));
}

export async function resolveBreakdown(metric, ctx, dimension, limit = 12) {
  const dim = SAFE_KEY(dimension);
  const minDen = metric.suppression?.minimumDenominator ?? 0;

  async function grouped(spec) {
    const { where, params } = buildWhere(spec, ctx);
    const rows = await chQuery(
      `SELECT dimensions['${dim}'] AS k, ${aggExpr(spec)} AS v
       FROM ${CH_DB}.analytics_events_raw WHERE ${where} AND dimensions['${dim}'] != ''
       GROUP BY k ORDER BY v DESC LIMIT 60`,
      params,
    );
    const m = new Map();
    for (const r of rows) m.set(String(r.k), Number(r.v || 0));
    return m;
  }

  let rows = [];
  let suppressedGroups = 0;
  if (metric.calculationType === "rate" || metric.calculationType === "ratio") {
    const num = await grouped(metric.numerator);
    const den = await grouped(metric.denominator);
    const factor = metric.calculationType === "rate" ? 100 : 1;
    for (const [k, d] of den.entries()) {
      if (d < Math.max(minDen, 1)) { suppressedGroups += 1; continue; }
      const n = num.get(k) || 0;
      rows.push({ key: k, value: round((n / d) * factor, 2), numerator: n, denominator: d });
    }
  } else if (metric.calculationType === "percentile") {
    const { where, params } = buildWhere(metric.numerator, ctx);
    const r = await chQuery(
      `SELECT dimensions['${dim}'] AS k, quantileExact(0.5)(duration_ms) AS v, count() AS n
       FROM ${CH_DB}.analytics_events_raw WHERE ${where} AND duration_ms > 0 AND dimensions['${dim}'] != ''
       GROUP BY k ORDER BY v DESC LIMIT 60`,
      params,
    );
    for (const row of r) {
      if (minDen > 0 && Number(row.n) < minDen) { suppressedGroups += 1; continue; }
      rows.push({ key: String(row.k), value: Number(row.v || 0), numerator: Number(row.n || 0), denominator: Number(row.n || 0) });
    }
  } else {
    const g = await grouped(metric.numerator);
    for (const [k, v] of g.entries()) rows.push({ key: k, value: v, numerator: v, denominator: 0 });
  }
  rows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  return { dimension, rows: rows.slice(0, limit), suppressedGroups, minimumCohort: minDen };
}
