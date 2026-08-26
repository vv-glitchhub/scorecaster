import crypto from "node:crypto";

export const INTELLIGENCE_CORE_VERSION = "scorecaster-intelligence-core-v1";
export const OWN_FOOTBALL_MODEL_ID = "scorecaster-own-football-baseline";
export const OWN_FOOTBALL_MODEL_VERSION = "1.0.0";
export const TEAM_STATE_VERSION = "scorecaster-football-team-state-v1";

const MARKET_SOURCES = new Set([
  "the_odds_api", "odds-market", "polymarket", "scorecaster-unified-data"
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
const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
export const stableHash = (value) => crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");

export function timeBucket(value, minutes = 30) {
  const parsed = Date.parse(String(value || ""));
  const date = new Date(Number.isFinite(parsed) ? parsed : Date.now());
  const size = Math.max(1, Math.floor(minutes));
  const bucket = Math.floor(date.getUTCMinutes() / size) * size;
  date.setUTCMinutes(bucket, 0, 0);
  return date.toISOString();
}

function inferIndependence(sourceId, family, key) {
  const source = clean(sourceId, 100).toLowerCase();
  const haystack = `${clean(family, 100)} ${clean(key, 160)}`.toLowerCase();
  if (MARKET_SOURCES.has(source) || MARKET_HINTS.some((hint) => haystack.includes(hint))) return "market";
  if (source.startsWith("scorecaster_derived") || source.startsWith("scorecaster-derived")) return "derived";
  if (source === "scorecaster_internal") return "derived";
  return "independent";
}

export function canonicalFactFromCollector(record = {}, rights = {}) {
  const sourceId = clean(record.source_id || record.sourceId, 100) || "unknown";
  const family = clean(record.payload?.family || record.source_type || "collector", 100) || "collector";
  const key = clean(record.metric, 160) || "metric";
  const observedAt = iso(record.observed_at || record.observedAt);
  const capturedAt = iso(record.collected_at || record.collectedAt || record.created_at);
  if (!observedAt || !capturedAt) return null;
  const valueNumeric = finite(record.value);
  const payload = record.payload && typeof record.payload === "object" ? record.payload : {};
  const base = {
    sourceId,
    sourceRecordFingerprint: clean(record.fingerprint, 180) || null,
    eventId: clean(record.event_id || record.eventId, 180) || null,
    entityId: clean(record.entity_id || record.entityId, 180) || null,
    entityType: clean(payload.entityType, 80) || null,
    sportKey: clean(record.sport || record.sport_key, 120) || "unknown",
    league: clean(record.league, 160) || null,
    factFamily: family,
    factKey: key,
    valueNumeric,
    valueText: valueNumeric === null && record.value !== null && record.value !== undefined ? clean(record.value, 500) : null,
    valueJson: payload,
    observedAt,
    capturedAt,
    sourceTrust: clamp(finite(record.source_trust, 0.5), 0, 1),
    confidence: clamp(finite(record.confidence, 0.5), 0, 1),
    independenceClass: inferIndependence(sourceId, family, key),
    commercialUseAllowed: record.commercial_use_allowed === true || rights.commercialUseAllowed === true,
    modelTrainingAllowed: rights.modelTrainingAllowed === true,
    publishable: record.publishable === true,
  };
  return {
    fact_hash: stableHash(base),
    source_id: base.sourceId,
    source_record_fingerprint: base.sourceRecordFingerprint,
    event_id: base.eventId,
    entity_id: base.entityId,
    entity_type: base.entityType,
    sport_key: base.sportKey,
    league: base.league,
    fact_family: base.factFamily,
    fact_key: base.factKey,
    value_numeric: base.valueNumeric,
    value_text: base.valueText,
    value_json: base.valueJson,
    observed_at: base.observedAt,
    captured_at: base.capturedAt,
    source_trust: base.sourceTrust,
    confidence: base.confidence,
    independence_class: base.independenceClass,
    commercial_use_allowed: base.commercialUseAllowed,
    model_training_allowed: base.modelTrainingAllowed,
    publishable: base.publishable,
    source_lineage: { sourceId: base.sourceId, sourceRecordFingerprint: base.sourceRecordFingerprint },
    paper_only: true,
  };
}

export function canonicalFactFromObservation(row = {}, rights = {}) {
  const sourceId = clean(row.provider, 100) || "scorecaster-analytics";
  const family = clean(row.family, 100) || "analytics";
  const key = clean(row.metric, 160) || "metric";
  const observedAt = iso(row.observed_at || row.observedAt);
  const capturedAt = iso(row.captured_at || row.capturedAt || row.created_at);
  if (!observedAt || !capturedAt) return null;
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const base = {
    sourceId,
    sourceRecordFingerprint: clean(row.fingerprint, 180) || null,
    eventId: clean(row.event_id || row.eventId, 180) || null,
    entityId: clean(row.participant_id || row.participantId, 180) || null,
    sportKey: clean(row.sport_key || row.canonical_sport, 120) || "unknown",
    league: clean(row.league, 160) || null,
    family,
    key,
    value: finite(row.value),
    observedAt,
    capturedAt,
    sourceTrust: clamp(finite(row.source_trust, 0.5), 0, 1),
    confidence: clamp(finite(row.confidence, 0.5), 0, 1),
    independenceClass: inferIndependence(sourceId, family, key),
    commercialUseAllowed: rights.commercialUseAllowed === true || metadata.commercialUseAllowed === true,
    modelTrainingAllowed: rights.modelTrainingAllowed === true || metadata.modelTrainingAllowed === true,
    publishable: rights.publishable === true || metadata.publishable === true,
    metadata,
  };
  return {
    fact_hash: stableHash(base), source_id: base.sourceId, source_record_fingerprint: base.sourceRecordFingerprint,
    event_id: base.eventId, entity_id: base.entityId, entity_type: "participant", sport_key: base.sportKey,
    league: base.league, fact_family: base.family, fact_key: base.key, value_numeric: base.value,
    value_text: null, value_json: base.metadata, observed_at: base.observedAt, captured_at: base.capturedAt,
    source_trust: base.sourceTrust, confidence: base.confidence, independence_class: base.independenceClass,
    commercial_use_allowed: base.commercialUseAllowed, model_training_allowed: base.modelTrainingAllowed,
    publishable: base.publishable, source_lineage: { sourceId: base.sourceId, sourceRecordFingerprint: base.sourceRecordFingerprint }, paper_only: true,
  };
}

function weightedMedian(entries = []) {
  const rows = entries
    .map((row) => ({ value: finite(row.value_numeric), weight: Math.max(EPS, finite(row.source_trust, 0.5) * finite(row.confidence, 0.5)) }))
    .filter((row) => row.value !== null)
    .sort((a, b) => a.value - b.value);
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  let running = 0;
  for (const row of rows) {
    running += row.weight;
    if (running >= total / 2) return row.value;
  }
  return rows.at(-1).value;
}

export function buildFactConsensus(facts = [], { tolerance = 0.08, requireIndependentSources = 2 } = {}) {
  const usable = facts.filter((fact) => fact && fact.independence_class !== "market");
  const sourceIds = [...new Set(usable.map((fact) => clean(fact.source_id, 100)).filter(Boolean))];
  const numeric = usable.map((fact) => finite(fact.value_numeric)).filter((value) => value !== null);
  const consensus = weightedMedian(usable);
  const min = numeric.length ? Math.min(...numeric) : null;
  const max = numeric.length ? Math.max(...numeric) : null;
  const spread = consensus !== null && min !== null && max !== null ? (max - min) / Math.max(Math.abs(consensus), 1) : null;
  const conflict = spread !== null && spread > tolerance;
  const rightsOk = usable.length > 0 && usable.every((fact) => fact.commercial_use_allowed === true);
  const trainingRightsOk = usable.length > 0 && usable.every((fact) => fact.model_training_allowed === true);
  const verified = sourceIds.length >= requireIndependentSources && !conflict && rightsOk;
  return {
    value: consensus,
    sources: sourceIds,
    sourceCount: sourceIds.length,
    observations: usable.length,
    spread,
    conflict,
    rightsOk,
    trainingRightsOk,
    status: verified ? "verified" : sourceIds.length ? (conflict ? "conflict" : "single-source") : "missing",
    verified,
  };
}

function teamKey(value) {
  return clean(value, 160).toLowerCase().replace(/[^a-z0-9åäöæøüéèáíóúñß]+/gi, "-").replace(/^-|-$/g, "");
}
function daysBetween(left, right) {
  const a = Date.parse(String(left || ""));
  const b = Date.parse(String(right || ""));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 7;
  return clamp((b - a) / 86_400_000, 1, 45);
}
function ewma(current, value, alpha, count) {
  return count === 0 ? value : alpha * value + (1 - alpha) * current;
}
function expectedElo(homeElo, awayElo, homeAdvantage = 65) {
  return 1 / (1 + 10 ** (-((homeElo + homeAdvantage) - awayElo) / 400));
}
function outcomeScore(home, away) {
  if (home > away) return 1;
  if (home < away) return 0;
  return 0.5;
}

export function buildFootballTeamStates(outcomes = [], asOf = new Date().toISOString(), options = {}) {
  const cutoff = Date.parse(asOf);
  const alpha = clamp(finite(options.alpha, 0.22), 0.05, 0.8);
  const kFactor = clamp(finite(options.kFactor, 24), 8, 64);
  const rows = [...outcomes]
    .filter((row) => row?.status === "final" && row.finality_verified === true)
    .filter((row) => Number.isFinite(Date.parse(row.resolved_at || row.observed_at)) && Date.parse(row.resolved_at || row.observed_at) <= cutoff)
    .filter((row) => finite(row.home_score) !== null && finite(row.away_score) !== null && row.home_team && row.away_team)
    .sort((a, b) => Date.parse(a.resolved_at || a.observed_at) - Date.parse(b.resolved_at || b.observed_at));
  const states = new Map();
  const get = (name) => {
    const key = teamKey(name);
    if (!states.has(key)) states.set(key, { teamKey: key, teamName: clean(name, 160), matches: 0, wins: 0, draws: 0, losses: 0, points: 0, elo: 1500, gfEwma: 1.35, gaEwma: 1.35, homeGfEwma: 1.45, homeGaEwma: 1.25, awayGfEwma: 1.20, awayGaEwma: 1.50, lastMatchAt: null, formPointsEwma: 1.35, sourceIds: new Set() });
    return states.get(key);
  };
  for (const row of rows) {
    const home = get(row.home_team); const away = get(row.away_team);
    const hg = finite(row.home_score, 0); const ag = finite(row.away_score, 0);
    const expected = expectedElo(home.elo, away.elo);
    const actual = outcomeScore(hg, ag);
    const marginMultiplier = 1 + Math.log1p(Math.abs(hg - ag)) * 0.25;
    const delta = kFactor * marginMultiplier * (actual - expected);
    home.elo += delta; away.elo -= delta;
    const homePts = actual === 1 ? 3 : actual === 0.5 ? 1 : 0;
    const awayPts = actual === 0 ? 3 : actual === 0.5 ? 1 : 0;
    home.gfEwma = ewma(home.gfEwma, hg, alpha, home.matches); home.gaEwma = ewma(home.gaEwma, ag, alpha, home.matches);
    away.gfEwma = ewma(away.gfEwma, ag, alpha, away.matches); away.gaEwma = ewma(away.gaEwma, hg, alpha, away.matches);
    home.homeGfEwma = ewma(home.homeGfEwma, hg, alpha, home.matches); home.homeGaEwma = ewma(home.homeGaEwma, ag, alpha, home.matches);
    away.awayGfEwma = ewma(away.awayGfEwma, ag, alpha, away.matches); away.awayGaEwma = ewma(away.awayGaEwma, hg, alpha, away.matches);
    home.formPointsEwma = ewma(home.formPointsEwma, homePts, alpha, home.matches); away.formPointsEwma = ewma(away.formPointsEwma, awayPts, alpha, away.matches);
    home.matches += 1; away.matches += 1; home.points += homePts; away.points += awayPts;
    if (hg > ag) { home.wins += 1; away.losses += 1; } else if (hg < ag) { away.wins += 1; home.losses += 1; } else { home.draws += 1; away.draws += 1; }
    home.lastMatchAt = row.resolved_at || row.observed_at; away.lastMatchAt = row.resolved_at || row.observed_at;
    for (const source of Array.isArray(row.source_ids) ? row.source_ids : []) { home.sourceIds.add(source); away.sourceIds.add(source); }
  }
  return new Map([...states.entries()].map(([key, state]) => [key, { ...state, elo: Number(state.elo.toFixed(3)), gfEwma: Number(state.gfEwma.toFixed(4)), gaEwma: Number(state.gaEwma.toFixed(4)), homeGfEwma: Number(state.homeGfEwma.toFixed(4)), homeGaEwma: Number(state.homeGaEwma.toFixed(4)), awayGfEwma: Number(state.awayGfEwma.toFixed(4)), awayGaEwma: Number(state.awayGaEwma.toFixed(4)), formPointsEwma: Number(state.formPointsEwma.toFixed(4)), sourceIds: [...state.sourceIds].sort() } ]));
}

function poisson(goals, lambda) {
  let factorial = 1;
  for (let i = 2; i <= goals; i += 1) factorial *= i;
  return Math.exp(-lambda) * lambda ** goals / factorial;
}
function poissonThreeWay(homeLambda, awayLambda, maxGoals = 10) {
  const p = { home: 0, draw: 0, away: 0 };
  for (let h = 0; h <= maxGoals; h += 1) for (let a = 0; a <= maxGoals; a += 1) {
    const joint = poisson(h, homeLambda) * poisson(a, awayLambda);
    if (h > a) p.home += joint; else if (h < a) p.away += joint; else p.draw += joint;
  }
  const total = p.home + p.draw + p.away || 1;
  return { home: p.home / total, draw: p.draw / total, away: p.away / total };
}
function normalizeThreeWay(p) {
  const values = [Math.max(EPS, finite(p.home, 0)), Math.max(EPS, finite(p.draw, 0)), Math.max(EPS, finite(p.away, 0))];
  const total = values.reduce((sum, value) => sum + value, 0);
  return { home: values[0] / total, draw: values[1] / total, away: values[2] / total };
}

export function predictOwnFootballMatch({ homeTeam, awayTeam, commenceTime, teamStates, league = null, asOf = new Date().toISOString(), featureSnapshotId = null } = {}) {
  const home = teamStates instanceof Map ? teamStates.get(teamKey(homeTeam)) : null;
  const away = teamStates instanceof Map ? teamStates.get(teamKey(awayTeam)) : null;
  const minHistory = Math.min(home?.matches || 0, away?.matches || 0);
  if (!home || !away || minHistory < 5) return { status: "insufficient-history", minHistory, independentFromMarket: true, probabilities: null };
  const leagueGoalPrior = 1.35;
  const homeLambda = clamp(Math.sqrt(Math.max(EPS, home.homeGfEwma * away.awayGaEwma)), 0.15, 4.5);
  const awayLambda = clamp(Math.sqrt(Math.max(EPS, away.awayGfEwma * home.homeGaEwma)), 0.15, 4.2);
  const poissonP = poissonThreeWay(homeLambda || leagueGoalPrior, awayLambda || leagueGoalPrior);
  const eloHomeNoDraw = expectedElo(home.elo, away.elo);
  const drawBase = clamp(0.27 - Math.abs(home.elo - away.elo) / 4000, 0.18, 0.30);
  const eloP = normalizeThreeWay({ home: eloHomeNoDraw * (1 - drawBase), draw: drawBase, away: (1 - eloHomeNoDraw) * (1 - drawBase) });
  const probabilities = normalizeThreeWay({
    home: 0.68 * poissonP.home + 0.32 * eloP.home,
    draw: 0.68 * poissonP.draw + 0.32 * eloP.draw,
    away: 0.68 * poissonP.away + 0.32 * eloP.away,
  });
  const rest = { home: daysBetween(home.lastMatchAt, commenceTime), away: daysBetween(away.lastMatchAt, commenceTime) };
  const input = { modelId: OWN_FOOTBALL_MODEL_ID, modelVersion: OWN_FOOTBALL_MODEL_VERSION, homeTeam, awayTeam, league, asOf, commenceTime, home, away, rest, homeLambda, awayLambda };
  const predictionHash = stableHash({ ...input, probabilities });
  return {
    status: "ready", modelId: OWN_FOOTBALL_MODEL_ID, modelVersion: OWN_FOOTBALL_MODEL_VERSION,
    modelFamily: "elo-goal-strength-poisson-ensemble", independentFromMarket: true, shadowOnly: true,
    probabilities, expectedScores: { home: homeLambda, away: awayLambda }, rest, minHistory,
    featureInputHash: stableHash(input), predictionHash, featureSnapshotId,
    calibration: { status: "uncalibrated-shadow", productionEligible: false },
  };
}

export function buildLearningExample({ featureSnapshot, outcome, sourceRights = {} } = {}) {
  if (!featureSnapshot?.id || !outcome?.id) return null;
  const featureTime = Date.parse(featureSnapshot.as_of || "");
  const kickoff = Date.parse(featureSnapshot.commence_time || outcome.commence_time || "");
  const outcomeTime = Date.parse(outcome.resolved_at || outcome.observed_at || "");
  const chronologyVerified = Number.isFinite(featureTime) && Number.isFinite(outcomeTime) && featureTime < outcomeTime && (!Number.isFinite(kickoff) || featureTime < kickoff);
  const finalOutcome = outcome.status === "final" && outcome.finality_verified === true && ["home", "draw", "away"].includes(outcome.outcome);
  const lineage = Array.isArray(featureSnapshot.source_lineage) ? featureSnapshot.source_lineage : [];
  const independentSources = lineage.filter((item) => item?.kind !== "market" && item?.sourceId && item.sourceId !== "the_odds_api");
  const trainingRightsVerified = independentSources.length > 0 && independentSources.every((item) => sourceRights[item.sourceId]?.modelTrainingAllowed === true);
  const exclusionReasons = [
    ...(chronologyVerified ? [] : ["chronology-not-verified"]),
    ...(finalOutcome ? [] : ["outcome-not-final"]),
    ...(featureSnapshot.leakage_guard_passed === true ? [] : ["feature-leakage-guard-failed"]),
    ...(trainingRightsVerified ? [] : ["independent-training-rights-not-verified"]),
  ];
  const base = {
    eventId: featureSnapshot.event_id, featureSnapshotId: featureSnapshot.id, outcomeId: outcome.id,
    featureSchemaVersion: featureSnapshot.feature_schema_version, featureInputHash: featureSnapshot.input_hash,
    outcomeHash: outcome.outcome_hash, target: outcome.outcome, chronologyVerified, trainingRightsVerified,
  };
  return {
    event_id: base.eventId, feature_snapshot_id: base.featureSnapshotId, outcome_id: base.outcomeId,
    feature_schema_version: base.featureSchemaVersion, feature_input_hash: base.featureInputHash, outcome_hash: base.outcomeHash,
    target: base.target, target_json: { homeScore: outcome.home_score, awayScore: outcome.away_score },
    eligible_for_training: exclusionReasons.length === 0, exclusion_reasons: exclusionReasons,
    chronology_verified: chronologyVerified, training_rights_verified: trainingRightsVerified,
    example_hash: stableHash(base), paper_only: true,
  };
}

export function buildDependencyReport(sourceHealth = []) {
  const active = sourceHealth.filter((row) => ["healthy", "degraded", "stale"].includes(row.status));
  const healthy = active.filter((row) => row.status === "healthy");
  const primaryHealthy = healthy.filter((row) => row.dependency_class === "primary");
  const independentHealthy = healthy.filter((row) => row.diagnostics?.independentFromMarket !== false);
  return {
    activeSources: active.length, healthySources: healthy.length, healthyPrimarySources: primaryHealthy.length,
    independentHealthySources: independentHealthy.length,
    singleSourceDependency: independentHealthy.length < 2,
    providerResilience: independentHealthy.length >= 3 ? "strong" : independentHealthy.length >= 2 ? "redundant" : independentHealthy.length === 1 ? "fragile" : "offline",
    allIntelligenceDerivedInScorecaster: true,
    rawFactsStillRequireExternalObservation: true,
  };
}
