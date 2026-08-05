import {
  SOURCE_REGISTRY_VERSION,
  getCollectorSource,
  listCollectorSources,
  sourceCanPublish
} from "./collector-source-registry.mjs";

const SAFE_ID = /^[a-z0-9_.:-]{1,180}$/i;
const MAX_TEXT = 500;

function clean(value, limit = MAX_TEXT) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanId(value, limit = 180) {
  const normalized = clean(value, limit);
  return SAFE_ID.test(normalized) ? normalized : null;
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function publicMetadata(source) {
  return Object.freeze({
    registryVersion: SOURCE_REGISTRY_VERSION,
    id: source.id,
    name: source.name,
    type: source.type,
    accessMode: source.accessMode,
    status: source.status,
    enabled: source.enabled,
    commercialUseAllowed: source.commercialUseAllowed,
    redistributionAllowed: source.redistributionAllowed,
    modelTrainingAllowed: source.modelTrainingAllowed,
    attributionRequired: source.attributionRequired,
    attribution: source.attribution,
    license: source.license,
    termsUrl: source.termsUrl,
    sports: source.sports,
    updateCadence: source.updateCadence,
    freshnessMinutes: source.freshnessMinutes,
    retentionDays: source.retentionDays,
    outageBehavior: source.outageBehavior,
    publicFields: source.publicFields,
    restrictedFields: source.restrictedFields,
    rawPayloadPublic: false,
    notes: source.notes
  });
}

export function publicSourceRegistry(env = process.env) {
  return listCollectorSources(env).map(publicMetadata);
}

export function publicSourceRegistrySummary(env = process.env) {
  const sources = publicSourceRegistry(env);
  return {
    version: SOURCE_REGISTRY_VERSION,
    total: sources.length,
    enabled: sources.filter((source) => source.enabled).length,
    production: sources.filter((source) => source.status === "production").length,
    researchOnly: sources.filter((source) => source.status === "research-only").length,
    publishable: sources.filter((source) => sourceCanPublish(getCollectorSource(source.id, env)).allowed).length,
    attributionRequired: sources.filter((source) => source.attributionRequired).length,
    rawPayloadsPublic: 0,
    sources
  };
}

export function sourceFreshness(sourceId, observedAt, now = Date.now(), env = process.env) {
  const source = getCollectorSource(sourceId, env);
  if (!source) return { status: "unknown-source", ageMinutes: null, thresholdMinutes: null, fresh: false };
  const timestamp = Date.parse(String(observedAt || ""));
  if (!Number.isFinite(timestamp)) {
    return { status: "unknown", ageMinutes: null, thresholdMinutes: source.freshnessMinutes, fresh: false };
  }
  const ageMinutes = Math.max(0, (Number(now) - timestamp) / 60000);
  const threshold = source.freshnessMinutes;
  const status = ageMinutes <= threshold
    ? "fresh"
    : ageMinutes <= threshold * 2
      ? "aging"
      : "stale";
  return {
    status,
    ageMinutes: Number(ageMinutes.toFixed(1)),
    thresholdMinutes: threshold,
    fresh: status === "fresh"
  };
}

export function sourcePublicationDecision(sourceId, fieldNames = [], env = process.env) {
  const source = getCollectorSource(sourceId, env);
  const permission = sourceCanPublish(source);
  if (!permission.allowed) return { allowed: false, reason: permission.reason, blockedFields: fieldNames };

  const requested = [...new Set(fieldNames.map((field) => clean(field, 80)).filter(Boolean))];
  const allowedSet = new Set(source.publicFields);
  const restrictedSet = new Set(source.restrictedFields);
  const blockedFields = requested.filter((field) => restrictedSet.has(field) || !allowedSet.has(field));
  return {
    allowed: blockedFields.length === 0,
    reason: blockedFields.length ? "field-not-public" : null,
    blockedFields,
    attributionRequired: source.attributionRequired,
    attribution: source.attribution
  };
}

export function sanitizePublicSourceRecord(record = {}, env = process.env) {
  const sourceId = clean(record.sourceId ?? record.source_id, 80).toLowerCase();
  const source = getCollectorSource(sourceId, env);
  const permission = sourceCanPublish(source);
  if (!permission.allowed) {
    return { ok: false, reason: permission.reason, sourceId: sourceId || null, record: null };
  }

  const normalized = {
    sourceId,
    eventId: cleanId(record.eventId ?? record.event_id),
    entityId: cleanId(record.entityId ?? record.entity_id),
    sport: clean(record.sport, 80) || null,
    league: clean(record.league, 120) || null,
    metric: clean(record.metric, 120) || null,
    value: finite(record.value),
    unit: clean(record.unit, 40) || null,
    observedAt: record.observedAt ?? record.observed_at ?? null,
    collectedAt: record.collectedAt ?? record.collected_at ?? null,
    confidence: finite(record.confidence),
    sourceTrust: finite(record.sourceTrust ?? record.source_trust)
  };

  const allowed = new Set(source.publicFields);
  const publicRecord = Object.fromEntries(
    Object.entries(normalized).filter(([field, value]) => allowed.has(field) && value !== undefined)
  );
  const freshness = sourceFreshness(sourceId, normalized.observedAt, Date.now(), env);

  return {
    ok: true,
    reason: null,
    sourceId,
    record: {
      ...publicRecord,
      freshness,
      attribution: source.attributionRequired ? source.attribution : null,
      registryVersion: SOURCE_REGISTRY_VERSION
    },
    strippedFields: Object.keys(record).filter((field) => !allowed.has(field)),
    rawPayloadPublic: false
  };
}

export function assertPublicSourceRecords(records = [], env = process.env) {
  const accepted = [];
  const rejected = [];
  for (const record of Array.isArray(records) ? records : []) {
    const result = sanitizePublicSourceRecord(record, env);
    if (result.ok) accepted.push(result.record);
    else rejected.push({ sourceId: result.sourceId, reason: result.reason });
  }
  return {
    ok: rejected.length === 0,
    accepted,
    rejected,
    registryVersion: SOURCE_REGISTRY_VERSION
  };
}
