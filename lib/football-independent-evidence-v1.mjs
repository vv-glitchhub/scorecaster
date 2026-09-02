export const FOOTBALL_INDEPENDENT_EVIDENCE_VERSION = "football-independent-evidence-v1";

const HOUR_MS = 60 * 60 * 1000;
const PREDICTIVE_FRESHNESS_HOURS = 72;
const LINEUP_REQUIRED_WITHIN_HOURS = 6;
const MAX_SUPPORTIVE_GAP = 0.02;
const STRONG_CONFLICT_GAP = 0.05;
const BLOCKED_PREDICTIVE_PROVIDERS = new Set(["scorecaster-unified-data", "the-odds-api", "odds-market", "polymarket", "open-meteo", "thesportsdb"]);

function clean(value, limit = 180) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function providerKey(value) {
  return clean(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedSport(pick = {}) {
  return clean(pick.sportKey || pick.sport || pick.league, 120).toLowerCase();
}

function isSoccer(pick = {}) {
  const sport = normalizedSport(pick);
  return sport.includes("soccer") || sport.includes("football") || sport.includes("epl") || sport.includes("liga") || sport.includes("serie-a") || sport.includes("bundesliga");
}

function marketProbability(pick = {}) {
  const value = finite(pick.consensusProbability ?? pick.marketProbability ?? pick.modelProbability);
  return value !== null && value > 0 && value < 1 ? value : null;
}

function predictiveProbability(model = {}) {
  const value = finite(model.probability ?? model.shadowProbability);
  return value !== null && value > 0 && value < 1 ? value : null;
}

function hoursUntilKickoff(pick = {}, now = Date.now()) {
  const kickoff = timestamp(pick.commenceTime || pick.commence_time);
  return kickoff === null ? null : (kickoff - now) / HOUR_MS;
}

function evidenceAgeHours(status = {}, model = {}, now = Date.now()) {
  const horizon = timestamp(model.predictionHorizon || status.horizon);
  const newest = timestamp(status.newestObservedAt || model?.provenance?.observedAtMax);
  const reference = horizon === null ? now : Math.min(now, horizon);
  return newest === null ? null : Math.max(0, (reference - newest) / HOUR_MS);
}

function shotQualityCoverage(observations = []) {
  const metrics = new Set((Array.isArray(observations) ? observations : []).map((row) => clean(row.metric, 120).toLowerCase()));
  const shots = ["shots-for-per-90", "shots-against-per-90", "shots-on-target-for-per-90", "shots-on-target-against-per-90"];
  const count = shots.filter((metric) => metrics.has(metric)).length;
  return { available: count >= 2, complete: count === shots.length, metricCount: count, requestedMetricCount: shots.length };
}

function lineupCoverage(report = {}) {
  const lineups = Array.isArray(report.lineups) ? report.lineups : [];
  const home = lineups.find((row) => row.side === "home" && row.startersConfirmed === true);
  const away = lineups.find((row) => row.side === "away" && row.startersConfirmed === true);
  return { homeConfirmed: Boolean(home), awayConfirmed: Boolean(away), bothConfirmed: Boolean(home && away), sources: [...new Set([home?.source, away?.source].filter(Boolean))] };
}

function formRestEvidence(form = {}) {
  const homeSample = Number(form?.samplePolicy?.homeSampleSize ?? form?.home?.sampleSize ?? 0);
  const awaySample = Number(form?.samplePolicy?.awaySampleSize ?? form?.away?.sampleSize ?? 0);
  const chronologySafe = form?.chronologyGuard === true;
  const providerLive = form?.provider?.mode === "live";
  const enoughHistory = homeSample >= 3 && awaySample >= 3;
  const restKnown = finite(form?.home?.restHours) !== null && finite(form?.away?.restHours) !== null;
  const usable = chronologySafe && providerLive && enoughHistory && restKnown && ["feature_only", "ready"].includes(String(form?.status || ""));
  return {
    verified: usable,
    chronologySafe,
    providerLive,
    enoughHistory,
    restKnown,
    homeSampleSize: homeSample,
    awaySampleSize: awaySample,
    source: clean(form?.provider?.source, 100) || null
  };
}

function providerEntitlement(configuration = {}) {
  return {
    configured: configuration?.configured === true,
    source: clean(configuration?.source, 100) || null,
    contract: clean(configuration?.contract, 120) || null,
    contractCompatible: clean(configuration?.contract, 120) === "scorecaster-sports-analytics-v5",
    commercialUseAllowed: configuration?.commercialUseAllowed === true,
    modelUseAllowed: configuration?.modelUseAllowed === true,
    rawRedistributionAllowed: configuration?.rawRedistributionAllowed === true,
    derivedAnalysisOnly: configuration?.derivedAnalysisOnly !== false
  };
}

export function buildFootballIndependentEvidenceV1(pick = {}, {
  sportsReport = {},
  soccerModel = {},
  advancedStatus = {},
  advancedObservations = [],
  formRest = {},
  providerConfiguration = {},
  now = Date.now()
} = {}) {
  if (!isSoccer(pick)) {
    return {
      version: FOOTBALL_INDEPENDENT_EVIDENCE_VERSION,
      applicable: false,
      readiness: { level: "market-only", allowsIndependentPlayEvidence: false },
      probabilityAdjusted: false,
      productionProbabilityChanged: false,
      decisionUpgradeAllowedByThisLayer: false,
      paperOnly: true
    };
  }

  const entitlement = providerEntitlement(providerConfiguration);
  const modelProbability = predictiveProbability(soccerModel);
  const consensus = marketProbability(pick);
  const delta = modelProbability === null || consensus === null ? null : modelProbability - consensus;
  const ageHours = evidenceAgeHours(advancedStatus, soccerModel, now);
  const modelAudit = soccerModel?.independentModelOutput?.audit || {};
  const sourceProviders = Array.isArray(soccerModel?.provenance?.providers) ? soccerModel.provenance.providers : [];
  const sourceProviderKeys = sourceProviders.map(providerKey).filter(Boolean);
  const configuredSourceKey = providerKey(entitlement.source);
  const configuredSourceMatches = Boolean(configuredSourceKey) && sourceProviderKeys.includes(configuredSourceKey);
  const marketSourceDetected = sourceProviderKeys.some((provider) => BLOCKED_PREDICTIVE_PROVIDERS.has(provider)) || BLOCKED_PREDICTIVE_PROVIDERS.has(configuredSourceKey);
  const predictive = {
    modelId: soccerModel?.modelId || "soccer-xg-poisson-v1",
    status: soccerModel?.status || "unavailable",
    probability: modelProbability,
    marketConsensusProbability: consensus,
    probabilityDelta: delta === null ? null : Number(delta.toFixed(4)),
    supportsSelection: delta !== null && delta >= -MAX_SUPPORTIVE_GAP,
    strongConflict: delta !== null && delta <= -STRONG_CONFLICT_GAP,
    inputSnapshotHash: soccerModel?.inputSnapshotHash || null,
    chronologySafe: modelAudit.chronologySafe === true,
    noMarketInputs: modelAudit.noMarketInputs === true,
    preEventOnly: modelAudit.preEventOnly === true,
    providerCount: Number(advancedStatus?.providerCount || 0),
    providers: sourceProviders.slice(0, 8),
    marketSourceDetected,
    newestObservedAt: advancedStatus?.newestObservedAt || soccerModel?.provenance?.observedAtMax || null,
    ageHours: ageHours === null ? null : Number(ageHours.toFixed(2)),
    fresh: ageHours !== null && ageHours <= PREDICTIVE_FRESHNESS_HOURS,
    entitlement,
    sourceMatchesConfiguredEntitlement: configuredSourceMatches,
    shotQuality: shotQualityCoverage(advancedObservations)
  };
  predictive.qualified = Boolean(
    soccerModel?.status === "ready" &&
    modelProbability !== null &&
    advancedStatus?.ok === true &&
    predictive.providerCount > 0 &&
    predictive.inputSnapshotHash &&
    predictive.chronologySafe &&
    predictive.noMarketInputs &&
    predictive.preEventOnly &&
    predictive.fresh &&
    !predictive.marketSourceDetected &&
    entitlement.configured &&
    entitlement.contractCompatible &&
    entitlement.commercialUseAllowed &&
    entitlement.modelUseAllowed &&
    entitlement.derivedAnalysisOnly &&
    configuredSourceMatches
  );

  const lineups = lineupCoverage(sportsReport);
  const injuryLive = sportsReport?.providerLive?.injuries === true;
  const injuryConflictFree = !(Array.isArray(sportsReport?.conflicts) && sportsReport.conflicts.length);
  const kickoffHours = hoursUntilKickoff(pick, now);
  const lineupRequired = kickoffHours !== null && kickoffHours <= LINEUP_REQUIRED_WITHIN_HOURS;
  const availability = {
    injuryStatusLive: injuryLive,
    conflictFree: injuryConflictFree,
    lineups,
    kickoffHours: kickoffHours === null ? null : Number(kickoffHours.toFixed(2)),
    lineupRequired,
    verified: injuryLive && injuryConflictFree && (!lineupRequired || lineups.bothConfirmed)
  };

  const scheduleForm = formRestEvidence(formRest);
  const inheritedConflicts = Array.isArray(sportsReport?.conflicts) ? sportsReport.conflicts.slice(0, 10) : [];
  const criticalConflicts = [...inheritedConflicts];
  if (predictive.marketSourceDetected) criticalConflicts.push("A market-derived or otherwise blocked provider was detected in the predictive evidence lineage.");
  if (predictive.strongConflict) criticalConflicts.push(`Independent xG model is ${(Math.abs(delta) * 100).toFixed(1)} percentage points below the market consensus for the selected side.`);

  const supportingFamilies = [availability.verified, scheduleForm.verified].filter(Boolean).length;
  const predictiveSupport = predictive.qualified && predictive.supportsSelection && !predictive.strongConflict;
  const verified = predictiveSupport &&
    supportingFamilies >= 1 &&
    availability.injuryStatusLive &&
    (!availability.lineupRequired || availability.lineups.bothConfirmed) &&
    criticalConflicts.length === 0;
  const anyEvidence = predictive.qualified || availability.verified || scheduleForm.verified || sportsReport?.readiness?.level === "partial" || sportsReport?.readiness?.level === "verified";
  const level = verified ? "verified" : anyEvidence ? "partial" : "market-only";
  const checks = {
    predictiveQualified: predictive.qualified,
    predictiveSupportsSelection: predictive.supportsSelection,
    injuryStatusLive: availability.injuryStatusLive,
    lineupRequirementSatisfied: !availability.lineupRequired || availability.lineups.bothConfirmed,
    formRestVerified: scheduleForm.verified,
    supportingFamilyPresent: supportingFamilies >= 1,
    noCriticalConflicts: criticalConflicts.length === 0
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const missing = [];
  if (!predictive.qualified) missing.push("qualified chronology-safe independent xG evidence with confirmed source rights");
  else if (!predictive.supportsSelection) missing.push("independent xG support for the selected side");
  if (!availability.injuryStatusLive) missing.push("live verified injury/suspension status");
  if (availability.lineupRequired && !availability.lineups.bothConfirmed) missing.push("both confirmed starting lineups inside the final 6-hour window");
  if (!scheduleForm.verified && !availability.verified) missing.push("a second verified evidence family (availability or form/rest)");
  if (criticalConflicts.length) missing.push("resolved critical evidence conflicts");

  return {
    version: FOOTBALL_INDEPENDENT_EVIDENCE_VERSION,
    generatedAt: new Date(now).toISOString(),
    applicable: true,
    readiness: {
      level,
      score: Number((passed / Object.keys(checks).length).toFixed(2)),
      verifiedCount: passed,
      totalChecks: Object.keys(checks).length,
      checks,
      missing,
      fullyVerified: verified,
      allowsIndependentPlayEvidence: verified
    },
    families: {
      predictive,
      availability,
      scheduleForm
    },
    criticalConflicts,
    sourceCount: new Set([...predictive.providers, ...(sportsReport?.sources || []), scheduleForm.source].filter(Boolean)).size,
    policy: {
      predictiveFamilyRequired: true,
      supportingIndependentFamilyRequired: true,
      liveInjuryStatusRequired: true,
      confirmedLineupsRequiredWithinHours: LINEUP_REQUIRED_WITHIN_HOURS,
      predictiveFreshnessHours: PREDICTIVE_FRESHNESS_HOURS,
      maximumPredictiveSupportGap: MAX_SUPPORTIVE_GAP,
      strongPredictiveConflictGap: STRONG_CONFLICT_GAP,
      missingEvidenceNeutral: true,
      staleEvidenceCannotVerify: true,
      marketProviderCannotQualifyPredictiveFamily: true,
      sourceRightsMustBeConfirmed: true
    },
    probabilityAdjusted: false,
    productionProbabilityChanged: false,
    productionEdgeChanged: false,
    productionEvChanged: false,
    decisionUpgradeAllowedByThisLayer: false,
    canSatisfyExistingEvidenceGate: verified,
    paperOnly: true
  };
}

export function attachFootballIndependentEvidenceV1(pick = {}, evidence = {}) {
  if (!evidence?.applicable) return pick;
  const report = pick.sportsIntelligence && typeof pick.sportsIntelligence === "object" ? pick.sportsIntelligence : {};
  const readiness = evidence.readiness || { level: "market-only", allowsIndependentPlayEvidence: false };
  const conflicts = [...new Set([...(Array.isArray(report.conflicts) ? report.conflicts : []), ...(Array.isArray(evidence.criticalConflicts) ? evidence.criticalConflicts : [])])];
  return {
    ...pick,
    footballIndependentEvidenceV1: evidence,
    sportsIntelligence: {
      ...report,
      version: report.version || "sports-intelligence-v1",
      evidenceVersion: FOOTBALL_INDEPENDENT_EVIDENCE_VERSION,
      evidenceFamilies: evidence.families,
      readiness,
      conflicts,
      sourceCount: Math.max(Number(report.sourceCount || 0), Number(evidence.sourceCount || 0)),
      probabilityAdjusted: false,
      marketProbabilityChanged: false
    },
    intelligenceReadiness: readiness,
    independentEvidenceVerified: readiness.allowsIndependentPlayEvidence === true,
    probabilityAdjustedByIntelligence: false
  };
}
