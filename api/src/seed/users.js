// The eight login accounts from the supplied user image. Logons and passphrases
// are taken verbatim. All five provider realms are now active and seeded with 2
// months of data, so every provider login shows a populated dashboard.

export const ALL_PERMISSIONS = [
  "analytics.provider.view", "analytics.provider.drilldown", "analytics.provider.export",
  "analytics.provider.configure", "analytics.provider.commercial", "analytics.admin.view",
  "analytics.admin.provider_detail", "analytics.admin.sensitive_detail", "analytics.operations.view",
  "analytics.data_quality.view", "analytics.metric.manage", "analytics.report.schedule",
  "analytics.alert.manage", "analytics.audit.view",
];

// Full active-provider permission set (used by every provider login).
const PROVIDER_PERMS = [
  "analytics.provider.view", "analytics.provider.drilldown", "analytics.provider.export",
  "analytics.provider.configure", "analytics.provider.commercial", "analytics.report.schedule",
  "analytics.alert.manage",
];

// providerKey links a provider login to a seeded Provider realm (providers.js).
export const SEED_USERS = [
  {
    logon: "admin", passphrase: "amber falcon rides the midnight tide",
    displayName: "Platform Administrator", type: "vendor",
    seededStateLabel: "Administrator/super user", providerApplicationStatus: "none",
    permissions: [...ALL_PERMISSIONS],
  },
  {
    logon: "operator", passphrase: "quiet baobab guards the winter road",
    displayName: "Take-on Operator", type: "vendor",
    seededStateLabel: "Take-on operator", providerApplicationStatus: "none",
    permissions: [
      "analytics.admin.view", "analytics.operations.view", "analytics.data_quality.view",
      "analytics.audit.view",
    ],
  },
  {
    logon: "approver", passphrase: "silver protea opens at first light",
    displayName: "Analytics Approver", type: "vendor",
    seededStateLabel: "Approver/overrides", providerApplicationStatus: "none",
    permissions: [
      "analytics.admin.view", "analytics.admin.provider_detail", "analytics.admin.sensitive_detail",
      "analytics.metric.manage", "analytics.report.schedule", "analytics.alert.manage",
      "analytics.data_quality.view", "analytics.audit.view",
    ],
  },
  {
    logon: "thabo.mokoena", passphrase: "green kudu jumps over seven hills",
    displayName: "Thabo Mokoena", type: "provider",
    seededStateLabel: "Active provider", providerApplicationStatus: "active",
    providerKey: "kudu", permissions: [...PROVIDER_PERMS],
  },
  {
    logon: "ansie.vdm", passphrase: "rooibos harvest waits for morning mist",
    displayName: "Ansie van der Merwe", type: "provider",
    seededStateLabel: "Active provider", providerApplicationStatus: "active",
    providerKey: "rooibos", permissions: [...PROVIDER_PERMS],
  },
  {
    logon: "priya.naidoo", passphrase: "cardamom clouds drift over durban bay",
    displayName: "Priya Naidoo", type: "provider",
    seededStateLabel: "Active provider", providerApplicationStatus: "active",
    providerKey: "cardamom", permissions: [...PROVIDER_PERMS],
  },
  {
    logon: "sipho.dlamini", passphrase: "copper pipes sing when water runs",
    displayName: "Sipho Dlamini", type: "provider",
    seededStateLabel: "Active provider", providerApplicationStatus: "active",
    providerKey: "copper", permissions: [...PROVIDER_PERMS],
  },
  {
    logon: "charlotte.baloyi", passphrase: "paper lanterns light the limpopo sky",
    displayName: "Charlotte Baloyi", type: "provider",
    seededStateLabel: "Active provider", providerApplicationStatus: "active",
    providerKey: "limpopo", permissions: [...PROVIDER_PERMS],
  },
];
