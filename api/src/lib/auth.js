// POC authentication. The production design uses Authentik/OIDC (SDD 16); for an
// offline Pi 5 demo this is replaced by local passphrase login that issues a
// bearer JWT. The resolved AnalyticsAccessContext (SDD 16.1 / T50) is derived
// server-side from the authenticated user and never from client input.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { CONFIG } from "../config.js";
import { User, Provider } from "../models/operational.js";

export async function hashPassphrase(passphrase) {
  return bcrypt.hash(passphrase, 10);
}

export async function login(logon, passphrase) {
  const user = await User.findOne({ logon: logon.trim().toLowerCase() }).select("+passphraseHash");
  if (!user) return null;
  const ok = await bcrypt.compare(passphrase, user.passphraseHash);
  if (!ok) return null;
  const token = jwt.sign({ sub: user._id.toString(), logon: user.logon }, CONFIG.JWT_SECRET, {
    expiresIn: `${CONFIG.AUTH_TOKEN_TTL_HOURS}h`,
  });
  return { token, user };
}

// Resolve the server-side access context. Provider realm is taken from the
// authoritative user->provider relationship, never from a client override.
export async function resolveAccessContext(userDoc) {
  const isProvider = userDoc.type === "provider";
  const ctx = {
    userId: userDoc._id.toString(),
    logon: userDoc.logon,
    displayName: userDoc.displayName,
    userType: isProvider ? "provider" : "vendor",
    providerRealmId: isProvider ? userDoc.providerRealmId?.toString() ?? null : null,
    providerApplicationStatus: userDoc.providerApplicationStatus,
    seededStateLabel: userDoc.seededStateLabel,
    organisationUnitIds: [],
    geographyScopes: [],
    permissions: userDoc.permissions || [],
    environmentScopes: ["production"],
    detailClass: "aggregate",
  };
  if (ctx.permissions.includes("analytics.admin.sensitive_detail") || ctx.permissions.includes("analytics.provider.drilldown")) {
    ctx.detailClass = "pseudonymous";
  }
  if (isProvider && ctx.providerRealmId) {
    const provider = await Provider.findById(ctx.providerRealmId).lean();
    if (provider) {
      ctx.providerName = provider.name;
      ctx.timeZone = provider.timeZone;
      ctx.commercialEnabled = provider.config?.commercialEnabled ?? false;
    }
  }
  return ctx;
}

// Express middleware: verify bearer token and attach access context.
export function authMiddleware() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      if (!token) return res.status(401).json(problem("unauthorised", "Authentication required", 401, req));
      const payload = jwt.verify(token, CONFIG.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (!user) return res.status(401).json(problem("unauthorised", "Unknown user", 401, req));
      req.user = user;
      req.access = await resolveAccessContext(user);
      return next();
    } catch (e) {
      return res.status(401).json(problem("unauthorised", "Invalid or expired token", 401, req));
    }
  };
}

// Require one of the given permissions (SDD 16.3 step 4).
export function requirePermission(...perms) {
  return (req, res, next) => {
    const held = req.access?.permissions || [];
    if (perms.some((p) => held.includes(p))) return next();
    // Do not disclose resource existence (SDD 15.1); generic forbidden.
    return res.status(403).json(problem("forbidden", "You do not have access to this resource", 403, req));
  };
}

// RFC7807-style problem response with correlation id (SDD 15.5 / T48).
export function problem(code, title, status, req, extra = {}) {
  return {
    type: `https://lulafi/errors/${code}`,
    title,
    status,
    correlationId: req?.correlationId || null,
    ...extra,
  };
}
