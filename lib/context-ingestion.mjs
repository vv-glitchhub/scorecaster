import { createHash } from "node:crypto";
import { getCollectorSource, sourceCanCollect, sourceCanPublish } from "./collector-source-registry.mjs";

export const CONTEXT_INGESTION_VERSION = "scorecaster-context-ingestion-v1";

const CATEGORIES = new Set([
  "lineup", "injury", "suspension", "availability", "rest", "travel",
  "weather", "surface", "official"
]);
const TEAM_ROLES = new Set(["home", "away", "event"]);
const CONFIRMATIONS = new Set(["confirmed", "probable", "unconfirmed", "rumor"]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clean = (value, max = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

function sourceReference(record, canonical) {
  const supplied = clean(
    record.sourceReference ?? record.source_reference ?? record.providerRecordId ?? record.provider_record_id ?? record.id,
    300
  );
  if (supplied) return supplied;
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function deterministicUuid(sourceId, reference) {
  const hex = createHash("sha256").update(`${sourceId}:${reference}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function inferredImpact(record) {
  const explicit = finite(record.impact);
  if (explicit !== null) return clamp(explicit, -1, 1);

  const participation = finite(record.expectedParticipationDelta ?? record.expected_participation_delta);
  if (participation !== null) return clamp(participation, -1, 1);

  const minutes = finite(record.expectedMinutesDelta ?? record.expected_minutes_delta);
  if (minutes === null) return 0;
  const baseline = clamp(finite(record.minutesBaseline ?? record.minutes_baseline) ?? 90, 1, 240);
  const importance = clamp(finite(record.roleImportance ?? record.role_importance) ?? 0.5, 0, 1);
  return clamp((minutes / baseline) * importance, -1, 1);
}

function publicNote(record) {
  const note = clean(record.publicNote ?? record.public_note ?? record.note, 500);
  const details = [];
  const minutes = finite(record.expectedMinutesDelta ?? record.expected_minutes_delta);
  const highImpactRole = clean(record.highImpactRole ?? record.high_impact_role, 100);
  if (minutes !== null) details.push(`expected minutes delta ${Math.round(minutes)}`);
  if (highImpactRole) details.push(`role ${highImpactRole}`);
  return clean([note, ...details].filter(Boolean).join(" · "), 500) || null;
}

function eventMap(events = []) {
  return new Map((Array.isArray(events) ? events : []).map((event) => {
    const eventId = clean(event.eventId ?? event.event_id ?? event.id, 180);
    return [eventId, {
      eventId,
      sport: clean(event.sport ?? event.sportKey ?? event.sport_key, 100) || null,
      league: clean(event.league ?? event.sportTitle ?? event.sport_title, 140) || null,
      homeTeam: clean(event.homeTeam ?? event.home_team, 140) || null,
      awayTeam: clean(event.awayTeam ?? event.away_team, 140) || null,
      kickoffAt: iso(event.kickoffAt ?? event.commenceTime ?? event.commence_time)
    }];
  }).filter(([eventId, event]) => eventId && event.kickoffAt));
}

function normalizeRecord(record, index, events, options) {
  const collectedAt = iso(options.collectedAt) || new Date().toISOString();
  const eventId = clean(record.eventId ?? record.event_id, 180);
  const event = events.get(eventId);
  const sourceId = clean(record.sourceId ?? record.source_id ?? options.sourceId, 80).toLowerCase();
  const category = clean(record.category, 40).toLowerCase();
  const teamRole = clean(record.teamRole ?? record.team_role, 20).toLowerCase();
  const confirmation = clean(record.confirmation, 30).toLowerCase();
  const observedAt = iso(record.observedAt ?? record.observed_at);
  const effectiveAt = iso(record.effectiveAt ?? record.effective_at) || observedAt;
  const expiresAt = iso(record.expiresAt ?? record.expires_at);
  const errors = [];

  if (!eventId || !event) errors.push("unknown-event");
  if (!CATEGORIES.has(category)) errors.push("unsupported-category");
  if (!TEAM_ROLES.has(teamRole)) errors.push("unsupported-team-role");
  if (!CONFIRMATIONS.has(confirmation)) errors.push("unsupported-confirmation");
  if (!sourceId) errors.push("missing-source-id");
  if (!observedAt) errors.push("missing-observed-at");
  if (observedAt && Date.parse(observedAt) > Date.parse(collectedAt)) errors.push("future-observation");
  if (event?.kickoffAt && observedAt && Date.parse(observedAt) >= Date.parse(event.kickoffAt)) errors.push("post-kickoff-observation");
  if (event?.kickoffAt && effectiveAt && Date.parse(effectiveAt) > Date.parse(event.kickoffAt)) errors.push("effective-after-kickoff");
  if (expiresAt && observedAt && Date.parse(expiresAt) <= Date.parse(observedAt)) errors.push("invalid-expiry-order");

  const source = sourceId ? getCollectorSource(sourceId, options.env) : null;
  const collection = sourceCanCollect(source, { production: options.env?.NODE_ENV === "production" });
  const publication = sourceCanPublish(source);
  if (!collection.allowed) errors.push(`source-${collection.reason}`);
  if (!publication.allowed) errors.push(`publication-${publication.reason}`);

  const subject = clean(record.subject, 160);
  const status = clean(record.status, 120);
  if (!subject) errors.push("missing-subject");
  if (!status) errors.push("missing-status");

  const canonical = {
    eventId,
    sourceId,
    category,
    teamRole,
    subject,
    status,
    confirmation,
    observedAt
  };
  const reference = sourceReference(record, canonical);
  const confidence = clamp(finite(record.confidence) ?? 0, 0, 1);
  const sourceTrust = clamp(finite(record.sourceTrust ?? record.source_trust) ?? 0.5, 0, 1);

  return {
    ok: errors.length === 0,
    index,
    errors,
    sourceReference: reference,
    supersedesSourceReference: clean(
      record.supersedesSourceReference ?? record.supersedes_source_reference,
      300
    ) || null,
    row: event ? {
      id: deterministicUuid(sourceId, reference),
      event_id: event.eventId,
      sport: event.sport,
      league: event.league,
      kickoff_at: event.kickoffAt,
      team_role: teamRole,
      team: clean(record.team, 140) || (teamRole === "home" ? event.homeTeam : teamRole === "away" ? event.awayTeam : null),
      category,
      subject,
      status,
      confirmation,
      impact: inferredImpact(record),
      confidence,
      source_trust: sourceTrust,
      source_id: sourceId,
      observed_at: observedAt,
      effective_at: effectiveAt,
      expires_at: expiresAt,
      public_note: publicNote(record),
      source_reference: reference
    } : null
  };
}

export function normalizeContextBatch(records = [], options = {}) {
  const events = eventMap(options.events);
  const env = options.env || process.env;
  const normalized = (Array.isArray(records) ? records : [])
    .slice(0, 5000)
    .map((record, index) => normalizeRecord(record || {}, index, events, {
      ...options,
      env
    }));

  const accepted = [];
  const rejected = [];
  const seen = new Set();
  for (const item of normalized) {
    const key = `${item.row?.source_id || "unknown"}:${item.sourceReference || item.index}`;
    if (item.ok && seen.has(key)) {
      rejected.push({ index: item.index, sourceReference: item.sourceReference, errors: ["duplicate-in-batch"] });
      continue;
    }
    if (item.ok) {
      seen.add(key);
      accepted.push(item);
    } else {
      rejected.push({ index: item.index, sourceReference: item.sourceReference, errors: item.errors });
    }
  }

  return {
    ok: rejected.length === 0,
    version: CONTEXT_INGESTION_VERSION,
    received: normalized.length,
    accepted,
    rejected,
    eventCount: events.size,
    paperOnly: true
  };
}

export function contextProviderConfiguration(env = process.env) {
  const sourceId = clean(env.COLLECTOR_JSON_SOURCE_ID || "configured_json_api", 80).toLowerCase();
  const source = getCollectorSource(sourceId, env);
  const permission = sourceCanCollect(source, { production: env.NODE_ENV === "production" });
  return {
    version: CONTEXT_INGESTION_VERSION,
    sourceId,
    configured: Boolean(source?.baseUrl),
    enabled: Boolean(source?.enabled),
    productionAllowed: permission.allowed,
    blockedReason: permission.reason,
    endpoint: source?.baseUrl ? "configured" : null,
    apiKeyConfigured: Boolean(env.COLLECTOR_JSON_API_KEY),
    commercialUseAllowed: Boolean(source?.commercialUseAllowed),
    accessMode: source?.accessMode || "disabled",
    license: source?.license || "unverified",
    paperOnly: true
  };
}
