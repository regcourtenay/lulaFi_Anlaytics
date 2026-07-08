// Two logical databases per SDD 13.1: operational (lulafi) and analytics
// (lulafi_analytics), each with its own connection/pool.
import mongoose from "mongoose";

import { CONFIG, mongoUri } from "./config.js";

export const operationalConn = mongoose.createConnection();
export const analyticsConn = mongoose.createConnection();

export async function connectDatabases() {
  await operationalConn.openUri(mongoUri(CONFIG.DB_OPERATIONAL), {
    serverSelectionTimeoutMS: 30000,
  });
  await analyticsConn.openUri(mongoUri(CONFIG.DB_ANALYTICS), {
    serverSelectionTimeoutMS: 30000,
  });
  // eslint-disable-next-line no-console
  console.log(
    `[db] connected: operational=${CONFIG.DB_OPERATIONAL} analytics=${CONFIG.DB_ANALYTICS}`,
  );
}

export async function pingDatabases() {
  await operationalConn.db.admin().ping();
  await analyticsConn.db.admin().ping();
}
