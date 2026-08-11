import { createHash } from "node:crypto";

export const NHL_XG_GOALIE_SHADOW_VERSION = "nhl-xg-goalie-shadow-v1";
export const NHL_XG_GOALIE_MODEL_ID = "nhl-xg-goalie-poisson-v1";

const FUTURE_SKEW_MS = 60_000;
const MIN_TRUST = 0.55;
const MIN_CONFIDENCE = 0.45;
const MAX_GOALS = 12;
const SHOT_QUALITY_WEIGHT = 0.2;
const MIN_LAMBDA = 0.8;
const MAX_LAMBDA = 6;
const MAX_GOALIE_ADJUSTMENT = 0.75;

const INTERNAL_OR_NON_INDEPENDENT_PROVIDERS = new Set([
  "scorecaster-unified-data",
  "the-odds-api",
  "odds-market",
  "polymarket",
  "open-meteo",
  "thesportsdb"
]);

const METRICS = Object.freeze({
  xgf60: new Set(["xg-for-per-60", "expected-goals-for-per-60", "xgf60", "team-xg-for-per-60"]),
  xga60: new Set(["xg-against-per-60", "expected-goals-against-per-60", "xga60", "team-xg-against-per-60"]),
  psxgf60: new Set(["post-shot-xg-for-per-60", "psxg-for-per-60", "post-shot-expected-goals-for-per-60", "team-post-shot-xg-for-per-60"]),
  gsax60: new Set(["goals-saved-above-expected-per-60", "gsax-per-60", "goalie-gsax-per-60", "goals-saved-above-expected-60"])
});

function clean(value, limit = 180) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function key(value, limit = 180) {
  return clean(value, limit)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function iso(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function horizonFor(pick = {}, now = Date.now()) {
  const commence = timestamp(pick.commenceTime || pick.commence_time);
  return new Date(commence === null ? now : Math.min(now, commence)).toISOString();
}

function isNhl(pick = {}) {
  const sport = key(pick.sportKey || pick.league || pick.sportTitle, 120);
  return sport.includes("nhl") || sport.includes("icehockey") || sport.includes("ice-hockey");
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

function isStarterGoalie(observation = {}) {
  const metadata = observation.metadata && typeof observation.metadata === "object" ? observation.metadata : {};
  if (metadata.starter === true || metadata.startingGoalie === true || metadata.starting_goalie === true) return true;
  const role = key(metadata.role || metadata.participantRole || metadata.participant_role, 80);
  return role === "starting-goalie" || role === "starter-goalie" || role === "goalie-starter";
}

function metricKind(value) {
  const metric = key(value, 120);
  for (const [kind, aliases] of Object.entries(METRICS)) {
    if (aliases.has(metric)) return kind;
  }
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
  if (!provider || INTERNAL_OR_NON_INDEPENDENT_PROVIDERS.has(provider)) return false;
  const trust = finite(observation.sourceTrust ?? observation.source_trust);
  const confidence = finite(observation.confidence);
  if (trust === null || trust < MIN_TRUST || confidence === null || confidence < MIN_CONFIDENCE) return false;
  if (!chronologySafe(observation, horizonTime)) return false;
  return metricKind(observation.metric) !== null;
}

function newestObservation(rows = [], predicate = () => true) {
  return rows
    .filter(predicate)
    .toSorted((a, b) => (timestamp(b.observedAt || b.observed_at) || 0) - (timestamp(a.observedAt || a.observed_at) || 0))[0] || null;
}

function selectInputs(pick, observations, horizon) {
  const horizonTime = timestamp(horizon);
  const eligible = observations.filter((row) => eligibleObservation(row, horizonTime));
  const result = {};
  for (const side of ["home", "away"]) {
    for (const kind of ["xgf60", "xga60", "psxgf60"]) {
      result[`${side}_${kind}`] = newestObservation(eligible, (row) => teamSide(row, pick) === side && metricKind(row.metric) === kind);
    }
    result[`${side}_gsax60`] = newestObservation(eligible, (row) => teamSide(row, pick) === side && metricKind(row.metric) === "gsax60" && isStarterGoalie(row));
  }
  return { eligible, result };
}

function valueOf(row) {
  return finite(row?.value);
}

function poisson(lambda, k) {
  let factorial = 1;
  for (let i = 2; i <= k; i += 1) factorial *= i;
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial;
}

function moneylineProbability(homeLambda, awayLambda) {
  let homeWin = 0;
  let tie = 0;
  let mass = 0;
  for (let home = 0; home <= MAX_GOALS; home += 1) {
    const ph = poisson(homeLambda, home);
    for (let away = 0; away <= MAX_GOALS; away += 1) {
      const joint = ph * poisson(awayLambda, away);
      mass += joint;
      if (home > away) homeWin += joint;
      else if (home === away) tie += joint;
    }
  }
  if (!(mass > 0)) return null;
  return clamp((homeWin + 0.5 * tie) / mass, 0.001, 0.999);
}

function round(value, digits = 6) {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
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
  return {
    providers: [...new Set(used.map((row) => clean(row.provider, 100)).filter(Boolean))].sort(),
    metrics: [...new Set(used.map((row) => key(row.metric, 120)).filter(Boolean))].sort(),
    observedAtMax: used.map((row) => iso(row.observedAt || row.observed_at)).filter(Boolean).sort().at(-1) || null,
    sourceTrustMin: used.map((row) => finite(row.sourceTrust ?? row.source_trust)).filter((value) => value !== null).reduce((min, value) => Math.min(min, value), 1),
    confidenceMin: used.map((row) => finite(row.confidence)).filter((value) => value !== null).reduce((min, value) => Math.min(min, value), 1)
  };
}

export function buildNhlXgGoalieShadowV1(pick = {}, observations = [], { now = Date.now() } = {}) {
  const horizon = horizonFor(pick, now);
  const side = selectedSide(pick);
  const reasons = [];
  if (!isNhl(pick)) reasons.push("unsupported-sport");
  if (!side) reasons.push("unsupported-selection");
  const rows = Array.isArray(observations) ? observations : [];
  const selected = selectInputs(pick, rows, horizon);
  const inputs = selected.result;

  const required = [
    "home_xgf60", "home_xga60", "away_xgf60", "away_xga60", "home_gsax60", "away_gsax60"
  ];
  for (const name of required) {
    if (valueOf(inputs[name]) === null) reasons.push(`missing-${name.replaceAll("_", "-")}`);
  }

  const usedRows = [
    inputs.home_xgf60, inputs.home_xga60, inputs.home_psxgf60, inputs.home_gsax60,
    inputs.away_xgf60, inputs.away_xga60, inputs.away_psxgf60, inputs.away_gsax60
  ].filter(Boolean);
  const dataProvenance = provenance(usedRows);

  if (reasons.length) {
    return {
      version: NHL_XG_GOALIE_SHADOW_VERSION,
      modelId: NHL_XG_GOALIE_MODEL_ID,
      status: "unavailable",
      generatedAt: new Date(now).toISOString(),
      predictionHorizon: horizon,
      reasons: [...new Set(reasons)].sort(),
      probability: null,
      shadowProbability: null,
      inputSummary: {
        eligibleAdvancedObservations: selected.eligible.length,
        usedObservations: usedRows.length,
        optionalPostShotXgPresent: Boolean(inputs.home_psxgf60 && inputs.away_psxgf60)
      },
      provenance: dataProvenance,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      paperOnly: true
    };
  }

  const homeXgf = valueOf(inputs.home_xgf60);
  const awayXgf = valueOf(inputs.away_xgf60);
  const homeAttack = inputs.home_psxgf60
    ? (1 - SHOT_QUALITY_WEIGHT) * homeXgf + SHOT_QUALITY_WEIGHT * valueOf(inputs.home_psxgf60)
    : homeXgf;
  const awayAttack = inputs.away_psxgf60
    ? (1 - SHOT_QUALITY_WEIGHT) * awayXgf + SHOT_QUALITY_WEIGHT * valueOf(inputs.away_psxgf60)
    : awayXgf;
  const homeBase = Math.sqrt(Math.max(0.01, homeAttack) * Math.max(0.01, valueOf(inputs.away_xga60)));
  const awayBase = Math.sqrt(Math.max(0.01, awayAttack) * Math.max(0.01, valueOf(inputs.home_xga60)));
  const awayGoalieAdjustment = clamp(valueOf(inputs.away_gsax60), -MAX_GOALIE_ADJUSTMENT, MAX_GOALIE_ADJUSTMENT);
  const homeGoalieAdjustment = clamp(valueOf(inputs.home_gsax60), -MAX_GOALIE_ADJUSTMENT, MAX_GOALIE_ADJUSTMENT);
  const homeLambda = clamp(homeBase - awayGoalieAdjustment, MIN_LAMBDA, MAX_LAMBDA);
  const awayLambda = clamp(awayBase - homeGoalieAdjustment, MIN_LAMBDA, MAX_LAMBDA);
  const homeProbability = moneylineProbability(homeLambda, awayLambda);
  const probability = side === "home" ? homeProbability : 1 - homeProbability;

  const inputSnapshot = {
    eventId: clean(pick.gameId || pick.eventId || pick.id, 180),
    homeTeam: clean(pick.homeTeam, 140),
    awayTeam: clean(pick.awayTeam, 140),
    selection: clean(pick.selection || pick.label, 140),
    horizon,
    inputs: {
      homeXgf60: round(homeXgf),
      homeXga60: round(valueOf(inputs.home_xga60)),
      homePsxgf60: round(valueOf(inputs.home_psxgf60)),
      homeStartingGoalieGsax60: round(valueOf(inputs.home_gsax60)),
      awayXgf60: round(awayXgf),
      awayXga60: round(valueOf(inputs.away_xga60)),
      awayPsxgf60: round(valueOf(inputs.away_psxgf60)),
      awayStartingGoalieGsax60: round(valueOf(inputs.away_gsax60))
    },
    providers: dataProvenance.providers,
    metrics: dataProvenance.metrics
  };
  const inputSnapshotHash = createHash("sha256").update(JSON.stringify(inputSnapshot)).digest("hex");

  return {
    version: NHL_XG_GOALIE_SHADOW_VERSION,
    modelId: NHL_XG_GOALIE_MODEL_ID,
    status: "ready",
    generatedAt: new Date(now).toISOString(),
    predictionHorizon: horizon,
    selectionSide: side,
    probability: round(probability),
    shadowProbability: round(probability),
    homeMoneylineProbability: round(homeProbability),
    awayMoneylineProbability: round(1 - homeProbability),
    projectedGoals: {
      home: round(homeLambda, 4),
      away: round(awayLambda, 4)
    },
    formula: {
      attackRate: "0.8*xGF60 + 0.2*postShotXGF60 when post-shot xG exists; otherwise xGF60",
      baseGoals: "sqrt(teamAttackRate * opponentXGA60)",
      goalieAdjustment: "projectedGoals = baseGoals - clamp(opponentStarterGSAx60,-0.75,0.75)",
      moneyline: "independent Poisson score model; regulation tie split 50/50 for research H2H baseline",
      postShotWeight: SHOT_QUALITY_WEIGHT
    },
    uncertainty: {
      calibrated: false,
      performanceWeightAvailable: false,
      optionalPostShotXgMissing: !(inputs.home_psxgf60 && inputs.away_psxgf60),
      sourceTrustFloor: round(dataProvenance.sourceTrustMin, 4),
      confidenceFloor: round(dataProvenance.confidenceMin, 4)
    },
    provenance: dataProvenance,
    inputSnapshotHash,
    independentModelOutput: {
      modelId: NHL_XG_GOALIE_MODEL_ID,
      modelVersion: NHL_XG_GOALIE_SHADOW_VERSION,
      modelFamily: "nhl-xg-goalie",
      probability: round(probability),
      generatedAt: new Date(now).toISOString(),
      role: "nhl-xg-goalie-shadow",
      signalFamilies: ["expected-performance"],
      dataLineage: {
        signalFamilies: ["expected-performance"],
        providers: dataProvenance.providers,
        metrics: dataProvenance.metrics
      },
      audit: {
        independentPredictiveModel: true,
        deterministic: true,
        chronologySafe: true,
        source: dataProvenance.providers.join("+") || "licensed-advanced-hockey-provider",
        implementationPath: "lib/nhl-xg-goalie-shadow-v1.mjs",
        inputSnapshotHash,
        trainingStatus: "transparent-untrained-research-baseline",
        probabilitySource: "advanced-xg-and-starting-goalie-model"
      }
    },
    productionProbabilityChanged: false,
    productionDecisionChanged: false,
    automaticPromotionAllowed: false,
    paperOnly: true
  };
}

export function attachNhlXgGoalieShadowV1(pick = {}, observations = [], { now = Date.now() } = {}) {
  const snapshot = buildNhlXgGoalieShadowV1(pick, observations, { now });
  const existing = Array.isArray(pick.independentModelOutputs) ? pick.independentModelOutputs : [];
  return {
    ...pick,
    nhlXgGoalieShadowV1: snapshot,
    independentModelOutputs: snapshot.status === "ready" && snapshot.independentModelOutput
      ? [...existing, snapshot.independentModelOutput]
      : existing,
    productionProbabilityAdjustedByNhlXgGoalieShadow: false,
    productionDecisionAdjustedByNhlXgGoalieShadow: false
  };
}
