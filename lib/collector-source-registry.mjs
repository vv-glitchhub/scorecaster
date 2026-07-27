const SOURCE_TYPES = new Set(["internal", "api", "open_dataset", "manual_import"]);
const ACCESS_MODES = new Set(["production", "research", "disabled"]);

function clean(value, limit = 240) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function normalizeSource(source = {}) {
  const id = clean(source.id, 80).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const type = SOURCE_TYPES.has(source.type) ? source.type : "api";
  const accessMode = ACCESS_MODES.has(source.accessMode) ? source.accessMode : "disabled";
  return Object.freeze({
    id,
    name: clean(source.name || id, 120),
    type,
    accessMode,
    enabled: Boolean(source.enabled) && accessMode !== "disabled",
    commercialUseAllowed: Boolean(source.commercialUseAllowed),
    redistributionAllowed: Boolean(source.redistributionAllowed),
    modelTrainingAllowed: Boolean(source.modelTrainingAllowed),
    attributionRequired: Boolean(source.attributionRequired),
    attribution: clean(source.attribution, 240) || null,
    license: clean(source.license, 160) || "unverified",
    termsUrl: clean(source.termsUrl, 500) || null,
    baseUrl: clean(source.baseUrl, 500) || null,
    sports: Array.isArray(source.sports) ? source.sports.map((item) => clean(item, 60)).filter(Boolean).slice(0, 30) : [],
    notes: clean(source.notes, 500) || null
  });
}

const BUILTIN_SOURCES = [
  normalizeSource({
    id: "scorecaster_internal",
    name: "Scorecaster internal event data",
    type: "internal",
    accessMode: "production",
    enabled: true,
    commercialUseAllowed: true,
    redistributionAllowed: false,
    modelTrainingAllowed: true,
    attributionRequired: false,
    license: "first-party",
    sports: ["multi-sport"],
    notes: "Data already obtained through Scorecaster's configured providers and normalized inside Scorecaster."
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
    notes: "Only for files whose rights have been independently verified by the operator."
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
    notes: "Research adapter stays disabled in production until written commercial rights are recorded."
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
    notes: "Research only unless the operator obtains explicit commercial permission."
  })
];

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
    notes: "Generic server-only JSON adapter. Production collection is fail-closed until rights flags are explicitly enabled."
  });
}

export function listCollectorSources(env = process.env) {
  const configured = configuredJsonSource(env);
  return configured ? [...BUILTIN_SOURCES, configured] : [...BUILTIN_SOURCES];
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
  return { allowed: true, reason: null };
}

export function collectorRegistrySummary(env = process.env) {
  const sources = listCollectorSources(env);
  return {
    total: sources.length,
    enabled: sources.filter((source) => source.enabled).length,
    productionApproved: sources.filter((source) => sourceCanCollect(source).allowed).length,
    researchOnly: sources.filter((source) => source.accessMode === "research").length,
    sources
  };
}
