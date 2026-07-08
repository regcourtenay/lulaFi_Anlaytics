// Analytics CONTROL-PLANE models (SDD v1.1 §13.1). In v1.1 the event/aggregate
// data plane moved to ClickHouse; MongoDB retains the governed control plane:
// metric definitions, saved views, export jobs, schedules, alert rules,
// data-quality runs and audit. These live in the `lulafi_analytics` Mongo DB.
import { Schema } from "mongoose";

import { analyticsConn } from "../db.js";

// ---- analytics_metric_definitions (SDD v1.1 §13.3) --------------------------
const MetricDefinitionSchema = new Schema(
  {
    metricId: { type: String, required: true, index: true },
    version: { type: String, required: true },
    name: { type: String, required: true },
    unit: { type: String, default: "count" },
    domain: { type: String, index: true },
    calculationType: { type: String, enum: ["count", "rate", "duration", "percentile", "ratio"], required: true },
    numerator: { type: Schema.Types.Mixed, default: null },
    denominator: { type: Schema.Types.Mixed, default: null },
    dimensions: { type: [String], default: [] },
    suppression: { minimumDenominator: { type: Number, default: 0 } },
    refresh: { type: String, default: "PT15M" },
    correctionWindow: { type: String, default: "P7D" },
    // v1.1: definition records the chosen ClickHouse storage/query plan.
    storageQueryPlan: { type: String, default: "aggregate-state|snapshot|bounded-detail" },
    effectiveFrom: { type: Date, default: () => new Date() },
    status: { type: String, enum: ["draft", "active", "retired"], default: "active" },
    accessClassification: { type: [String], default: ["provider", "global"] },
    description: String,
    owner: String,
    higherIsBetter: { type: Boolean, default: true },
  },
  { collection: "analytics_metric_definitions", timestamps: true },
);
MetricDefinitionSchema.index({ metricId: 1, version: 1 }, { unique: true });

// ---- analytics_saved_views --------------------------------------------------
const SavedViewSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    ownerLogon: String,
    scopeType: { type: String, enum: ["provider", "global"], required: true },
    providerRealmId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    route: String,
    visibility: { type: String, enum: ["personal", "published"], default: "personal" },
    filterDescriptor: { type: Schema.Types.Mixed, default: {} },
    panels: { type: [String], default: [] },
  },
  { collection: "analytics_saved_views", timestamps: true },
);
SavedViewSchema.index({ ownerId: 1, name: 1, scopeType: 1 }, { unique: true });

// ---- analytics_export_jobs (SDD v1.1 §19) -----------------------------------
const ExportJobSchema = new Schema(
  {
    jobId: { type: String, required: true, unique: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    ownerLogon: String,
    scopeType: String,
    providerRealmId: { type: Schema.Types.ObjectId, default: null },
    scopeHash: String,
    queryDescriptor: { type: Schema.Types.Mixed, default: {} },
    format: { type: String, enum: ["csv", "xlsx", "pdf"], required: true },
    status: { type: String, enum: ["queued", "running", "completed", "failed", "expired"], default: "queued" },
    rowCount: { type: Number, default: 0 },
    storageRef: String,
    downloadToken: String,
    estimatedClass: { type: String, default: "small" },
    expiresAtUtc: Date,
    correlationId: String,
  },
  { collection: "analytics_export_jobs", timestamps: true },
);
ExportJobSchema.index({ ownerId: 1, createdAt: -1 });
ExportJobSchema.index({ status: 1, createdAt: -1 });

// ---- analytics_report_schedules ---------------------------------------------
const ReportScheduleSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    scopeType: String,
    providerRealmId: { type: Schema.Types.ObjectId, default: null },
    savedViewId: { type: Schema.Types.ObjectId, default: null },
    name: String,
    recurrence: { type: String, enum: ["daily", "weekly", "monthly"], default: "weekly" },
    timeZone: { type: String, default: "Africa/Johannesburg" },
    recipients: { type: [String], default: [] },
    format: { type: String, default: "pdf" },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    lastRunUtc: Date,
    nextRunUtc: Date,
  },
  { collection: "analytics_report_schedules", timestamps: true },
);

// ---- analytics_alert_rules --------------------------------------------------
const AlertRuleSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    scopeType: String,
    providerRealmId: { type: Schema.Types.ObjectId, default: null },
    name: String,
    metricId: String,
    operator: { type: String, enum: ["gt", "lt", "gte", "lte"], default: "lt" },
    threshold: Number,
    evaluationWindow: { type: String, default: "P1D" },
    cooldown: { type: String, default: "PT6H" },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    lastState: { type: String, enum: ["ok", "breached"], default: "ok" },
    lastEvaluatedUtc: Date,
  },
  { collection: "analytics_alert_rules", timestamps: true },
);

// ---- analytics_data_quality_runs (SDD v1.1 §21) -----------------------------
const DataQualityRunSchema = new Schema(
  {
    source: { type: String, required: true },
    providerRealmId: { type: Schema.Types.ObjectId, default: null },
    scopeType: { type: String, default: "global" },
    periodStartUtc: Date,
    periodEndUtc: { type: Date, index: true },
    expected: Number,
    received: Number,
    duplicates: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    variancePct: Number,
    freshnessSeconds: Number,
    completeness: Number,
    status: { type: String, enum: ["current", "delayed", "partial", "reconciled", "variance"], default: "reconciled" },
    affectedMetrics: { type: [String], default: [] },
  },
  { collection: "analytics_data_quality_runs", timestamps: true },
);
DataQualityRunSchema.index({ source: 1, periodEndUtc: -1 });

// ---- analytics_audit (SDD v1.1 §16.3 / §17.4) -------------------------------
const AuditEntrySchema = new Schema(
  {
    actorId: Schema.Types.ObjectId,
    actorLogon: String,
    action: String,
    scopeHash: String,
    providerRealmId: { type: Schema.Types.ObjectId, default: null },
    correlationId: String,
    detail: Schema.Types.Mixed,
    atUtc: { type: Date, default: () => new Date() },
  },
  { collection: "analytics_audit" },
);

export const MetricDefinition = analyticsConn.model("MetricDefinition", MetricDefinitionSchema);
export const SavedView = analyticsConn.model("SavedView", SavedViewSchema);
export const ExportJob = analyticsConn.model("ExportJob", ExportJobSchema);
export const ReportSchedule = analyticsConn.model("ReportSchedule", ReportScheduleSchema);
export const AlertRule = analyticsConn.model("AlertRule", AlertRuleSchema);
export const DataQualityRun = analyticsConn.model("DataQualityRun", DataQualityRunSchema);
export const AuditEntry = analyticsConn.model("AuditEntry", AuditEntrySchema);
