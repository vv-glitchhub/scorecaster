import { getSupabaseAdmin } from "./supabase-admin";
import { canonicalSportFromKey } from "./sports-analytics-ingestion.mjs";

const MAX_ROWS = 300;
const CACHE_TTL_MS = 60_000;
const cache = new Map();

const NHL_METRICS = [
  "xg-for-per-60", "expected-goals-for-per-60", "xgf60", "team-xg-for-per-60",
  "xg-against-per-60", "expected-goals-against-per-60", "xga60", "team-xg-against-per-60",
  "post-shot-xg-for-per-60", "psxg-for-per-60", "post-shot-expected-goals-for-per-60", "team-post-shot-xg-for-per-60",
  "goals-saved-above-expected-per-60", "gsax-per-60", "goalie-gsax-per-60", "goals-saved-above-expected-60"
];

const SOCCER_METRICS = [
  "xg-for-per-90", "expected-goals-for-per-90", "xgf90", "team-xg-for-per-90",
  "xg-against-per-90", "expected-goals-against-per-90", "xga90", "team-xg-against-per-90",
  "post-shot-xg-for-per-90", "psxg-for-per-90", "post-shot-expected-goals-for-per-90", "team-post-shot-xg-for-per-90"
];

const BASKETBALL_METRICS = [
  "pace", "pace-per-48", "possessions-per-48", "team-pace",
  "offensive-rating", "ortg", "off-rating", "points-per-100-possessions",
  "defensive-rating", "drtg", "def-rating", "opponent-points-per-100-possessions",
  "lineup-adjusted-impact", "lineup-impact-per-100", "lineup-net-impact", "lineup-strength-adjustment"
];

const BASEBALL_METRICS = [
  "lineup-strength", "lineup-strength-z", "offense-lineup-strength",
  "bullpen-depth", "bullpen-depth-z", "relief-pitching-strength",
  "starting-pitcher-xwoba-allowed", "pitcher-xwoba-allowed", "xwoba-allowed", "xwoba",
  "park-adjusted-strength", "park-factor-z"
];

const METRICS_BY_SPORT = Object.freeze({
  ice_hockey: NHL_METRICS,
  soccer: SOCCER_METRICS,
  basketball: BASKETBALL_METRICS,
  baseball: BASEBALL_METRICS
});

const BLOCKED_PROVIDERS = new Set([
  "scorecaster-unified-data", "the-odds-api", "odds-market", "polymarket", "open-meteo", "thesportsdb"
]);

function clean(value, limit = 180) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function key(value, limit = 120) {
  return clean(value, limit).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function eventId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.id, 180);
}

function horizonFor(pick = {}, now = Date.now()) {
  const commence = timestamp(pick.commenceTime || pick.commence_time);
  return new Date(commence === null ? now : Math.min(now, commence)).toISOString();
}

function sportFor(pick = {}) {
  return canonicalSportFromKey(pick.sportKey || pick.league || pick.sportTitle || "unknown");
}

function serializeRow(row = {}) {
  return {
    eventId: row.event_id,
    participantId: row.participant_id,
    family: row.family,
    metric: row.metric,
    value: row.value === null || row.value === undefined ? null : Number(row.value),
    unit: row.unit,
    observedAt: row.observed_at,
    capturedAt: row.captured_at,
    provider: row.provider,
    sourceTrust: Number(row.source_trust || 0),
    confidence: Number(row.confidence || 0),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {}
  };
}

function cacheKey(id, sport, horizon) {
  return `${id}|${sport}|${horizon.slice(0, 16)}`;
}

function getCached(id, sport, horizon, now) {
  const value = cache.get(cacheKey(id, sport, horizon));
  if (!value || now - value.cachedAt > CACHE_TTL_MS) return null;
  return value.payload;
}

function setCached(id, sport, horizon, now, payload) {
  cache.set(cacheKey(id, sport, horizon), { cachedAt: now, payload });
  if (cache.size > 300) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

export async function loadPregameAdvancedShadowInputs(pick = {}, { now = Date.now() } = {}) {
  const id = eventId(pick);
  const horizon = horizonFor(pick, now);
  const sport = sportFor(pick);
  const metrics = METRICS_BY_SPORT[sport] || [];
  if (!id || !metrics.length) {
    return {
      ok: false,
      mode: "not-applicable",
      eventId: id || null,
      sport,
      horizon,
      observations: [],
      reason: !id ? "missing-event-id" : "unsupported-sport"
    };
  }

  const cached = getCached(id, sport, horizon, now);
  if (cached) return { ...cached, cached: true };

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, mode: "unavailable", eventId: id, sport, horizon, observations: [], reason: "supabase-admin-not-configured", cached: false };
  }

  try {
    const { data, error } = await admin
      .from("sports_analytics_observations")
      .select("event_id,participant_id,family,metric,value,unit,observed_at,captured_at,provider,source_trust,confidence,metadata")
      .eq("event_id", id)
      .in("metric", metrics)
      .lte("observed_at", horizon)
      .lte("captured_at", horizon)
      .order("observed_at", { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw error;

    const observations = (Array.isArray(data) ? data : [])
      .map(serializeRow)
      .filter((row) => row.value !== null && Number.isFinite(row.value))
      .filter((row) => !BLOCKED_PROVIDERS.has(key(row.provider, 100)));

    const payload = {
      ok: observations.length > 0,
      mode: observations.length > 0 ? "stored-pregame-advanced" : "no-independent-advanced-data",
      eventId: id,
      sport,
      horizon,
      observations,
      providerCount: new Set(observations.map((row) => clean(row.provider, 100)).filter(Boolean)).size,
      newestObservedAt: observations.map((row) => row.observedAt).filter(Boolean).sort().at(-1) || null,
      reason: observations.length > 0 ? null : "no-independent-advanced-observations-before-horizon",
      cached: false
    };
    setCached(id, sport, horizon, now, payload);
    return payload;
  } catch (error) {
    const payload = {
      ok: false,
      mode: "degraded",
      eventId: id,
      sport,
      horizon,
      observations: [],
      reason: process.env.NODE_ENV === "production" ? "advanced-shadow-inputs-unavailable" : String(error),
      cached: false
    };
    setCached(id, sport, horizon, now, payload);
    return payload;
  }
}

export const NHL_ADVANCED_SHADOW_METRICS = Object.freeze([...NHL_METRICS]);
export const SOCCER_ADVANCED_SHADOW_METRICS = Object.freeze([...SOCCER_METRICS]);
export const BASKETBALL_ADVANCED_SHADOW_METRICS = Object.freeze([...BASKETBALL_METRICS]);
export const BASEBALL_ADVANCED_SHADOW_METRICS = Object.freeze([...BASEBALL_METRICS]);
