// Tab metadata for the AnalyticsShell (SDD 7.3). Keys match the `modules`
// returned by /analytics/context. kind: "domain" uses the generic dashboard;
// "special" routes to a bespoke page.
export const TAB_META = {
  overview: { label: "Overview", sub: "", kind: "domain", domain: "overview" },
  forms: { label: "Forms", sub: "forms", kind: "special", special: "forms" },
  operations: { label: "Operations", sub: "operations", kind: "domain", domain: "operations" },
  messaging: { label: "Messaging", sub: "messaging", kind: "domain", domain: "messaging" },
  notifications: { label: "Notifications", sub: "notifications", kind: "domain", domain: "notifications" },
  connectors: { label: "Connectors", sub: "connectors", kind: "domain", domain: "connectors" },
  advertising: { label: "Advertising", sub: "advertising", kind: "domain", domain: "advertising" },
  commercial: { label: "Commercial", sub: "commercial", kind: "domain", domain: "commercial" },
  platform: { label: "Platform", sub: "platform", kind: "domain", domain: "platform" },
  providers: { label: "Providers", sub: "providers", kind: "special", special: "providers" },
  "data-quality": { label: "Data Quality", sub: "data-quality", kind: "special", special: "data-quality" },
  metrics: { label: "Metrics", sub: "metrics", kind: "special", special: "metrics" },
  reports: { label: "Reports", sub: "reports", kind: "special", special: "reports" },
};

export function basePath(userType) {
  return userType === "provider" ? "/portal/provider/analytics" : "/portal/admin/analytics";
}
