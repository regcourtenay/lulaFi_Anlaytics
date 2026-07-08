// Standalone seed entrypoint:  npm run seed
import { bootstrapClickHouse } from "../clickhouse.js";
import { CONFIG } from "../config.js";
import { connectDatabases } from "../db.js";
import { syncMetricDefinitions } from "./metricDefinitions.js";
import { runSeed } from "./seed.js";

(async () => {
  await connectDatabases();
  await bootstrapClickHouse();
  await syncMetricDefinitions();
  await runSeed({ months: CONFIG.SEED_MONTHS, timeZone: CONFIG.SEED_TIMEZONE });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
