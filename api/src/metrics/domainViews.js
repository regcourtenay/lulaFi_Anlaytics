// Dashboard composition per analytics domain/tab (SDD 9, 10, T27). Each domain
// declares its KPI cards, chart series and a default breakdown. One generic
// builder renders any domain, so provider tailoring is by config not by forking
// (SDD 9.1).
export const DOMAIN_VIEWS = {
  overview: {
    title: "Overview",
    cards: ["KPI-001", "KPI-002", "KPI-013", "KPI-004", "KPI-005"],
    series: ["KPI-002", "KPI-013"],
    breakdown: { metricId: "KPI-002", dimension: "channel" },
  },
  forms: {
    title: "Forms",
    cards: ["KPI-010", "KPI-011", "KPI-013", "KPI-014", "KPI-015"],
    series: ["KPI-011", "KPI-013"],
    breakdown: { metricId: "KPI-013", dimension: "formId" },
    funnel: ["form.viewed", "form.started", "form.step_completed", "form.submitted"],
  },
  operations: {
    title: "Operations",
    cards: ["KPI-020", "KPI-021", "KPI-022", "KPI-023", "KPI-005"],
    series: ["KPI-021", "KPI-022"],
    breakdown: { metricId: "KPI-022", dimension: "team" },
  },
  messaging: {
    title: "Messaging",
    cards: ["KPI-030", "KPI-031", "KPI-032", "KPI-033"],
    series: ["KPI-030", "KPI-031"],
    breakdown: { metricId: "KPI-032", dimension: "errorClass" },
  },
  notifications: {
    title: "Notifications",
    cards: ["KPI-040", "KPI-041", "KPI-042", "KPI-043", "KPI-044"],
    series: ["KPI-040", "KPI-041"],
    breakdown: { metricId: "KPI-042", dimension: "template" },
  },
  connectors: {
    title: "Connectors",
    cards: ["KPI-050", "KPI-051", "KPI-052", "KPI-053"],
    series: ["KPI-050", "KPI-051"],
    breakdown: { metricId: "KPI-051", dimension: "connectorType" },
  },
  advertising: {
    title: "Advertising",
    cards: ["KPI-060", "KPI-061", "KPI-062", "KPI-063", "KPI-064"],
    series: ["KPI-060", "KPI-061"],
    breakdown: { metricId: "KPI-061", dimension: "campaign" },
    requiresPermission: "analytics.provider.commercial",
  },
  platform: {
    title: "Platform Reliability",
    cards: ["KPI-080", "KPI-081", "KPI-082", "KPI-083"],
    series: ["KPI-080", "KPI-082"],
    breakdown: null,
    requiresPermission: "analytics.operations.view",
    globalOnly: true,
  },
  commercial: {
    title: "Commercial",
    cards: ["KPI-070", "KPI-071", "KPI-064"],
    series: ["KPI-071"],
    breakdown: { metricId: "KPI-070", dimension: "connectorType" },
    globalOnly: true,
  },
};

// Provider tabs (SDD 7.3) and Admin tabs.
export const PROVIDER_TABS = ["overview", "forms", "operations", "messaging", "notifications", "connectors", "advertising", "reports"];
export const ADMIN_TABS = ["overview", "providers", "platform", "data-quality", "advertising", "commercial", "metrics", "reports"];
