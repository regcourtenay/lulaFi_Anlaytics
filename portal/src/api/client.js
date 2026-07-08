// Thin API client over the analytics endpoints (SDD 8.5 RTK-style, simplified).
const BASE = "/api/v1";
let token = localStorage.getItem("lulafi_token") || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem("lulafi_token", t);
  else localStorage.removeItem("lulafi_token");
}
export function getToken() { return token; }

async function req(path, { method = "GET", body, params } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : v);
  });
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.title || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

export const api = {
  // auth
  accounts: () => req("/auth/accounts"),
  login: (logon, passphrase) => req("/auth/login", { method: "POST", body: { logon, passphrase } }),
  me: () => req("/auth/me"),
  // analytics
  context: () => req("/analytics/context"),
  domain: (domain, params) => req(`/analytics/${domain}`, { params }),
  metric: (id, params) => req(`/analytics/metrics/${id}`, { params }),
  timeseries: (id, params) => req(`/analytics/metrics/${id}/timeseries`, { params }),
  breakdown: (id, params) => req(`/analytics/metrics/${id}/breakdown`, { params }),
  formDrill: (formId, params) => req(`/analytics/forms/${formId}`, { params }),
  providers: (params) => req("/analytics/providers", { params }),
  dataQuality: () => req("/analytics/data-quality"),
  metricDefinitions: () => req("/analytics/metric-definitions"),
  createMetricDefinition: (body) => req("/analytics/metric-definitions", { method: "POST", body }),
  savedViews: () => req("/analytics/saved-views"),
  createSavedView: (body) => req("/analytics/saved-views", { method: "POST", body }),
  exports: () => req("/analytics/exports"),
  createExport: (body) => req("/analytics/exports", { method: "POST", body }),
  exportJob: (jobId) => req(`/analytics/exports/${jobId}`),
  schedules: () => req("/analytics/report-schedules"),
  createSchedule: (body) => req("/analytics/report-schedules", { method: "POST", body }),
  alerts: () => req("/analytics/alert-rules"),
  createAlert: (body) => req("/analytics/alert-rules", { method: "POST", body }),
};
