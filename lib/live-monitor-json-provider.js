import { createHash } from "node:crypto";
import { getCollectorSource, sourceCanCollect, sourceCanPublish } from "./collector-source-registry.mjs";

export const LIVE_MONITOR_PROVIDER_CONTRACT_VERSION = "scorecaster-live-monitor-provider-v1";

const SUPPORTED_SPORT_PREFIXES = ["soccer", "icehockey", "basketball", "baseball", "americanfootball"];
const SUPPORTED_MARKETS = new Set(["h2h", "spreads", "totals"]);
const STATUSES = new Set(["scheduled", "live", "paused", "suspended", "final", "postponed", "cancelled"]);
const CLOCK_DIRECTIONS = new Set(["up", "down", "unknown"]);
const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);
const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const bool = (value) => value === true || ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];

function supportedSport(value) {
  const sport = clean(value, 100).toLowerCase();
  return SUPPORTED_SPORT_PREFIXES.some((prefix) => sport === prefix || sport.startsWith(`${prefix}_`));
}

function https(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function deterministicId(parts) {
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex");
}

function eventRegistry(events = []) {
  return new Map(array(events).map((event) => {
    const eventId = clean(event.eventId ?? event.event_id ?? event.id, 180);
    return [eventId, {
      eventId,
      sport: clean(event.sport ?? event.sportKey ?? event.sport_key, 100).toLowerCase(),
      league: clean(event.league ?? event.leagueTitle ?? event.sport_title, 140) || null,
      homeTeam: clean(event.homeTeam ?? event.home_team, 140) || null,
      awayTeam: clean(event.awayTeam ?? event.away_team, 140) || null,
      commenceTime: iso(event.commenceTime ?? event.commence_time ?? event.kickoffAt)
    }];
  }).filter(([eventId, event]) => eventId && supportedSport(event.sport) && event.commenceTime));
}

function normalizePrices(value, observedAt) {
  return array(value).map((row) => ({
    bookmaker: clean(row?.bookmaker ?? row?.bookmakerKey, 120),
    market: clean(row?.market, 40).toLowerCase(),
    selection: clean(row?.selection, 160),
    price: finite(row?.price),
    available: row?.available !== false,
    observedAt: iso(row?.observedAt ?? row?.observed_at) || observedAt
  })).filter((row) => row.bookmaker && SUPPORTED_MARKETS.has(row.market) && row.selection && row.price > 1 && row.observedAt).slice(0, 250);
}

function normalizeProbabilities(value) {
  const entries = Object.entries(object(value)).map(([key, raw]) => [clean(key, 80), finite(raw)])
    .filter(([key, probability]) => key && probability !== null && probability >= 0 && probability <= 1);
  const total = entries.reduce((sum, [, probability]) => sum + probability, 0);
  if (!entries.length || total <= 0) return {};
  return Object.fromEntries(entries.map(([key, probability]) => [key, Number((probability / total).toFixed(6))]));
}

function normalizeRecord(record, index, events, options) {
  const collectedAt = options.collectedAt;
  const eventId = clean(record.eventId ?? record.event_id, 180);
  const event = events.get(eventId);
  const sourceId = clean(record.sourceId ?? record.source_id ?? options.sourceId, 100).toLowerCase();
  const providerId = clean(record.providerId ?? record.provider_id, 100).toLowerCase();
  const sport = clean(record.sport ?? event?.sport, 100).toLowerCase();
  const league = clean(record.league ?? event?.league, 140) || null;
  const market = clean(record.market || "h2h", 40).toLowerCase();
  const status = clean(record.status, 30).toLowerCase();
  const clockDirection = clean((record.clockDirection ?? record.clock_direction) || "unknown", 20).toLowerCase();
  const observedAt = iso(record.observedAt ?? record.observed_at);
  const providerUpdatedAt = iso(record.providerUpdatedAt ?? record.provider_updated_at) || observedAt;
  const capturedAt = iso(record.capturedAt ?? record.captured_at) || collectedAt;
  const homeScore = finite(record.homeScore ?? record.home_score);
  const awayScore = finite(record.awayScore ?? record.away_score);
  const period = finite(record.period);
  const clockSeconds = finite(record.clockSeconds ?? record.clock_seconds);
  const correction = bool(record.correction);
  const correctionReason = clean(record.correctionReason ?? record.correction_reason, 300) || null;
  const providerReference = clean(record.providerReference ?? record.provider_reference ?? record.id, 300);
  const supersedesReference = clean(record.supersedesProviderReference ?? record.supersedes_provider_reference, 300) || null;
  const errors = [];

  if (!event) errors.push("unknown-event");
  if (!sourceId || sourceId !== options.sourceId) errors.push("source-id-mismatch");
  if (!providerId) errors.push("missing-provider-id");
  if (!supportedSport(sport)) errors.push("unsupported-sport");
  if (!SUPPORTED_MARKETS.has(market)) errors.push("unsupported-market");
  if (!STATUSES.has(status)) errors.push("unsupported-status");
  if (!CLOCK_DIRECTIONS.has(clockDirection)) errors.push("unsupported-clock-direction");
  if (!observedAt || !providerUpdatedAt || !capturedAt) errors.push("missing-timestamp");
  for (const value of [observedAt, providerUpdatedAt, capturedAt]) {
    if (value && Date.parse(value) > Date.parse(collectedAt) + 5000) errors.push("future-timestamp");
  }
  if (homeScore === null || homeScore < 0 || awayScore === null || awayScore < 0) errors.push("invalid-score");
  if (period !== null && period < 0) errors.push("invalid-period");
  if (clockSeconds !== null && clockSeconds < 0) errors.push("invalid-clock");
  if (correction && !correctionReason) errors.push("correction-reason-required");
  if (!providerReference) errors.push("provider-reference-required");

  const id = deterministicId([sourceId, providerId, eventId, providerReference || index]);
  const supersedesId = supersedesReference ? deterministicId([sourceId, providerId, eventId, supersedesReference]) : null;
  return {
    id,
    errors: [...new Set(errors)],
    row: {
      id,
      event_id: eventId,
      sport,
      league,
      market,
      provider_id: providerId,
      source_id: sourceId,
      status,
      period: period === null ? null : Math.round(period),
      clock_seconds: clockSeconds === null ? null : Math.round(clockSeconds),
      clock_direction: clockDirection,
      home_team: clean(record.homeTeam ?? record.home_team ?? event?.homeTeam, 140) || null,
      away_team: clean(record.awayTeam ?? record.away_team ?? event?.awayTeam, 140) || null,
      home_score: homeScore === null ? 0 : Math.round(homeScore),
      away_score: awayScore === null ? 0 : Math.round(awayScore),
      commence_time: event?.commenceTime || null,
      observed_at: observedAt,
      provider_updated_at: providerUpdatedAt,
      captured_at: capturedAt,
      correction,
      correction_reason: correctionReason,
      supersedes_id: supersedesId,
      metrics: object(record.metrics),
      prices: normalizePrices(record.prices, observedAt),
      live_probabilities: normalizeProbabilities(record.liveProbabilities ?? record.live_probabilities),
      live_model_version: clean(record.liveModelVersion ?? record.live_model_version, 120) || null,
      paper_only: true
    }
  };
}

export function liveMonitorProviderConfiguration(env = process.env) {
  const sourceId = clean(env.LIVE_MONITOR_SOURCE_ID || env.COLLECTOR_JSON_SOURCE_ID || "configured_json_api", 100).toLowerCase();
  const source = getCollectorSource(sourceId, env);
  const collection = sourceCanCollect(source, { production: env.NODE_ENV === "production" });
  const publication = sourceCanPublish(source);
  const authMode = clean(env.LIVE_MONITOR_AUTH_MODE || "bearer", 40).toLowerCase();
  const hasApiKey = Boolean(env.LIVE_MONITOR_API_KEY || env.COLLECTOR_JSON_API_KEY);
  const retentionDays = Number.parseInt(String(env.LIVE_MONITOR_RETENTION_DAYS ?? ""), 10);
  const contractReferenceConfigured = Boolean(clean(env.LIVE_MONITOR_CONTRACT_REFERENCE, 200));
  const liveDataAllowed = bool(env.LIVE_MONITOR_LIVE_DATA_ALLOWED);
  const displayAllowed = bool(env.LIVE_MONITOR_DISPLAY_ALLOWED);
  const gates = {
    endpointConfigured: Boolean(source?.baseUrl),
    httpsEndpoint: Boolean(source?.baseUrl && https(source.baseUrl)),
    sourceEnabled: Boolean(source?.enabled),
    workerEnabled: bool(env.LIVE_MONITOR_ENABLED),
    commercialUseAllowed: Boolean(source?.commercialUseAllowed),
    liveDataAllowed,
    displayAllowed,
    contractReferenceConfigured,
    retentionDefined: Number.isFinite(retentionDays) && retentionDays >= 0,
    attributionReady: source?.attributionRequired !== true || Boolean(source?.attribution),
    authenticationReady: authMode === "ip_allowlist" || authMode === "none" || (authMode === "bearer" && hasApiKey),
    registryApproved: collection.allowed && publication.allowed
  };
  const failedGates = Object.entries(gates).filter(([, passed]) => !passed).map(([key]) => key);
  const contractReady = failedGates.length === 0;
  return {
    sourceId,
    configured: Boolean(source?.baseUrl),
    enabled: bool(env.LIVE_MONITOR_ENABLED),
    sourceEnabled: Boolean(source?.enabled),
    productionAllowed: contractReady,
    contractReady,
    blockedReason: failedGates[0] || (!collection.allowed ? collection.reason : !publication.allowed ? publication.reason : null),
    failedGates,
    gates,
    baseUrl: source?.baseUrl ? "configured" : null,
    hasApiKey,
    authMode,
    accessMode: source?.accessMode || "disabled",
    license: source?.license || "unverified",
    commercialUseAllowed: Boolean(source?.commercialUseAllowed),
    liveDataAllowed,
    displayAllowed,
    contractReferenceConfigured,
    retentionDays: Number.isFinite(retentionDays) && retentionDays >= 0 ? retentionDays : null,
    rawPayloadStored: false
  };
}

export function normalizeLiveMonitorBatch(records = [], options = {}) {
  const env = options.env || process.env;
  const sourceId = clean(options.sourceId || env.LIVE_MONITOR_SOURCE_ID || env.COLLECTOR_JSON_SOURCE_ID || "configured_json_api", 100).toLowerCase();
  const source = getCollectorSource(sourceId, env);
  const collection = sourceCanCollect(source, { production: env.NODE_ENV === "production" });
  const publication = sourceCanPublish(source);
  const collectedAt = iso(options.collectedAt) || new Date().toISOString();
  const events = eventRegistry(options.events);
  if (!collection.allowed || !publication.allowed) {
    return {
      received: array(records).length,
      accepted: [],
      rejected: array(records).map((record, index) => ({ index, id: clean(record?.id, 100) || null, errors: [`source-${!collection.allowed ? collection.reason : publication.reason}`] }))
    };
  }
  const normalized = array(records).slice(0, 10000).map((record, index) => normalizeRecord(record, index, events, { sourceId, collectedAt }));
  return {
    received: normalized.length,
    accepted: normalized.filter((item) => !item.errors.length),
    rejected: normalized.filter((item) => item.errors.length).map((item) => ({ id: item.id, errors: item.errors }))
  };
}

export async function fetchLiveMonitorRecords(events = [], options = {}) {
  const env = options.env || process.env;
  const configuration = liveMonitorProviderConfiguration(env);
  if (!configuration.enabled) return { ok: true, mode: "disabled", configuration, sourceId: configuration.sourceId, normalized: { received: 0, accepted: [], rejected: [] } };
  const source = getCollectorSource(configuration.sourceId, env);
  if (!source?.baseUrl) return { ok: true, mode: "unconfigured", configuration, sourceId: configuration.sourceId, normalized: { received: 0, accepted: [], rejected: [] } };
  if (!configuration.productionAllowed) return { ok: true, mode: "blocked", reason: configuration.blockedReason, configuration, sourceId: configuration.sourceId, normalized: { received: 0, accepted: [], rejected: [] } };
  if (!https(source.baseUrl)) return { ok: false, mode: "blocked", reason: "https-required", configuration, sourceId: configuration.sourceId, normalized: { received: 0, accepted: [], rejected: [] } };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(60000, Number(options.timeoutMs || 20000))));
  const collectedAt = new Date().toISOString();
  try {
    const response = await fetch(source.baseUrl, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...((env.LIVE_MONITOR_API_KEY || env.COLLECTOR_JSON_API_KEY) ? { authorization: `Bearer ${env.LIVE_MONITOR_API_KEY || env.COLLECTOR_JSON_API_KEY}` } : {})
      },
      body: JSON.stringify({
        version: LIVE_MONITOR_PROVIDER_CONTRACT_VERSION,
        requestedAt: collectedAt,
        events: array(events).slice(0, 250).map((event) => ({
          eventId: clean(event.eventId ?? event.event_id ?? event.id, 180),
          sport: clean(event.sport ?? event.sportKey ?? event.sport_key, 100),
          league: clean(event.league ?? event.leagueTitle, 140) || null,
          homeTeam: clean(event.homeTeam ?? event.home_team, 140) || null,
          awayTeam: clean(event.awayTeam ?? event.away_team, 140) || null,
          commenceTime: iso(event.commenceTime ?? event.commence_time ?? event.kickoffAt)
        }))
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, mode: "error", reason: `provider-http-${response.status}`, configuration, sourceId: configuration.sourceId, normalized: { received: 0, accepted: [], rejected: [] } };
    const records = array(payload?.records || payload?.data);
    const normalized = normalizeLiveMonitorBatch(records, { events, sourceId: configuration.sourceId, collectedAt, env });
    return { ok: true, mode: "live", configuration, sourceId: configuration.sourceId, normalized };
  } catch (error) {
    return { ok: false, mode: "error", reason: error?.name === "AbortError" ? "provider-timeout" : "provider-request-failed", configuration, sourceId: configuration.sourceId, normalized: { received: 0, accepted: [], rejected: [] } };
  } finally {
    clearTimeout(timer);
  }
}
