// Idempotent seed (v1.1). Provider realms, the eight login accounts and forms go
// into MongoDB; a 2-month canonical event stream is inserted into ClickHouse;
// daily/hourly aggregate tables and headline KPI snapshots are populated in
// ClickHouse; saved views, alerts, schedules and data-quality runs go into the
// MongoDB control plane.
import { DateTime } from "luxon";

import { CONFIG } from "../config.js";
import { hashPassphrase } from "../lib/auth.js";
import { CH_DB, ch, chCommand, chDateTime, chInsertEvents, chQuery, toRawEventRow } from "../clickhouse.js";
import { AlertRule, DataQualityRun, ReportSchedule, SavedView } from "../models/analytics.js";
import { Form, Provider, User } from "../models/operational.js";
import { metricById } from "../metrics/catalogue.js";
import { computeFromEvents, scopeKey } from "../metrics/engine.js";
import { generatePlatformEvents, generateProviderEvents } from "./generator.js";
import { SEED_PROVIDERS } from "./providers.js";
import { SEED_USERS } from "./users.js";

const FORM_TITLES = {
  Healthcare: ["Patient Intake", "Consent to Treat", "Medical Aid Claim", "Referral Request", "Appointment Booking"],
  "Financial Services": ["Account Opening", "KYC Verification", "Loan Application", "Beneficiary Update", "Dispute Form"],
  Retail: ["Loyalty Sign-up", "Returns Request", "Credit Application", "Warranty Registration", "Feedback Survey"],
  Utilities: ["New Connection", "Meter Reading", "Fault Report", "Debit Order Mandate", "Tariff Change"],
  Education: ["Enrolment", "Bursary Application", "Course Change", "Consent Form", "Exam Registration"],
  Logistics: ["Collection Booking", "Claim Submission", "Account Application", "Address Verification", "Delivery Feedback"],
  Government: ["Permit Application", "Grant Application", "Records Request", "Compliance Declaration", "Appeal Form"],
};

const SAFE_TZ = (CONFIG.SEED_TIMEZONE || "Africa/Johannesburg").replace(/[^A-Za-z0-9_/+-]/g, "");

export async function runSeed({ months = 2, timeZone = "Africa/Johannesburg", scale = parseFloat(process.env.SEED_SCALE ?? "1") } = {}) {
  const started = Date.now();

  // 1. Provider realms (MongoDB).
  const providerIdByKey = {};
  for (const p of SEED_PROVIDERS) {
    const registrationNumber = `REG-${p.key.toUpperCase()}`;
    const doc = await Provider.findOneAndUpdate(
      { registrationNumber },
      { $set: {
        name: p.name, industry: p.industry, tier: p.tier, geography: p.geography,
        onboardingMonth: p.onboardingMonth, timeZone, status: p.status,
        config: { commercialEnabled: !!p.commercialEnabled, defaultCards: [], targets: { "KPI-013": 60 } },
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    providerIdByKey[p.key] = doc._id;
  }

  // 2. Login accounts (MongoDB).
  for (const u of SEED_USERS) {
    const existing = await User.findOne({ logon: u.logon });
    const providerRealmId = u.providerKey ? providerIdByKey[u.providerKey] : null;
    if (!existing) {
      await User.create({
        uid: `uid_${u.logon}`, logon: u.logon, passphraseHash: await hashPassphrase(u.passphrase),
        type: u.type, displayName: u.displayName, email: `${u.logon.replace(/\./g, "")}@lulafi.poc`,
        providerRealmId, providerApplicationStatus: u.providerApplicationStatus,
        seededStateLabel: u.seededStateLabel, permissions: u.permissions,
      });
    } else {
      existing.permissions = u.permissions;
      existing.providerApplicationStatus = u.providerApplicationStatus;
      existing.seededStateLabel = u.seededStateLabel;
      existing.providerRealmId = providerRealmId;
      await existing.save();
    }
  }

  // 3. Forms for active providers (MongoDB).
  const formIdsByKey = {};
  for (const p of SEED_PROVIDERS.filter((x) => x.status === "active")) {
    const realmId = providerIdByKey[p.key];
    let forms = await Form.find({ providerRealmId: realmId }).lean();
    if (!forms.length) {
      const titles = FORM_TITLES[p.industry] || FORM_TITLES.Retail;
      forms = await Form.insertMany(
        titles.map((title, i) => ({
          title, providerRealmId: realmId, status: i < 4 ? "published" : "unpublished",
          version: 1 + (i % 3), category: p.industry,
        })),
      );
    }
    formIdsByKey[p.key] = forms.map((f) => f._id.toString());
  }

  const now = DateTime.now().setZone(timeZone);
  const endLocal = now.plus({ days: 1 }).startOf("day");
  const startLocal = endLocal.minus({ months }).startOf("day");
  const days = Math.round(endLocal.diff(startLocal, "days").days);
  const startUtc = startLocal.toUTC().toJSDate();
  const endUtc = endLocal.toUTC().toJSDate();

  // 4. Event stream -> ClickHouse (only if the raw table is empty).
  const existingEvents = Number((await chQuery(`SELECT count() AS c FROM ${CH_DB}.analytics_events_raw`))?.[0]?.c || 0);
  if (existingEvents === 0) {
    console.log(`[seed] generating ~${months} months of events (${days} days, scale=${scale}) ...`);
    const buffer = [];
    for (const p of SEED_PROVIDERS.filter((x) => x.status === "active")) {
      generateProviderEvents(buffer, {
        provider: p, providerRealmId: providerIdByKey[p.key],
        formIds: formIdsByKey[p.key], startLocal, days, timeZone, scale,
      });
    }
    generatePlatformEvents(buffer, { startLocal, days, timeZone, scale });
    console.log(`[seed] inserting ${buffer.length} events into ClickHouse ...`);
    const rows = buffer.map(toRawEventRow);
    for (let i = 0; i < rows.length; i += 20000) {
      await chInsertEvents(rows.slice(i, i + 20000));
    }
    await populateAggregates();
  } else {
    console.log(`[seed] ClickHouse already has ${existingEvents} events; skipping generation.`);
  }

  // 5. Headline KPI snapshots -> ClickHouse (aggregate/snapshot fast path).
  const snapCount = Number((await chQuery(`SELECT count() AS c FROM ${CH_DB}.analytics_metric_snapshots`))?.[0]?.c || 0);
  if (snapCount === 0) {
    try {
      await populateSnapshots({
        scopes: [
          { scopeType: "global", providerRealmId: null, chScope: "platform" },
          { scopeType: "provider", providerRealmId: String(providerIdByKey.kudu), chScope: "provider" },
        ],
        metricIds: ["KPI-001", "KPI-002", "KPI-011", "KPI-013"],
        startLocal, days, timeZone,
      });
      console.log("[seed] headline snapshots computed.");
    } catch (e) {
      console.error("[seed] snapshot population skipped:", e?.message || e);
    }
  }

  // 6. Data quality runs (MongoDB control plane).
  if ((await DataQualityRun.estimatedDocumentCount()) === 0) {
    const sources = ["forms", "notifications", "connectors", "messaging", "billing"];
    const runs = [];
    for (let w = 0; w < Math.ceil(days / 7); w++) {
      const periodEnd = startLocal.plus({ weeks: w + 1 }).toUTC().toJSDate();
      const periodStart = startLocal.plus({ weeks: w }).toUTC().toJSDate();
      for (const source of sources) {
        const expected = 4000 + Math.round(Math.random() * 3000);
        const variance = source === "connectors" && w === Math.ceil(days / 7) - 2 ? -0.043 : (Math.random() - 0.5) * 0.01;
        const received = Math.round(expected * (1 + variance));
        runs.push({
          source, scopeType: "global", periodStartUtc: periodStart, periodEndUtc: periodEnd,
          expected, received, duplicates: Math.round(Math.random() * 20), rejected: Math.round(Math.random() * 15),
          variancePct: Math.round(variance * 1000) / 10, freshnessSeconds: 120 + Math.round(Math.random() * 400),
          completeness: Math.round((0.99 + Math.random() * 0.009) * 1000) / 1000,
          status: Math.abs(variance) > 0.03 ? "variance" : "reconciled",
          affectedMetrics: Math.abs(variance) > 0.03 ? ["KPI-051", "KPI-053"] : [],
        });
      }
    }
    await DataQualityRun.insertMany(runs);
    console.log(`[seed] data-quality runs: ${runs.length}`);
  }

  // 7. Saved views, alert rules, a schedule (MongoDB control plane).
  const kuduUser = await User.findOne({ logon: "thabo.mokoena" });
  const adminUser = await User.findOne({ logon: "admin" });
  if (kuduUser && (await SavedView.estimatedDocumentCount()) === 0) {
    await SavedView.create([
      { ownerId: kuduUser._id, ownerLogon: "thabo.mokoena", scopeType: "provider", providerRealmId: kuduUser.providerRealmId, name: "Mobile conversions", route: "/portal/provider/analytics/forms", visibility: "published", panels: ["KPI-013", "KPI-014"], filterDescriptor: { channel: ["mobile"] } },
      { ownerId: adminUser._id, ownerLogon: "admin", scopeType: "global", name: "Platform reliability", route: "/portal/admin/analytics/platform", visibility: "published", panels: ["KPI-080", "KPI-082"] },
    ]);
  }
  if (kuduUser && (await AlertRule.estimatedDocumentCount()) === 0) {
    await AlertRule.create([
      { ownerId: kuduUser._id, scopeType: "provider", providerRealmId: kuduUser.providerRealmId, name: "Conversion below target", metricId: "KPI-013", operator: "lt", threshold: 55 },
      { ownerId: adminUser._id, scopeType: "global", name: "Availability SLO", metricId: "KPI-080", operator: "lt", threshold: 99 },
    ]);
  }
  if (kuduUser && (await ReportSchedule.estimatedDocumentCount()) === 0) {
    await ReportSchedule.create({ ownerId: kuduUser._id, scopeType: "provider", providerRealmId: kuduUser.providerRealmId, name: "Weekly provider summary", recurrence: "weekly", recipients: ["ops@kudu.poc"], format: "pdf", nextRunUtc: new Date(Date.now() + 7 * 86400000) });
  }

  console.log(`[seed] complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

// Daily + hourly aggregate rollups from raw facts (SDD v1.1 §13.4). Simple,
// standard SQL; wrapped so a failure never aborts the seed.
async function populateAggregates() {
  try {
    await chCommand(
      `INSERT INTO ${CH_DB}.analytics_metrics_daily
         (environment, scope_type, provider_realm_id, event_name, day, events, uniq_sessions, uniq_actors)
       SELECT environment, scope_type, provider_realm_id, event_name,
              toDate(occurred_at_utc, '${SAFE_TZ}') AS day,
              count(), uniqExact(session_id_token), uniqExact(actor_id_token)
       FROM ${CH_DB}.analytics_events_raw
       GROUP BY environment, scope_type, provider_realm_id, event_name, day`,
    );
    await chCommand(
      `INSERT INTO ${CH_DB}.analytics_metrics_hourly
         (environment, scope_type, provider_realm_id, event_name, hour, events, uniq_sessions)
       SELECT environment, scope_type, provider_realm_id, event_name,
              toStartOfHour(occurred_at_utc) AS hour,
              count(), uniqExact(session_id_token)
       FROM ${CH_DB}.analytics_events_raw
       GROUP BY environment, scope_type, provider_realm_id, event_name, hour`,
    );
    console.log("[seed] hourly/daily aggregate tables populated.");
  } catch (e) {
    console.error("[seed] aggregate population skipped:", e?.message || e);
  }
}

async function populateSnapshots({ scopes, metricIds, startLocal, days, timeZone }) {
  const rows = [];
  for (const scope of scopes) {
    const key = scopeKey({ scopeType: scope.scopeType, providerRealmId: scope.providerRealmId, environment: "production" });
    for (const id of metricIds) {
      const metric = metricById(id);
      if (!metric) continue;
      for (let d = 0; d < days; d++) {
        const bStart = startLocal.plus({ days: d });
        const bEnd = bStart.plus({ days: 1 });
        const ctx = {
          scopeType: scope.scopeType, providerRealmId: scope.providerRealmId,
          startUtc: bStart.toUTC().toJSDate(), endUtc: bEnd.toUTC().toJSDate(),
          timeZone, environment: "production",
        };
        const r = await computeFromEvents(metric, ctx);
        if (!r.numerator && !r.denominator && !r.sample) continue;
        rows.push({
          environment: "production", scope_key: key, scope_type: scope.chScope,
          provider_realm_id: scope.providerRealmId || "",
          metric_id: metric.metricId, metric_version: metric.version,
          bucket_start_utc: chDateTime(ctx.startUtc), bucket_end_utc: chDateTime(ctx.endUtc),
          time_zone: timeZone, dimension_signature: "@all",
          value: r.value ?? 0, numerator: r.numerator ?? 0, denominator: r.denominator ?? 0,
          coverage: 1, sample_count: r.sample ?? 0, quality: "reconciled",
        });
      }
    }
  }
  if (rows.length) {
    await ch.insert({ table: `${CH_DB}.analytics_metric_snapshots`, values: rows, format: "JSONEachRow" });
  }
}
