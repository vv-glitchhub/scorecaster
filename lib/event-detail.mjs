function text(value, max = 240) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function number(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function probability(value) {
  const parsed = number(value);
  return parsed !== null && parsed > 0 && parsed < 1 ? parsed : null;
}

function objectAvailable(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);
}

function evidenceState(value, observedCount = null) {
  if (!objectAvailable(value)) return "missing";
  const count = number(observedCount);
  return count === 0 ? "no-observations" : "observed";
}

function eventId(pick = {}) {
  return text(pick.gameId || pick.eventId || pick.id, 180);
}

function decision(pick = {}) {
  const value = text(pick.productDecision || pick.decision, 20).toUpperCase();
  if (value === "PLAY" || value === "BET") return "PLAY";
  if (value === "SKIP" || value === "PASS") return "SKIP";
  return "CAUTION";
}

function safeEvidence(items, maximum = 12) {
  return (Array.isArray(items) ? items : []).slice(0, maximum).map((item) => ({
    category: text(item?.category, 40),
    side: text(item?.side, 20) || null,
    subject: text(item?.subject || item?.title || item?.name, 160),
    status: text(item?.status, 80),
    detail: text(item?.detail || item?.description, 320),
    source: text(item?.source, 100),
    sourceType: text(item?.sourceType, 60),
    observedAt: text(item?.observedAt || item?.publishedAt || item?.updatedAt, 80) || null,
    freshness: text(item?.freshness, 30) || "unknown",
    verified: item?.verified === true
  }));
}

function safeSportsIntelligence(value = {}) {
  const available = objectAvailable(value);
  const readiness = value?.readiness || {};
  const evidence = [
    ...(Array.isArray(value.news) ? value.news : []),
    ...(Array.isArray(value.injuries) ? value.injuries : []),
    ...(Array.isArray(value.lineups) ? value.lineups : [])
  ];
  const totalChecks = available ? number(readiness.totalChecks) : null;
  return {
    version: text(value.version, 80) || "sports-intelligence-v1",
    generatedAt: text(value.generatedAt, 80) || null,
    evidenceState: evidenceState(value, totalChecks),
    readiness: {
      level: available ? text(readiness.level, 30) || "market-only" : "unavailable",
      score: available ? number(readiness.score) : null,
      verifiedCount: available ? number(readiness.verifiedCount) : null,
      totalChecks,
      missing: (Array.isArray(readiness.missing) ? readiness.missing : []).map((item) => text(item, 180)).filter(Boolean).slice(0, 10),
      fullyVerified: readiness.fullyVerified === true
    },
    sourceCount: available ? number(value.sourceCount) : null,
    sources: (Array.isArray(value.sources) ? value.sources : []).map((item) => text(item, 100)).filter(Boolean).slice(0, 12),
    conflicts: (Array.isArray(value.conflicts) ? value.conflicts : []).map((item) => text(typeof item === "string" ? item : item?.detail || item?.message, 240)).filter(Boolean).slice(0, 8),
    impacts: { home: available ? number(value?.impacts?.home) : null, away: available ? number(value?.impacts?.away) : null },
    evidence: safeEvidence(evidence),
    probabilityAdjusted: false
  };
}

function safeFusionFactor(value = {}) {
  return {
    key: text(value.key, 80),
    title: text(value.title, 160),
    status: text(value.status, 60),
    confidence: number(value.confidence),
    trust: number(value.trust),
    impact: number(value.impact),
    direction: text(value.direction, 30) || "neutral",
    useMode: text(value.useMode, 80) || "unknown",
    downgradeEligible: value.downgradeEligible === true,
    eligibleForAi: value.eligibleForAi === true,
    reason: text(value.reason, 360)
  };
}

function safeIntelligenceFusion(value = {}) {
  const available = objectAvailable(value);
  const coverage = value?.coverage || {};
  const trust = value?.trust || {};
  const gate = value?.dataQualityGate || {};
  const sourceCount = available ? number(coverage.sourceCount) : null;
  return {
    version: text(value.version, 80) || "intelligence-fusion-v2",
    generatedAt: text(value.generatedAt, 80) || null,
    evidenceState: evidenceState(value, sourceCount),
    coverage: {
      configuredFamilies: available ? number(coverage.configuredFamilies) : null,
      eligibleFamilies: available ? number(coverage.eligibleFamilies) : null,
      coverageRate: available ? number(coverage.coverageRate) : null,
      sourceCount,
      independentOddsProviders: available ? number(coverage.independentOddsProviders) : null
    },
    trust: {
      score: available ? number(trust.score) : null,
      band: available ? text(trust.band, 20) || "low" : "unavailable"
    },
    dataQualityGate: {
      safeForAi: gate.safeForAi === true,
      decisionCeiling: text(gate.decisionCeiling, 20) || "SKIP",
      reasons: (Array.isArray(gate.reasons) ? gate.reasons : []).map((item) => text(item, 220)).filter(Boolean).slice(0, 10),
      ignoredFactorCount: available ? number(gate.ignoredFactorCount) : null,
      missingFactorCount: available ? number(gate.missingFactorCount) : null
    },
    eligibleFactors: (Array.isArray(value.eligibleFactors) ? value.eligibleFactors : []).map(safeFusionFactor).slice(0, 16),
    ignoredFactors: (Array.isArray(value.ignoredFactors) ? value.ignoredFactors : []).map(safeFusionFactor).slice(0, 16),
    adverseFactors: (Array.isArray(value.adverseFactors) ? value.adverseFactors : []).map(safeFusionFactor).slice(0, 10),
    conflicts: (Array.isArray(value.conflicts) ? value.conflicts : []).map((item) => text(item, 240)).filter(Boolean).slice(0, 8),
    explanationEvidence: (Array.isArray(value.explanationEvidence) ? value.explanationEvidence : []).map((item) => text(item, 360)).filter(Boolean).slice(0, 6),
    missingEvidence: (Array.isArray(value.missingEvidence) ? value.missingEvidence : []).map((item) => text(item, 240)).filter(Boolean).slice(0, 6),
    probabilityAdjusted: false,
    contextCanUpgrade: false,
    paperOnly: true
  };
}

function safeFeatureRow(value = {}) {
  return {
    id: text(value.id, 100),
    value: number(value.value),
    role: text(value.role, 40),
    family: text(value.family, 60),
    status: text(value.status, 60),
    eligibleForModel: value.eligibleForModel === true,
    source: text(value.source, 120),
    observedAt: text(value.observedAt, 80) || null,
    trust: number(value.trust),
    confidence: number(value.confidence)
  };
}

function safeFeatureEngine(value = {}) {
  const available = objectAvailable(value);
  const counts = value?.counts || {};
  const total = available ? number(counts.total) : null;
  return {
    version: text(value.version, 80) || "scorecaster-feature-engine-v1",
    generatedAt: text(value.generatedAt, 80) || null,
    snapshotHash: text(value.snapshotHash, 80) || null,
    evidenceState: evidenceState(value, total),
    eligibilityRate: available ? number(value.eligibilityRate) : null,
    counts: {
      total,
      eligible: available ? number(counts.eligible) : null,
      benchmark: available ? number(counts.benchmark) : null,
      missing: available ? number(counts.missing) : null,
      rejected: available ? number(counts.rejected) : null
    },
    eligibleFeatures: (Array.isArray(value.eligibleFeatures) ? value.eligibleFeatures : []).map(safeFeatureRow).slice(0, 20),
    missingFeatures: (Array.isArray(value.missingFeatures) ? value.missingFeatures : []).map((item) => ({ id: text(item?.id, 100), reasons: (Array.isArray(item?.reasons) ? item.reasons : []).map((reason) => text(reason, 120)).filter(Boolean).slice(0, 6) })).slice(0, 20),
    rejectedFeatures: (Array.isArray(value.rejectedFeatures) ? value.rejectedFeatures : []).map((item) => ({ id: text(item?.id, 100), reasons: (Array.isArray(item?.reasons) ? item.reasons : []).map((reason) => text(reason, 120)).filter(Boolean).slice(0, 6) })).slice(0, 20),
    contract: { missingDataImputed: false, futureDataAccepted: false, marketBenchmarkRelabeledAsIndependentFeature: false, paperOnly: true }
  };
}

function safeEnsembleModel(value = {}) {
  const performance = value?.performance || {};
  return {
    modelId: text(value.modelId, 160),
    modelVersion: text(value.modelVersion, 160),
    role: text(value.role, 60),
    probability: probability(value.probability),
    independentPredictiveModel: value.independentPredictiveModel === true,
    deterministic: value.deterministic === true,
    eligibleForResearch: value.eligibleForResearch === true,
    eligibleForDecisionWeight: value.eligibleForDecisionWeight === true,
    researchWeight: number(value.researchWeight),
    performance: {
      sampleSize: number(performance.sampleSize),
      status: text(performance.status, 40) || "unvalidated",
      performanceWeight: number(performance.performanceWeight),
      weightSource: text(performance.weightSource, 80) || null,
      brier: number(performance.brier),
      logLoss: number(performance.logLoss),
      calibrationGap: number(performance.calibrationGap),
      calibrationReady: performance.calibrationReady === true
    },
    rejectionReasons: (Array.isArray(value.rejectionReasons) ? value.rejectionReasons : []).map((item) => text(item, 140)).filter(Boolean).slice(0, 8)
  };
}

function safeEnsembleEngine(value = {}) {
  const available = objectAvailable(value);
  const counts = value?.counts || {};
  const uncertainty = value?.uncertainty || {};
  const gate = value?.researchRiskGate || {};
  const promotion = value?.promotion || {};
  const supplied = available ? number(counts.supplied) : null;
  const marketBenchmarkAvailable = objectAvailable(value?.marketBenchmark);
  return {
    version: text(value.version, 80) || "scorecaster-ensemble-engine-v1",
    generatedAt: text(value.generatedAt, 80) || null,
    performanceSliceKey: text(value.performanceSliceKey, 260) || null,
    evidenceState: evidenceState(value, supplied),
    counts: { supplied, researchEligible: available ? number(counts.researchEligible) : null, calibrationReady: available ? number(counts.calibrationReady) : null, rejected: available ? number(counts.rejected) : null },
    marketBenchmark: { probability: probability(value?.marketBenchmark?.probability), source: marketBenchmarkAvailable ? text(value?.marketBenchmark?.source, 100) || "no-vig-market-consensus" : null, independentPredictiveModel: false },
    shadowProbability: probability(value.shadowProbability),
    calibratedShadowProbability: probability(value.calibratedShadowProbability),
    shadowEdgeVsMarket: number(value.shadowEdgeVsMarket),
    calibratedShadowEdgeVsMarket: number(value.calibratedShadowEdgeVsMarket),
    uncertainty: { standardDeviation: number(uncertainty.standardDeviation), range: number(uncertainty.range), minimum: probability(uncertainty.minimum), maximum: probability(uncertainty.maximum), band: text(uncertainty.band, 20) || "unknown" },
    researchRiskGate: { decision: text(gate.decision, 20) || "NO_BET", blocked: gate.blocked === true, reasons: (Array.isArray(gate.reasons) ? gate.reasons : []).map((item) => text(item, 180)).filter(Boolean).slice(0, 12), productionDecisionChanged: false },
    promotion: { eligibleForHumanReview: promotion.eligibleForHumanReview === true, automaticPromotionAllowed: false, minimumDecisionSamplePerWeightedModel: number(promotion.minimumDecisionSamplePerWeightedModel, 100), requiresValidatedPerformanceWeights: true, requiresAtLeastTwoIndependentModels: true },
    models: (Array.isArray(value.models) ? value.models : []).map(safeEnsembleModel).slice(0, 12),
    contract: { productionProbabilityChanged: false, marketBenchmarkIncludedAsIndependentModel: false, randomLegacyModelsAccepted: false, contextModelsMayMasqueradeAsIndependentModels: false, missingModelOutputsImputed: false, paperOnly: true }
  };
}

function safeDecisionArchitecture(value = {}) {
  const available = objectAvailable(value);
  return {
    version: text(value.version, 80) || "scorecaster-decision-architecture-v1",
    generatedAt: text(value.generatedAt, 80) || null,
    featureSnapshotHash: text(value.featureSnapshotHash, 80) || null,
    evidenceState: available ? "observed" : "missing",
    featureEligibilityRate: available ? number(value.featureEligibilityRate) : null,
    researchModelCount: available ? number(value.researchModelCount) : null,
    calibrationReadyModelCount: available ? number(value.calibrationReadyModelCount) : null,
    shadowProbability: probability(value.shadowProbability),
    calibratedShadowProbability: probability(value.calibratedShadowProbability),
    productionProbabilityChanged: false,
    productionDecisionChanged: false,
    paperOnly: true
  };
}

function safeTeam(value = {}) {
  const available = objectAvailable(value);
  const sampleSize = available ? number(value.sampleSize) : null;
  return {
    team: text(value.team, 120),
    evidenceState: !available || sampleSize === null ? "missing" : sampleSize === 0 ? "no-observations" : "observed",
    sampleSize,
    weightedResultRate: number(value.weightedResultRate),
    formStrength: number(value.formStrength),
    normalizedScoreMargin: number(value.normalizedScoreMargin),
    restDays: number(value.restDays),
    backToBack: value.backToBack === true,
    gamesLast7Days: available ? number(value.gamesLast7Days) : null,
    gamesLast14Days: available ? number(value.gamesLast14Days) : null
  };
}

function safeFormRest(value = {}) {
  const available = objectAvailable(value);
  const ready = value?.status === "ready";
  const home = safeTeam(value.home);
  const away = safeTeam(value.away);
  const homeSample = number(home.sampleSize);
  const awaySample = number(away.sampleSize);
  const totalSample = homeSample !== null || awaySample !== null ? (homeSample || 0) + (awaySample || 0) : null;
  const state = !available || !ready || totalSample === null ? "missing" : totalSample === 0 ? "no-observations" : "observed";
  return {
    version: text(value.version, 80) || "form-rest-shadow-v1",
    modelId: text(value.modelId, 80) || null,
    mode: text(value.mode, 40) || "unavailable",
    status: text(value.status, 60) || "unavailable",
    evidenceState: state,
    asOf: text(value.asOf, 80) || null,
    home,
    away,
    features: { homeFormAdvantage: number(value?.features?.homeFormAdvantage), homeMarginAdvantage: number(value?.features?.homeMarginAdvantage), homeRestAdvantage: number(value?.features?.homeRestAdvantage), homeCongestionAdvantage: number(value?.features?.homeCongestionAdvantage) },
    marketProbability: ready ? probability(value.marketProbability) : null,
    shadowProbability: ready ? probability(value.shadowProbability) : null,
    probabilityDelta: ready ? number(value.probabilityDelta) : null,
    probabilityAppliedToProduction: false,
    usedForDecision: false,
    chronologyGuard: value?.chronologyGuard === true
  };
}

function selectionShape(pick = {}, selectedName = "") {
  const consensus = probability(pick.consensusProbability ?? pick.modelProbability);
  const odds = number(pick.odds);
  const gateAvailable = objectAvailable(pick.dataGate);
  return {
    id: text(pick.id || `${eventId(pick)}-${pick.selection || pick.label}`, 220),
    selection: text(pick.selection || pick.label, 160),
    odds,
    bookmaker: text(pick.bookmaker, 100),
    consensusProbability: consensus,
    marketProbability: probability(pick.marketProbability ?? (odds !== null && odds > 1 ? 1 / odds : null)),
    fairOdds: number(pick.fairOdds, consensus ? 1 / consensus : null),
    edge: number(pick.edge),
    ev: number(pick.ev),
    confidence: number(pick.confidence),
    trustScore: number(pick.trustScore),
    bookmakerCount: number(pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount),
    freshness: text(pick.freshnessLabel || pick.dataQuality?.freshness, 40) || "unknown",
    lastUpdate: text(pick.lastUpdate, 80) || null,
    dataAgeHours: number(pick.dataAgeHours ?? pick.dataQuality?.ageHours),
    decision: decision(pick),
    decisionReason: text(pick.evidenceGateReason || pick.decisionReason, 360),
    decisionReasons: (Array.isArray(pick.decisionReasons) ? pick.decisionReasons : []).map((item) => text(item, 220)).filter(Boolean).slice(0, 8),
    qualityGrade: text(pick.qualityGrade, 20) || null,
    dataGate: {
      bookmakerCount: gateAvailable ? number(pick.dataGate.bookmakerCount) : null,
      confidence: gateAvailable ? number(pick.dataGate.confidence) : null,
      freshness: gateAvailable ? text(pick.dataGate.freshness, 40) || "unknown" : "unknown",
      stale: gateAvailable ? pick.dataGate.stale === true : null,
      playable: gateAvailable ? pick.dataGate.playable === true : null,
      watchable: gateAvailable ? pick.dataGate.watchable === true : null
    },
    priceGuard: { breakEvenOdds: consensus ? 1 / consensus : null, minimumPlayOdds: consensus ? 1.03 / consensus : null, currentOdds: odds, buffer: consensus && odds !== null && odds > 1 ? odds - 1.03 / consensus : null },
    selected: selectedName ? text(pick.selection || pick.label, 160).toLowerCase() === selectedName.toLowerCase() : false
  };
}

export function buildEventDetail(picks = [], requestedEventId = "", requestedSelection = "") {
  const id = text(requestedEventId, 180);
  const matches = (Array.isArray(picks) ? picks : []).filter((pick) => eventId(pick) === id);
  if (!id || !matches.length) return null;
  const primary = matches.find((pick) => requestedSelection && text(pick.selection || pick.label, 160).toLowerCase() === text(requestedSelection, 160).toLowerCase()) || matches[0];
  const selections = matches.map((pick) => selectionShape(pick, requestedSelection));

  return {
    version: "event-detail-v2",
    evidenceSemanticsVersion: "scorecaster-evidence-semantics-v2",
    eventId: id,
    sportKey: text(primary.sportKey || primary.league, 120),
    league: text(primary.leagueTitle || primary.league, 120),
    match: text(primary.match || [primary.homeTeam, primary.awayTeam].filter(Boolean).join(" – "), 240),
    homeTeam: text(primary.homeTeam, 120),
    awayTeam: text(primary.awayTeam, 120),
    commenceTime: text(primary.commenceTime || primary.commence_time, 80) || null,
    generatedAt: new Date().toISOString(),
    fixtureVerifiedByProvider: primary.fixtureVerifiedByProvider === true,
    fixtureSource: text(primary.fixtureSource, 80) || "live-odds-provider",
    selectedSelection: text(primary.selection || primary.label, 160),
    selections,
    sportsIntelligence: safeSportsIntelligence(primary.sportsIntelligence),
    intelligenceFusion: safeIntelligenceFusion(primary.intelligenceFusionV2),
    featureEngine: safeFeatureEngine(primary.featureEngineV1),
    ensembleEngine: safeEnsembleEngine(primary.ensembleEngineV1),
    decisionArchitecture: safeDecisionArchitecture(primary.decisionArchitectureV1),
    formRestShadow: safeFormRest(primary.formRestShadow || primary.featureSnapshot),
    paperOnly: true,
    realMoneyActionAvailable: false,
    probabilityAdjustedByDetail: false,
    probabilityAdjustedByIntelligenceFusion: false,
    probabilityAdjustedByFeatureEnsemble: false,
    decisionAdjustedByFeatureEnsemble: false
  };
}
