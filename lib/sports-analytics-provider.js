import { getSportsAnalyticsDefinition } from "./sports-analytics-catalog.mjs";
import { canonicalSportFromKey, normalizeExternalAnalyticsPayload } from "./sports-analytics-ingestion.mjs";

const MAX_RESPONSE_BYTES = 2_000_000;
const TIMEOUT_MS = 20_000;
const NHL_XG_GOALIE_REQUESTED_METRICS = Object.freeze([
  "xg-for-per-60",
  "xg-against-per-60",
  "post-shot-xg-for-per-60",
  "goals-saved-above-expected-per-60"
]);

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function configuredUrl() {
  const raw = String(process.env.SPORTS_ANALYTICS_API_URL || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return url;
  } catch {
    return null;
  }
}

function requestedMetricsForSport(sport, definition) {
  const metrics = Object.values(definition?.families || {}).flat();
  if (sport === "ice_hockey") metrics.push(...NHL_XG_GOALIE_REQUESTED_METRICS);
  return [...new Set(metrics)].slice(0, 300);
}

function requestedModelContracts(sport) {
  if (sport !== "ice_hockey") return [];
  return [{
    modelId: "nhl-xg-goalie-poisson-v1",
    mode: "pregame-shadow-inputs",
    requiredMetrics: ["xg-for-per-60", "xg-against-per-60", "goals-saved-above-expected-per-60"],
    optionalMetrics: ["post-shot-xg-for-per-60"],
    participantContract: {
      teamMetrics: "participantId should identify the team or metadata.side/metadata.team should map to home or away",
      goalieMetric: "participantId should identify the goalie and metadata must include team/side plus starter=true for a confirmed starting goalie"
    },
    chronology: "every observation must have observedAt no later than the prediction horizon",
    units: "per-60",
    independentFromMarketPricing: true
  }];
}

function matchPayload(match = {}) {
  const sport = canonicalSportFromKey(match.sportKey || match.sport || match.league);
  const definition = getSportsAnalyticsDefinition(sport);
  return {
    contract: "scorecaster-sports-analytics-v2",
    event: {
      eventId: clean(match.eventId, 180),
      sport,
      sportKey: clean(match.sportKey || match.sport, 120),
      league: clean(match.league, 140),
      homeTeam: clean(match.homeTeam, 140),
      awayTeam: clean(match.awayTeam, 140),
      commenceTime: match.commenceTime || null,
      venue: clean(match.venue, 180)
    },
    requestedFamilies: Object.keys(definition?.families || {}),
    requestedMetrics: requestedMetricsForSport(sport, definition),
    requestedModelContracts: requestedModelContracts(sport),
    policy: {
      noPersonalAccountData: true,
      noBetExecution: true,
      chronologyRequired: true,
      marketPricingCannotBeUsedAsIndependentModelInput: true,
      paperOnly: true
    }
  };
}

async function boundedJson(response) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error("Sports analytics provider response is too large");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("Sports analytics provider response is too large");
  return JSON.parse(text);
}

export function sportsAnalyticsProviderConfiguration() {
  const url = configuredUrl();
  return {
    configured: Boolean(url),
    source: clean(process.env.SPORTS_ANALYTICS_PROVIDER_NAME || (url ? url.hostname : "external-sports-analytics"), 80),
    transport: url ? "https-post" : "not-configured",
    contract: "scorecaster-sports-analytics-v2",
    nhlXgGoalieInputsRequested: true,
    timeoutMs: TIMEOUT_MS,
    maxResponseBytes: MAX_RESPONSE_BYTES
  };
}

export async function fetchExternalSportsAnalytics(match = {}, { capturedAt = new Date().toISOString() } = {}) {
  const url = configuredUrl();
  const configuration = sportsAnalyticsProviderConfiguration();
  if (!url) {
    return {
      ok: false,
      mode: "not-configured",
      source: configuration.source,
      retrievedAt: capturedAt,
      observations: [],
      golfShots: [],
      reason: "SPORTS_ANALYTICS_API_URL is not configured"
    };
  }

  const apiKey = String(process.env.SPORTS_ANALYTICS_API_KEY || "").trim();
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Scorecaster-Sports-Analytics/2.0"
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(matchPayload(match)),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) {
      return {
        ok: false,
        mode: "degraded",
        source: configuration.source,
        retrievedAt: capturedAt,
        observations: [],
        golfShots: [],
        reason: `Provider returned HTTP ${response.status}`
      };
    }
    const payload = await boundedJson(response);
    const normalized = normalizeExternalAnalyticsPayload(payload, {
      sport: canonicalSportFromKey(match.sportKey || match.sport || match.league),
      eventId: match.eventId,
      league: match.league,
      observedAt: payload?.observedAt || payload?.generatedAt || capturedAt,
      capturedAt,
      provider: payload?.provider || configuration.source,
      sourceTrust: payload?.sourceTrust ?? 0.75,
      confidence: payload?.confidence ?? 0.7
    });
    return {
      ok: true,
      mode: "live",
      source: normalized.provider || configuration.source,
      retrievedAt: capturedAt,
      observations: normalized.observations,
      golfShots: normalized.golfShots,
      reason: null
    };
  } catch (error) {
    return {
      ok: false,
      mode: "degraded",
      source: configuration.source,
      retrievedAt: capturedAt,
      observations: [],
      golfShots: [],
      reason: process.env.NODE_ENV === "production" ? "External analytics provider unavailable" : String(error)
    };
  }
}

export const SPORTS_ANALYTICS_PROVIDER_TIMEOUT_MS = TIMEOUT_MS;
export const SPORTS_ANALYTICS_PROVIDER_MAX_RESPONSE_BYTES = MAX_RESPONSE_BYTES;
export const SPORTS_ANALYTICS_NHL_XG_GOALIE_REQUESTED_METRICS = NHL_XG_GOALIE_REQUESTED_METRICS;
