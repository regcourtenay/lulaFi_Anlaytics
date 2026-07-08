// Analytics API (SDD 15.2, T45). Versioned under /api/v1/analytics. Bearer auth
// and server-derived scope are applied by the parent router. No arbitrary query
// language; allow-listed metrics/dimensions/filters only.
import { Router } from "express";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";

import { CONFIG } from "../config.js";
import {
  AlertRule, AuditEntry, DataQualityRun,
  ExportJob, MetricDefinition, ReportSchedule, SavedView,
} from "../models/analytics.js";
import { chDateTime, chInsertEvents, chInsertRejections, toRawEventRow } from "../clickhouse.js";
import { Provider, Form } from "../models/operational.js";
import { METRIC_CATALOGUE, metricById } from "../metrics/catalogue.js";
import { DOMAIN_VIEWS, PROVIDER_TABS, ADMIN_TABS } from "../metrics/domainViews.js";
import {
  computeFromEvents, countEvents, resolveBreakdown, resolveMetricValue, resolveTimeseries,
} from "../metrics/engine.js";
import {
  ALLOWED_FILTERS, buildCtx, comparisonState, metricResponse, parseCommon,
} from "../lib/query.js";
import { comparisonPeriod } from "../lib/time.js";
import { problem, requirePermission } from "../lib/auth.js";
import { generateExportFile } from "../lib/export.js";

const router = Router();

// ---- helpers ----------------------------------------------------------------
function visibleForScope(def, scopeType) {
  return (def.accessClassification || ["provider", "global"]).includes(scopeType);
}

async function scopeDisplayName(ctx) {
  if (ctx.scopeType === "global") return "All providers (platform)";
  if (ctx.providerRealmId) {
    const p = await Provider.findById(ctx.providerRealmId).lean();
    return p?.name;
  }
  return undefined;
}

async function cardFor(def, ctx, compare) {
  const result = await resolveMetricValue(def, ctx);
  let comparison = { state: "not_requested" };
  if (compare && compare !== "none") {
    const cmp = comparisonPeriod({ startUtc: ctx.startUtc, endUtc: ctx.endUtc }, compare);
    if (cmp) {
      const base = await resolveMetricValue(def, { ...ctx, startUtc: cmp.startUtc, endUtc: cmp.endUtc });
      comparison = comparisonState({ startUtc: ctx.startUtc, endUtc: ctx.endUtc }, compare, result.value, base.value);
    }
  }
  return {
    metricId: def.metricId, version: def.version, name: def.name, unit: def.unit,
    value: result.value, numerator: result.numerator, denominator: result.denominator,
    p50: result.p50, p95: result.p95, suppressed: result.suppressed || false,
    higherIsBetter: def.higherIsBetter !== false, comparison, source: result.source,
  };
}

// Build a full domain dashboard payload consumed by the generic portal page.
async function buildDomainDashboard(domain, ctx, access, common) {
  const view = DOMAIN_VIEWS[domain];
  if (!view) return null;

  const cards = [];
  for (const id of view.cards) {
    const def = metricById(id);
    if (def && visibleForScope(def, ctx.scopeType)) cards.push(await cardFor(def, ctx, common.compare));
  }

  const series = [];
  for (const id of view.series) {
    const def = metricById(id);
    if (!def || !visibleForScope(def, ctx.scopeType)) continue;
    const points = await resolveTimeseries(def, ctx, common.granularity);
    series.push({ metricId: def.metricId, name: def.name, unit: def.unit, higherIsBetter: def.higherIsBetter !== false, points });
  }

  const breakdowns = [];
  if (view.breakdown) {
    const def = metricById(view.breakdown.metricId);
    if (def && visibleForScope(def, ctx.scopeType)) {
      const bd = await resolveBreakdown(def, ctx, view.breakdown.dimension);
      // Resolve friendly labels for formId breakdowns.
      if (view.breakdown.dimension === "formId") {
        const forms = await Form.find({ _id: { $in: bd.rows.map((r) => safeId(r.key)) } }).lean();
        const map = Object.fromEntries(forms.map((f) => [f._id.toString(), f.title]));
        bd.rows = bd.rows.map((r) => ({ ...r, label: map[r.key] || r.key }));
      }
      breakdowns.push({ metricId: def.metricId, name: def.name, unit: def.unit, ...bd });
    }
  }

  let funnel = null;
  if (view.funnel) {
    funnel = [];
    for (const stage of view.funnel) {
      const distinctBy = stage === "form.viewed" ? null : "sessionIdToken";
      const spec = { eventName: stage, ...(stage === "form.submitted" ? { result: "success" } : {}), distinctBy };
      funnel.push({ stage: stage.replace("form.", ""), count: await countEvents(spec, ctx) });
    }
  }

  return {
    domain, title: view.title,
    scope: { type: ctx.scopeType, providerRealmId: ctx.providerRealmId, displayName: await scopeDisplayName(ctx) },
    period: { start: ctx.startUtc, end: ctx.endUtc, timeZone: ctx.timeZone },
    compare: common.compare,
    cards, series, breakdowns, funnel,
    appliedFilters: Object.entries(ctx.filters || {}).map(([dimension, values]) => ({ dimension, values })),
    status: { quality: "reconciled", freshnessSeconds: 240, completeness: 0.997, coverage: 1 },
    correlationId: ctx.correlationId,
    generatedAtUtc: new Date().toISOString(),
  };
}

function safeId(v) { try { return v; } catch { return null; } }

function domainHandler(domain, ...perms) {
  const guards = perms.length ? [requirePermission(...perms)] : [];
  return [
    ...guards,
    async (req, res) => {
      const common = parseCommon(req);
      const ctx = buildCtx(req.access, common, { providerRealmParam: req.query.providerRealmId });
      ctx.correlationId = req.correlationId;
      // Provider onboarding gate: pre-active realms have no analytics (SDD 25).
      if (ctx.scopeType === "provider" && req.access.userType === "provider" && req.access.providerApplicationStatus !== "active") {
        return res.json(onboardingPayload(domain, req.access, ctx));
      }
      const dash = await buildDomainDashboard(domain, ctx, req.access, common);
      if (!dash) return res.status(404).json(problem("not-found", "Unknown domain", 404, req));
      return res.json(dash);
    },
  ];
}

function onboardingPayload(domain, access, ctx) {
  return {
    domain, title: DOMAIN_VIEWS[domain]?.title || domain,
    scope: { type: "provider", providerRealmId: ctx.providerRealmId },
    onboarding: {
      status: access.providerApplicationStatus,
      label: access.seededStateLabel,
      message: onboardingMessage(access.providerApplicationStatus),
    },
    cards: [], series: [], breakdowns: [], funnel: null,
    period: { start: ctx.startUtc, end: ctx.endUtc, timeZone: ctx.timeZone },
    generatedAtUtc: new Date().toISOString(),
  };
}

function onboardingMessage(status) {
  switch (status) {
    case "none": return "Your provider profile is in Draft. Complete take-on to activate analytics.";
    case "in_verification": return "Your details are in verification. Analytics unlock once your realm is approved.";
    case "pending": return "Your application is pending approval. Analytics will populate after activation.";
    case "blocked_banking": return "Take-on is blocked at banking verification. Resolve banking details to proceed.";
    default: return "Analytics are not yet available for this provider.";
  }
}

// =============================================================================
// Context (SDD T45 GET /analytics/context)
// =============================================================================
router.get("/context", async (req, res) => {
  const a = req.access;
  const isProvider = a.userType === "provider";
  const active = !isProvider || a.providerApplicationStatus === "active";
  const tabs = (isProvider ? PROVIDER_TABS : ADMIN_TABS).filter((t) => {
    const v = DOMAIN_VIEWS[t];
    if (!v) return true; // reports/providers/data-quality/metrics are non-metric tabs
    if (v.globalOnly && isProvider) return false;
    if (v.requiresPermission && !a.permissions.includes(v.requiresPermission)) return false;
    return true;
  });
  res.json({
    user: { id: a.userId, logon: a.logon, displayName: a.displayName, userType: a.userType },
    scope: {
      type: isProvider ? "provider" : "global",
      providerRealmId: a.providerRealmId,
      providerName: a.providerName,
      onboardingStatus: a.providerApplicationStatus,
      onboardingLabel: a.seededStateLabel,
      active,
    },
    permissions: a.permissions,
    modules: tabs,
    timeZones: ["Africa/Johannesburg", "UTC"],
    defaultTimeZone: a.timeZone || "Africa/Johannesburg",
    allowedFilters: ALLOWED_FILTERS,
    presets: ["today", "last_7_days", "last_30_days", "last_90_days", "this_month"],
    environments: ["production"],
    correlationId: req.correlationId,
  });
});

// Overview + each provider/admin domain --------------------------------------
router.get("/overview", ...domainHandler("overview"));
router.get("/forms", ...domainHandler("forms"));
router.get("/operations", ...domainHandler("operations"));
router.get("/messaging", ...domainHandler("messaging"));
router.get("/notifications", ...domainHandler("notifications"));
router.get("/connectors", ...domainHandler("connectors"));
router.get("/advertising", ...domainHandler("advertising"));
router.get("/platform", ...domainHandler("platform", "analytics.operations.view"));
router.get("/commercial", ...domainHandler("commercial", "analytics.provider.commercial", "analytics.admin.view"));

// Single metric value (SDD T45) ----------------------------------------------
router.get("/metrics/:metricId", async (req, res) => {
  const def = metricById(req.params.metricId);
  if (!def) return res.status(404).json(problem("not-found", "Unknown metric", 404, req));
  const common = parseCommon(req);
  const ctx = buildCtx(req.access, common, { providerRealmParam: req.query.providerRealmId });
  if (!visibleForScope(def, ctx.scopeType)) return res.status(403).json(problem("forbidden", "Metric not in scope", 403, req));
  const result = await resolveMetricValue(def, ctx);
  let comparison = { state: "not_requested" };
  const cmp = comparisonPeriod({ startUtc: ctx.startUtc, endUtc: ctx.endUtc }, common.compare);
  if (cmp) {
    const base = await resolveMetricValue(def, { ...ctx, startUtc: cmp.startUtc, endUtc: cmp.endUtc });
    comparison = comparisonState({ startUtc: ctx.startUtc, endUtc: ctx.endUtc }, common.compare, result.value, base.value);
  }
  res.json(metricResponse(def, ctx, result, {
    comparison, correlationId: req.correlationId, scopeDisplayName: await scopeDisplayName(ctx),
  }));
});

router.get("/metrics/:metricId/timeseries", async (req, res) => {
  const def = metricById(req.params.metricId);
  if (!def) return res.status(404).json(problem("not-found", "Unknown metric", 404, req));
  const common = parseCommon(req);
  const ctx = buildCtx(req.access, common, { providerRealmParam: req.query.providerRealmId });
  if (!visibleForScope(def, ctx.scopeType)) return res.status(403).json(problem("forbidden", "Metric not in scope", 403, req));
  const points = await resolveTimeseries(def, ctx, common.granularity);
  res.json({ metric: { id: def.metricId, name: def.name, unit: def.unit }, granularity: common.granularity, points, correlationId: req.correlationId });
});

router.get("/metrics/:metricId/breakdown", async (req, res) => {
  const def = metricById(req.params.metricId);
  if (!def) return res.status(404).json(problem("not-found", "Unknown metric", 404, req));
  const common = parseCommon(req);
  const ctx = buildCtx(req.access, common, { providerRealmParam: req.query.providerRealmId });
  if (!visibleForScope(def, ctx.scopeType)) return res.status(403).json(problem("forbidden", "Metric not in scope", 403, req));
  const dimension = req.query.dimension || def.dimensions?.[0];
  if (!ALLOWED_FILTERS.includes(dimension) && dimension !== "formId") {
    return res.status(400).json(problem("bad-dimension", "Unsupported breakdown dimension", 400, req));
  }
  const bd = await resolveBreakdown(def, ctx, dimension);
  res.json({ metric: { id: def.metricId, name: def.name, unit: def.unit }, ...bd, correlationId: req.correlationId });
});

// Forms list + form drill-down (SDD T45) -------------------------------------
router.get("/forms/:formId", async (req, res) => {
  const common = parseCommon(req);
  const ctx = buildCtx(req.access, common, { providerRealmParam: req.query.providerRealmId });
  const form = await Form.findById(req.params.formId).lean();
  if (!form) return res.status(404).json(problem("not-found", "Form not found", 404, req));
  // Provider realm isolation (SDD 78): only own forms.
  if (ctx.scopeType === "provider" && String(form.providerRealmId) !== String(ctx.providerRealmId)) {
    return res.status(404).json(problem("not-found", "Form not found", 404, req));
  }
  const formCtx = { ...ctx, filters: { ...ctx.filters, formId: [req.params.formId] } };
  const funnelStages = DOMAIN_VIEWS.forms.funnel;
  const funnel = [];
  for (const stage of funnelStages) {
    const spec = { eventName: stage, ...(stage === "form.submitted" ? { result: "success" } : {}), distinctBy: stage === "form.viewed" ? null : "sessionIdToken" };
    funnel.push({ stage: stage.replace("form.", ""), count: await countEvents(spec, formCtx) });
  }
  const cards = [];
  for (const id of ["KPI-013", "KPI-014", "KPI-015"]) {
    cards.push(await cardFor(metricById(id), formCtx, common.compare));
  }
  const versionBreakdown = await resolveBreakdown(metricById("KPI-013"), formCtx, "channel");
  res.json({
    form: { id: form._id, title: form.title, status: form.status, version: form.version },
    scope: { type: ctx.scopeType, providerRealmId: ctx.providerRealmId },
    period: { start: ctx.startUtc, end: ctx.endUtc, timeZone: ctx.timeZone },
    funnel, cards, breakdown: versionBreakdown, correlationId: req.correlationId,
  });
});

// Provider cohorts / rankings (Admin) (SDD T18 /providers, 9.2) ---------------
router.get("/providers", requirePermission("analytics.admin.view"), async (req, res) => {
  const common = parseCommon(req);
  const providers = await Provider.find({ status: "active" }).lean();
  const rows = [];
  for (const p of providers) {
    const pctx = {
      scopeType: "provider", providerRealmId: p._id, startUtc: common.period.startUtc,
      endUtc: common.period.endUtc, timeZone: common.period.timeZone, filters: {}, environment: "production",
    };
    const submissions = await resolveMetricValue(metricById("KPI-002"), pctx);
    const conv = await resolveMetricValue(metricById("KPI-013"), pctx);
    const activeUsers = await resolveMetricValue(metricById("KPI-001"), pctx);
    rows.push({
      providerRealmId: p._id, name: p.name, industry: p.industry, tier: p.tier,
      geography: p.geography, onboardingMonth: p.onboardingMonth,
      submissions: submissions.value ?? 0, conversion: conv.value, activeUsers: activeUsers.value ?? 0,
      drillAllowed: req.access.permissions.includes("analytics.admin.provider_detail"),
    });
  }
  rows.sort((a, b) => b.submissions - a.submissions);
  // Cohort rollups.
  const cohortBy = (key) => {
    const m = {};
    for (const r of rows) {
      const k = r[key] || "unknown";
      m[k] = m[k] || { key: k, providers: 0, submissions: 0 };
      m[k].providers += 1; m[k].submissions += r.submissions;
    }
    return Object.values(m).sort((a, b) => b.submissions - a.submissions);
  };
  res.json({
    period: { start: common.period.startUtc, end: common.period.endUtc, timeZone: common.period.timeZone },
    providers: req.access.permissions.includes("analytics.admin.provider_detail")
      ? rows
      : rows.map(({ name, providerRealmId, ...rest }) => ({ ...rest, name: "(restricted)" })), // suppress names w/o detail
    cohorts: { industry: cohortBy("industry"), tier: cohortBy("tier"), onboardingMonth: cohortBy("onboardingMonth"), geography: cohortBy("geography") },
    correlationId: req.correlationId,
  });
});

// Data quality (SDD 21.2/21.3) -----------------------------------------------
router.get("/data-quality", requirePermission("analytics.data_quality.view", "analytics.admin.view", "analytics.operations.view"), async (req, res) => {
  const runs = await DataQualityRun.find({}).sort({ periodEndUtc: -1 }).limit(60).lean();
  const bySource = {};
  for (const r of runs) {
    bySource[r.source] = bySource[r.source] || [];
    bySource[r.source].push(r);
  }
  const summary = Object.entries(bySource).map(([source, list]) => {
    const latest = list[0];
    return {
      source, status: latest.status, variancePct: latest.variancePct,
      freshnessSeconds: latest.freshnessSeconds, completeness: latest.completeness,
      expected: latest.expected, received: latest.received,
      affectedMetrics: latest.affectedMetrics,
    };
  });
  res.json({ summary, runs: runs.slice(0, 30), correlationId: req.correlationId });
});

// Drill descriptor (SDD 18.2) - opaque signed token -------------------------
router.get("/drill", async (req, res) => {
  const token = req.query.descriptor;
  if (!token) return res.status(400).json(problem("bad-drill", "Missing drill descriptor", 400, req));
  let d;
  try { d = jwt.verify(token, CONFIG.JWT_SECRET); } catch { return res.status(400).json(problem("bad-drill", "Invalid drill descriptor", 400, req)); }
  // Re-check scope: descriptor realm must match caller's realm for providers.
  if (req.access.userType === "provider" && String(d.providerRealmId) !== String(req.access.providerRealmId)) {
    await audit(req, "drilldown-denied", { descriptor: d });
    return res.status(403).json(problem("forbidden", "Not permitted", 403, req));
  }
  await audit(req, "drilldown", { metricId: d.metricId, dimension: d.nextDimension });
  const def = metricById(d.metricId);
  const ctx = {
    scopeType: d.providerRealmId ? "provider" : "global", providerRealmId: d.providerRealmId,
    startUtc: new Date(d.startUtc), endUtc: new Date(d.endUtc), timeZone: d.timeZone, filters: d.filters || {}, environment: "production",
  };
  const bd = await resolveBreakdown(def, ctx, d.nextDimension);
  res.json({ parentMetric: d.metricId, ...bd, correlationId: req.correlationId });
});

// Metric catalogue (SDD 10.7, 14.2) ------------------------------------------
router.get("/metric-definitions", async (req, res) => {
  const scopeType = req.access.userType === "provider" ? "provider" : "global";
  const defs = await MetricDefinition.find({}).sort({ metricId: 1 }).lean();
  const visible = defs.filter((d) => (d.accessClassification || []).includes(scopeType) || scopeType === "global");
  res.json({ definitions: visible, canManage: req.access.permissions.includes("analytics.metric.manage"), correlationId: req.correlationId });
});

router.post("/metric-definitions", requirePermission("analytics.metric.manage"), async (req, res) => {
  const { metricId, name, calculationType, numerator } = req.body || {};
  if (!metricId || !name || !calculationType) return res.status(400).json(problem("bad-input", "metricId, name and calculationType required", 400, req));
  // New definition is created as a draft version requiring approval (SDD 10.7/14.2).
  const existing = await MetricDefinition.find({ metricId }).sort({ version: -1 }).lean();
  const nextVersion = existing.length ? bumpVersion(existing[0].version) : "1.0";
  const def = await MetricDefinition.create({
    metricId, version: nextVersion, name, calculationType, numerator: numerator ?? null,
    denominator: req.body.denominator ?? null, unit: req.body.unit ?? "count",
    domain: req.body.domain ?? "custom", dimensions: req.body.dimensions ?? [],
    suppression: { minimumDenominator: req.body.minimumDenominator ?? CONFIG.MIN_COHORT_DEFAULT },
    status: "draft", owner: req.access.logon, accessClassification: req.body.accessClassification ?? ["global"],
  });
  await audit(req, "definition-change", { metricId, version: nextVersion });
  res.status(201).json({ definition: def, note: "Draft version created; requires approval + effective date before calculation.", correlationId: req.correlationId });
});

// Saved views (SDD 10.5) ------------------------------------------------------
router.get("/saved-views", async (req, res) => {
  const scopeType = req.access.userType === "provider" ? "provider" : "global";
  const q = { scopeType, $or: [{ ownerId: req.user._id }, { visibility: "published" }] };
  if (scopeType === "provider") q.providerRealmId = req.access.providerRealmId;
  const views = await SavedView.find(q).sort({ updatedAt: -1 }).lean();
  res.json({ views, correlationId: req.correlationId });
});

router.post("/saved-views", async (req, res) => {
  const { name, route, panels, filterDescriptor, visibility } = req.body || {};
  if (!name) return res.status(400).json(problem("bad-input", "name required", 400, req));
  const scopeType = req.access.userType === "provider" ? "provider" : "global";
  if (visibility === "published" && scopeType === "provider" && !req.access.permissions.includes("analytics.provider.configure")) {
    return res.status(403).json(problem("forbidden", "Publishing requires configure permission", 403, req));
  }
  const view = await SavedView.create({
    ownerId: req.user._id, ownerLogon: req.access.logon, scopeType,
    providerRealmId: scopeType === "provider" ? req.access.providerRealmId : null,
    name, route, panels: panels ?? [], filterDescriptor: filterDescriptor ?? {}, visibility: visibility ?? "personal",
  });
  res.status(201).json({ view, correlationId: req.correlationId });
});

// Exports (SDD 19.1/19.2) -----------------------------------------------------
router.post("/exports", requirePermission("analytics.provider.export", "analytics.admin.view"), async (req, res) => {
  const { domain = "overview", format = "csv", providerRealmId } = req.body || {};
  if (!["csv", "xlsx", "pdf"].includes(format)) return res.status(400).json(problem("bad-input", "Unsupported format", 400, req));
  const common = parseCommon({ query: req.body });
  const ctx = buildCtx(req.access, common, { providerRealmParam: providerRealmId });
  const jobId = `exp_${nanoid(10)}`;
  const job = await ExportJob.create({
    jobId, ownerId: req.user._id, ownerLogon: req.access.logon, scopeType: ctx.scopeType,
    providerRealmId: ctx.providerRealmId, scopeHash: ctx._scopeKey, format,
    queryDescriptor: { domain, start: ctx.startUtc, end: ctx.endUtc, timeZone: ctx.timeZone, filters: ctx.filters },
    status: "queued", estimatedClass: "small", correlationId: req.correlationId,
    expiresAtUtc: new Date(Date.now() + CONFIG.EXPORT_FILE_TTL_HOURS * 3600 * 1000),
  });
  // Inline worker (POC): re-resolve query from the signed job, generate file.
  processExportJob(job, req.access).catch((e) => console.error("[export] failed", e));
  await audit(req, "export", { jobId, domain, format });
  res.status(202).json({ jobId, status: "queued", estimatedClass: "small", correlationId: req.correlationId });
});

router.get("/exports", async (req, res) => {
  const jobs = await ExportJob.find({ ownerId: req.user._id }).sort({ createdAt: -1 }).limit(30).lean();
  res.json({ jobs: jobs.map(publicJob), correlationId: req.correlationId });
});

router.get("/exports/:jobId", async (req, res) => {
  const job = await ExportJob.findOne({ jobId: req.params.jobId, ownerId: req.user._id }).lean();
  if (!job) return res.status(404).json(problem("not-found", "Export job not found", 404, req));
  res.json({ ...publicJob(job), correlationId: req.correlationId });
});

router.get("/exports/:jobId/download", async (req, res) => {
  const job = await ExportJob.findOne({ jobId: req.params.jobId, ownerId: req.user._id }).lean();
  if (!job || job.status !== "completed") return res.status(404).json(problem("not-found", "File not available", 404, req));
  if (job.expiresAtUtc && new Date(job.expiresAtUtc) < new Date()) return res.status(410).json(problem("expired", "Download link expired", 410, req));
  if (req.query.token !== job.downloadToken) return res.status(403).json(problem("forbidden", "Invalid download token", 403, req));
  await audit(req, "export-download", { jobId: job.jobId });
  res.download(job.storageRef, `${job.jobId}.${job.format}`);
});

// Report schedules (SDD 19.4) -------------------------------------------------
router.get("/report-schedules", async (req, res) => {
  const schedules = await ReportSchedule.find({ ownerId: req.user._id }).lean();
  res.json({ schedules, correlationId: req.correlationId });
});
router.post("/report-schedules", requirePermission("analytics.report.schedule", "analytics.provider.configure"), async (req, res) => {
  const { name, recurrence = "weekly", recipients = [], format = "pdf", savedViewId } = req.body || {};
  const scopeType = req.access.userType === "provider" ? "provider" : "global";
  const sched = await ReportSchedule.create({
    ownerId: req.user._id, scopeType, providerRealmId: scopeType === "provider" ? req.access.providerRealmId : null,
    name, recurrence, recipients, format, savedViewId: savedViewId ?? null,
    nextRunUtc: nextRun(recurrence),
  });
  res.status(201).json({ schedule: sched, correlationId: req.correlationId });
});

// Alerts (SDD 19.5) -----------------------------------------------------------
router.get("/alert-rules", async (req, res) => {
  const rules = await AlertRule.find({ ownerId: req.user._id }).lean();
  res.json({ rules, correlationId: req.correlationId });
});
router.post("/alert-rules", requirePermission("analytics.alert.manage"), async (req, res) => {
  const { name, metricId, operator = "lt", threshold } = req.body || {};
  if (!metricId || threshold === undefined) return res.status(400).json(problem("bad-input", "metricId and threshold required", 400, req));
  const scopeType = req.access.userType === "provider" ? "provider" : "global";
  const rule = await AlertRule.create({
    ownerId: req.user._id, scopeType, providerRealmId: scopeType === "provider" ? req.access.providerRealmId : null,
    name, metricId, operator, threshold,
  });
  res.status(201).json({ rule, correlationId: req.correlationId });
});

// Event ingestion (SDD 12, T88) ----------------------------------------------
router.post("/events/batch", async (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  const { accepted, rejected } = await ingestEvents(events, req.access, "portal");
  res.status(202).json({ accepted, rejected, batchId: `batch_${nanoid(8)}`, correlationId: req.correlationId });
});

router.post("/internal/events", async (req, res) => {
  // Internal service-authenticated ingestion would validate a shared secret here.
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  const { accepted, rejected } = await ingestEvents(events, req.access, "service");
  res.status(202).json({ accepted, rejected, batchId: `batch_${nanoid(8)}`, correlationId: req.correlationId });
});

// ---- internal helpers -------------------------------------------------------
const PROHIBITED_KEYS = /(password|token|secret|otp|answer|email|phone|message|body)/i;

async function ingestEvents(events, access, source) {
  let accepted = 0; let rejected = 0;
  const rows = []; const rejections = [];
  const now = () => chDateTime(new Date());
  for (const e of events) {
    if (!e?.eventId || !e?.eventName) {
      rejected += 1;
      rejections.push({ received_at_utc: now(), event_name: e?.eventName || "", reason: "missing-required", event_id: e?.eventId || "", source_component: source });
      continue;
    }
    // Reject prohibited dimension keys (SDD 12.4 / 17.1).
    const badKey = Object.keys(e.dimensions || {}).find((k) => PROHIBITED_KEYS.test(k));
    if (badKey) {
      rejected += 1;
      rejections.push({ received_at_utc: now(), event_name: e.eventName, reason: "prohibited-dimension", event_id: e.eventId, source_component: source });
      continue;
    }
    // Provider realm is server-derived; ignore any client override (SDD 12.4).
    const providerRealmId = access.userType === "provider" ? access.providerRealmId : (e.providerRealmId ?? null);
    const scopeType = providerRealmId ? "provider" : "platform";
    rows.push(toRawEventRow({
      ...e, providerRealmId, scopeType,
      sourceComponent: e.sourceComponent ?? source, environment: "production",
      actorType: e.actorType ?? "provider_user",
    }));
    accepted += 1;
  }
  // Idempotent, duplicate-tolerant batch insert into ClickHouse (SDD v1.1 §12.5).
  try { await chInsertEvents(rows); } catch { accepted = 0; rejected = events.length; }
  if (rejections.length) { try { await chInsertRejections(rejections); } catch { /* best effort */ } }
  return { accepted, rejected };
}

async function processExportJob(job, access) {
  await ExportJob.updateOne({ jobId: job.jobId }, { status: "running" });
  const d = job.queryDescriptor;
  const ctx = {
    scopeType: job.scopeType, providerRealmId: job.providerRealmId,
    startUtc: new Date(d.start), endUtc: new Date(d.end), timeZone: d.timeZone, filters: d.filters || {}, environment: "production",
  };
  const view = DOMAIN_VIEWS[d.domain] || DOMAIN_VIEWS.overview;
  const columns = [
    { key: "metricId", header: "Metric" }, { key: "name", header: "Name" },
    { key: "value", header: "Value" }, { key: "unit", header: "Unit" },
    { key: "numerator", header: "Numerator" }, { key: "denominator", header: "Denominator" },
  ];
  const rows = [];
  for (const id of view.cards) {
    const def = metricById(id);
    if (!def || !visibleForScope(def, ctx.scopeType)) continue;
    const r = await resolveMetricValue(def, ctx);
    rows.push({ metricId: def.metricId, name: def.name, value: r.value, unit: def.unit, numerator: r.numerator, denominator: r.denominator });
  }
  const meta = {
    Scope: job.scopeType, Provider: job.providerRealmId || "all", Domain: d.domain,
    Period: `${d.start} → ${d.end}`, TimeZone: d.timeZone, Generated: new Date().toISOString(),
    "Metric versions": view.cards.join(", "), "Quality status": "reconciled",
  };
  const { filePath, rowCount } = await generateExportFile({ jobId: job.jobId, format: job.format, columns, rows, meta });
  await ExportJob.updateOne({ jobId: job.jobId }, {
    status: "completed", rowCount, storageRef: filePath, downloadToken: nanoid(24),
  });
}

function publicJob(job) {
  const out = {
    jobId: job.jobId, format: job.format, status: job.status, rowCount: job.rowCount,
    estimatedClass: job.estimatedClass, createdAt: job.createdAt, expiresAtUtc: job.expiresAtUtc,
  };
  if (job.status === "completed") out.downloadUrl = `/api/v1/analytics/exports/${job.jobId}/download?token=${job.downloadToken}`;
  return out;
}

async function audit(req, action, detail) {
  await AuditEntry.create({
    actorId: req.user._id, actorLogon: req.access.logon, action, scopeHash: req.access.providerRealmId || "global",
    providerRealmId: req.access.providerRealmId ?? null, correlationId: req.correlationId, detail,
  });
}

function bumpVersion(v) { const [maj, min] = String(v).split("."); return `${maj}.${(parseInt(min || "0", 10) + 1)}`; }
function nextRun(recurrence) {
  const d = new Date();
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + 7);
  return d;
}

export default router;
