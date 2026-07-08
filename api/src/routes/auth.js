// POC auth routes. Passphrase login stands in for Authentik/OIDC (SDD 16).
import { Router } from "express";

import { authMiddleware, login, resolveAccessContext } from "../lib/auth.js";
import { problem } from "../lib/auth.js";
import { User } from "../models/operational.js";

const router = Router();

// List the seeded demo login accounts (no passphrases) to populate the login UI.
router.get("/accounts", async (_req, res) => {
  const users = await User.find({}).sort({ type: 1, logon: 1 }).lean();
  res.json({
    accounts: users.map((u) => ({
      logon: u.logon, displayName: u.displayName, userType: u.type,
      seededState: u.seededStateLabel, providerApplicationStatus: u.providerApplicationStatus,
    })),
  });
});

router.post("/login", async (req, res) => {
  const { logon, passphrase } = req.body || {};
  if (!logon || !passphrase) return res.status(400).json(problem("bad-input", "logon and passphrase required", 400, req));
  const result = await login(logon, passphrase);
  if (!result) return res.status(401).json(problem("invalid-credentials", "Invalid logon or passphrase", 401, req));
  const access = await resolveAccessContext(result.user);
  res.json({ token: result.token, user: publicUser(access) });
});

router.get("/me", authMiddleware(), async (req, res) => {
  res.json({ user: publicUser(req.access) });
});

function publicUser(access) {
  return {
    id: access.userId, logon: access.logon, displayName: access.displayName,
    userType: access.userType, providerRealmId: access.providerRealmId,
    providerName: access.providerName, providerApplicationStatus: access.providerApplicationStatus,
    seededStateLabel: access.seededStateLabel, permissions: access.permissions,
    timeZone: access.timeZone || "Africa/Johannesburg",
  };
}

export default router;
