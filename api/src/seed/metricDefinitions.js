// Upsert the governed metric catalogue into analytics_metric_definitions.
// Active versions are immutable in production (SDD 14.2); for the POC we upsert
// idempotently so the catalogue is always present after boot.
import { MetricDefinition } from "../models/analytics.js";
import { METRIC_CATALOGUE } from "../metrics/catalogue.js";

export async function syncMetricDefinitions() {
  const ops = METRIC_CATALOGUE.map((m) => ({
    updateOne: {
      filter: { metricId: m.metricId, version: m.version },
      update: {
        $set: {
          metricId: m.metricId, version: m.version, name: m.name, unit: m.unit ?? "count",
          domain: m.domain, calculationType: m.calculationType, numerator: m.numerator ?? null,
          denominator: m.denominator ?? null, dimensions: m.dimensions ?? [],
          suppression: { minimumDenominator: m.suppression?.minimumDenominator ?? 0 },
          refresh: m.refresh ?? "PT15M", correctionWindow: m.correctionWindow ?? "P7D",
          status: "active", accessClassification: m.accessClassification ?? ["provider", "global"],
          higherIsBetter: m.higherIsBetter !== false, description: m.description,
          owner: "platform.metrics", effectiveFrom: new Date("2026-05-01T00:00:00Z"),
        },
      },
      upsert: true,
    },
  }));
  if (ops.length) await MetricDefinition.bulkWrite(ops, { ordered: false });
  console.log(`[seed] metric definitions synced: ${ops.length}`);
}
