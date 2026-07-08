// Operational-domain models (existing lulaFi shapes, simplified for the POC).
// These live in the `lulafi` database. Provider realm is modelled as a stable
// tenancy boundary independent of the provider *user* account (SDD 3.4 / 16.1).
import { Schema } from "mongoose";

import { operationalConn } from "../db.js";

export const USER_TYPES = ["end", "provider", "vendor"];
// Provider take-on lifecycle used by the seeded login accounts (from the
// supplied user image). "active" is the only state with a provisioned realm.
export const PROVIDER_APPLICATION_STATUS = [
  "none", // Draft
  "in_verification",
  "pending", // Pending approval
  "blocked_banking",
  "active",
  "rejected",
];

const UserSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true, index: true },
    logon: { type: String, required: true, unique: true, index: true },
    passphraseHash: { type: String, required: true, select: false },
    type: { type: String, enum: USER_TYPES, required: true, index: true },
    displayName: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    // Provider users point at a stable Provider realm.
    providerRealmId: { type: Schema.Types.ObjectId, ref: "Provider", index: true },
    providerApplicationStatus: {
      type: String,
      enum: PROVIDER_APPLICATION_STATUS,
      default: "none",
    },
    seededStateLabel: { type: String }, // human label from the user image
    // Analytics permission codes (SDD 16.2).
    permissions: { type: [String], default: [] },
  },
  { timestamps: true },
);

const ProviderSchema = new Schema(
  {
    name: { type: String, required: true, index: true },
    registrationNumber: { type: String, required: true, unique: true },
    industry: { type: String, index: true }, // cohort dimension
    tier: { type: String, index: true }, // bronze/silver/gold
    geography: { type: String, index: true }, // SA province
    onboardingMonth: { type: String, index: true }, // YYYY-MM cohort
    timeZone: { type: String, default: "Africa/Johannesburg" },
    status: { type: String, default: "active", index: true },
    // Small denormalised config block (SDD 9.1 provider tailoring).
    config: {
      defaultCards: { type: [String], default: [] },
      commercialEnabled: { type: Boolean, default: false },
      targets: { type: Schema.Types.Mixed, default: {} },
    },
  },
  { timestamps: true },
);

const FormSchema = new Schema(
  {
    title: { type: String, required: true },
    providerRealmId: { type: Schema.Types.ObjectId, ref: "Provider", index: true },
    status: { type: String, enum: ["published", "unpublished", "draft"], default: "published" },
    version: { type: Number, default: 1 },
    category: { type: String },
  },
  { timestamps: true },
);

export const User = operationalConn.model("User", UserSchema);
export const Provider = operationalConn.model("Provider", ProviderSchema);
export const Form = operationalConn.model("Form", FormSchema);
