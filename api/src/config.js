// Central configuration for the lulaFi Analytics POC API (v1.1).
// Control plane / operational data in MongoDB; analytics data plane in ClickHouse
// (LULAFI-SDD-ANL-001 v1.1 §13). POC-safe defaults so the stack boots with zero
// required configuration.

export const CONFIG = {
  PORT: parseInt(process.env.PORT ?? "4000", 10),
  NODE_ENV: process.env.NODE_ENV ?? "development",

  DB_URI: process.env.DB_URI ?? "mongodb://127.0.0.1:27017",
  DB_OPERATIONAL: process.env.DB_OPERATIONAL ?? "lulafi",
  DB_ANALYTICS: process.env.DB_ANALYTICS ?? "lulafi_analytics",
  // Root creds live in the admin DB, so auth against it.
  DB_AUTH_SOURCE: process.env.DB_AUTH_SOURCE ?? "admin",

  // Analytics data plane (ClickHouse) - SDD v1.1 §13.
  CLICKHOUSE_URL: process.env.CLICKHOUSE_URL ?? "http://127.0.0.1:8123",
  CLICKHOUSE_DB: process.env.CLICKHOUSE_DB ?? "lulafi_analytics",
  CLICKHOUSE_USER: process.env.CLICKHOUSE_USER ?? "lulafi",
  CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD ?? "lulafi_ch_password",

  JWT_SECRET: process.env.JWT_SECRET ?? "lulafi-poc-dev-secret",
  AUTH_TOKEN_TTL_HOURS: parseInt(process.env.AUTH_TOKEN_TTL_HOURS ?? "12", 10),

  SEED_ON_START: (process.env.SEED_ON_START ?? "true") === "true",
  SEED_MONTHS: parseInt(process.env.SEED_MONTHS ?? "2", 10),
  SEED_TIMEZONE: process.env.SEED_TIMEZONE ?? "Africa/Johannesburg",

  // SDD 17.3 - minimum cohort suppression default.
  MIN_COHORT_DEFAULT: parseInt(process.env.MIN_COHORT_DEFAULT ?? "10", 10),

  // SDD 15 / 20.3 - query cost controls.
  MAX_DETAIL_ROWS: parseInt(process.env.MAX_DETAIL_ROWS ?? "500", 10),
  DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE ?? "50", 10),
  EXPORT_FILE_TTL_HOURS: parseInt(process.env.EXPORT_FILE_TTL_HOURS ?? "48", 10),
};

export function mongoUri(dbName) {
  // Insert the db name before any query string, add authSource for root creds.
  const base = CONFIG.DB_URI.replace(/\/+$/, "");
  const [host, query] = base.split("?");
  const params = new URLSearchParams(query ?? "");
  if (!params.has("authSource")) params.set("authSource", CONFIG.DB_AUTH_SOURCE);
  return `${host}/${dbName}?${params.toString()}`;
}
