import { createHash } from "node:crypto";

export const BASKETBALL_EFFICIENCY_SHADOW_VERSION = "basketball-efficiency-shadow-v1";

const FUTURE_SKEW_MS = 60_000;
const MIN_TRUST = 0.55;
const MIN_CONFIDENCE = 0.45;
const MAX_LINEUP_ADJUSTMENT = 5;

const PROFILES = Object.freeze({
  basketball_nba: Object.freeze({
    modelId: "nba-efficiency-pace-v1",
    modelVersion: "nba-efficiency-pace-shadow-v1",
    league: "NBA",
    minPace: 85,
    maxPace: 115,
    homeAdvantagePoints: 2.5,
    logisticScale: 6.5
  }),
  basketball_wnba: Object.freeze({
    modelId: "wnba-efficiency-pace-v1",
    modelVersion: "wnba-efficiency-pace-shadow-v1",
    league: "WNBA",
    minPace: 75,
    maxPace: 110,
    homeAdvantagePoints: 2.0,
    logisticScale: 6.0
  })
});

const BLOCKED_PROVIDERS = new Set([
  "scorecaster-unified-data",
  "the-odds-api",
  "odds-market",
  "polymarket",
  "open-meteo",
  "thesportsdb"
]);

const METRICS = Object.freeze({
  pace: new Set(["pace", "pace-per-48", "possessions-per-48", "team-pace"]),
  offensiveRating: new Set(["offensive-rating", "ortg", "off-rating", "points-per-100-possessions"]),
  defensiveRating: new Set(["defensive-rating", "drtg", "def-rating", "opponent-points-per-100-possessions"]),
  lineupImpact: new Set(["lineup-adjusted-impact", "lineup-impact-per-100", "lineup-net-impact", "lineup-strength-adjustment"])
});

function clean(value, limit = 180) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function key(value, limit = 180) {
  return clean(value, limit).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value, digits = 6) {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value) {
  const parsed = timestamp(value);
  return parsed === null ? null : new Date(parsed).toISOString();
}

function horizonFor(pick = {}, now = Date.now()) {
  const commence = timestamp(pick.commenceTime || pick.commence_time);
  return new Date(commence === null ? now : Math.min(now, commence)).toISOString();
}

function profileFor(pick = {}) {
  const sportKey = key(pick.sportKey || pick.league || pick.sportTitle, 120).replaceAll("-", "_");
  if (sportKey.includes("wnba")) return PROFILES.basketball_wnba;
  if (sportKey.includes("nba") || sportKey === "basketball") return PROFILES.basketball_nba;
  return null;
}

function teamSide(observation = {}, pick = {}) {
  const metadata = observation.metadata && typeof observation.metadata === "object" ? observation.metadata : {};
  const explicit = key(metadata.teamSide || metadata.side || metadata.team_side, 40);
  if (explicit === "home" || explicit === "away") return explicit;
  const home = key(pick.homeTeam, 140);
  const away = key(pick.awayTeam, 140);
  const team = key(metadata.team || metadata.teamName || metadata.team_name, 140);
  const participant = key(observation.participantId || observation.participant_id, 140);
  if (team && team === home) return "home";
  if (team && team === away) return "away";
  if (participant && participant === home) return "home";
  if (participant && participant === away) return "away";
  return null;
}

function metricKind(metric) {
  const normalized = key(metric, 120);
  for (const [kind, aliases] of Object.entries(METRICS)) if (aliases.has(normalized)) return kind;
  return null;
}

function chronologySafe(observation, horizonTime) {
  const observed = timestamp(observation.observedAt || observation.observed_at);
  const captured = timestamp(observation.capturedAt || observation.captured_at);
  if (observed === null || captured === null) return false;
  return observed <= horizonTime + FUTURE_SKEW_MS && captured <= horizonTime + FUTURE_SKEW_MS;
}

function eligibleObservation(observation, horizonTime) {
  const provider = key(observation.provider, 100);
  if (!provider || BLOCKED_PROVIDERS.has(provider)) return false;
  const trust = finite(observation.sourceTrust ?? observation.source_trust);
  const confidence = finite(observation.confidence);
  if (trust === null || trust < MIN_TRUST || confidence === null || confidence < MIN_CONFIDENCE) return false;
  return chronologySafe(observation, horizonTime) && metricKind(observation.metric) !== null;
}

function newest(rows, predicate) {
  return rows.filter(predicate).toSorted((a, b) => (timestamp(b.observedAt || b.observed_at) || 0) - (timestamp(a.observedAt || a.observed_at) || 0))[0] || null;
}

function selectInputs(pick, observations, horizon) {
  const horizonTime = timestamp(horizon);
  const eligible = observations.filter((row) => eligibleObservation(row, horizonTime));
  const values = {};
  for (const side of ["home", "away"]) {
    for (const kind of ["pace", "offensiveRating", "defensiveRating", "lineupImpact"]) {
      values[`${side}_${kind}`] = newest(eligible, (row) => teamSide(row, pick) === side && metricKind(row.metric) === kind);
    }
  }
  return { eligible, values };
}

function valueOf(row) {
  return finite(row?.value);
}

function selectedSide(pick = {}) {
  const selection = key(pick.selection || pick.label, 140);
  if (!selection) return null;
  if (selection === key(pick.homeTeam, 140)) return "home";
  if (selection === key(pick.awayTeam, 140)) return "away";
  return null;
}

function provenance(rows = []) {
  const used = rows.filter(Boolean);
  const trust = used.map((row) => finite(row.sourceTrust ?? row.source_trust)).filter((value) => value !== null);
  const confidence = used.map((row) => finite(row.confidence)).filter((value) => value !== null);
  return {
    providers: [...new Set(used.map((row) => clean(row.provider, 100)).filter(Boolean))].sort(),
    metrics: [...new Set(used.map((row) => key(row.metric, 120)).filter(Boolean))].sort(),
    observedAtMax: used.map((row) => iso(row.observedAt || row.observed_at)).filter(Boolean).sort().at(-1) || null,
    sourceTrustMin: trust.length ? Math.min(...trust) : null,
    confidenceMin: confidence.length ? Math.min(...confidence) : null
  };
}

function logistic(margin, scale) {
  return 1 / (1 + Math.exp(-margin / scale));
}

export function buildBasketballEfficiencyShadowV1(pick = {}, observations = [], { now = Date.now() } = {}) {
  const profile = profileFor(pick);
  const horizon = horizonFor(pick, now);
  const side = selectedSide(pick);
  const reasons = [];
  if (!profile) reasons.push("unsupported-sport");
  if (!side) reasons.push("unsupported-selection");

  const selected = selectInputs(pick, Array.isArray(observations) ? observations : [], horizon);
  const inputs = selected.values;
  for (const name of ["home_pace", "home_offensiveRating", "home_defensiveRating", "away_pace", "away_offensiveRating", "away_defensiveRating"]) {
    if (valueOf(inputs[name]) === null) reasons.push(`missing-${name.replaceAll("_", "-").replaceAll(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`);
  }

  const usedRows = [
    inputs.home_pace, inputs.home_offensiveRating, inputs.home_defensiveRating, inputs.home_lineupImpact,
    inputs.away_pace, inputs.away_offensiveRating, inputs.away_defensiveRating, inputs.away_lineupImpact
  ].filter(Boolean);
  const dataProvenance = provenance(usedRows);

  if (reasons.length) {
    return {
      version: BASKETBALL_EFFICIENCY_SHADOW_VERSION,
      modelId: profile?.modelId || null,
      modelVersion: profile?.modelVersion || null,
      league: profile?.league || null,
      status: "unavailable",
      generatedAt: new Date(now).toISOString(),
      predictionHorizon: horizon,
      reasons: [...new Set(reasons)].sort(),
      probability: null,
      shadowProbability: null,
      inputSummary: {
        eligibleAdvancedObservations: selected.eligible.length,
        usedObservations: usedRows.length,
        optionalLineupImpactPresent: Boolean(inputs.home_lineupImpact || inputs.away_lineupImpact)
      },
      provenance: dataProvenance,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      paperOnly: true
    };
  }

  const homePace = valueOf(inputs.home_pace);
  const awayPace = valueOf(inputs.away_pace);
  const possessions = clamp(Math.sqrt(Math.max(1, homePace) * Math.max(1, awayPace)), profile.minPace, profile.maxPace);
  const homeBaseRating = (valueOf(inputs.home_offensiveRating) + valueOf(inputs.away_defensiveRating)) / 2;
  const awayBaseRating = (valueOf(inputs.away_offensiveRating) + valueOf(inputs.home_defensiveRating)) / 2;
  const homeLineup = valueOf(inputs.home_lineupImpact);
  const awayLineup = valueOf(inputs.away_lineupImpact);
  const homeLineupAdjustment = homeLineup === null ? 0 : clamp(homeLineup, -MAX_LINEUP_ADJUSTMENT, MAX_LINEUP_ADJUSTMENT);
  const awayLineupAdjustment = awayLineup === null ? 0 : clamp(awayLineup, -MAX_LINEUP_ADJUSTMENT, MAX_LINEUP_ADJUSTMENT);
  const homeRating = homeBaseRating + homeLineupAdjustment;
  const awayRating = awayBaseRating + awayLineupAdjustment;
  const homePointsNeutral = possessions * homeRating / 100;
  const awayPointsNeutral = possessions * awayRating / 100;
  const projectedHome = homePointsNeutral + profile.homeAdvantagePoints / 2;
  const projectedAway = awayPointsNeutral - profile.homeAdvantagePoints / 2;
  const projectedMargin = projectedHome - projectedAway;
  const homeProbability = logistic(projectedMargin, profile.logisticScale);
  const awayProbability = 1 - homeProbability;
  const probability = side === "home" ? homeProbability : awayProbability;

  const inputSnapshot = {
    eventId: clean(pick.gameId || pick.eventId || pick.id, 180),
    homeTeam: clean(pick.homeTeam, 140),
    awayTeam: clean(pick.awayTeam, 140),
    selection: clean(pick.selection || pick.label, 140),
    league: profile.league,
    horizon,
    inputs: {
      homePace: round(homePace),
      homeOffensiveRating: round(valueOf(inputs.home_offensiveRating)),
      homeDefensiveRating: round(valueOf(inputs.home_defensiveRating)),
      homeLineupImpact: round(homeLineup),
      awayPace: round(awayPace),
      awayOffensiveRating: round(valueOf(inputs.away_offensiveRating)),
      awayDefensiveRating: round(valueOf(inputs.away_defensiveRating)),
      awayLineupImpact: round(awayLineup)
    },
    providers: dataProvenance.providers,
    metrics: dataProvenance.metrics,
    profile: {
      minPace: profile.minPace,
      maxPace: profile.maxPace,
      homeAdvantagePoints: profile.homeAdvantagePoints,
      logisticScale: profile.logisticScale,
      maxLineupAdjustment: MAX_LINEUP_ADJUSTMENT
    }
  };
  const inputSnapshotHash = createHash("sha256").update(JSON.stringify(inputSnapshot)).digest("hex");

  return {
    version: BASKETBALL_EFFICIENCY_SHADOW_VERSION,
    modelId: profile.modelId,
    modelVersion: profile.modelVersion,
    league: profile.league,
    status: "ready",
    generatedAt: new Date(now).toISOString(),
    predictionHorizon: horizon,
    selectionSide: side,
    probability: round(probability),
    shadowProbability: round(probability),
    probabilities: { home: round(homeProbability), away: round(awayProbability) },
    projected: {
      possessions: round(possessions, 3),
      homePoints: round(projectedHome, 3),
      awayPoints: round(projectedAway, 3),
      homeMargin: round(projectedMargin, 3)
    },
    formula: {
      possessions: "sqrt(home pace * away pace), bounded by research profile",
      matchupRating: "teamRating = mean(team ORtg, opponent DRtg) + bounded lineup impact when available",
      projectedPoints: "possessions * matchupRating / 100, then split research home-court advantage across teams",
      h2hProbability: "P(home) = logistic(projected home margin / research logistic scale)",
      homeAdvantagePoints: profile.homeAdvantagePoints,
      logisticScale: profile.logisticScale,
      maxLineupAdjustment: MAX_LINEUP_ADJUSTMENT
    },
    uncertainty: {
      calibrated: false,
      trainingStatus: "transparent-untrained-research-baseline",
      performanceWeightAvailable: false,
      optionalLineupImpactMissing: !(inputs.home_lineupImpact && inputs.away_lineupImpact),
      sourceTrustFloor: round(dataProvenance.sourceTrustMin, 4),
      confidenceFloor: round(dataProvenance.confidenceMin, 4)
    },
    provenance: dataProvenance,
    inputSnapshotHash,
    independentModelOutput: {
      modelId: profile.modelId,
      modelVersion: profile.modelVersion,
      modelFamily: "basketball-efficiency-pace",
      probability: round(probability),
      generatedAt: new Date(now).toISOString(),
      role: "basketball-efficiency-shadow",
      signalFamilies: ["performance-statistics", "context"],
      dataLineage: {
        signalFamilies: ["performance-statistics", "context"],
        providers: dataProvenance.providers,
        metrics: dataProvenance.metrics
      },
      audit: {
        independentPredictiveModel: true,
        deterministic: true,
        chronologySafe: true,
        source: "licensed-stored-pregame-advanced-analytics",
        implementationPath: "lib/basketball-efficiency-shadow-v1.mjs",
        featureCutoff: horizon,
        inputSnapshotHash,
        noMarketInputs: true,
        preEventOnly: true,
        trainingStatus: "transparent-untrained-research-baseline"
      }
    },
    productionProbabilityChanged: false,
    productionDecisionChanged: false,
    automaticPromotionAllowed: false,
    paperOnly: true
  };
}

export const BASKETBALL_EFFICIENCY_PROFILES = PROFILES;
