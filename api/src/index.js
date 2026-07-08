// lulaFi Analytics POC API bootstrap (v1.1): MongoDB control plane + ClickHouse
// analytics data plane.
import cors from "cors";
import express from "express";
import { nanoid } from "nanoid";

import { bootstrapClickHouse, pingClickHouse } from "./clickhouse.js";
import { CONFIG } from "./config.js";
import { connectDatabases, pingDatabases } from "./db.js";
import { authMiddleware, problem } from "./lib/auth.js";
import analyticsRouter from "./routes/analytics.js";
import authRouter from "./routes/auth.js";
import { syncMetricDefinitions } from "./seed/metricDefinitions.js";
import { runSeed } from "./seed/seed.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "4mb" }));

// Correlation id on every request (SDD 6.3 / 21.4).
app.use((req, _res, next) => {
  req.correlationId = req.headers["x-correlation-id"] || `corr_${nanoid(12)}`;
  next();
});

app.get("/health", async (_req, res) => {
  const health = { status: "ok", service: "lulafi-analytics-api", version: "1.1.0", time: new Date().toISOString() };
  try {
    await pingDatabases();
    health.mongo = "ok";
  } catch (e) {
    health.status = "degraded"; health.mongo = String(e?.message || e);
  }
  try {
    health.clickhouse = (await pingClickHouse()) ? "ok" : "degraded";
    if (health.clickhouse !== "ok") health.status = "degraded";
  } catch (e) {
    health.status = "degraded"; health.clickhouse = String(e?.message || e);
  }
  res.status(health.status === "ok" ? 200 : 503).json(health);
});

app.get("/", (_req, res) => {
  res.json({ service: "lulaFi Analytics POC API", version: "1.1.0", dataPlane: "ClickHouse", controlPlane: "MongoDB", docs: "/api/v1/analytics/context (auth required)" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/analytics", authMiddleware(), analyticsRouter);

app.use((req, res) => res.status(404).json(problem("not-found", "Route not found", 404, req)));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("[error]", err);
  res.status(500).json(problem("internal-error", "An unexpected error occurred", 500, req));
});

async function start() {
  await connectDatabases();
  await bootstrapClickHouse();
  await syncMetricDefinitions();
  if (CONFIG.SEED_ON_START) {
    await runSeed({ months: CONFIG.SEED_MONTHS, timeZone: CONFIG.SEED_TIMEZONE });
  }
  app.listen(CONFIG.PORT, () => {
    console.log(`[api] lulaFi Analytics POC v1.1 listening on :${CONFIG.PORT} (env=${CONFIG.NODE_ENV})`);
  });
}

start().catch((e) => {
  console.error("[fatal] failed to start", e);
  process.exit(1);
});
