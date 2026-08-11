import { createHash } from "node:crypto";

export const FEATURE_ENGINE_VERSION = "scorecaster-feature-engine-v1";

const MIN_TRUST = 0.55;
const MIN_CONFIDENCE = 0.45;
const FUTURE_SKEW_MS = 60_000;

const BAD_FACTOR_STATUSES = new Set([
  "missing",
  "unavailable",
  "not-configured",
  "not_configured",
  "not-verified",
  "not_verified",
  "not-confirmed",
  "source-unavailable",
  "fetch_error",
  "api_error",
  "no-reliable-news",
  "not-yet-available"
]);

function clean(value, limit = 180) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  const number = finite(value);
  return number === null ? null : Math.max(min, Math.min(max, number));
}

function round(value, digits = 6) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function probability(value) {
  const number = finite(value);
  return number !== null && number > 0 && number < 1 ? number : null;
}

function iso(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function eventId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.id, 180) || null;
}

function factorMap(pick = {}) {
  const rows = Array.isArray(pick?.unifiedSportsData?.factors) ? pick.unifiedSportsData.factors : [];
  return new Map(rows.map((row) => [clean(row?.key, 80), row]));
}

function latestFactorSource(factor = {}) {
  const sources = Array.isArray(factor.sources) ? factor.sources : [];
  return sources
    .map((source) => ({
      provider: clean(source?.provider || source?.name, 120) || "unknown",
      observedAt: iso(source?.observedAt),
      trust: clamp(source?.trust, 0, 1),
      type: clean(source?.type, 80) || "unknown"
    }))
    .sort((left, right) => (timestamp(right.observedAt) || 0) - (timestamp(left.observedAt) || 0))[0] || null;
}

function chronology({ observedAt, commenceTime, now }) {
  const observed = timestamp(observedAt);
  const commence = timestamp(commenceTime);
  const horizon = commence === null ? now : Math.min(now, commence);
  if (observed === null) return { safe: true, checked: false, horizon: new Date(horizon).toISOString() };
  return {
    safe: observed <= horizon + FUTURE_SKEW_MS,
    checked: true,
    horizon: new Date(horizon).toISOString()
  };
}

function feature({
  id,
  value,
  role = "feature",
  family = "general",
  source = "scorecaster",
  sourceType = "derived",
  observedAt = null,
  trust = null,
  confidence = null,
  commenceTime = null,
  now = Date.now(),
  required = false,
  sourceStatus = "available",
  modelEligible = true,
  note = null
}) {
  const numeric = finite(value);
  const normalizedStatus = clean(sourceStatus, 60).toLowerCase();
  const time = chronology({ observedAt, commenceTime, now });
  const reasons = [];

  if (numeric === null) reasons.push(required ? "required-value-missing" : "value-missing");
  if (BAD_FACTOR_STATUSES.has(normalizedStatus)) reasons.push(`source-status-${normalizedStatus}`);
  if (!time.safe) reasons.push("future-dated-source");

  const boundedTrust = clamp(trust, 0, 1);
  const boundedConfidence = clamp(confidence, 0, 1);
  const available = reasons.length === 0;
  const eligible = available && modelEligible === true && (boundedTrust === null || boundedTrust >= MIN_TRUST) && (boundedConfidence === null || boundedConfidence >= MIN_CONFIDENCE);

  if (available && modelEligible === true && boundedTrust !== null && boundedTrust < MIN_TRUST) reasons.push(`trust-below-${MIN_TRUST}`);
  if (available && modelEligible === true && boundedConfidence !== null && boundedConfidence < MIN_CONFIDENCE) reasons.push(`confidence-below-${MIN_CONFIDENCE}`);

  return {
    id: clean(id, 100),
    value: numeric === null ? null : round(numeric),
    role: clean(role, 40),
    family: clean(family, 60),
    status: available ? eligible ? "eligible" : "available-not-model-eligible" : reasons.includes("future-dated-source") ? "rejected-future" : "missing",
    eligibleForModel: eligible,
    source: clean(source, 120) || "unknown",
    sourceType: clean(sourceType, 80) || "unknown",
    sourceStatus: normalizedStatus || "unknown",
    observedAt: iso(observedAt),
    trust: boundedTrust === null ? null : round(boundedTrust, 3),
    confidence: boundedConfidence === null ? null : round(boundedConfidence, 3),
    chronology: time,
    reasons,
    note: clean(note, 260) || null
  };
}

function factorImpactFeature(factors, key, id, family, pick, now) {
  const factorRow = factors.get(key);
  const source = factorRow ? latestFactorSource(factorRow) : null;
  return feature({
    id,
    value: factorRow && !BAD_FACTOR_STATUSES.has(clean(factorRow.status, 60).toLowerCase()) ? factorRow.impact : null,
    family,
    role: "context",
    source: source?.provider || factorRow?.sources?.[0]?.provider || "unavailable",
    sourceType: source?.type || "context",
    observedAt: source?.observedAt,
    trust: factorRow?.trust,
    confidence: factorRow?.confidence,
    sourceStatus: factorRow?.status || "missing",
    commenceTime: pick.commenceTime || pick.commence_time,
    now,
    modelEligible: factorRow?.usedByAi === true,
    note: factorRow?.reason
  });
}

function formRestFeatures(pick = {}, now) {
  const shadow = pick.formRestShadow || pick.formRestShadowModel || null;
  const live = shadow?.provider?.mode === "live" && shadow?.chronologyGuard === true;
  const sample = Math.min(Number(shadow?.home?.sampleSize || 0), Number(shadow?.away?.sampleSize || 0));
  const confidence = live ? Math.min(0.8, Math.max(0, sample / 5) * 0.72) : 0;
  const observedAt = shadow?.provider?.retrievedAt || shadow?.asOf || null;
  const source = shadow?.provider?.source || "recent-results-provider";
  const sourceStatus = live ? sample >= 3 ? "ready" : "insufficient-sample" : "source-unavailable";
  const base = {
    family: "team-form-rest",
    role: "feature",
    source,
    sourceType: "completed-results",
    observedAt,
    trust: live ? 0.72 : 0,
    confidence,
    sourceStatus,
    commenceTime: pick.commenceTime || pick.commence_time,
    now,
    modelEligible: live && sample >= 3
  };

  return [
    feature({ id: "home-form-advantage", value: shadow?.features?.homeFormAdvantage, ...base }),
    feature({ id: "home-margin-advantage", value: shadow?.features?.homeMarginAdvantage, ...base }),
    feature({ id: "home-rest-advantage", value: shadow?.features?.homeRestAdvantage, ...base }),
    feature({ id: "home-congestion-advantage", value: shadow?.features?.homeCongestionAdvantage, ...base })
  ];
}

function auditedCustomFeatures(pick = {}, now) {
  const rows = Array.isArray(pick.modelFeatureInputs) ? pick.modelFeatureInputs : [];
  return rows.slice(0, 80).map((row) => feature({
    id: row?.id || row?.name,
    value: row?.value,
    family: row?.family || "custom",
    role: row?.role || "feature",
    source: row?.source,
    sourceType: row?.sourceType || "audited-model-input",
    observedAt: row?.observedAt,
    trust: row?.trust,
    confidence: row?.confidence,
    sourceStatus: row?.status || (row?.audited === true ? "available" : "not-verified"),
    commenceTime: pick.commenceTime || pick.commence_time,
    now,
    required: row?.required === true,
    modelEligible: row?.audited === true && row?.trainingOnly !== true,
    note: row?.note
  })).filter((row) => row.id);
}

function hashSnapshot(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function buildFeatureSnapshotV1(pick = {}, { now = Date.now() } = {}) {
  const factors = factorMap(pick);
  const fusion = pick.intelligenceFusionV2 || {};
  const coverage = pick.unifiedSportsData?.coverage || {};
  const oddsFactor = factors.get("odds-consensus");
  const oddsSource = latestFactorSource(oddsFactor || {});
  const commenceTime = pick.commenceTime || pick.commence_time || null;
  const marketProbability = probability(pick.marketProbability ?? pick.consensusProbability);

  const features = [
    feature({
      id: "selected-odds",
      value: pick.odds,
      role: "market-benchmark",
      family: "market",
      source: oddsSource?.provider || "odds-market",
      sourceType: "odds-market",
      observedAt: oddsSource?.observedAt || pick.lastUpdate || pick.updatedAt,
      trust: oddsFactor?.trust ?? 0.75,
      confidence: oddsFactor?.confidence ?? pick.confidence,
      sourceStatus: oddsFactor?.status || (finite(pick.odds) ? "available" : "missing"),
      commenceTime,
      now,
      required: true,
      modelEligible: false,
      note: "Price is retained as a market benchmark and is not an independent predictive feature."
    }),
    feature({
      id: "market-probability",
      value: marketProbability,
      role: "market-benchmark",
      family: "market",
      source: oddsSource?.provider || "odds-market",
      sourceType: "no-vig-market",
      observedAt: oddsSource?.observedAt || pick.lastUpdate || pick.updatedAt,
      trust: oddsFactor?.trust ?? 0.75,
      confidence: oddsFactor?.confidence ?? pick.confidence,
      sourceStatus: marketProbability === null ? "missing" : "available",
      commenceTime,
      now,
      required: true,
      modelEligible: false,
      note: "No-vig market probability is benchmark evidence, never relabeled as an independent model feature."
    }),
    feature({
      id: "bookmaker-count",
      value: pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount,
      role: "quality",
      family: "market-quality",
      source: "odds-market",
      sourceType: "coverage",
      observedAt: pick.lastUpdate || pick.updatedAt,
      trust: oddsFactor?.trust ?? 0.75,
      confidence: oddsFactor?.confidence ?? pick.confidence,
      sourceStatus: "available",
      commenceTime,
      now,
      modelEligible: true
    }),
    feature({
      id: "verified-data-coverage",
      value: coverage.verifiedCoverageRate ?? fusion?.coverage?.coverageRate,
      role: "quality",
      family: "data-quality",
      source: "intelligence-fusion-v2",
      sourceType: "audit",
      observedAt: fusion.generatedAt || pick.unifiedDataGeneratedAt,
      trust: fusion?.trust?.score,
      confidence: fusion?.trust?.score,
      sourceStatus: fusion?.dataQualityGate?.safeForAi === false ? "not-verified" : "available",
      commenceTime,
      now,
      modelEligible: true
    }),
    feature({
      id: "source-diversity",
      value: coverage.sourceCount ?? fusion?.coverage?.sourceCount,
      role: "quality",
      family: "data-quality",
      source: "unified-sports-data",
      sourceType: "coverage",
      observedAt: fusion.generatedAt || pick.unifiedDataGeneratedAt,
      trust: fusion?.trust?.score,
      confidence: fusion?.trust?.score,
      sourceStatus: "available",
      commenceTime,
      now,
      modelEligible: true
    }),
    feature({
      id: "fusion-trust-score",
      value: fusion?.trust?.score,
      role: "quality",
      family: "data-quality",
      source: "intelligence-fusion-v2",
      sourceType: "trust-engine",
      observedAt: fusion.generatedAt,
      trust: fusion?.trust?.score,
      confidence: fusion?.trust?.score,
      sourceStatus: fusion?.trust?.score === null || fusion?.trust?.score === undefined ? "missing" : "available",
      commenceTime,
      now,
      modelEligible: true
    }),
    factorImpactFeature(factors, "injuries", "injury-impact", "availability", pick, now),
    factorImpactFeature(factors, "lineups-and-starters", "lineup-impact", "availability", pick, now),
    factorImpactFeature(factors, "recent-form", "recent-form-impact", "team", pick, now),
    factorImpactFeature(factors, "rest-and-congestion", "rest-congestion-impact", "workload", pick, now),
    factorImpactFeature(factors, "travel", "travel-impact", "workload", pick, now),
    factorImpactFeature(factors, "weather", "weather-impact", "environment", pick, now),
    factorImpactFeature(factors, "market-movement", "market-movement-risk", "market", pick, now),
    ...formRestFeatures(pick, now),
    ...auditedCustomFeatures(pick, now)
  ];

  const deduped = [...new Map(features.filter((row) => row.id).map((row) => [row.id, row])).values()]
    .sort((left, right) => left.id.localeCompare(right.id));
  const eligible = deduped.filter((row) => row.eligibleForModel);
  const missing = deduped.filter((row) => row.status === "missing");
  const rejected = deduped.filter((row) => row.status === "rejected-future");
  const benchmark = deduped.filter((row) => row.role === "market-benchmark");

  const generatedAt = new Date(now).toISOString();
  const canonical = {
    version: FEATURE_ENGINE_VERSION,
    eventId: eventId(pick),
    sportKey: clean(pick.sportKey || pick.league, 120) || null,
    league: clean(pick.leagueTitle || pick.league, 140) || null,
    market: clean(pick.market || pick.marketKey || "h2h", 80) || "unknown",
    generatedAt,
    features: deduped.map((row) => ({
      id: row.id,
      value: row.value,
      role: row.role,
      family: row.family,
      status: row.status,
      eligibleForModel: row.eligibleForModel,
      source: row.source,
      observedAt: row.observedAt,
      trust: row.trust,
      confidence: row.confidence
    }))
  };

  return {
    ...canonical,
    snapshotHash: hashSnapshot(canonical),
    counts: {
      total: deduped.length,
      eligible: eligible.length,
      benchmark: benchmark.length,
      missing: missing.length,
      rejected: rejected.length
    },
    eligibilityRate: deduped.length ? round(eligible.length / deduped.length, 3) : 0,
    featureRows: deduped,
    eligibleFeatures: eligible,
    missingFeatures: missing.map((row) => ({ id: row.id, reasons: row.reasons })),
    rejectedFeatures: rejected.map((row) => ({ id: row.id, reasons: row.reasons })),
    contract: {
      missingDataImputed: false,
      futureDataAccepted: false,
      marketBenchmarkRelabeledAsIndependentFeature: false,
      customFeaturesRequireExplicitAudit: true,
      deterministic: true,
      paperOnly: true
    }
  };
}
