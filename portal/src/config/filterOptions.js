// Known value options for allow-listed filter dimensions (SDD 18.1). The API
// re-validates; the UI only offers governed values.
export const FILTER_OPTIONS = {
  channel: ["mobile", "portal", "push", "sms", "email"],
  deviceClass: ["phone", "tablet", "desktop"],
  priority: ["low", "medium", "high"],
  team: ["intake", "review", "compliance"],
  connectorType: ["kyc", "payments", "sms", "email", "geocode"],
  campaign: ["spring-launch", "retention", "referral"],
  placement: ["feed", "banner", "sidebar"],
  template: ["welcome", "reminder", "statement", "verify"],
  conversationType: ["support", "onboarding", "billing"],
  errorClass: ["timeout", "rejected", "unreachable"],
};

export const PRESETS = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
];
export const COMPARE = [
  { value: "none", label: "No comparison" },
  { value: "previous_period", label: "Previous period" },
  { value: "prior_year", label: "Prior year" },
];
export const GRANULARITY = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];
