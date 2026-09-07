import crypto from "node:crypto";

export const INTELLIGENCE_CORE_VERSION = "scorecaster-intelligence-core-v1";
export const OWN_FOOTBALL_MODEL_ID = "scorecaster-own-football-baseline";
export const OWN_FOOTBALL_MODEL_VERSION = "1.1.0";
export const TEAM_STATE_VERSION = "scorecaster-football-team-state-v1";

const MARKET_SOURCES = new Set([
  "the_odds_api",
  "the-odds-api",
  "odds-market",
  "sports_game_odds",
  "sportsgameodds",
  "polymarket",
  "scorecaster-unified-data"
]);
const MARKET_HINTS = ["odds", "price", "market", "bookmaker", "implied_probability", "no_vig"];
const EPS = 1e-12;

const clean = (value, limit = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const finite = (value, fallback = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const iso = (value) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function timeBucket(value, minutes = 30) {
  const parsed = Date.parse(String(value || ""));
  const date = new Date(Number.isFinite(parsed) ? parsed : Date.now());
  const size = Math.max(1, Math.min(1440, Math.floor(Number(minutes) || 30)));
  const epochMinutes = Math.floor(date.getTime() / 60000);
  return new Date(Math.floor(epochMinutes / size) * size * 60000).toISOString();
}

export function sourceIndependenceClass(sourceId = "", family = "", metric = "") {
  const source = clean(sourceId, 100).toLowerCase();
  const text = `${clean(family, 100)} ${clean(metric, 140)}`.toLowerCase();
  if (MARKET_SOURCES.has(source) || MARKET_HINTS.some((hint) => text.includes(hint))) return "market";
  if (source === "scorecaster_internal" || source.startsWith("scorecaster_")) return "derived";
  return "independent";
}

function normalizedFact(row = {}, kind = "collector", rights = {}) {
  const observedAt = iso(row.observed_at || row.observedAt || row.captured_at || row.collected_at || row.created_at);
  const capturedAt = iso(row.collected_at || row.captured_at || row.created_at || row.observed_at || row.observedAt);
  const sourceId = clean(row.source_id || row.provider || row.sourceId, 100).toLowerCase() || "unknown";
  const eventId = clean(row.event_id || row.eventId, 180);
  const entityId = clean(row.entity_id || row.participant_id || row.entityId, 180) || null;
  const family = clean(row.fact_family || row.family || (kind === "collector" ? "collector" : "analytics"), 100) || "unknown";
  const metric = clean(row.fact_key || row.metric, 140) || "unknown";
  if (!observedAt || !capturedAt || !eventId) return null;

  const valueNumeric = finite(row.value_numeric ?? row.value);
  const valueText = row.value_text !== undefined && row.value_text !== null ? clean(row.value_text, 500) : null;
  const valueJson = row.value_json && typeof row.value_json === "object"
    ? row.value_json
    : row.payload && typeof row.payload === "object"
      ? row.payload
      : row.metadata && typeof row.metadata === "object"
        ? row.metadata
        : {};

  const hashInput = { sourceId, eventId, entityId, family, metric, observedAt, valueNumeric, valueText, valueJson };
  return {
    fact_hash: stableHash(hashInput),
    source_id: sourceId,
    source_record_fingerprint: clean(row.fingerprint, 180) || null,
    event_id: eventId,
    entity_id: entityId,
    entity_type: entityId ? "participant" : "event",
    sport_key: clean(row.sport_key || row.sport || row.canonical_sport, 120) || "unknown",
    league: clean(row.league, 160) || null,
    fact_family: family,
    fact_key: metric,
    value_numeric: valueNumeric,
    value_text: valueText,
    value_json: valueJson,
    observed_at: observedAt,
    captured_at: capturedAt,
    source_trust: finite(row.source_trust, 0.5),
    confidence: finite(row.confidence, 0.5),
    independence_class: sourceIndependenceClass(sourceId, family, metric),
    commercial_use_allowed: rights.commercialUseAllowed === true || row.commercial_use_allowed === true,
    model_training_allowed: rights.modelTrainingAllowed === true,
    publishable: rights.publishable === true || row.publishable === true,
    source_lineage: { kind, sourceId, rights },
    paper_only: true
  };
}

export function canonicalFactFromCollector(row = {}, rights = {}) {
  return normalizedFact(row, "collector", rights);
}

export function canonicalFactFromObservation(row = {}, rights = {}) {
  return normalizedFact(row, "analytics", rights);
}

function factSourceId(row = {}) {
  return clean(row.source_id || row.sourceId || row.provider, 100).toLowerCase() || "unknown";
}

export function buildFactConsensus(facts = [], options = {}) {
  const rows = Array.isArray(facts) ? facts : [];
  const latestBySource = new Map();
  for (const row of rows) {
    const sourceId = factSourceId(row);
    if (!latestBySource.has(sourceId)) latestBySource.set(sourceId, row);
  }

  const independent = [...latestBySource.values()].filter((row) => {
    const sourceId = factSourceId(row);
    const independence = row.independence_class || sourceIndependenceClass(sourceId, row.fact_family || row.family, row.fact_key || row.metric);
    return independence === "independent";
  });
  const numeric = independent.map((row) => finite(row.value_numeric ?? row.value)).filter((value) => value !== null);
  const value = numeric.length ? numeric.reduce((sum, item) => sum + item, 0) / numeric.length : null;
  const tolerance = Number.isFinite(Number(options.tolerance)) ? Number(options.tolerance) : Number(options.numericConflictTolerance || 0.15);
  const range = numeric.length >= 2 ? Math.max(...numeric) - Math.min(...numeric) : 0;
  const scale = Math.max(1, Math.abs(value || 0));
  const conflict = numeric.length >= 2 && range / scale > tolerance;
  const verified = numeric.length >= 2 && !conflict;
  const sourceCount = independent.length;
  const status = sourceCount === 0
    ? "no-independent-source"
    : numeric.length < 2
      ? "single-source"
      : conflict
        ? "conflict"
        : "verified";

  return {
    value,
    sourceCount,
    totalSourceCount: latestBySource.size,
    verified,
    conflict,
    status,
    sourceIds: independent.map(factSourceId).sort()
  };
}

export function resolveFactConsensus(facts = [], options = {}) {
  const maxAgeMinutes = Math.max(1, Number(options.maxAgeMinutes || 1440));
  const asOf = iso(options.asOf || new Date().toISOString());
  const asOfMs = Date.parse(asOf);
  const usable = (Array.isArray(facts) ? facts : []).filter((fact) => {
    const observed = Date.parse(String(fact.observed_at || fact.observedAt || ""));
    const captured = Date.parse(String(fact.captured_at || fact.capturedAt || ""));
    return Number.isFinite(observed) && Number.isFinite(captured) && observed <= asOfMs && captured <= asOfMs && (asOfMs - observed) / 60000 <= maxAgeMinutes;
  });

  const byKey = new Map();
  for (const fact of usable) {
    const key = `${clean(fact.event_id, 180)}:${clean(fact.entity_id, 180)}:${clean(fact.fact_family, 100)}:${clean(fact.fact_key, 140)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(fact);
  }

  return [...byKey.entries()].map(([key, group]) => {
    const result = buildFactConsensus(group, { tolerance: options.numericConflictTolerance });
    return {
      key,
      value: result.value,
      independentSourceCount: result.sourceCount,
      totalSourceCount: result.totalSourceCount,
      verified: result.verified,
      conflict: result.conflict,
      sourceIds: result.sourceIds
    };
  });
}

function teamKey(value) {
  return clean(value, 160).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stateFor(states, name) {
  const key = teamKey(name);
  if (!states.has(key)) {
    states.set(key, {
      teamKey: key,
      teamName: clean(name, 160),
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      elo: 1500,
      gfEwma: 1.35,
      gaEwma: 1.35,
      homeGfEwma: 1.45,
      homeGaEwma: 1.25,
      awayGfEwma: 1.20,
      awayGaEwma: 1.50,
      lastMatchAt: null,
      formPointsEwma: 1.35,
      sourceIds: new Set()
    });
  }
  return states.get(key);
}

function expectedElo(homeElo, awayElo, homeAdvantage = 65) {
  return 1 / (1 + 10 ** (-((homeElo + homeAdvantage) - awayElo) / 400));
}

function resultScore(home, away) {
  return home > away ? 1 : home < away ? 0 : 0.5;
}

function ewma(current, value, alpha, count) {
  return count === 0 ? value : alpha * value + (1 - alpha) * current;
}

export function buildFootballTeamStates(outcomes = [], asOf = new Date().toISOString(), options = {}) {
  const cutoff = Date.parse(asOf);
  const alpha = clamp(Number(options.alpha || 0.22), 0.05, 0.8);
  const k = Math.max(4, Math.min(60, Number(options.eloK || 24)));
  const states = new Map();
  const sorted = (Array.isArray(outcomes) ? outcomes : [])
    .filter((row) => row.status === "final" && row.finality_verified === true && Number.isFinite(Date.parse(row.commence_time || row.observed_at)) && Date.parse(row.commence_time || row.observed_at) < cutoff)
    .sort((a, b) => Date.parse(a.commence_time || a.observed_at) - Date.parse(b.commence_time || b.observed_at));

  for (const row of sorted) {
    const home = stateFor(states, row.home_team);
    const away = stateFor(states, row.away_team);
    const hg = finite(row.home_score);
    const ag = finite(row.away_score);
    if (hg === null || ag === null) continue;

    const expected = expectedElo(home.elo, away.elo);
    const actual = resultScore(hg, ag);
    const margin = 1 + Math.log1p(Math.abs(hg - ag)) * 0.25;
    const delta = k * margin * (actual - expected);
    home.elo += delta;
    away.elo -= delta;

    const hp = actual === 1 ? 3 : actual === 0.5 ? 1 : 0;
    const ap = actual === 0 ? 3 : actual === 0.5 ? 1 : 0;
    home.gfEwma = ewma(home.gfEwma, hg, alpha, home.matches);
    home.gaEwma = ewma(home.gaEwma, ag, alpha, home.matches);
    away.gfEwma = ewma(away.gfEwma, ag, alpha, away.matches);
    away.gaEwma = ewma(away.gaEwma, hg, alpha, away.matches);
    home.homeGfEwma = ewma(home.homeGfEwma, hg, alpha, home.matches);
    home.homeGaEwma = ewma(home.homeGaEwma, ag, alpha, home.matches);
    away.awayGfEwma = ewma(away.awayGfEwma, ag, alpha, away.matches);
    away.awayGaEwma = ewma(away.awayGaEwma, hg, alpha, away.matches);
    home.formPointsEwma = ewma(home.formPointsEwma, hp, alpha, home.matches);
    away.formPointsEwma = ewma(away.formPointsEwma, ap, alpha, away.matches);
    home.matches += 1;
    away.matches += 1;
    home.points += hp;
    away.points += ap;

    if (hg > ag) {
      home.wins += 1;
      away.losses += 1;
    } else if (hg < ag) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
    }
    home.lastMatchAt = iso(row.commence_time || row.observed_at);
    away.lastMatchAt = iso(row.commence_time || row.observed_at);
    for (const source of Array.isArray(row.source_ids) ? row.source_ids : []) {
      home.sourceIds.add(source);
      away.sourceIds.add(source);
    }
  }
  return states;
}

function poisson(goals, lambda) {
  let factorial = 1;
  for (let index = 2; index <= goals; index += 1) factorial *= index;
  return Math.exp(-lambda) * (lambda ** goals) / factorial;
}

function poisson1x2(homeLambda, awayLambda, maxGoals = 10) {
  const p = { home: 0, draw: 0, away: 0 };
  for (let h = 0; h <= maxGoals; h += 1) {
    for (let a = 0; a <= maxGoals; a += 1) {
      const joint = poisson(h, homeLambda) * poisson(a, awayLambda);
      if (h > a) p.home += joint;
      else if (h < a) p.away += joint;
      else p.draw += joint;
    }
  }
  const total = p.home + p.draw + p.away || 1;
  return { home: p.home / total, draw: p.draw / total, away: p.away / total };
}

function normalizeProbabilities(p) {
  const values = [Math.max(EPS, finite(p.home, 0)), Math.max(EPS, finite(p.draw, 0)), Math.max(EPS, finite(p.away, 0))];
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  return { home: values[0] / total, draw: values[1] / total, away: values[2] / total };
}

export function predictOwnFootballMatch({ homeTeam, awayTeam, teamStates, commenceTime = null, league = null, asOf = new Date().toISOString(), featureSnapshotId = null } = {}) {
  const home = teamStates instanceof Map ? teamStates.get(teamKey(homeTeam)) : null;
  const away = teamStates instanceof Map ? teamStates.get(teamKey(awayTeam)) : null;
  const minHistory = Math.min(home?.matches || 0, away?.matches || 0);
  if (!home || !away || minHistory < 5) {
    return {
      status: "insufficient-history",
      minHistory,
      modelId: OWN_FOOTBALL_MODEL_ID,
      modelVersion: OWN_FOOTBALL_MODEL_VERSION,
      probabilities: null,
      independentFromMarket: true,
      productionProbabilityChanged: false,
      productionPlayUpgradeAllowed: false,
      paperOnly: true
    };
  }

  const homeLambda = clamp(Math.sqrt(Math.max(EPS, home.homeGfEwma * away.awayGaEwma)), 0.15, 4.5);
  const awayLambda = clamp(Math.sqrt(Math.max(EPS, away.awayGfEwma * home.homeGaEwma)), 0.15, 4.2);
  const poissonComponent = poisson1x2(homeLambda, awayLambda);
  const eloHome = expectedElo(home.elo, away.elo);
  const draw = clamp(0.27 - Math.abs(home.elo - away.elo) / 4000, 0.18, 0.30);
  const elo = normalizeProbabilities({ home: eloHome * (1 - draw), draw, away: (1 - eloHome) * (1 - draw) });
  const probabilities = normalizeProbabilities({
    home: 0.68 * poissonComponent.home + 0.32 * elo.home,
    draw: 0.68 * poissonComponent.draw + 0.32 * elo.draw,
    away: 0.68 * poissonComponent.away + 0.32 * elo.away
  });

  const input = {
    homeTeam: clean(homeTeam, 160),
    awayTeam: clean(awayTeam, 160),
    league: clean(league, 160) || null,
    commenceTime: iso(commenceTime),
    asOf: iso(asOf),
    home: { ...home, sourceIds: [...home.sourceIds].sort() },
    away: { ...away, sourceIds: [...away.sourceIds].sort() },
    featureSnapshotId,
    modelVersion: OWN_FOOTBALL_MODEL_VERSION
  };
  const featureInputHash = stableHash(input);
  return {
    status: "ready",
    modelId: OWN_FOOTBALL_MODEL_ID,
    modelVersion: OWN_FOOTBALL_MODEL_VERSION,
    modelFamily: "elo-goal-strength-poisson-ensemble",
    independentFromMarket: true,
    expectedScores: { home: Number(homeLambda.toFixed(4)), away: Number(awayLambda.toFixed(4)) },
    probabilities,
    components: { poisson: poissonComponent, elo },
    minHistory,
    featureInputHash,
    predictionHash: stableHash({ input: featureInputHash, probabilities }),
    calibration: { status: "uncalibrated-shadow", productionEligible: false },
    productionProbabilityChanged: false,
    productionPlayUpgradeAllowed: false,
    paperOnly: true
  };
}

function lineageSourceId(item = {}) {
  return clean(item.sourceId || item.source_id || item.provider, 100).toLowerCase();
}

export function buildLearningExample({ featureSnapshot = {}, outcome = {}, sourceRights = {} } = {}) {
  if (!featureSnapshot?.id || !outcome?.id || !featureSnapshot?.event_id || !outcome?.outcome_hash) return null;

  const cutoff = Date.parse(featureSnapshot.as_of || "");
  const kickoff = Date.parse(featureSnapshot.commence_time || "");
  const outcomeObserved = Date.parse(outcome.observed_at || outcome.resolved_at || outcome.captured_at || "");
  const chronologyVerified = [cutoff, kickoff, outcomeObserved].every(Number.isFinite) && cutoff < kickoff && outcomeObserved >= kickoff;
  const outcomeVerified = outcome.status === "final" && outcome.finality_verified === true;
  const leakageVerified = featureSnapshot.leakage_guard_passed === true;

  const lineage = Array.isArray(featureSnapshot.source_lineage) ? featureSnapshot.source_lineage : [];
  const sources = [...new Set(lineage.map(lineageSourceId).filter(Boolean))];
  const blocked = [];
  const unverified = [];
  for (const sourceId of sources) {
    const right = sourceRights[sourceId]?.modelTrainingAllowed;
    if (right === false) blocked.push(sourceId);
    else if (right !== true) unverified.push(sourceId);
  }
  const trainingRightsVerified = sources.length > 0 && blocked.length === 0 && unverified.length === 0;

  const homeScore = finite(outcome.home_score);
  const awayScore = finite(outcome.away_score);
  const target = clean(outcome.outcome, 24) || (
    homeScore !== null && awayScore !== null
      ? homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw"
      : "unknown"
  );
  const featureInputHash = clean(featureSnapshot.input_hash, 180) || stableHash(featureSnapshot.features || {});
  const exclusions = [];
  if (!chronologyVerified) exclusions.push("chronology-not-verified");
  if (!outcomeVerified) exclusions.push("outcome-not-verified");
  if (!leakageVerified) exclusions.push("leakage-guard-not-verified");
  if (!sources.length) exclusions.push("training-lineage-missing");
  exclusions.push(...blocked.map((source) => `training-rights-blocked:${source}`));
  exclusions.push(...unverified.map((source) => `training-rights-unverified:${source}`));

  const eligibleForTraining = chronologyVerified && outcomeVerified && leakageVerified && trainingRightsVerified && target !== "unknown";
  const hashInput = {
    featureSnapshotId: featureSnapshot.id,
    inputHash: featureInputHash,
    target,
    outcomeHash: outcome.outcome_hash
  };

  return {
    event_id: featureSnapshot.event_id,
    feature_snapshot_id: featureSnapshot.id,
    outcome_id: outcome.id,
    feature_schema_version: clean(featureSnapshot.feature_schema_version, 120) || "scorecaster-pit-features-v1",
    feature_input_hash: featureInputHash,
    outcome_hash: outcome.outcome_hash,
    target,
    target_json: {
      outcome: target,
      homeScore,
      awayScore,
      resolvedAt: iso(outcome.resolved_at || outcome.observed_at)
    },
    eligible_for_training: eligibleForTraining,
    exclusion_reasons: [...new Set(exclusions)],
    chronology_verified: chronologyVerified,
    training_rights_verified: trainingRightsVerified,
    example_hash: stableHash(hashInput),
    paper_only: true
  };
}

export function buildDependencyReport(sourceHealth = []) {
  const rows = Array.isArray(sourceHealth) ? sourceHealth : [];
  const healthy = rows.filter((row) => row.status === "healthy" && row.rights_ok === true);
  const primary = healthy.filter((row) => row.dependency_class === "primary");
  const redundant = healthy.filter((row) => row.dependency_class === "redundant");
  return {
    totalSources: rows.length,
    healthySources: healthy.length,
    healthyPrimary: primary.length,
    healthyRedundant: redundant.length,
    providerIndependentEnoughForContinuity: primary.length >= 1 && (primary.length + redundant.length >= 2 || rows.some((row) => row.dependency_class === "bootstrap" && row.status === "healthy")),
    singleProviderFailureStopsStoredHistory: false,
    singleProviderFailureStopsFreshExternalFacts: primary.length <= 1 && redundant.length === 0,
    missingDataBehavior: "fail-closed"
  };
}
