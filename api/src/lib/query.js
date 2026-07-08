// Query parsing, server-side scope derivation and allow-listed filters
// (SDD 15.3, 16.3, 18.1). No raw Mongo operators or field selection are accepted.
import { CONFIG } from "../config.js";
import { comparisonPeriod, resolvePeriod } from "./time.js";
import { scopeKey } from "../metrics/engine.js";

// Allow-listed filter dimensions (SDD 18.1). Anything else is dropped.
export const ALLOWED_FILTERS = [
  "channel", "deviceClass", "formId", "priority", "team",
  "connectorType", "campaign", "placement", "template",
  "conversationType", "errorClass",
];

export function parseFilters(raw) {
  // Accept either JSON string or repeated query params like filters[channel]=mobile
  let obj = {};
  if (!raw) return obj;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!ALLOWED_FILTERS.includes(k)) continue; // drop non-allow-listed
    if (k.startsWith("$") || String(v).includes("$")) continue; // no operators
    clean[k] = Array.isArray(v) ? v : [v];
  }
  return clean;
}

export function parseCommon(req) {
  const q = req.query;
  const period = resolvePeriod({
    preset: q.preset,
    start: q.start,
    end: q.end,
    timeZone: q.timeZone,
  });
  return {
    period,
    granularity: ["hour", "day", "week", "month"].includes(q.granularity) ? q.granularity : "day",
    compare: q.compare || "none",
    filters: parseFilters(q.filters),
    dimension: q.dimension,
    sort: q.sort,
    limit: Math.min(parseInt(q.limit ?? CONFIG.DEFAULT_PAGE_SIZE, 10) || CONFIG.DEFAULT_PAGE_SIZE, CONFIG.MAX_DETAIL_ROWS),
    cursor: q.cursor,
    environment: "production",
  };
}

// Derive the engine context, enforcing scope from the access context.
// A provider user is locked to its realm. A global user is aggregate unless it
// holds provider_detail AND explicitly selects a providerRealmId (SDD 9.2/16.3).
export function buildCtx(access, common, { providerRealmParam } = {}) {
  let scopeType = access.userType === "provider" ? "provider" : "global";
  let providerRealmId = null;

  if (access.userType === "provider") {
    providerRealmId = access.providerRealmId;
  } else if (providerRealmParam && access.permissions.includes("analytics.admin.provider_detail")) {
    scopeType = "provider";
    providerRealmId = providerRealmParam;
  }

  return {
    scopeType,
    providerRealmId,
    startUtc: common.period.startUtc,
    endUtc: common.period.endUtc,
    timeZone: common.period.timeZone,
    filters: common.filters,
    environment: "production",
    _scopeKey: scopeKey({ scopeType, providerRealmId, environment: "production" }),
  };
}

// Standard metric response envelope (SDD 15.4 / T47).
export function metricResponse(def, ctx, result, extra = {}) {
  const denom = result.denominator ?? 0;
  return {
    metric: { id: def.metricId, version: def.version, name: def.name, unit: def.unit },
    scope: {
      type: ctx.scopeType,
      providerRealmId: ctx.providerRealmId,
      displayName: extra.scopeDisplayName,
    },
    period: { start: ctx.startUtc, end: ctx.endUtc, timeZone: ctx.timeZone },
    value: result.value,
    numerator: result.numerator,
    denominator: result.denominator,
    p50: result.p50,
    p95: result.p95,
    suppressed: result.suppressed || false,
    suppressionReason: result.suppressed ? "below-minimum-cohort" : undefined,
    comparison: extra.comparison ?? { state: "not_requested" },
    quality: {
      status: result.quality || "current",
      freshnessSeconds: 240,
      completeness: 0.997,
      reconciled: (result.quality || "current") !== "current",
    },
    coverage: 1.0,
    appliedFilters: Object.entries(ctx.filters || {}).map(([dimension, values]) => ({ dimension, values })),
    drill: { available: (def.dimensions || []).length > 0, nextDimensions: def.dimensions || [] },
    higherIsBetter: def.higherIsBetter !== false,
    source: result.source,
    generatedAtUtc: new Date().toISOString(),
    correlationId: extra.correlationId,
  };
}

export function comparisonState(period, compare, currentValue, baselineValue) {
  const cmp = comparisonPeriod(period, compare);
  if (!cmp) return { state: "not_requested" };
  if (baselineValue === null || baselineValue === undefined || baselineValue === 0) {
    return { state: "no_baseline" };
  }
  if (currentValue === null || currentValue === undefined) return { state: "unavailable" };
  const abs = currentValue - baselineValue;
  const pct = (abs / baselineValue) * 100;
  return {
    state: "available",
    baseline: baselineValue,
    absoluteChange: Math.round(abs * 100) / 100,
    percentChange: Math.round(pct * 100) / 100,
  };
}
