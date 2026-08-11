import { createHash } from "node:crypto";

export const SOCCER_XG_POISSON_SHADOW_VERSION = "soccer-xg-poisson-shadow-v1";
export const SOCCER_XG_POISSON_MODEL_ID = "soccer-xg-poisson-v1";

const FUTURE_SKEW_MS = 60_000;
const MIN_TRUST = 0.55;
const MIN_CONFIDENCE = 0.45;
const MAX_GOALS = 10;
const POST_SHOT_WEIGHT = 0.2;
const MIN_LAMBDA = 0.15;
const MAX_LAMBDA = 5.5;

const BLOCKED_PROVIDERS = new Set([
  "scorecaster-unified-data",
  "the-odds-api",
  "odds-market",
  "polymarket",
  "open-meteo",
  "thesportsdb"
]);

const METRICS = Object.freeze({
  xgf90: new Set(["xg-for-per-90", "expected-goals-for-per-90", "xgf90", "team-xg-for-per-90"]),
  xga90: new Set(["xg-against-per-90", "expected-goals-against-per-90", "xga90", "team-xg-against-per-90"]),
  psxgf90: new Set(["post-shot-xg-for-per-90", "psxg-for-per-90", "post-shot-expected-goals-for-per-90", "team-post-shot-xg-for-per-90"])
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

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value) {
  const parsed = timestamp(value);
  return parsed === null ? null : new Date(parsed).toISOString();
}

function round(value, digits = 6) {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function horizonFor(pick = {}, now = Date.now()) {
  const commence = timestamp(pick.commenceTime || pick.commence_time);
  return new Date(commence === null ? now : Math.min(now, commence)).toISOString();
}

function isSoccer(pick = {}) {
  const sport = key(pick.sportKey || pick.league || pick.sportTitle, 120);
  return sport.includes("soccer") || sport.includes("football") || sport.includes("epl") || sport.includes("liga") || sport.includes("serie-a") || sport.includes("bundesliga");
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
    for (const kind of ["xgf90", "xga90", "psxgf90"]) {
      values[`${side}_${kind}`] = newest(eligible, (row) => teamSide(row, pick) === side && metricKind(row.metric) === kind);
    }
  }
  return { eligible, values };
}

function valueOf(row) {
  return finite(row?.value);
}

function poisson(lambda, goals) {
  let factorial = 1;
  for (let i = 2; i <= goals; i += 1) factorial *= i;
  return Math.exp(-lambda) * Math.pow(lambda, goals) / factorial;
}

function scoreProbabilities(homeLambda, awayLambda) {
  let home = 0;
  let draw = 0;
  let away = 0;
  let mass = 0;
  for (let hg = 0; hg <= MAX_GOALS; hg += 1) {
    const ph = poisson(homeLambda, hg);
    for (let ag = 0; ag <= MAX_GOALS; ag += 1) {
      const joint = ph * poisson(awayLambda, ag);
      mass += joint;
      if (hg > ag) home += joint;
      else if (hg === ag) draw += joint;
      else away += joint;
    }
  }
  if (!(mass > 0)) return null;
  return { home: home / mass, draw: draw / mass, away: away / mass };
}

function selectedSide(pick = {}) {
  const selection = key(pick.selection || pick.label, 140);
  if (!selection) return null;
  if (selection === key(pick.homeTeam, 140)) return "home";
  if (selection === key(pick.awayTeam, 140)) return "away";
  if (["draw", "tie", "tasapeli", "x"].includes(selection)) return "draw";
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

export function buildSoccerXgPoissonShadowV1(pick = {}, observations = [], { now = Date.now() } = {}) {
  const horizon = horizonFor(pick, now);
  const side = selectedSide(pick);
  const reasons = [];
  if (!isSoccer(pick)) reasons.push("unsupported-sport");
  if (!side) reasons.push("unsupported-selection");

  const selected = selectInputs(pick, Array.isArray(observations) ? observations : [], horizon);
  const inputs = selected.values;
  for (const name of ["home_xgf90", "home_xga90", "away_xgf90", "away_xga90"]) {
    if (valueOf(inputs[name]) === null) reasons.push(`missing-${name.replaceAll("_", "-")}`);
  }

  const usedRows = [inputs.home_xgf90, inputs.home_xga90, inputs.home_psxgf90, inputs.away_xgf90, inputs.away_xga90, inputs.away_psxgf90].filter(Boolean);
  const dataProvenance = provenance(usedRows);

  if (reasons.length) {
    return {
      version: SOCCER_XG_POISSON_SHADOW_VERSION,
      modelId: SOCCER_XG_POISSON_MODEL_ID,
      status: "unavailable",
      generatedAt: new Date(now).toISOString(),
      predictionHorizon: horizon,
      reasons: [...new Set(reasons)].sort(),
      probability: null,
      shadowProbability: null,
      inputSummary: {
        eligibleAdvancedObservations: selected.eligible.length,
        usedObservations: usedRows.length,
        optionalPostShotXgPresent: Boolean(inputs.home_psxgf90 && inputs.away_psxgf90)
      },
      provenance: dataProvenance,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      paperOnly: true
    };
  }

  const homeXgf = valueOf(inputs.home_xgf90);
  const awayXgf = valueOf(inputs.away_xgf90);
  const homeAttack = inputs.home_psxgf90 ? (1 - POST_SHOT_WEIGHT) * homeXgf + POST_SHOT_WEIGHT * valueOf(inputs.home_psxgf90) : homeXgf;
  const awayAttack = inputs.away_psxgf90 ? (1 - POST_SHOT_WEIGHT) * awayXgf + POST_SHOT_WEIGHT * valueOf(inputs.away_psxgf90) : awayXgf;
  const homeLambda = clamp(Math.sqrt(Math.max(0.01, homeAttack) * Math.max(0.01, valueOf(inputs.away_xga90))), MIN_LAMBDA, MAX_LAMBDA);
  const awayLambda = clamp(Math.sqrt(Math.max(0.01, awayAttack) * Math.max(0.01, valueOf(inputs.home_xga90))), MIN_LAMBDA, MAX_LAMBDA);
  const probabilities = scoreProbabilities(homeLambda, awayLambda);
  const probability = probabilities?.[side] ?? null;

  const inputSnapshot = {
    eventId: clean(pick.gameId || pick.eventId || pick.id, 180),
    homeTeam: clean(pick.homeTeam, 140),
    awayTeam: clean(pick.awayTeam, 140),
    selection: clean(pick.selection || pick.label, 140),
    horizon,
    inputs: {
      homeXgf90: round(homeXgf),
      homeXga90: round(valueOf(inputs.home_xga90)),
      homePostShotXgf90: round(valueOf(inputs.home_psxgf90)),
      awayXgf90: round(awayXgf),
      awayXga90: round(valueOf(inputs.away_xga90)),
      awayPostShotXgf90: round(valueOf(inputs.away_psxgf90))
    },
    providers: dataProvenance.providers,
    metrics: dataProvenance.metrics
  };
  const inputSnapshotHash = createHash("sha256").update(JSON.stringify(inputSnapshot)).digest("hex");

  return {
    version: SOCCER_XG_POISSON_SHADOW_VERSION,
    modelId: SOCCER_XG_POISSON_MODEL_ID,
    status: probability === null ? "unavailable" : "ready",
    generatedAt: new Date(now).toISOString(),
    predictionHorizon: horizon,
    selectionSide: side,
    probability: round(probability),
    shadowProbability: round(probability),
    probabilities: {
      home: round(probabilities?.home),
      draw: round(probabilities?.draw),
      away: round(probabilities?.away)
    },
    projectedGoals: { home: round(homeLambda, 4), away: round(awayLambda, 4) },
    formula: {
      attackRate: "0.8*xGF90 + 0.2*postShotXGF90 when post-shot xG exists; otherwise xGF90",
      expectedGoals: "lambda = sqrt(teamAttackRate * opponentXGA90)",
      oneXtwo: "independent Poisson score matrix converted to home/draw/away probability",
      postShotWeight: POST_SHOT_WEIGHT
    },
    uncertainty: {
      calibrated: false,
      performanceWeightAvailable: false,
      optionalPostShotXgMissing: !(inputs.home_psxgf90 && inputs.away_psxgf90),
      sourceTrustFloor: round(dataProvenance.sourceTrustMin, 4),
      confidenceFloor: round(dataProvenance.confidenceMin, 4)
    },
    provenance: dataProvenance,
    inputSnapshotHash,
    independentModelOutput: {
      modelId: SOCCER_XG_POISSON_MODEL_ID,
      modelVersion: SOCCER_XG_POISSON_SHADOW_VERSION,
      modelFamily: "soccer-xg-poisson",
      probability: round(probability),
      generatedAt: new Date(now).toISOString(),
      role: "soccer-xg-poisson-shadow",
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
        source: "licensed-stored-pregame-advanced-analytics",
        implementationPath: "lib/soccer-xg-poisson-shadow-v1.mjs",
        featureCutoff: horizon,
        inputSnapshotHash,
        noMarketInputs: true,
        preEventOnly: true
      }
    },
    productionProbabilityChanged: false,
    productionDecisionChanged: false,
    paperOnly: true
  };
}
