import crypto from "node:crypto";

export const DECISION_EVIDENCE_CONTRACT_VERSION = "scorecaster-decision-evidence-contract-v1";

function text(value, max = 240) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function number(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function probability(value) {
  const parsed = number(value);
  return parsed !== null && parsed > 0 && parsed < 1 ? parsed : null;
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function compactStrings(values, limit = 16, max = 220) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value, max)).filter(Boolean))].slice(0, limit);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function fingerprint(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex");
}

function productDecision(pick = {}) {
  const product = text(pick.productDecision, 20).toUpperCase();
  if (["PLAY", "CAUTION", "SKIP"].includes(product)) return product;
  const engine = text(pick.decision, 20).toUpperCase();
  if (engine === "BET") return "PLAY";
  if (engine === "PASS") return "SKIP";
  return "CAUTION";
}

function missingEvidence(pick = {}) {
  const sportsMissing = pick.sportsIntelligence?.readiness?.missing || [];
  const fusionMissing = pick.intelligenceFusionV2?.missingEvidence || [];
  const featureMissing = (Array.isArray(pick.featureEngineV1?.missingFeatures) ? pick.featureEngineV1.missingFeatures : [])
    .map((item) => item?.id || item?.key || item?.name);
  return compactStrings([...sportsMissing, ...fusionMissing, ...featureMissing], 24);
}

function researchModels(pick = {}) {
  return (Array.isArray(pick.ensembleEngineV1?.models) ? pick.ensembleEngineV1.models : []).slice(0, 12).map((model) => ({
    modelId: text(model?.modelId || model?.modelVersion, 160) || null,
    modelVersion: text(model?.modelVersion, 160) || null,
    probability: probability(model?.probability),
    independentPredictiveModel: model?.independentPredictiveModel === true,
    calibrationReady: model?.performance?.calibrationReady === true,
    sampleSize: number(model?.performance?.sampleSize),
    eligibleForDecisionWeight: model?.eligibleForDecisionWeight === true,
    usedForDecision: false
  }));
}

export function buildDecisionEvidenceContractV1(pick = {}) {
  const gate = pick.dataGate || {};
  const readiness = pick.sportsIntelligence?.readiness || {};
  const conflicts = Array.isArray(pick.sportsIntelligence?.conflicts) ? pick.sportsIntelligence.conflicts : [];
  const feature = pick.featureEngineV1 || {};
  const ensemble = pick.ensembleEngineV1 || {};
  const uncertainty = pick.uncertaintyEngineV1 || {};
  const formRest = pick.formRestShadow || {};
  const decision = productDecision(pick);

  const payload = {
    version: DECISION_EVIDENCE_CONTRACT_VERSION,
    eventId: text(pick.gameId || pick.eventId || pick.id, 180) || null,
    selection: text(pick.selection || pick.label, 160) || null,
    decision: {
      productDecision: decision,
      engineDecision: text(pick.decision, 20).toUpperCase() || null,
      marketDecisionBeforeSafetyGate: text(pick.marketDecisionBeforeSafetyGate, 20).toUpperCase() || null,
      reason: text(pick.decisionReason || pick.evidenceGateReason, 500) || null,
      skipReason: text(pick.skipReason, 360) || null,
      productionProbabilitySource: "no-vig-market-consensus",
      productionProbabilityChangedByResearch: false,
      productionDecisionChangedByResearch: false
    },
    known: {
      market: {
        odds: number(pick.odds),
        bookmaker: text(pick.bookmaker, 100) || null,
        bookmakerCount: number(pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount),
        consensusProbability: probability(pick.consensusProbability ?? pick.modelProbability),
        marketProbability: probability(pick.marketProbability),
        fairOdds: number(pick.fairOdds),
        edge: number(pick.edge),
        ev: number(pick.ev),
        confidence: number(pick.confidence),
        freshness: text(pick.freshnessLabel || pick.dataQuality?.freshness, 40) || null
      },
      fixture: {
        verifiedByProvider: booleanOrNull(pick.fixtureVerifiedByProvider),
        source: text(pick.fixtureSource, 100) || null,
        commenceTime: text(pick.commenceTime || pick.commence_time, 80) || null
      },
      independentEvidence: {
        readiness: text(readiness.level, 30) || "unavailable",
        verifiedCount: number(readiness.verifiedCount),
        totalChecks: number(readiness.totalChecks),
        sourceCount: number(pick.sportsIntelligence?.sourceCount),
        conflicts: conflicts.length,
        relativeImpact: number(pick.intelligenceRelativeImpact)
      }
    },
    missing: missingEvidence(pick),
    decisionInputs: {
      marketQuality: {
        bookmakerCount: number(gate.bookmakerCount ?? pick.bookmakerCount),
        confidence: number(gate.confidence ?? pick.confidence),
        freshness: text(gate.freshness || pick.freshnessLabel || pick.dataQuality?.freshness, 40) || null,
        stale: booleanOrNull(gate.stale),
        playable: booleanOrNull(gate.playable),
        watchable: booleanOrNull(gate.watchable),
        usedForDecision: true
      },
      priceValue: {
        edge: number(pick.edge),
        ev: number(pick.ev),
        qualityGrade: text(pick.qualityGrade, 20) || null,
        usedForDecision: true
      },
      independentSafetyGate: {
        readiness: text(readiness.level, 30) || "unavailable",
        conflictCount: conflicts.length,
        relativeImpact: number(pick.intelligenceRelativeImpact),
        gateReason: text(pick.evidenceGateReason, 360) || null,
        usedForDecision: true,
        mayUpgradeMarketDecision: false,
        mayDowngradeMarketDecision: true
      }
    },
    researchOnly: {
      featureEngine: {
        snapshotHash: text(feature.snapshotHash, 100) || null,
        total: number(feature.counts?.total),
        eligible: number(feature.counts?.eligible),
        eligibilityRate: number(feature.eligibilityRate),
        usedForDecision: false
      },
      ensemble: {
        shadowProbability: probability(ensemble.shadowProbability),
        calibratedShadowProbability: probability(ensemble.calibratedShadowProbability),
        researchEligible: number(ensemble.counts?.researchEligible),
        calibrationReady: number(ensemble.counts?.calibrationReady),
        researchRiskDecision: text(ensemble.researchRiskGate?.decision, 20) || null,
        models: researchModels(pick),
        usedForDecision: false
      },
      uncertainty: {
        index: number(uncertainty.uncertaintyIndex),
        evidenceReadiness: number(uncertainty.evidenceReadiness),
        usedForDecision: false,
        probabilityConfidenceInterval: false
      },
      formRest: {
        status: text(formRest.status, 60) || "unavailable",
        probabilityDelta: number(formRest.probabilityDelta),
        chronologyGuard: booleanOrNull(formRest.chronologyGuard),
        usedForDecision: false
      }
    },
    invariants: {
      missingDataImputed: false,
      marketBenchmarkIsIndependentPredictiveModel: false,
      researchMayMasqueradeAsDecisionInput: false,
      automaticModelPromotionAllowed: false,
      contextCanUpgrade: false,
      paperOnly: true,
      realMoneyActionAvailable: false
    }
  };

  return { ...payload, fingerprint: fingerprint(payload) };
}
