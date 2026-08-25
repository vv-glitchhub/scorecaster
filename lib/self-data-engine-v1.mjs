import crypto from "node:crypto";

export const SELF_DATA_ENGINE_VERSION = "scorecaster-self-data-engine-v1";
export const PIT_FEATURE_SCHEMA_VERSION = "scorecaster-pit-features-v1";

const clean = (value, limit = 180) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

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

export function halfHourBucket(value) {
  const parsed = Date.parse(String(value || ""));
  const date = new Date(Number.isFinite(parsed) ? parsed : Date.now());
  date.setUTCSeconds(0, 0);
  date.setUTCMinutes(date.getUTCMinutes() < 30 ? 0 : 30);
  return date.toISOString();
}

function eventId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.id, 180);
}

function commenceTime(pick = {}) {
  return iso(pick.commenceTime || pick.commence_time || pick.startTime || pick.start_time);
}

function rowTime(row = {}) {
  return iso(row.observed_at || row.observedAt || row.captured_at || row.collected_at || row.created_at);
}

function collectedTime(row = {}) {
  return iso(row.captured_at || row.collected_at || row.created_at || row.observed_at);
}

function beforeOrAt(value, cutoffMs) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) && parsed <= cutoffMs;
}

function chronologySafe(rows = [], asOf, kickoff) {
  const asOfMs = Date.parse(asOf);
  const kickoffMs = kickoff ? Date.parse(kickoff) : null;
  return rows.filter((row) => {
    const observed = rowTime(row);
    const captured = collectedTime(row);
    if (!observed || !captured) return false;
    if (!beforeOrAt(observed, asOfMs) || !beforeOrAt(captured, asOfMs)) return false;
    if (Number.isFinite(kickoffMs) && (Date.parse(observed) >= kickoffMs || Date.parse(captured) >= kickoffMs)) return false;
    return true;
  });
}

function latestByKey(rows = [], keyFn) {
  const sorted = [...rows].sort((a, b) => Date.parse(rowTime(b) || 0) - Date.parse(rowTime(a) || 0));
  const out = new Map();
  for (const row of sorted) {
    const key = keyFn(row);
    if (key && !out.has(key)) out.set(key, row);
  }
  return [...out.values()];
}

function observationFeatures(rows = []) {
  const latest = latestByKey(rows, (row) => `${clean(row.family, 80)}:${clean(row.metric, 120)}:${clean(row.participant_id, 140)}`);
  const numeric = {};
  const families = new Set();
  const providers = new Set();
  for (const row of latest) {
    const family = clean(row.family, 80) || "unknown";
    const metric = clean(row.metric, 120) || "metric";
    const participant = clean(row.participant_id, 140) || "event";
    families.add(family);
    if (row.provider) providers.add(clean(row.provider, 100));
    const value = finite(row.value);
    if (value !== null) numeric[`${family}.${metric}.${participant}`] = value;
  }
  return { numeric, families: [...families].sort(), providers: [...providers].sort(), latestCount: latest.length };
}

function collectorFeatures(rows = []) {
  const latest = latestByKey(rows, (row) => `${clean(row.source_id, 100)}:${clean(row.metric, 120)}:${clean(row.entity_id, 140)}`);
  const numeric = {};
  const sources = new Set();
  for (const row of latest) {
    const source = clean(row.source_id, 100) || "unknown";
    const metric = clean(row.metric, 120) || "metric";
    const entity = clean(row.entity_id, 140) || "event";
    sources.add(source);
    const value = finite(row.value);
    if (value !== null) numeric[`${source}.${metric}.${entity}`] = value;
  }
  return { numeric, sources: [...sources].sort(), latestCount: latest.length };
}

function pickFeatures(pick = {}) {
  return {
    modelProbability: finite(pick.probability ?? pick.modelProbability ?? pick.model_probability),
    marketProbability: finite(pick.marketProbability ?? pick.market_probability ?? pick.noVigProbability),
    edge: finite(pick.edge),
    ev: finite(pick.ev ?? pick.expectedValue),
    confidence: finite(pick.confidence),
    score: finite(pick.score ?? pick.recommendationScore),
    bookmakerCount: finite(pick.bookmakerCount ?? pick.bookmakersCount ?? pick.coverage?.bookmakerCount),
    freshnessMinutes: finite(pick.freshnessMinutes ?? pick.dataFreshnessMinutes),
  };
}

function evidenceReadiness(pick = {}) {
  const readiness = pick.intelligenceReadiness || pick.sportsIntelligence?.readiness || pick.footballIndependentEvidenceV1?.readiness || {};
  return {
    level: clean(readiness.level, 40) || "market-only",
    score: finite(readiness.score),
    verifiedCount: finite(readiness.verifiedCount),
    totalChecks: finite(readiness.totalChecks),
    allowsIndependentPlayEvidence: readiness.allowsIndependentPlayEvidence === true,
    fullyVerified: readiness.fullyVerified === true,
    missing: Array.isArray(readiness.missing) ? readiness.missing.map((item) => clean(item, 160)).filter(Boolean).slice(0, 20) : [],
  };
}

function sourceLineage(collectorRows = [], observationRows = []) {
  const lineage = new Map();
  for (const row of collectorRows) {
    const sourceId = clean(row.source_id, 100) || "unknown";
    const current = lineage.get(sourceId) || { sourceId, kind: "collector", records: 0, commercialUseAllowed: true, publishable: true, latestObservedAt: null };
    current.records += 1;
    current.commercialUseAllowed = current.commercialUseAllowed && row.commercial_use_allowed === true;
    current.publishable = current.publishable && row.publishable === true;
    const observedAt = rowTime(row);
    if (observedAt && (!current.latestObservedAt || observedAt > current.latestObservedAt)) current.latestObservedAt = observedAt;
    lineage.set(sourceId, current);
  }
  for (const row of observationRows) {
    const sourceId = clean(row.provider, 100) || "scorecaster-analytics";
    const current = lineage.get(sourceId) || { sourceId, kind: "analytics", records: 0, latestObservedAt: null };
    current.records += 1;
    const observedAt = rowTime(row);
    if (observedAt && (!current.latestObservedAt || observedAt > current.latestObservedAt)) current.latestObservedAt = observedAt;
    lineage.set(sourceId, current);
  }
  return [...lineage.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

export function buildPointInTimeFeatureSnapshot({ pick = {}, collectorRows = [], observationRows = [], asOf = new Date().toISOString(), runId = null } = {}) {
  const id = eventId(pick);
  const kickoff = commenceTime(pick);
  const safeCollectors = chronologySafe(collectorRows.filter((row) => clean(row.event_id, 180) === id), asOf, kickoff);
  const safeObservations = chronologySafe(observationRows.filter((row) => clean(row.event_id, 180) === id), asOf, kickoff);
  const collectors = collectorFeatures(safeCollectors);
  const observations = observationFeatures(safeObservations);
  const pickData = pickFeatures(pick);
  const lineage = sourceLineage(safeCollectors, safeObservations);

  const rawRows = [...collectorRows.filter((row) => clean(row.event_id, 180) === id), ...observationRows.filter((row) => clean(row.event_id, 180) === id)];
  const rejectedForChronology = Math.max(0, rawRows.length - safeCollectors.length - safeObservations.length);
  const kickoffMs = kickoff ? Date.parse(kickoff) : null;
  const asOfMs = Date.parse(asOf);
  const pregame = !Number.isFinite(kickoffMs) || asOfMs < kickoffMs;
  const leakageGuardPassed = pregame && rejectedForChronology === 0;
  const usefulFamilies = observations.families.filter((family) => family !== "market");
  const sourceCount = lineage.length;
  const evidence = evidenceReadiness(pick);
  const hasMarketAnchor = pickData.marketProbability !== null || pickData.bookmakerCount !== null || safeCollectors.some((row) => clean(row.metric, 80).includes("fixture"));
  const hasIndependentSignal = usefulFamilies.length > 0 || evidence.level === "partial" || evidence.level === "verified";
  const eligibleForModel = leakageGuardPassed && hasMarketAnchor && (safeCollectors.length + safeObservations.length > 0);

  const dataQuality = {
    pregame,
    leakageGuardPassed,
    rejectedForChronology,
    collectorRecords: safeCollectors.length,
    analyticsObservations: safeObservations.length,
    sourceCount,
    families: observations.families,
    independentFamilyCount: usefulFamilies.length,
    hasMarketAnchor,
    hasIndependentSignal,
    evidenceLevel: evidence.level,
    eligibleForModel,
    missing: [
      ...(hasMarketAnchor ? [] : ["market-anchor"]),
      ...(safeCollectors.length + safeObservations.length ? [] : ["point-in-time-data"]),
      ...(pregame ? [] : ["event-already-started"]),
      ...(rejectedForChronology ? ["chronology-rejected-rows"] : []),
    ],
  };

  const features = {
    market: pickData,
    analytics: observations.numeric,
    collected: collectors.numeric,
    evidence,
    counts: {
      collectorLatest: collectors.latestCount,
      analyticsLatest: observations.latestCount,
      sourceCount,
      familyCount: observations.families.length,
    },
  };

  const hashInput = {
    eventId: id,
    asOf,
    kickoff,
    schema: PIT_FEATURE_SCHEMA_VERSION,
    features,
    lineage,
    dataQuality,
  };

  return {
    run_id: runId,
    event_id: id,
    sport_key: clean(pick.sportKey || pick.sport_key || pick.league, 120) || "unknown",
    league: clean(pick.leagueTitle || pick.sportTitle || pick.league, 140) || null,
    home_team: clean(pick.homeTeam || pick.home_team, 140) || null,
    away_team: clean(pick.awayTeam || pick.away_team, 140) || null,
    commence_time: kickoff,
    as_of: asOf,
    as_of_bucket: halfHourBucket(asOf),
    feature_schema_version: PIT_FEATURE_SCHEMA_VERSION,
    input_hash: stableHash(hashInput),
    features,
    source_lineage: lineage,
    data_quality: dataQuality,
    eligible_for_model: eligibleForModel,
    leakage_guard_passed: leakageGuardPassed,
    paper_only: true,
  };
}

function normalizeDecision(value) {
  const decision = clean(value, 20).toUpperCase();
  return ["PLAY", "CAUTION", "SKIP"].includes(decision) ? decision : "CAUTION";
}

export function buildAutonomousDecision({ pick = {}, featureSnapshot = {}, featureSnapshotId, runId = null, asOf = new Date().toISOString() } = {}) {
  const baseDecision = normalizeDecision(pick.decision || pick.action || pick.recommendation);
  const quality = featureSnapshot.data_quality || {};
  let decision = baseDecision;
  const reasons = [];

  if (quality.leakageGuardPassed !== true) {
    decision = "SKIP";
    reasons.push("point-in-time-leakage-guard-failed");
  } else if (quality.eligibleForModel !== true && baseDecision === "PLAY") {
    decision = "CAUTION";
    reasons.push("self-data-insufficient-for-play");
  }
  if (quality.hasIndependentSignal !== true) reasons.push("independent-data-incomplete");
  if (Array.isArray(quality.missing)) reasons.push(...quality.missing);

  const selection = clean(pick.selection || pick.label || pick.pick || pick.homeTeam, 180) || null;
  const modelProbability = finite(pick.probability ?? pick.modelProbability ?? pick.model_probability);
  const marketProbability = finite(pick.marketProbability ?? pick.market_probability ?? pick.noVigProbability);
  const evidence = evidenceReadiness(pick);
  const modelStack = {
    recommendationVersion: clean(pick.version || pick.recommendationVersion || pick.engineVersion, 120) || null,
    soccerXgPoisson: pick.soccerXgPoissonShadowV1 ? {
      status: clean(pick.soccerXgPoissonShadowV1.status, 40) || null,
      modelId: clean(pick.soccerXgPoissonShadowV1.modelId, 120) || null,
      modelVersion: clean(pick.soccerXgPoissonShadowV1.version || pick.soccerXgPoissonShadowV1.modelVersion, 120) || null,
    } : null,
    footballIndependentEvidence: pick.footballIndependentEvidenceV1 ? {
      version: clean(pick.footballIndependentEvidenceV1.version, 120) || null,
      readiness: clean(pick.footballIndependentEvidenceV1.readiness?.level, 40) || null,
    } : null,
    selfDataEngineVersion: SELF_DATA_ENGINE_VERSION,
    featureSchemaVersion: PIT_FEATURE_SCHEMA_VERSION,
  };

  const decisionHash = stableHash({
    eventId: featureSnapshot.event_id,
    asOfBucket: featureSnapshot.as_of_bucket,
    inputHash: featureSnapshot.input_hash,
    decision,
    selection,
    modelProbability,
    marketProbability,
  });

  return {
    run_id: runId,
    feature_snapshot_id: featureSnapshotId,
    event_id: featureSnapshot.event_id,
    as_of: asOf,
    decision,
    selection,
    model_probability: modelProbability,
    market_probability: marketProbability,
    edge: finite(pick.edge),
    ev: finite(pick.ev ?? pick.expectedValue),
    confidence: finite(pick.confidence),
    score: finite(pick.score ?? pick.recommendationScore),
    model_stack: modelStack,
    evidence_readiness: evidence,
    reason_codes: [...new Set(reasons.filter(Boolean))].slice(0, 30),
    decision_hash: decisionHash,
    source_decision_version: clean(pick.version || pick.recommendationVersion || pick.engineVersion, 120) || null,
    automatic_upgrade_by_self_data_layer: false,
    production_probability_changed: false,
    real_money_action_available: false,
    paper_only: true,
  };
}
