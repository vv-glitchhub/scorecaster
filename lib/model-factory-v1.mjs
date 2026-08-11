import { buildModelPerformanceEvidenceV1 } from "./model-performance-evidence-v1.mjs";

export const MODEL_FACTORY_VERSION = "scorecaster-model-factory-v1";

const FUTURE_SKEW_MS = 60_000;
const BANNED_PATTERNS = ["model-engine-v3", "legacy-random", "math.random", "random-model"];

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

const probability = (value) => {
  const parsed = finite(value);
  return parsed !== null && parsed > 0 && parsed < 1 ? parsed : null;
};

const round = (value, digits = 6) => {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
};

const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const time = (value) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
};

function predictionHorizon(pick = {}, now = Date.now()) {
  const commence = time(pick.commenceTime || pick.commence_time);
  return new Date(commence === null ? now : Math.min(now, commence)).toISOString();
}

function bannedModel(value) {
  const text = clean(value, 300).toLowerCase();
  return BANNED_PATTERNS.some((pattern) => text.includes(pattern));
}

function historicalDependenceGroup(sportKey) {
  const key = clean(sportKey || "unknown", 100).toLowerCase() || "unknown";
  return `${key}-historical-results-family`;
}

function modelIdentity(candidate = {}) {
  const audit = candidate.audit && typeof candidate.audit === "object" ? candidate.audit : {};
  const modelId = clean(candidate.modelId || candidate.id || candidate.name || candidate.modelVersion, 160);
  const modelVersion = clean(candidate.modelVersion || candidate.version || modelId, 160);
  const modelFamily = clean(candidate.modelFamily || candidate.model_family || audit.modelFamily || audit.model_family || modelId, 120).toLowerCase();
  const dependenceGroup = clean(
    candidate.dependenceGroup || candidate.dependence_group || audit.dependenceGroup || audit.dependence_group || modelFamily || modelId,
    160
  ).toLowerCase();
  return { modelId, modelVersion, modelFamily, dependenceGroup };
}

function performanceRows(pick = {}) {
  return [
    ...(Array.isArray(pick.modelPerformanceEvidenceV1) ? pick.modelPerformanceEvidenceV1 : []),
    ...(Array.isArray(pick.modelPerformanceEvidence) ? pick.modelPerformanceEvidence : [])
  ].slice(0, 100);
}

function findPerformanceEvidence(pick, candidate, identity) {
  const direct = candidate.performance && typeof candidate.performance === "object" ? candidate.performance : null;
  const rows = performanceRows(pick);
  const matched = rows.find((row) => {
    const rowId = clean(row?.modelId, 160).toLowerCase();
    const rowVersion = clean(row?.modelVersion, 160).toLowerCase();
    return (rowVersion && rowVersion === identity.modelVersion.toLowerCase())
      || (rowId && rowId === identity.modelId.toLowerCase());
  });
  return matched || direct;
}

function canonicalPerformance(pick, candidate, identity, horizon, now) {
  const raw = findPerformanceEvidence(pick, candidate, identity);
  if (!raw) return { performance: null, evidence: null, warnings: [] };
  const evidence = buildModelPerformanceEvidenceV1(raw, {
    modelId: identity.modelId,
    modelVersion: identity.modelVersion,
    dependenceGroup: identity.dependenceGroup,
    predictionHorizon: horizon,
    now
  });
  return {
    performance: evidence.ensemblePerformance,
    evidence: evidence.value,
    warnings: [...evidence.errors]
  };
}

function canonicalExternalCandidate(candidate = {}, pick = {}, horizon, now, origin = "external") {
  const audit = candidate.audit && typeof candidate.audit === "object" ? candidate.audit : {};
  const identity = modelIdentity(candidate);
  const p = probability(candidate.probability ?? candidate.modelProbability);
  const generatedAt = iso(candidate.generatedAt || audit.generatedAt);
  const generatedTime = time(generatedAt);
  const horizonTime = time(horizon);
  const reasons = [];

  if (!identity.modelId) reasons.push("missing-model-id");
  if (!identity.modelVersion) reasons.push("missing-model-version");
  if (!identity.dependenceGroup) reasons.push("missing-dependence-group");
  if (p === null) reasons.push("invalid-probability");
  if (candidate.independentPredictiveModel !== true && audit.independentPredictiveModel !== true) reasons.push("not-independent-predictive-model");
  if (candidate.deterministic !== true && audit.deterministic !== true) reasons.push("not-deterministic");
  if (audit.chronologySafe === false) reasons.push("chronology-audit-failed");
  if (generatedTime !== null && horizonTime !== null && generatedTime > horizonTime + FUTURE_SKEW_MS) reasons.push("prediction-after-decision-horizon");
  if (bannedModel(`${identity.modelId} ${identity.modelVersion} ${audit.implementationPath || ""}`)) reasons.push("banned-random-or-legacy-model");

  const performance = canonicalPerformance(pick, candidate, identity, horizon, now);
  if (performance.evidence?.chronologySafe === false) reasons.push("performance-evidence-chronology-violation");

  if (reasons.length) {
    return {
      accepted: false,
      origin,
      identity,
      reasons: [...new Set(reasons)].sort(),
      performanceWarnings: performance.warnings
    };
  }

  return {
    accepted: true,
    origin,
    identity,
    output: {
      modelId: identity.modelId,
      modelVersion: identity.modelVersion,
      modelFamily: identity.modelFamily,
      dependenceGroup: identity.dependenceGroup,
      probability: round(p),
      generatedAt,
      trainingCutoff: performance.evidence?.trainingCutoff || candidate.trainingCutoff || audit.trainingCutoff || null,
      role: clean(candidate.role, 60) || "independent-shadow-model",
      audit: {
        independentPredictiveModel: true,
        deterministic: true,
        chronologySafe: true,
        source: clean(audit.source || candidate.source || `model-factory:${origin}`, 120),
        implementationPath: clean(audit.implementationPath, 180) || null,
        modelFamily: identity.modelFamily,
        dependenceGroup: identity.dependenceGroup,
        factoryVersion: MODEL_FACTORY_VERSION
      },
      performance: performance.performance,
      performanceEvidenceV1: performance.evidence,
      factoryOrigin: origin
    },
    performanceWarnings: performance.warnings
  };
}

function explicitCandidate(pick = {}) {
  const p = probability(pick.independentModelProbability);
  const audit = pick.independentModelAudit;
  if (p === null || !audit || typeof audit !== "object") return null;
  return {
    modelId: audit.modelId || audit.modelVersion || "explicit-independent-model",
    modelVersion: audit.modelVersion || audit.modelId || "explicit-independent-model",
    modelFamily: audit.modelFamily || audit.model_family,
    dependenceGroup: audit.dependenceGroup || audit.dependence_group,
    probability: p,
    generatedAt: audit.generatedAt || pick.generatedAt,
    trainingCutoff: audit.trainingCutoff,
    audit,
    performance: audit.performance || pick.independentModelPerformance,
    role: "independent-shadow-model"
  };
}

function formRestCandidate(pick = {}) {
  const snapshot = pick.formRestShadow || pick.featureSnapshot;
  const p = probability(snapshot?.shadowProbability);
  if (!snapshot || snapshot.mode !== "binary-shadow" || snapshot.status !== "ready" || p === null) return null;
  const sportKey = clean(snapshot.sportKey || pick.sportKey || pick.league, 100).toLowerCase();
  const modelId = clean(snapshot.modelId, 120);
  if (!modelId) return null;
  return {
    modelId,
    modelVersion: modelId,
    modelFamily: `${sportKey || "unknown"}-form-rest-logit`,
    dependenceGroup: historicalDependenceGroup(sportKey),
    probability: p,
    generatedAt: snapshot.generatedAt,
    role: "form-rest-shadow",
    audit: {
      independentPredictiveModel: true,
      deterministic: true,
      chronologySafe: snapshot.chronologyGuard === true,
      source: snapshot?.provider?.source || "completed-results-form-rest",
      implementationPath: "lib/form-rest-shadow-model.mjs"
    }
  };
}

function historicalRatingCandidate(pick = {}) {
  const snapshot = pick.historicalRatingShadow;
  const p = probability(snapshot?.shadowProbability);
  if (!snapshot || snapshot.status !== "ready" || p === null) return null;
  const sportKey = clean(snapshot.sportKey || pick.sportKey || pick.league, 100).toLowerCase();
  const modelId = clean(snapshot.modelId, 120);
  if (!modelId) return null;
  return {
    modelId,
    modelVersion: modelId,
    modelFamily: `${sportKey || "unknown"}-historical-rating`,
    dependenceGroup: historicalDependenceGroup(sportKey),
    probability: p,
    generatedAt: snapshot.generatedAt,
    role: "historical-rating-shadow",
    audit: {
      independentPredictiveModel: true,
      deterministic: true,
      chronologySafe: snapshot.chronologyGuard === true && snapshot.trainingUsesOnlyCompletedEventsBeforeFixture === true,
      source: snapshot?.provider?.source || "completed-results-historical-rating",
      implementationPath: "lib/historical-rating-shadow-model.mjs"
    }
  };
}

function transparentInventory(pick = {}) {
  const model = pick.transparent1x2V2 || pick.transparent1x2 || pick.transparentModel;
  if (!model) return null;
  return {
    adapter: "transparent-1x2",
    status: model.ok === true ? "delegated-to-ensemble-adapter" : "unavailable",
    modelId: clean(model.modelVersion || model.baselineModelVersion, 160) || null,
    modelFamily: "transparent-1x2",
    dependenceGroup: "transparent-1x2-family",
    probabilityOutputOwnedByFactory: false,
    reason: "Ensemble V1 already owns the canonical Transparent 1X2 adapter; Model Factory inventories it without duplicating the vote."
  };
}

function featureOnlyInventory(pick = {}) {
  const snapshot = pick.formRestShadow || pick.featureSnapshot;
  if (!snapshot || snapshot.mode !== "feature-only") return null;
  return {
    adapter: "form-rest-feature-only",
    status: snapshot.status || "feature_only",
    modelId: clean(snapshot.modelId, 120) || null,
    modelFamily: "form-rest-features",
    dependenceGroup: historicalDependenceGroup(snapshot.sportKey || pick.sportKey || pick.league),
    probabilityOutputOwnedByFactory: false,
    reason: "Feature-only profiles may feed Feature Engine but cannot cast an ensemble probability vote."
  };
}

function historicalRatingInventory(pick = {}) {
  const snapshot = pick.historicalRatingShadow;
  if (!snapshot || snapshot.status === "ready") return null;
  return {
    adapter: "historical-rating-shadow",
    status: clean(snapshot.status, 60) || "unavailable",
    modelId: clean(snapshot.modelId, 120) || null,
    modelFamily: `${clean(snapshot.sportKey || pick.sportKey || pick.league, 100).toLowerCase() || "unknown"}-historical-rating`,
    dependenceGroup: historicalDependenceGroup(snapshot.sportKey || pick.sportKey || pick.league),
    probabilityOutputOwnedByFactory: false,
    reason: "Historical rating remains non-voting until its result source, chronology, sample and selection gates are ready."
  };
}

function rawExternalCandidates(pick = {}) {
  const rows = [
    ...(Array.isArray(pick.independentModelOutputs) ? pick.independentModelOutputs : []),
    ...(Array.isArray(pick.modelOutputsV1) ? pick.modelOutputsV1 : [])
  ];
  const explicit = explicitCandidate(pick);
  if (explicit) rows.push(explicit);
  return rows.slice(0, 30);
}

function dedupeOutputs(outputs = []) {
  const seen = new Set();
  const rows = [];
  for (const output of outputs) {
    const key = `${clean(output.modelVersion, 160).toLowerCase()}|${clean(output.dependenceGroup, 160).toLowerCase()}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(output);
  }
  return rows;
}

export function buildModelFactoryV1(pick = {}, { now = Date.now() } = {}) {
  const horizon = predictionHorizon(pick, now);
  const accepted = [];
  const rejected = [];
  const warnings = [];

  const admit = (candidate, origin) => {
    if (!candidate) return;
    const result = canonicalExternalCandidate(candidate, pick, horizon, now, origin);
    if (result.accepted) accepted.push(result.output);
    else rejected.push(result);
    warnings.push(...(result.performanceWarnings || []).map((warning) => `${result.identity?.modelId || "unknown"}:${warning}`));
  };

  for (const candidate of rawExternalCandidates(pick)) admit(candidate, "external-audited-output");
  admit(formRestCandidate(pick), "form-rest-shadow-adapter");
  admit(historicalRatingCandidate(pick), "historical-rating-shadow-adapter");

  const outputs = dedupeOutputs(accepted);
  const inventory = [
    transparentInventory(pick),
    featureOnlyInventory(pick),
    historicalRatingInventory(pick)
  ].filter(Boolean);

  return {
    version: MODEL_FACTORY_VERSION,
    generatedAt: new Date(now).toISOString(),
    predictionHorizon: horizon,
    sportKey: clean(pick.sportKey || pick.league, 100).toLowerCase() || null,
    league: clean(pick.leagueTitle || pick.league, 120) || null,
    market: clean(pick.market || pick.marketKey || "h2h", 80).toLowerCase(),
    outputs,
    rejectedModels: rejected.map((item) => ({
      origin: item.origin,
      modelId: item.identity?.modelId || null,
      modelVersion: item.identity?.modelVersion || null,
      dependenceGroup: item.identity?.dependenceGroup || null,
      reasons: item.reasons || []
    })),
    inventory,
    warnings: [...new Set(warnings)].sort(),
    counts: {
      acceptedOutputs: outputs.length,
      rejectedOutputs: rejected.length,
      calibrationReadyOutputs: outputs.filter((item) => item.performanceEvidenceV1?.calibrationReady === true).length,
      inventoriedNonVotingAdapters: inventory.length,
      uniqueDependenceGroups: new Set(outputs.map((item) => item.dependenceGroup).filter(Boolean)).size
    },
    contracts: {
      transparent1x2VoteDuplicated: false,
      featureOnlyModelsCastProbabilityVote: false,
      marketConsensusCastAsIndependentModel: false,
      historicalResultModelsDoubleCountedAsIndependentFamilies: false,
      missingProbabilityImputed: false,
      randomLegacyModelAccepted: false,
      unauditedExternalModelAccepted: false,
      automaticPromotionAllowed: false,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      paperOnly: true
    }
  };
}
