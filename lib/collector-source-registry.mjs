export const SOURCE_REGISTRY_VERSION = "scorecaster-source-registry-v1";

const SOURCE_TYPES = new Set(["internal", "api", "open_dataset", "manual_import"]);
const ACCESS_MODES = new Set(["production", "research", "disabled"]);
const DEFAULT_PUBLIC_FIELDS = Object.freeze([
  "sourceId", "eventId", "entityId", "sport", "league", "metric", "value", "unit",
  "observedAt", "collectedAt", "confidence", "sourceTrust"
]);
const DEFAULT_RESTRICTED_FIELDS = Object.freeze([
  "apiKey", "authorization", "cookie", "headers", "rawPayload", "providerPayload",
  "requestUrl", "accountId", "userId", "email", "ipAddress"
]);

function clean(value, limit = 240) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function integer(value, fallback, min = 0, max = 525600) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function stringList(value, fallback = [], limit = 60) {
  const items = Array.isArray(value) ? value : String(value || "").split(",");
  const normalized = items.map((item) => clean(item, limit)).filter(Boolean);
  return normalized.length ? [...new Set(normalized)] : [...fallback];
}

function normalizeSource(source = {}) {
  const id = clean(source.id, 80).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const type = SOURCE_TYPES.has(source.type) ? source.type : "api";
  const accessMode = ACCESS_MODES.has(source.accessMode) ? source.accessMode : "disabled";
  const enabled = Boolean(source.enabled) && accessMode !== "disabled";
  return Object.freeze({
    id,
    name: clean(source.name || id, 120),
    type,
    accessMode,
    enabled,
    status: !enabled ? (accessMode === "research" ? "research-only" : "disabled") : accessMode === "production" ? "production" : accessMode,
    commercialUseAllowed: Boolean(source.commercialUseAllowed),
    redistributionAllowed: Boolean(source.redistributionAllowed),
    modelTrainingAllowed: Boolean(source.modelTrainingAllowed),
    attributionRequired: Boolean(source.attributionRequired),
    attribution: clean(source.attribution, 240) || null,
    license: clean(source.license, 160) || "unverified",
    termsUrl: clean(source.termsUrl, 500) || null,
    baseUrl: clean(source.baseUrl, 500) || null,
    sports: stringList(source.sports, [], 60).slice(0, 30),
    updateCadence: clean(source.updateCadence, 120) || "provider-dependent",
    freshnessMinutes: integer(source.freshnessMinutes, 180, 1),
    retentionDays: integer(source.retentionDays, 30, 0, 3650),
    outageBehavior: clean(source.outageBehavior, 240) || "fail-closed; mark unavailable and do not invent replacement data",
    publicFields: stringList(source.publicFields, DEFAULT_PUBLIC_FIELDS, 80),
    restrictedFields: stringList(source.restrictedFields, DEFAULT_RESTRICTED_FIELDS, 80),
    rawPayloadPublic: false,
    notes: clean(source.notes, 500) || null
  });
}

function builtinSources(env = process.env) {
  return [
    normalizeSource({
      id: "scorecaster_internal",
      name: "Scorecaster normalized first-party data",
      type: "internal",
      accessMode: "production",
      enabled: true,
      commercialUseAllowed: true,
      redistributionAllowed: true,
      modelTrainingAllowed: true,
      attributionRequired: false,
      license: "first-party",
      sports: ["multi-sport"],
      updateCadence: "event-driven",
      freshnessMinutes: 180,
      retentionDays: 730,
      notes: "Scorecaster calculations and normalized records. Raw upstream payloads remain governed by their original provider."
    }),
    normalizeSource({
      id: "the_odds_api",
      name: "The Odds API",
      type: "api",
      accessMode: "production",
      enabled: Boolean(clean(env.ODDS_API_KEY, 20)),
      commercialUseAllowed: true,
      redistributionAllowed: false,
      modelTrainingAllowed: false,
      attributionRequired: true,
      attribution: "Market odds: The Odds API",
      license: "commercial application use; no standalone raw-data redistribution",
      termsUrl: "https://the-odds-api.com/terms-and-conditions.html",
      baseUrl: "https://api.the-odds-api.com/v4",
      sports: ["multi-sport"],
      updateCadence: "provider and subscription dependent",
      freshnessMinutes: 15,
      retentionDays: 365,
      publicFields: [
        "sourceId", "eventId", "sport", "league", "metric", "value", "unit",
        "observedAt", "collectedAt", "confidence", "sourceTrust"
      ],
      restrictedFields: [...DEFAULT_RESTRICTED_FIELDS, "bookmakerRawPayload", "providerHeaders", "quota"],
      notes: "Normalized prices may be shown in the Scorecaster user interface. The API key, raw response and standalone downloadable feed remain private."
    }),
    normalizeSource({
      id: "veikkaus_public_data",
      name: "Veikkaus API Developer Portal discovery",
      type: "api",
      accessMode: "disabled",
      enabled: false,
      commercialUseAllowed: false,
      redistributionAllowed: false,
      modelTrainingAllowed: false,
      attributionRequired: false,
      license: "Veikkaus API Developer Portal EULA; documentation/testing purpose only by default; broader reuse requires prior approval",
      termsUrl: "https://dev.developer.api.veikkaus.fi/terms",
      baseUrl: null,
      sports: ["multi-sport"],
      updateCadence: "unverified",
      freshnessMinutes: 15,
      retentionDays: 0,
      publicFields: [
        "sourceId", "eventId", "sport", "league", "metric", "value", "unit",
        "observedAt", "collectedAt", "confidence", "sourceTrust"
      ],
      restrictedFields: [...DEFAULT_RESTRICTED_FIELDS, "x-apikey", "session", "ticket", "cashOut", "customerContext", "undocumentedEndpoint"],
      notes: "Official Veikkaus API Developer Portal identified, but API catalogue access requires sign-in and administrator-approved API access. No production data endpoint or commercial/display permission is recorded. The portal EULA limits default use to reviewing documentation/testing APIs and restricts broader Veikkaus Data use without prior approval. Collection remains disabled."
    }),
    normalizeSource({
      id: "manual_licensed_import",
      name: "Manual licensed import",
      type: "manual_import",
      accessMode: "production",
      enabled: true,
      commercialUseAllowed: true,
      redistributionAllowed: false,
      modelTrainingAllowed: true,
      attributionRequired: false,
      license: "operator-confirmed",
      sports: ["multi-sport"],
      updateCadence: "manual",
      freshnessMinutes: 1440,
      retentionDays: 730,
      notes: "Only for files whose rights, provenance and permitted fields have been independently verified by the operator."
    }),
    normalizeSource({
      id: "statsbomb_open",
      name: "StatsBomb Open Data",
      type: "open_dataset",
      accessMode: "research",
      enabled: false,
      commercialUseAllowed: false,
      redistributionAllowed: false,
      modelTrainingAllowed: true,
      attributionRequired: true,
      attribution: "StatsBomb Open Data",
      license: "verify-before-use",
      termsUrl: "https://github.com/statsbomb/open-data",
      sports: ["soccer"],
      updateCadence: "dataset release dependent",
      freshnessMinutes: 10080,
      retentionDays: 3650,
      notes: "Research adapter stays disabled in production until written commercial and display rights are recorded."
    }),
    normalizeSource({
      id: "moneypuck_research",
      name: "MoneyPuck research data",
      type: "open_dataset",
      accessMode: "research",
      enabled: false,
      commercialUseAllowed: false,
      redistributionAllowed: false,
      modelTrainingAllowed: true,
      attributionRequired: true,
      attribution: "MoneyPuck.com",
      license: "non-commercial-by-default",
      termsUrl: "https://moneypuck.com/data.htm",
      sports: ["ice_hockey"],
      updateCadence: "dataset release dependent",
      freshnessMinutes: 1440,
      retentionDays: 3650,
      notes: "Research only unless the operator obtains explicit commercial permission."
    })
  ];
}

function configuredJsonSource(env = process.env) {
  const baseUrl = clean(env.COLLECTOR_JSON_API_URL, 500);
  if (!baseUrl) return null;
  const accessMode = clean(env.COLLECTOR_JSON_ACCESS_MODE, 20).toLowerCase() || "disabled";
  return normalizeSource({
    id: env.COLLECTOR_JSON_SOURCE_ID || "configured_json_api",
    name: env.COLLECTOR_JSON_SOURCE_NAME || "Configured JSON API",
    type: "api",
    accessMode,
    enabled: bool(env.COLLECTOR_JSON_ENABLED),
    commercialUseAllowed: bool(env.COLLECTOR_JSON_COMMERCIAL_ALLOWED),
    redistributionAllowed: bool(env.COLLECTOR_JSON_REDISTRIBUTION_ALLOWED),
    modelTrainingAllowed: bool(env.COLLECTOR_JSON_TRAINING_ALLOWED),
    attributionRequired: bool(env.COLLECTOR_JSON_ATTRIBUTION_REQUIRED),
    attribution: env.COLLECTOR_JSON_ATTRIBUTION,
    license: env.COLLECTOR_JSON_LICENSE || "operator-configured",
    termsUrl: env.COLLECTOR_JSON_TERMS_URL,
    baseUrl,
    sports: String(env.COLLECTOR_JSON_SPORTS || "multi-sport").split(","),
    updateCadence: env.COLLECTOR_JSON_UPDATE_CADENCE || "operator-configured",
    freshnessMinutes: integer(env.COLLECTOR_JSON_FRESHNESS_MINUTES, 180, 1),
    retentionDays: integer(env.COLLECTOR_JSON_RETENTION_DAYS, 30, 0, 3650),
    publicFields: stringList(env.COLLECTOR_JSON_PUBLIC_FIELDS, DEFAULT_PUBLIC_FIELDS, 80),
    restrictedFields: stringList(env.COLLECTOR_JSON_RESTRICTED_FIELDS, DEFAULT_RESTRICTED_FIELDS, 80),
    outageBehavior: env.COLLECTOR_JSON_OUTAGE_BEHAVIOR,
    notes: "Generic server-only JSON adapter. Production collection is fail-closed until rights flags are explicitly enabled."
  });
}

export function listCollectorSources(env = process.env) {
  const configured = configuredJsonSource(env);
  return configured ? [...builtinSources(env), configured] : builtinSources(env);
}

export function getCollectorSource(id, env = process.env) {
  const key = clean(id, 80).toLowerCase();
  return listCollectorSources(env).find((source) => source.id === key) || null;
}

export function sourceCanCollect(source, { production = true } = {}) {
  if (!source || !source.enabled) return { allowed: false, reason: "source-disabled" };
  if (production && source.accessMode !== "production") return { allowed: false, reason: "not-production-approved" };
  if (production && !source.commercialUseAllowed) return { allowed: false, reason: "commercial-rights-not-confirmed" };
  return { allowed: true, reason: null };
}

export function sourceCanPublish(source) {
  if (!source) return { allowed: false, reason: "unknown-source" };
  if (source.accessMode !== "production") return { allowed: false, reason: "research-only" };
  if (!source.commercialUseAllowed) return { allowed: false, reason: "commercial-rights-not-confirmed" };
  if (!source.enabled) return { allowed: false, reason: "source-disabled" };
  return { allowed: true, reason: null };
}

export function collectorRegistrySummary(env = process.env) {
  const sources = listCollectorSources(env);
  return {
    version: SOURCE_REGISTRY_VERSION,
    total: sources.length,
    enabled: sources.filter((source) => source.enabled).length,
    productionApproved: sources.filter((source) => sourceCanCollect(source).allowed).length,
    publishable: sources.filter((source) => sourceCanPublish(source).allowed).length,
    researchOnly: sources.filter((source) => source.accessMode === "research").length,
    sources
  };
}
