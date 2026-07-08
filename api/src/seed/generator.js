// Deterministic event generator. Produces a realistic 2-month journey stream
// per active provider realm across all analytics domains (SDD 12 taxonomy).
import { DateTime } from "luxon";
import { nanoid } from "nanoid";

// Small deterministic PRNG so re-seeding yields the same shape.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const CHANNELS = ["mobile", "portal"];
const DEVICES = ["phone", "tablet", "desktop"];
const PRIORITIES = ["low", "medium", "high"];
const TEAMS = ["intake", "review", "compliance"];
const CONNECTORS = ["kyc", "payments", "sms", "email", "geocode"];
const CAMPAIGNS = ["spring-launch", "retention", "referral"];
const PLACEMENTS = ["feed", "banner", "sidebar"];
const TEMPLATES = ["welcome", "reminder", "statement", "verify"];
const CONVO_TYPES = ["support", "onboarding", "billing"];
const ERROR_CLASSES = ["timeout", "rejected", "unreachable"];

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
function pois(rng, mean) { // small-count approximation
  let n = 0; const target = Math.max(0, mean); let acc = 0;
  while (acc < target) { acc += -Math.log(1 - rng()); n++; if (n > 5000) break; } return Math.max(0, n - 1);
}

// Generate all events for one provider across the window.
// Pushes plain objects into `out`. providerRealmId is an ObjectId.
export function generateProviderEvents(out, { provider, providerRealmId, formIds, startLocal, days, timeZone, scale }) {
  const rngBase = mulberry32(hashStr(provider.key));
  for (let d = 0; d < days; d++) {
    const dayLocal = startLocal.plus({ days: d });
    const dow = dayLocal.weekday; // 1..7
    const weekendFactor = dow >= 6 ? 0.55 : 1.0;
    const trend = 0.82 + (0.36 * d) / Math.max(days - 1, 1); // gentle growth for comparisons
    const rng = mulberry32(hashStr(`${provider.key}|${d}`));
    const factor = provider.sizeFactor * weekendFactor * trend * scale;
    const sessions = Math.max(1, Math.round(8 * factor));
    const conv = clamp((provider.baseConversion ?? 0.55) + (rng() - 0.5) * 0.06 + (trend - 1) * 0.1, 0.2, 0.9);

    const tsFor = () => dayLocal.plus({ seconds: Math.floor(rng() * 86400) }).toUTC().toJSDate();
    const base = () => ({ providerRealmId, environment: "production", occurredAtUtc: tsFor() });

    // ---- Form journeys (per session) ----
    for (let s = 0; s < sessions; s++) {
      const session = `sess_${provider.key}_${d}_${s}`;
      const actor = `hmac:v2:${hashStr(session) % 100000}`;
      const channel = pick(rng, CHANNELS);
      const device = channel === "mobile" ? pick(rng, ["phone", "tablet"]) : "desktop";
      const formId = pick(rng, formIds);
      const dims = { channel, deviceClass: device, formId };
      const views = 1 + (rng() < 0.4 ? 1 : 0);
      for (let v = 0; v < views; v++) out.push({ ...base(), eventId: nanoid(14), eventName: "form.viewed", actorType: "end_user", actorIdToken: actor, sessionIdToken: session, sourceComponent: channel, entity: { type: "form", id: formId }, result: "n/a", dimensions: dims });
      out.push({ ...base(), eventId: nanoid(14), eventName: "form.started", actorType: "end_user", actorIdToken: actor, sessionIdToken: session, sourceComponent: channel, entity: { type: "form", id: formId }, result: "n/a", dimensions: dims });
      if (rng() < 0.82) out.push({ ...base(), eventId: nanoid(14), eventName: "form.step_completed", actorType: "end_user", sessionIdToken: session, sourceComponent: channel, entity: { type: "form", id: formId }, dimensions: dims });
      if (rng() < conv) {
        out.push({ ...base(), eventId: nanoid(14), eventName: "form.submitted", actorType: "end_user", actorIdToken: actor, sessionIdToken: session, sourceComponent: channel, entity: { type: "form", id: formId }, result: "success", durationMs: Math.round(45000 + rng() * 150000), dimensions: dims });
      } else {
        out.push({ ...base(), eventId: nanoid(14), eventName: "form.abandoned", actorType: "end_user", sessionIdToken: session, sourceComponent: channel, entity: { type: "form", id: formId }, dimensions: dims });
      }
    }

    // ---- Operations / workflow ----
    const created = Math.round(sessions * 0.5);
    const completed = Math.round(sessions * 0.45);
    for (let i = 0; i < created; i++) out.push({ ...base(), eventId: nanoid(14), eventName: "workflow.created", actorType: "provider_user", sourceComponent: "portal", dimensions: { priority: pick(rng, PRIORITIES), team: pick(rng, TEAMS) } });
    for (let i = 0; i < completed; i++) {
      const priority = pick(rng, PRIORITIES);
      const breach = rng() < (priority === "high" ? 0.16 : 0.07);
      out.push({ ...base(), eventId: nanoid(14), eventName: "workflow.completed", actorType: "provider_user", sourceComponent: "portal", result: "success", durationMs: Math.round((3 + rng() * 46) * 3600000), dimensions: { priority, team: pick(rng, TEAMS), slaBreached: breach } });
    }

    // ---- Messaging ----
    const convos = Math.round(sessions * 0.3);
    const sent = Math.round(sessions * 1.4);
    for (let i = 0; i < convos; i++) out.push({ ...base(), eventId: nanoid(14), eventName: "conversation.started", actorType: "provider_user", sourceComponent: "chat", dimensions: { conversationType: pick(rng, CONVO_TYPES) } });
    for (let i = 0; i < sent; i++) {
      out.push({ ...base(), eventId: nanoid(14), eventName: "message.sent", actorType: "provider_user", sourceComponent: "chat", dimensions: { conversationType: pick(rng, CONVO_TYPES) } });
      if (rng() < 0.97) out.push({ ...base(), eventId: nanoid(14), eventName: "message.delivered", sourceComponent: "chat", result: "delivered", dimensions: {} });
      else out.push({ ...base(), eventId: nanoid(14), eventName: "message.failed", sourceComponent: "chat", result: "failure", dimensions: { errorClass: pick(rng, ERROR_CLASSES) } });
    }
    for (let i = 0; i < Math.round(convos * 1.2); i++) out.push({ ...base(), eventId: nanoid(14), eventName: "message.responded", sourceComponent: "chat", durationMs: Math.round((1 + rng() * 90) * 60000), dimensions: {} });

    // ---- Notifications ----
    const notif = Math.round(sessions * 1.1);
    for (let i = 0; i < notif; i++) {
      const channel = pick(rng, ["push", "sms", "email"]);
      const template = pick(rng, TEMPLATES);
      out.push({ ...base(), eventId: nanoid(14), eventName: "notification.sent", sourceComponent: "notification", dimensions: { channel, template } });
      if (rng() < 0.94) {
        out.push({ ...base(), eventId: nanoid(14), eventName: "notification.delivered", sourceComponent: "notification", result: "delivered", dimensions: { channel, template } });
        if (rng() < 0.42) out.push({ ...base(), eventId: nanoid(14), eventName: "notification.opened", sourceComponent: "notification", result: "opened", dimensions: { channel, template } });
        if (rng() < 0.14) out.push({ ...base(), eventId: nanoid(14), eventName: "notification.actioned", sourceComponent: "notification", result: "actioned", dimensions: { channel, template } });
      } else {
        out.push({ ...base(), eventId: nanoid(14), eventName: "notification.failed", sourceComponent: "notification", result: "failure", dimensions: { channel, errorClass: pick(rng, ERROR_CLASSES) } });
      }
    }

    // ---- Connectors ----
    const calls = Math.round(sessions * 1.0);
    for (let i = 0; i < calls; i++) {
      const connectorType = pick(rng, CONNECTORS);
      const r = rng();
      const result = r < 0.93 ? "success" : r < 0.98 ? "failure" : "timeout";
      out.push({ ...base(), eventId: nanoid(14), eventName: "connector.call", actorType: "connector", sourceComponent: "connector", result, durationMs: Math.round(80 + rng() * (result === "timeout" ? 8000 : 1200)), dimensions: { connectorType, usageUnits: 1 + Math.floor(rng() * 3), errorClass: result === "success" ? undefined : pick(rng, ERROR_CLASSES) } });
    }

    // ---- Advertising (commercial providers carry more) ----
    if (provider.commercialEnabled) {
      const impressions = Math.round(sessions * 2.2);
      for (let i = 0; i < impressions; i++) {
        const campaign = pick(rng, CAMPAIGNS);
        const viewable = rng() < 0.72;
        const invalid = rng() < 0.03;
        out.push({ ...base(), eventId: nanoid(14), eventName: "ad.impression", sourceComponent: "advertising", dimensions: { campaign, placement: pick(rng, PLACEMENTS), viewable, invalid } });
        if (viewable && !invalid && rng() < 0.02) {
          out.push({ ...base(), eventId: nanoid(14), eventName: "ad.click", sourceComponent: "advertising", dimensions: { campaign } });
          if (rng() < 0.12) out.push({ ...base(), eventId: nanoid(14), eventName: "ad.conversion", sourceComponent: "advertising", dimensions: { campaign, revenue: Math.round(20 + rng() * 240) } });
        }
      }
    }

    // ---- Billing / commercial (one per provider-day) ----
    out.push({ ...base(), eventId: nanoid(14), eventName: "billing.usage", sourceComponent: "billing", dimensions: { units: Math.round(sessions * 3.5), amount: Math.round(sessions * 3.5 * 1.8) } });
  }
}

// Global platform reliability stream (providerRealmId null).
export function generatePlatformEvents(out, { startLocal, days, timeZone, scale }) {
  for (let d = 0; d < days; d++) {
    const dayLocal = startLocal.plus({ days: d });
    const rng = mulberry32(hashStr(`platform|${d}`));
    const reqs = Math.round(320 * scale * (dayLocal.weekday >= 6 ? 0.6 : 1));
    for (let i = 0; i < reqs; i++) {
      const fail = rng() < 0.012;
      out.push({
        providerRealmId: null, environment: "production",
        occurredAtUtc: dayLocal.plus({ seconds: Math.floor(rng() * 86400) }).toUTC().toJSDate(),
        eventId: nanoid(14), eventName: "http.request", actorType: "service", sourceComponent: "platform",
        result: fail ? "failure" : "success", durationMs: Math.round(30 + rng() * (fail ? 2500 : 400)),
        errorCode: fail ? "upstream_5xx" : null, dimensions: { route: pick(rng, ["/forms", "/auth", "/analytics", "/chat", "/connectors"]) },
      });
    }
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
