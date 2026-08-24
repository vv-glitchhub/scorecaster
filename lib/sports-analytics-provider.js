import { getSportsAnalyticsDefinition } from "./sports-analytics-catalog.mjs";
import { canonicalSportFromKey, normalizeExternalAnalyticsPayload } from "./sports-analytics-ingestion.mjs";
import { fetchSportmonksFootballEvidence, sportmonksFootballEvidenceConfiguration } from "./sportmonks-football-evidence-provider.js";

const MAX_RESPONSE_BYTES = 2_000_000;
const TIMEOUT_MS = 20_000;
const NHL_XG_GOALIE_REQUESTED_METRICS = Object.freeze([
  "xg-for-per-60",
  "xg-against-per-60",
  "post-shot-xg-for-per-60",
  "goals-saved-above-expected-per-60"
]);
const SOCCER_XG_REQUESTED_METRICS = Object.freeze([
  "xg-for-per-90",
  "xg-against-per-90",
  "post-shot-xg-for-per-90",
  "shots-for-per-90",
  "shots-against-per-90",
  "shots-on-target-for-per-90",
  "shots-on-target-against-per-90"
]);
const BASKETBALL_EFFICIENCY_REQUESTED_METRICS = Object.freeze([
  "pace",
  "offensive-rating",
  "defensive-rating",
  "lineup-adjusted-impact"
]);
const MLB_PITCHING_OFFENSE_REQUESTED_METRICS = Object.freeze([
  "lineup-strength",
  "bullpen-depth",
  "starting-pitcher-xwoba-allowed",
  "park-adjusted-strength"
]);

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function bool(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
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
  if (sport === "soccer") metrics.push(...SOCCER_XG_REQUESTED_METRICS);
  if (sport === "basketball") metrics.push(...BASKETBALL_EFFICIENCY_REQUESTED_METRICS);
  if (sport === "baseball") metrics.push(...MLB_PITCHING_OFFENSE_REQUESTED_METRICS);
  return [...new Set(metrics)].slice(0, 300);
}

function requestedModelContracts(sport) {
  if (sport === "ice_hockey") {
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
  if (sport === "soccer") {
    return [{
      modelId: "soccer-xg-poisson-v1",
      mode: "pregame-shadow-inputs",
      requiredMetrics: ["xg-for-per-90", "xg-against-per-90"],
      optionalMetrics: ["post-shot-xg-for-per-90", "shots-for-per-90", "shots-against-per-90", "shots-on-target-for-per-90", "shots-on-target-against-per-90"],
      participantContract: {
        teamMetrics: "participantId should identify the team or metadata.side/metadata.team should map to home or away"
      },
      chronology: "every observation must have observedAt no later than the prediction horizon",
      units: "per-90",
      independentFromMarketPricing: true
    }];
  }
  if (sport === "basketball") {
    return [{
      modelId: "basketball-efficiency-pace-v1",
      profiles: ["nba-efficiency-pace-v1", "wnba-efficiency-pace-v1"],
      mode: "pregame-shadow-inputs",
      requiredMetrics: ["pace", "offensive-rating", "defensive-rating"],
      optionalMetrics: ["lineup-adjusted-impact"],
      participantContract: {
        teamMetrics: "participantId should identify the team or metadata.side/metadata.team should map to home or away",
        lineupMetric: "lineup-adjusted-impact is a team-level points-per-100 adjustment available before the prediction horizon"
      },
      chronology: "every observation must have observedAt and capturedAt no later than the prediction horizon",
      units: "pace plus points-per-100-possessions ratings",
      independentFromMarketPricing: true
    }];
  }
  if (sport === "baseball") {
    return [{
      modelId: "mlb-pitching-offense-v1",
      mode: "pregame-shadow-inputs",
      requiredMetrics: ["lineup-strength", "bullpen-depth", "starting-pitcher-xwoba-allowed"],
      optionalMetrics: ["park-adjusted-strength"],
      participantContract: {
        teamMetrics: "lineup-strength and bullpen-depth must map to home/away team and be standardized z-scores, declared by unit or metadata.scale",
        startingPitcherMetric: "participantId identifies the pitcher; metadata must map team/side and declare starter=true or role=starting-pitcher; generic xwoba requires perspective=allowed/against",
        parkMetric: "optional park-adjusted-strength must be a standardized z-score available before first pitch"
      },
      chronology: "every observation must have observedAt and capturedAt no later than the prediction horizon",
      units: "team strength z-scores plus starting-pitcher xwOBA allowed rate",
      independentFromMarketPricing: true
    }];
  }
  return [];
}

export function buildSportsAnalyticsProviderRequest(match = {}) {
  const sport = canonicalSportFromKey(match.sportKey || match.sport || match.league);
  const definition = getSportsAnalyticsDefinition(sport);
  return {
    contract: "scorecaster-sports-analytics-v5",
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
      sourceRightsMustBeConfirmedBeforePlayEvidence: true,
      rawRedistributionAllowed: false,
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

function genericProviderConfiguration() {
  const url = configuredUrl();
  const commercialUseAllowed = bool(process.env.SPORTS_ANALYTICS_COMMERCIAL_USE_ALLOWED);
  const modelUseAllowed = bool(process.env.SPORTS_ANALYTICS_MODEL_USE_ALLOWED);
  return {
    configured: Boolean(url),
    evidenceEntitled: Boolean(url) && commercialUseAllowed && modelUseAllowed,
    source: clean(process.env.SPORTS_ANALYTICS_PROVIDER_NAME || (url ? url.hostname : "external-sports-analytics"), 80),
    transport: url ? "https-post" : "not-configured",
    contract: "scorecaster-sports-analytics-v5",
    commercialUseAllowed,
    modelUseAllowed,
    rawRedistributionAllowed: bool(process.env.SPORTS_ANALYTICS_RAW_REDISTRIBUTION_ALLOWED),
    derivedAnalysisOnly: true,
    nhlXgGoalieInputsRequested: true,
    soccerXgInputsRequested: true,
    basketballEfficiencyInputsRequested: true,
    mlbPitchingOffenseInputsRequested: true,
    timeoutMs: TIMEOUT_MS,
    maxResponseBytes: MAX_RESPONSE_BYTES
  };
}

export function sportsAnalyticsProviderConfiguration() {
  const generic = genericProviderConfiguration();
  if (generic.configured) return generic;
  const sportmonks = sportmonksFootballEvidenceConfiguration();
  if (sportmonks.configured) {
    return {
      ...sportmonks,
      evidenceEntitled: true,
      nhlXgGoalieInputsRequested: false,
      soccerXgInputsRequested: true,
      basketballEfficiencyInputsRequested: false,
      mlbPitchingOffenseInputsRequested: false,
      maxResponseBytes: sportmonks.maximumResponseBytes
    };
  }
  return {
    ...generic,
    sportmonksCandidate: {
      tokenPresent: sportmonks.tokenPresent,
      enabled: sportmonks.enabled,
      commercialUseAllowed: sportmonks.commercialUseAllowed,
      modelUseAllowed: sportmonks.modelUseAllowed,
      reason: sportmonks.reason
    }
  };
}

async function fetchGenericSportsAnalytics(match, capturedAt, url, configuration) {
  const apiKey = String(process.env.SPORTS_ANALYTICS_API_KEY || "").trim();
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Scorecaster-Sports-Analytics/5.0"
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(buildSportsAnalyticsProviderRequest(match)),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) {
      return { ok: false, mode: "degraded", source: configuration.source, retrievedAt: capturedAt, observations: [], golfShots: [], reason: `Provider returned HTTP ${response.status}` };
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
    return { ok: true, mode: "live", source: normalized.provider || configuration.source, retrievedAt: capturedAt, observations: normalized.observations, golfShots: normalized.golfShots, reason: null };
  } catch (error) {
    return { ok: false, mode: "degraded", source: configuration.source, retrievedAt: capturedAt, observations: [], golfShots: [], reason: process.env.NODE_ENV === "production" ? "External analytics provider unavailable" : String(error) };
  }
}

export async function fetchExternalSportsAnalytics(match = {}, { capturedAt = new Date().toISOString() } = {}) {
  const url = configuredUrl();
  const configuration = sportsAnalyticsProviderConfiguration();
  if (url) return fetchGenericSportsAnalytics(match, capturedAt, url, configuration);

  const sport = canonicalSportFromKey(match.sportKey || match.sport || match.league);
  if (sport === "soccer") {
    const sportmonks = await fetchSportmonksFootballEvidence(match, { capturedAt });
    if (sportmonks.ok) {
      const normalized = normalizeExternalAnalyticsPayload({ provider: sportmonks.source, observations: sportmonks.observations }, {
        sport,
        eventId: match.eventId,
        league: match.league,
        observedAt: capturedAt,
        capturedAt,
        provider: sportmonks.source,
        sourceTrust: 0.9,
        confidence: 0.75
      });
      return {
        ...sportmonks,
        observations: normalized.observations,
        golfShots: normalized.golfShots,
        entitlement: sportmonks.entitlement,
        lineageHash: sportmonks.lineageHash
      };
    }
    return sportmonks;
  }

  return {
    ok: false,
    mode: "not-configured",
    source: configuration.source,
    retrievedAt: capturedAt,
    observations: [],
    golfShots: [],
    reason: "No entitled external sports analytics provider is configured for this sport"
  };
}

export const SPORTS_ANALYTICS_PROVIDER_TIMEOUT_MS = TIMEOUT_MS;
export const SPORTS_ANALYTICS_PROVIDER_MAX_RESPONSE_BYTES = MAX_RESPONSE_BYTES;
export const SPORTS_ANALYTICS_NHL_XG_GOALIE_REQUESTED_METRICS = NHL_XG_GOALIE_REQUESTED_METRICS;
export const SPORTS_ANALYTICS_SOCCER_XG_REQUESTED_METRICS = SOCCER_XG_REQUESTED_METRICS;
export const SPORTS_ANALYTICS_BASKETBALL_EFFICIENCY_REQUESTED_METRICS = BASKETBALL_EFFICIENCY_REQUESTED_METRICS;
export const SPORTS_ANALYTICS_MLB_PITCHING_OFFENSE_REQUESTED_METRICS = MLB_PITCHING_OFFENSE_REQUESTED_METRICS;
