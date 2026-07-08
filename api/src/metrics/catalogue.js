// Governed metric catalogue (SDD 13.3, 14). Each definition is versioned and
// declares its calculation type, source events, dimensions and suppression.
// The engine (engine.js) turns these into daily snapshots; the API resolves
// snapshots for cards/time-series and computes bounded detail on demand.
//
// numerator/denominator spec fields:
//   eventName   - governed domain.action to match
//   result      - optional event.result filter
//   distinctBy  - field to count distinct values of (rate/count-distinct)
//   sumField    - dimensions.<field> to sum instead of counting rows
//   field       - dimensions/duration field for percentile/duration metrics
//   where       - { 'dimensions.x': value } equality filters

export const METRIC_CATALOGUE = [
  // ---- Overview (provider + global) ----------------------------------------
  { metricId: "KPI-001", version: "1.0", name: "Active Users", unit: "count", domain: "overview",
    calculationType: "count", numerator: { eventName: "form.started", distinctBy: "actorIdToken" },
    dimensions: ["channel", "deviceClass"], suppression: { minimumDenominator: 5 },
    description: "Distinct actors who started at least one form in the period." },
  { metricId: "KPI-002", version: "1.0", name: "Submissions", unit: "count", domain: "overview",
    calculationType: "count", numerator: { eventName: "form.submitted", result: "success" },
    dimensions: ["formId", "channel"], description: "Accepted form submissions." },
  { metricId: "KPI-013", version: "1.2", name: "Start-to-Submission Conversion", unit: "percent", domain: "overview",
    calculationType: "rate",
    numerator: { eventName: "form.submitted", result: "success", distinctBy: "sessionIdToken" },
    denominator: { eventName: "form.started", distinctBy: "sessionIdToken" },
    dimensions: ["formId", "channel", "deviceClass"], suppression: { minimumDenominator: 10 },
    description: "Distinct sessions that submit divided by distinct sessions that start." },
  { metricId: "KPI-004", version: "1.0", name: "Median Turnaround", unit: "ms", domain: "overview",
    calculationType: "percentile", numerator: { eventName: "workflow.completed", field: "durationMs" },
    percentiles: ["p50", "p95"], higherIsBetter: false, description: "Time from workflow open to completion." },
  { metricId: "KPI-005", version: "1.0", name: "Open Workload", unit: "count", domain: "overview",
    calculationType: "count", numerator: { eventName: "workflow.created" },
    denominator: { eventName: "workflow.completed" }, higherIsBetter: false,
    description: "Backlog proxy: created minus completed in period." , diffMode: true },

  // ---- Forms ----------------------------------------------------------------
  { metricId: "KPI-010", version: "1.0", name: "Form Views", unit: "count", domain: "forms",
    calculationType: "count", numerator: { eventName: "form.viewed" }, dimensions: ["formId", "channel"] },
  { metricId: "KPI-011", version: "1.0", name: "Form Starts", unit: "count", domain: "forms",
    calculationType: "count", numerator: { eventName: "form.started" }, dimensions: ["formId", "channel"] },
  { metricId: "KPI-012", version: "1.0", name: "Step Completion Rate", unit: "percent", domain: "forms",
    calculationType: "rate",
    numerator: { eventName: "form.step_completed", distinctBy: "sessionIdToken" },
    denominator: { eventName: "form.started", distinctBy: "sessionIdToken" },
    dimensions: ["formId"], suppression: { minimumDenominator: 10 } },
  { metricId: "KPI-014", version: "1.0", name: "Abandonment Rate", unit: "percent", domain: "forms",
    calculationType: "rate", higherIsBetter: false,
    numerator: { eventName: "form.abandoned", distinctBy: "sessionIdToken" },
    denominator: { eventName: "form.started", distinctBy: "sessionIdToken" },
    dimensions: ["formId", "deviceClass"], suppression: { minimumDenominator: 10 } },
  { metricId: "KPI-015", version: "1.0", name: "Completion Time", unit: "ms", domain: "forms",
    calculationType: "percentile", numerator: { eventName: "form.submitted", result: "success", field: "durationMs" },
    percentiles: ["p50", "p95"], higherIsBetter: false, dimensions: ["formId"] },

  // ---- Operations (workflow / SLA) -----------------------------------------
  { metricId: "KPI-020", version: "1.0", name: "Workflows Created", unit: "count", domain: "operations",
    calculationType: "count", numerator: { eventName: "workflow.created" }, dimensions: ["priority", "team"] },
  { metricId: "KPI-021", version: "1.0", name: "Workflows Completed", unit: "count", domain: "operations",
    calculationType: "count", numerator: { eventName: "workflow.completed" }, dimensions: ["priority", "team"] },
  { metricId: "KPI-022", version: "1.1", name: "SLA Compliance", unit: "percent", domain: "operations",
    calculationType: "rate",
    numerator: { eventName: "workflow.completed", where: { "dimensions.slaBreached": false } },
    denominator: { eventName: "workflow.completed" }, dimensions: ["priority", "team"],
    suppression: { minimumDenominator: 10 }, description: "Completed within SLA / all completed." },
  { metricId: "KPI-023", version: "1.0", name: "Turnaround p95", unit: "ms", domain: "operations",
    calculationType: "percentile", numerator: { eventName: "workflow.completed", field: "durationMs" },
    percentiles: ["p50", "p95"], higherIsBetter: false, dimensions: ["priority"] },

  // ---- Messaging ------------------------------------------------------------
  { metricId: "KPI-030", version: "1.0", name: "Conversations", unit: "count", domain: "messaging",
    calculationType: "count", numerator: { eventName: "conversation.started" }, dimensions: ["conversationType"] },
  { metricId: "KPI-031", version: "1.0", name: "Message Delivery Rate", unit: "percent", domain: "messaging",
    calculationType: "rate", numerator: { eventName: "message.delivered" },
    denominator: { eventName: "message.sent" }, suppression: { minimumDenominator: 20 } },
  { metricId: "KPI-032", version: "1.0", name: "Failed Messages", unit: "count", domain: "messaging",
    calculationType: "count", numerator: { eventName: "message.failed" }, higherIsBetter: false, dimensions: ["errorClass"] },
  { metricId: "KPI-033", version: "1.0", name: "First Response Time", unit: "ms", domain: "messaging",
    calculationType: "percentile", numerator: { eventName: "message.responded", field: "durationMs" },
    percentiles: ["p50", "p95"], higherIsBetter: false },

  // ---- Notifications --------------------------------------------------------
  { metricId: "KPI-040", version: "1.0", name: "Notifications Sent", unit: "count", domain: "notifications",
    calculationType: "count", numerator: { eventName: "notification.sent" }, dimensions: ["channel", "template"] },
  { metricId: "KPI-041", version: "1.0", name: "Delivery Rate", unit: "percent", domain: "notifications",
    calculationType: "rate", numerator: { eventName: "notification.delivered" },
    denominator: { eventName: "notification.sent" }, dimensions: ["channel"], suppression: { minimumDenominator: 20 } },
  { metricId: "KPI-042", version: "1.0", name: "Open Rate", unit: "percent", domain: "notifications",
    calculationType: "rate", numerator: { eventName: "notification.opened" },
    denominator: { eventName: "notification.delivered" }, dimensions: ["channel", "template"], suppression: { minimumDenominator: 20 } },
  { metricId: "KPI-043", version: "1.0", name: "Action Rate", unit: "percent", domain: "notifications",
    calculationType: "rate", numerator: { eventName: "notification.actioned" },
    denominator: { eventName: "notification.delivered" }, dimensions: ["template"], suppression: { minimumDenominator: 20 } },
  { metricId: "KPI-044", version: "1.0", name: "Failed Notifications", unit: "count", domain: "notifications",
    calculationType: "count", numerator: { eventName: "notification.failed" }, higherIsBetter: false, dimensions: ["channel", "errorClass"] },

  // ---- Connectors -----------------------------------------------------------
  { metricId: "KPI-050", version: "1.0", name: "Connector Calls", unit: "count", domain: "connectors",
    calculationType: "count", numerator: { eventName: "connector.call" }, dimensions: ["connectorType"] },
  { metricId: "KPI-051", version: "1.0", name: "Connector Success Rate", unit: "percent", domain: "connectors",
    calculationType: "rate", numerator: { eventName: "connector.call", result: "success" },
    denominator: { eventName: "connector.call" }, dimensions: ["connectorType"], suppression: { minimumDenominator: 20 } },
  { metricId: "KPI-052", version: "1.0", name: "Connector Latency p95", unit: "ms", domain: "connectors",
    calculationType: "percentile", numerator: { eventName: "connector.call", field: "durationMs" },
    percentiles: ["p50", "p95"], higherIsBetter: false, dimensions: ["connectorType"] },
  { metricId: "KPI-053", version: "1.0", name: "Usage Units", unit: "count", domain: "connectors",
    calculationType: "count", numerator: { eventName: "connector.call", sumField: "usageUnits" }, dimensions: ["connectorType"] },

  // ---- Advertising ----------------------------------------------------------
  { metricId: "KPI-060", version: "1.0", name: "Viewable Impressions", unit: "count", domain: "advertising",
    calculationType: "count", numerator: { eventName: "ad.impression", where: { "dimensions.viewable": true } }, dimensions: ["campaign", "placement"] },
  { metricId: "KPI-061", version: "1.0", name: "Click-Through Rate", unit: "percent", domain: "advertising",
    calculationType: "rate", numerator: { eventName: "ad.click" },
    denominator: { eventName: "ad.impression", where: { "dimensions.viewable": true } }, dimensions: ["campaign"], suppression: { minimumDenominator: 50 } },
  { metricId: "KPI-062", version: "1.0", name: "Conversions", unit: "count", domain: "advertising",
    calculationType: "count", numerator: { eventName: "ad.conversion" }, dimensions: ["campaign"] },
  { metricId: "KPI-063", version: "1.0", name: "Invalid Traffic Rate", unit: "percent", domain: "advertising",
    calculationType: "rate", higherIsBetter: false,
    numerator: { eventName: "ad.impression", where: { "dimensions.invalid": true } },
    denominator: { eventName: "ad.impression" }, suppression: { minimumDenominator: 50 } },
  { metricId: "KPI-064", version: "1.0", name: "Revenue Share", unit: "currency", domain: "advertising",
    calculationType: "count", numerator: { eventName: "ad.conversion", sumField: "revenue" }, dimensions: ["campaign"], accessClassification: ["provider", "global"] },

  // ---- Commercial (global) --------------------------------------------------
  { metricId: "KPI-070", version: "1.0", name: "Billed Usage Units", unit: "count", domain: "commercial",
    calculationType: "count", numerator: { eventName: "billing.usage", sumField: "units" }, accessClassification: ["global"] },
  { metricId: "KPI-071", version: "1.0", name: "Platform Revenue", unit: "currency", domain: "commercial",
    calculationType: "count", numerator: { eventName: "billing.usage", sumField: "amount" }, accessClassification: ["global"] },

  // ---- Platform reliability (global, operations permission) -----------------
  { metricId: "KPI-080", version: "1.0", name: "Availability", unit: "percent", domain: "platform",
    calculationType: "rate", numerator: { eventName: "http.request", result: "success" },
    denominator: { eventName: "http.request" }, accessClassification: ["global"], suppression: { minimumDenominator: 50 } },
  { metricId: "KPI-081", version: "1.0", name: "Request Latency p95", unit: "ms", domain: "platform",
    calculationType: "percentile", numerator: { eventName: "http.request", field: "durationMs" },
    percentiles: ["p50", "p95"], higherIsBetter: false, accessClassification: ["global"] },
  { metricId: "KPI-082", version: "1.0", name: "Error Rate", unit: "percent", domain: "platform",
    calculationType: "rate", higherIsBetter: false,
    numerator: { eventName: "http.request", result: "failure" },
    denominator: { eventName: "http.request" }, accessClassification: ["global"], suppression: { minimumDenominator: 50 } },
  { metricId: "KPI-083", version: "1.0", name: "Traffic", unit: "count", domain: "platform",
    calculationType: "count", numerator: { eventName: "http.request" }, accessClassification: ["global"] },
];

export function metricById(id) {
  return METRIC_CATALOGUE.find((m) => m.metricId === id) ?? null;
}
export function metricsByDomain(domain) {
  return METRIC_CATALOGUE.filter((m) => m.domain === domain);
}
