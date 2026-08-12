import { createHash } from "node:crypto";

export const MLB_PITCHING_OFFENSE_SHADOW_VERSION = "mlb-pitching-offense-shadow-v1";
export const MLB_PITCHING_OFFENSE_MODEL_ID = "mlb-pitching-offense-v1";
export const MLB_PITCHING_OFFENSE_MODEL_VERSION = "mlb-pitching-offense-shadow-v1";

const MIN_TRUST = 0.55;
const MIN_CONFIDENCE = 0.45;
const FUTURE_SKEW_MS = 60_000;
const XWOBA_BASELINE = 0.320;
const XWOBA_SCALE = 0.030;
const MAX_STANDARDIZED_INPUT = 3;
const HOME_FIELD_SCORE = 0.18;
const LOGISTIC_SCALE = 1.55;

const BLOCKED_PROVIDERS = new Set([
  "scorecaster-unified-data",
  "the-odds-api",
  "odds-market",
  "polymarket",
  "open-meteo",
  "thesportsdb"
]);

const LINEUP_METRICS = new Set(["lineup-strength", "lineup-strength-z", "offense-lineup-strength"]);
const BULLPEN_METRICS = new Set(["bullpen-depth", "bullpen-depth-z", "relief-pitching-strength"]);
const STARTER_XWOBA_METRICS = new Set(["starting-pitcher-xwoba-allowed", "pitcher-xwoba-allowed", "xwoba-allowed", "xwoba"]);
const PARK_METRICS = new Set(["park-adjusted-strength", "park-factor-z"]);

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

function isMlb(pick = {}) {
  const sport = key(pick.sportKey || pick.league || pick.sportTitle, 120);
  return sport.includes("mlb") || sport === "baseball" || sport.includes("baseball-mlb");
}

function teamSide(observation = {}, pick = {}) {
  const metadata = observation.metadata && typeof observation.metadata === "object" ? observation.metadata : {};
  const explicit = key(metadata.teamSide || metadata.team_side || metadata.side, 40);
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

function metricKind(observation = {}) {
  const metric = key(observation.metric, 120);
  if (LINEUP_METRICS.has(metric)) return "lineup";
  if (BULLPEN_METRICS.has(metric)) return "bullpen";
  if (PARK_METRICS.has(metric)) return "park";
  if (STARTER_XWOBA_METRICS.has(metric)) {
    const metadata = observation.metadata && typeof observation.metadata === "object" ? observation.metadata : {};
    const role = key(metadata.role || metadata.playerRole || metadata.player_role, 80);
    const starter = metadata.starter === true || metadata.isStarter === true || role === "starting-pitcher" || role === "starter";
    const perspective = key(metadata.perspective || metadata.direction || metadata.measurement, 80);
    const explicitAllowedMetric = metric !== "xwoba";
    const allowedPerspective = explicitAllowedMetric || perspective === "allowed" || perspective === "against" || perspective === "conceded";
    if (starter && allowedPerspective) return "starter-xwoba-allowed";
  }
  return null;
}

function chronologySafe(row, horizonTime) {
  const observed = timestamp(row.observedAt || row.observed_at);
  const captured = timestamp(row.capturedAt || row.captured_at);
  return observed !== null && captured !== null && observed <= horizonTime + FUTURE_SKEW_MS && captured <= horizonTime + FUTURE_SKEW_MS;
}

function eligible(row, horizonTime) {
  const provider = key(row.provider, 100);
  const trust = finite(row.sourceTrust ?? row.source_trust);
  const confidence = finite(row.confidence);
  if (!provider || BLOCKED_PROVIDERS.has(provider)) return false;
  if (trust === null || trust < MIN_TRUST || confidence === null || confidence < MIN_CONFIDENCE) return false;
  return chronologySafe(row, horizonTime) && metricKind(row) !== null && finite(row.value) !== null;
}

function newest(rows, predicate) {
  return rows.filter(predicate).toSorted((a, b) => (timestamp(b.observedAt || b.observed_at) || 0) - (timestamp(a.observedAt || a.observed_at) || 0))[0] || null;
}

function standardizedValue(row) {
  if (!row) return null;
  const value = finite(row.value);
  if (value === null) return null;
  const unit = key(row.unit, 60);
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const scale = key(metadata.scale || metadata.normalization || metadata.normalizedScale || metadata.normalized_scale, 60);
  if (!["z", "z-score", "standardized", "standard-score"].includes(unit) && !["z", "z-score", "standardized", "standard-score"].includes(scale)) return null;
  return clamp(value, -MAX_STANDARDIZED_INPUT, MAX_STANDARDIZED_INPUT);
}

function starterXwoba(row) {
  const value = finite(row?.value);
  if (value === null || value < 0.15 || value > 0.55) return null;
  return value;
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
  const trusts = used.map((row) => finite(row.sourceTrust ?? row.source_trust)).filter((value) => value !== null);
  const confidences = used.map((row) => finite(row.confidence)).filter((value) => value !== null);
  return {
    providers: [...new Set(used.map((row) => clean(row.provider, 100)).filter(Boolean))].sort(),
    metrics: [...new Set(used.map((row) => key(row.metric, 120)).filter(Boolean))].sort(),
    observedAtMax: used.map((row) => iso(row.observedAt || row.observed_at)).filter(Boolean).sort().at(-1) || null,
    sourceTrustMin: trusts.length ? Math.min(...trusts) : null,
    confidenceMin: confidences.length ? Math.min(...confidences) : null
  };
}

function logistic(score) {
  return 1 / (1 + Math.exp(-score / LOGISTIC_SCALE));
}

export function buildMlbPitchingOffenseShadowV1(pick = {}, observations = [], { now = Date.now() } = {}) {
  const horizon = horizonFor(pick, now);
  const horizonTime = timestamp(horizon);
  const side = selectedSide(pick);
  const reasons = [];
  if (!isMlb(pick)) reasons.push("unsupported-sport");
  if (!side) reasons.push("unsupported-selection");

  const rows = (Array.isArray(observations) ? observations : []).filter((row) => eligible(row, horizonTime));
  const inputs = {};
  for (const teamSideName of ["home", "away"]) {
    inputs[`${teamSideName}Lineup`] = newest(rows, (row) => teamSide(row, pick) === teamSideName && metricKind(row) === "lineup");
    inputs[`${teamSideName}Bullpen`] = newest(rows, (row) => teamSide(row, pick) === teamSideName && metricKind(row) === "bullpen");
    inputs[`${teamSideName}Starter`] = newest(rows, (row) => teamSide(row, pick) === teamSideName && metricKind(row) === "starter-xwoba-allowed");
    inputs[`${teamSideName}Park`] = newest(rows, (row) => teamSide(row, pick) === teamSideName && metricKind(row) === "park");
  }

  const homeLineup = standardizedValue(inputs.homeLineup);
  const awayLineup = standardizedValue(inputs.awayLineup);
  const homeBullpen = standardizedValue(inputs.homeBullpen);
  const awayBullpen = standardizedValue(inputs.awayBullpen);
  const homeStarterXwoba = starterXwoba(inputs.homeStarter);
  const awayStarterXwoba = starterXwoba(inputs.awayStarter);
  const park = standardizedValue(inputs.homePark || inputs.awayPark);

  if (homeLineup === null) reasons.push("missing-home-lineup-strength-z");
  if (awayLineup === null) reasons.push("missing-away-lineup-strength-z");
  if (homeBullpen === null) reasons.push("missing-home-bullpen-depth-z");
  if (awayBullpen === null) reasons.push("missing-away-bullpen-depth-z");
  if (homeStarterXwoba === null) reasons.push("missing-home-confirmed-starter-xwoba-allowed");
  if (awayStarterXwoba === null) reasons.push("missing-away-confirmed-starter-xwoba-allowed");

  const usedRows = [inputs.homeLineup, inputs.awayLineup, inputs.homeBullpen, inputs.awayBullpen, inputs.homeStarter, inputs.awayStarter, inputs.homePark || inputs.awayPark].filter(Boolean);
  const dataProvenance = provenance(usedRows);

  if (reasons.length) {
    return {
      version: MLB_PITCHING_OFFENSE_SHADOW_VERSION,
      modelId: MLB_PITCHING_OFFENSE_MODEL_ID,
      modelVersion: MLB_PITCHING_OFFENSE_MODEL_VERSION,
      status: "unavailable",
      generatedAt: new Date(now).toISOString(),
      predictionHorizon: horizon,
      reasons: [...new Set(reasons)].sort(),
      probability: null,
      shadowProbability: null,
      inputSummary: {
        eligibleAdvancedObservations: rows.length,
        confirmedStartingPitchers: [inputs.homeStarter, inputs.awayStarter].filter(Boolean).length,
        optionalParkContextPresent: park !== null
      },
      provenance: dataProvenance,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      paperOnly: true
    };
  }

  const homeStarterVulnerability = clamp((homeStarterXwoba - XWOBA_BASELINE) / XWOBA_SCALE, -MAX_STANDARDIZED_INPUT, MAX_STANDARDIZED_INPUT);
  const awayStarterVulnerability = clamp((awayStarterXwoba - XWOBA_BASELINE) / XWOBA_SCALE, -MAX_STANDARDIZED_INPUT, MAX_STANDARDIZED_INPUT);
  const parkContextZ = park === null ? null : clamp(park, -1.5, 1.5);

  const homeMatchup = homeLineup + awayStarterVulnerability - awayBullpen;
  const awayMatchup = awayLineup + homeStarterVulnerability - homeBullpen;
  const homeEdgeScore = homeMatchup - awayMatchup + HOME_FIELD_SCORE;
  const homeProbability = logistic(homeEdgeScore);
  const awayProbability = 1 - homeProbability;
  const probability = side === "home" ? homeProbability : awayProbability;

  const inputSnapshot = {
    eventId: clean(pick.gameId || pick.eventId || pick.id, 180),
    homeTeam: clean(pick.homeTeam, 140),
    awayTeam: clean(pick.awayTeam, 140),
    selection: clean(pick.selection || pick.label, 140),
    horizon,
    inputs: {
      homeLineupZ: round(homeLineup),
      awayLineupZ: round(awayLineup),
      homeBullpenZ: round(homeBullpen),
      awayBullpenZ: round(awayBullpen),
      homeStarterXwobaAllowed: round(homeStarterXwoba),
      awayStarterXwobaAllowed: round(awayStarterXwoba),
      parkContextZ: round(parkContextZ)
    },
    providers: dataProvenance.providers,
    metrics: dataProvenance.metrics,
    researchParameters: {
      xwobaBaseline: XWOBA_BASELINE,
      xwobaScale: XWOBA_SCALE,
      homeFieldScore: HOME_FIELD_SCORE,
      logisticScale: LOGISTIC_SCALE,
      maxStandardizedInput: MAX_STANDARDIZED_INPUT,
      parkUsedInH2hProbability: false
    }
  };
  const inputSnapshotHash = createHash("sha256").update(JSON.stringify(inputSnapshot)).digest("hex");

  return {
    version: MLB_PITCHING_OFFENSE_SHADOW_VERSION,
    modelId: MLB_PITCHING_OFFENSE_MODEL_ID,
    modelVersion: MLB_PITCHING_OFFENSE_MODEL_VERSION,
    status: "ready",
    generatedAt: new Date(now).toISOString(),
    predictionHorizon: horizon,
    selectionSide: side,
    probability: round(probability),
    shadowProbability: round(probability),
    probabilities: { home: round(homeProbability), away: round(awayProbability) },
    matchup: {
      homeScore: round(homeMatchup, 4),
      awayScore: round(awayMatchup, 4),
      homeEdgeScore: round(homeEdgeScore, 4),
      homeStarterVulnerabilityZ: round(homeStarterVulnerability, 4),
      awayStarterVulnerabilityZ: round(awayStarterVulnerability, 4),
      parkContextZ: round(parkContextZ)
    },
    formula: {
      starterVulnerability: "clamp((starter xwOBA allowed - 0.320) / 0.030, -3, 3)",
      matchupScore: "lineupStrengthZ + opponentStarterVulnerabilityZ - opponentBullpenDepthZ",
      homeEdge: "homeMatchupScore - awayMatchupScore + research home-field score",
      h2hProbability: "P(home) = logistic(homeEdgeScore / research scale)",
      parkContext: "optional standardized park context is audited in V1 but is not used in H2H probability",
      xwobaBaseline: XWOBA_BASELINE,
      xwobaScale: XWOBA_SCALE,
      homeFieldScore: HOME_FIELD_SCORE,
      logisticScale: LOGISTIC_SCALE
    },
    uncertainty: {
      calibrated: false,
      trainingStatus: "transparent-untrained-research-baseline",
      performanceWeightAvailable: false,
      optionalParkContextMissing: park === null,
      sourceTrustFloor: round(dataProvenance.sourceTrustMin, 4),
      confidenceFloor: round(dataProvenance.confidenceMin, 4)
    },
    provenance: dataProvenance,
    inputSnapshotHash,
    independentModelOutput: {
      modelId: MLB_PITCHING_OFFENSE_MODEL_ID,
      modelVersion: MLB_PITCHING_OFFENSE_MODEL_VERSION,
      modelFamily: "mlb-pitching-offense",
      probability: round(probability),
      generatedAt: new Date(now).toISOString(),
      role: "mlb-pitching-offense-shadow",
      signalFamilies: ["expected-performance", "performance-statistics"],
      dataLineage: {
        signalFamilies: ["expected-performance", "performance-statistics"],
        providers: dataProvenance.providers,
        metrics: dataProvenance.metrics
      },
      audit: {
        independentPredictiveModel: true,
        deterministic: true,
        chronologySafe: true,
        source: "licensed-stored-pregame-advanced-analytics",
        implementationPath: "lib/mlb-pitching-offense-shadow-v1.mjs",
        featureCutoff: horizon,
        inputSnapshotHash,
        noMarketInputs: true,
        preEventOnly: true,
        confirmedStartingPitchersRequired: true,
        parkContextUsedInProbability: false,
        trainingStatus: "transparent-untrained-research-baseline"
      }
    },
    productionProbabilityChanged: false,
    productionDecisionChanged: false,
    automaticPromotionAllowed: false,
    paperOnly: true
  };
}
