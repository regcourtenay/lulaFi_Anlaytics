// Provider realms. All realms (the five keyed login realms + background tenants)
// are active and seeded with 2 months of events, so every provider login shows a
// populated dashboard and global/cohort/ranking analytics are rich (SDD 9.2).
const PROVINCES = ["Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Limpopo", "Free State"];
const INDUSTRIES = ["Healthcare", "Financial Services", "Retail", "Utilities", "Education", "Logistics", "Government"];
const TIERS = ["gold", "silver", "bronze"];

export const KEYED_PROVIDERS = [
  { key: "kudu", name: "Kudu Health Services", industry: "Healthcare", tier: "gold", geography: "Gauteng", onboardingMonth: "2026-01", status: "active", commercialEnabled: true, sizeFactor: 1.35, baseConversion: 0.63 },
  { key: "rooibos", name: "Rooibos Wellness Co", industry: "Healthcare", tier: "silver", geography: "Western Cape", onboardingMonth: "2026-06", status: "active", commercialEnabled: false, sizeFactor: 0.9, baseConversion: 0.58 },
  { key: "cardamom", name: "Cardamom Financial", industry: "Financial Services", tier: "gold", geography: "KwaZulu-Natal", onboardingMonth: "2026-06", status: "active", commercialEnabled: true, sizeFactor: 1.1, baseConversion: 0.55 },
  { key: "copper", name: "Copperworks Utilities", industry: "Utilities", tier: "silver", geography: "Gauteng", onboardingMonth: "2026-06", status: "active", commercialEnabled: false, sizeFactor: 0.85, baseConversion: 0.5 },
  { key: "limpopo", name: "Limpopo Lanterns", industry: "Retail", tier: "bronze", geography: "Limpopo", onboardingMonth: "2026-07", status: "active", commercialEnabled: false, sizeFactor: 0.6, baseConversion: 0.46 },
];

// Deterministic background realms.
const BACKGROUND = [
  ["Protea Legal Group", "Government", "gold", "Western Cape", "2025-11", 1.2, 0.6],
  ["Baobab Microfinance", "Financial Services", "silver", "Limpopo", "2026-02", 0.9, 0.52],
  ["Marula Retail", "Retail", "bronze", "Eastern Cape", "2026-03", 0.6, 0.44],
  ["Springbok Logistics", "Logistics", "gold", "Gauteng", "2025-12", 1.25, 0.58],
  ["Aloe Care Clinics", "Healthcare", "silver", "KwaZulu-Natal", "2026-01", 0.95, 0.61],
  ["Fynbos Education Trust", "Education", "bronze", "Western Cape", "2026-04", 0.55, 0.47],
  ["Sable Utilities", "Utilities", "silver", "Free State", "2026-02", 0.85, 0.5],
  ["Nguni Foods", "Retail", "gold", "Gauteng", "2025-10", 1.3, 0.55],
  ["Karoo Telecom", "Utilities", "gold", "Eastern Cape", "2026-01", 1.15, 0.53],
  ["Highveld Pharmacy", "Healthcare", "silver", "Gauteng", "2026-03", 0.9, 0.6],
  ["Zambezi Insurance", "Financial Services", "bronze", "KwaZulu-Natal", "2026-05", 0.5, 0.42],
  ["Table Bay Shipping", "Logistics", "silver", "Western Cape", "2026-02", 0.8, 0.49],
];

export const BACKGROUND_PROVIDERS = BACKGROUND.map(([name, industry, tier, geography, onboardingMonth, sizeFactor, baseConversion], i) => ({
  key: `bg${i + 1}`, name, industry, tier, geography, onboardingMonth,
  status: "active", commercialEnabled: tier === "gold", sizeFactor, baseConversion,
}));

export const SEED_PROVIDERS = [...KEYED_PROVIDERS, ...BACKGROUND_PROVIDERS];
export const ACTIVE_PROVIDER_KEYS = SEED_PROVIDERS.filter((p) => p.status === "active").map((p) => p.key);
