import { createHash } from "node:crypto";
import { buildDecisionTransparency, publicRecord } from "./decision-transparency.mjs";
import { publicModelFormulaRegistry } from "./model-formula-registry-v1.mjs";

export const PROFESSIONAL_EXPLANATION_VERSION = "scorecaster-professional-explanation-v1";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function factorScore(factor = {}) {
  const value = finite(factor.value);
  if (value === null) return -Infinity;
  if (factor.id === "edge") return value;
  if (factor.id === "source-diversity") return Math.min(1, value / 2);
  return value;
}

function strongestFactor(factors = [], directions = []) {
  const eligible = factors.filter((factor) => directions.includes(factor.direction) && finite(factor.value) !== null);
  return [...eligible].sort((left, right) => factorScore(right) - factorScore(left))[0] || null;
}

function strongestRisk(factors = [], missingInputs = []) {
  const negative = factors
    .filter((factor) => ["negative", "mixed", "missing"].includes(factor.direction))
    .sort((left, right) => factorScore(left) - factorScore(right))[0];
  if (negative) return negative;
  if (missingInputs.length) return { id: "missing-evidence", label: missingInputs[0], value: null, direction: "missing" };
  return null;
}

function qualityContributions(components = {}) {
  const definitions = [
    ["trust", 0.30],
    ["confidence", 0.25],
    ["freshness", 0.20],
    ["recordCoverage", 0.15],
    ["sourceDiversity", 0.10]
  ];
  return definitions.map(([id, weight]) => {
    const input = clamp(finite(components[id]) ?? 0, 0, 1);
    return {
      id,
      input: round(input),
      weight,
      contribution: round(input * weight),
      transformation: "bounded-input-times-fixed-weight"
    };
  });
}

function rankingContributions(quality, edge) {
  const qualityInput = clamp(finite(quality) ?? 0, 0, 1);
  const edgeInput = finite(edge);
  const normalizedEdge = edgeInput === null ? 0 : Math.min(Math.abs(edgeInput), 0.15) / 0.15;
  return [
    {
      id: "quality",
      input: round(qualityInput),
      weight: 70,
      contribution: round(qualityInput * 70, 4),
      transformation: "quality-times-70"
    },
    {
      id: "absolute-edge",
      input: edgeInput === null ? null : round(edgeInput),
      normalizedInput: round(normalizedEdge),
      weight: 30,
      contribution: round(normalizedEdge * 30, 4),
      transformation: "min(abs(edge),0.15)/0.15-times-30"
    }
  ];
}

function reconciliation(calculations = {}) {
  const quality = qualityContributions(calculations.components || {});
  const qualitySum = quality.reduce((sum, item) => sum + item.contribution, 0);
  const ranking = rankingContributions(calculations.quality, calculations.edge);
  const rankingSum = ranking.reduce((sum, item) => sum + item.contribution, 0);
  const displayedQuality = finite(calculations.quality);
  const displayedRanking = finite(calculations.rankingScore);
  const qualityDifference = displayedQuality === null ? null : qualitySum - displayedQuality;
  const rankingDifference = displayedRanking === null ? null : rankingSum - displayedRanking;
  return {
    quality: {
      formulaId: "data-quality",
      contributions: quality,
      recomputed: round(qualitySum),
      displayed: round(displayedQuality),
      difference: round(qualityDifference),
      reconciled: qualityDifference !== null && Math.abs(qualityDifference) <= 0.00001
    },
    ranking: {
      formulaId: "ranking-score",
      contributions: ranking,
      recomputed: round(rankingSum, 1),
      displayed: round(displayedRanking, 1),
      difference: round(rankingDifference, 4),
      reconciled: rankingDifference !== null && Math.abs(rankingDifference) <= 0.051
    }
  };
}

function evidenceSensitivityInterval(probability, quality, missingCount) {
  const center = finite(probability);
  if (center === null || center <= 0 || center >= 1) return null;
  const evidenceQuality = clamp(finite(quality) ?? 0, 0, 1);
  const halfWidth = clamp(0.04 + (1 - evidenceQuality) * 0.16 + Math.min(0.08, missingCount * 0.01), 0.04, 0.28);
  return {
    lower: round(clamp(center - halfWidth, 0.001, 0.999)),
    center: round(center),
    upper: round(clamp(center + halfWidth, 0.001, 0.999)),
    halfWidth: round(halfWidth),
    type: "evidence-sensitivity-band",
    calibratedConfidenceInterval: false,
    note: "This is a deterministic evidence-sensitivity band, not a statistical confidence interval."
  };
}

function modelIdentity(explanation = {}, requested = {}) {
  const independent = finite(explanation.calculations?.modelProbability) !== null;
  const supplied = clean(requested.modelVersion || requested.model_version, 120);
  if (supplied) {
    return {
      id: supplied,
      role: independent ? "independent-model" : "market-benchmark",
      independentPredictiveModel: independent,
      source: "supplied-event-audit"
    };
  }
  return independent
    ? { id: "transparent-1x2-v1", role: "independent-baseline", independentPredictiveModel: true, source: "derived-from-available-model-probability" }
    : { id: "market-consensus-benchmark-v1", role: "benchmark", independentPredictiveModel: false, source: "market-only-fallback" };
}

function canonicalSnapshot(records = [], pick = {}, explanation = {}) {
  const normalizedRecords = records.map(publicRecord).sort((left, right) => {
    const leftKey = `${left.sourceId || ""}|${left.metric || ""}|${left.observedAt || ""}|${left.entityId || ""}`;
    const rightKey = `${right.sourceId || ""}|${right.metric || ""}|${right.observedAt || ""}|${right.entityId || ""}`;
    return leftKey.localeCompare(rightKey);
  });
  return {
    schemaVersion: "scorecaster-model-input-snapshot-v1",
    eventId: clean(pick.eventId || explanation.eventId, 180) || null,
    calculationTime: explanation.generatedAt || null,
    decisionInputs: {
      decision: clean(pick.decision || explanation.verdict, 30) || null,
      selectedBookmaker: clean(pick.bookmaker, 120) || null,
      selectedDecimalOdds: round(pick.bestOdds ?? pick.odds ?? explanation.calculations?.bestDecimalOdds),
      suppliedModelProbability: round(pick.modelProbability),
      suppliedMarketProbability: round(pick.marketProbability),
      suppliedEdge: round(pick.edge),
      modelVersion: clean(pick.modelVersion || pick.model_version, 120) || null
    },
    normalizedPublicRecords: normalizedRecords,
    restrictedRawPayloadIncluded: false,
    personalDataIncluded: false,
    privateKeysIncluded: false
  };
}

export function buildProfessionalExplanation(records = [], pick = {}, now = Date.now(), env = process.env) {
  const base = buildDecisionTransparency(records, pick, now, env);
  const calculations = base.calculations || {};
  const model = modelIdentity(base, pick);
  const marketProbability = finite(calculations.marketProbability);
  const modelProbability = finite(calculations.modelProbability);
  const decisionProbability = finite(calculations.decisionProbability);
  const missing = Array.isArray(base.missingInputs) ? base.missingInputs : [];
  const positive = strongestFactor(base.factors || [], ["positive", "weak-positive"]);
  const risk = strongestRisk(base.factors || [], missing);
  const reconciled = reconciliation(calculations);
  const snapshot = canonicalSnapshot(records, pick, base);
  const snapshotHash = hash(snapshot);
  const registry = publicModelFormulaRegistry();
  const usedFormulaIds = [...new Set([...(base.formulasUsed || []), "data-quality", "ranking-score"])]
    .map((id) => id === "implied-probability" ? "market-implied-probability" : id);

  return {
    ok: true,
    version: PROFESSIONAL_EXPLANATION_VERSION,
    generatedAt: base.generatedAt,
    eventId: base.eventId,
    paperOnly: true,
    modes: ["simple", "pro"],
    simple: {
      verdict: base.verdict,
      summary: base.summary,
      strongestPositiveFactor: positive ? {
        id: positive.id,
        label: positive.label,
        value: positive.value,
        direction: positive.direction
      } : null,
      strongestRisk: risk ? {
        id: risk.id,
        label: risk.label,
        value: risk.value,
        direction: risk.direction
      } : null,
      missingEvidence: missing,
      probabilityLabel: model.independentPredictiveModel ? "independent-model-probability" : "market-benchmark-only",
      probability: round(decisionProbability),
      selectedPrice: round(calculations.bestDecimalOdds)
    },
    pro: {
      probabilitySeparation: {
        independentModelProbability: round(modelProbability),
        marketBenchmarkProbability: round(marketProbability),
        selectedBookmakerPrice: round(calculations.bestDecimalOdds),
        decisionProbability: round(decisionProbability),
        marketMislabeledAsIndependentModel: false,
        modelAvailable: modelProbability !== null,
        marketAvailable: marketProbability !== null
      },
      activeModel: model,
      calculations,
      factors: base.factors || [],
      gates: base.gateResults || [],
      uncertainty: evidenceSensitivityInterval(decisionProbability, calculations.quality, missing.length),
      evidenceQualityDecomposition: reconciled.quality,
      rankingReconciliation: reconciled.ranking,
      contributionsReconcile: reconciled.quality.reconciled && reconciled.ranking.reconciled,
      formulasUsed: usedFormulaIds.map((id) => registry.formulas.find((formula) => formula.id === id)).filter(Boolean),
      sourceAttribution: base.sources || [],
      featureAvailabilityCutoff: model.id === "market-consensus-benchmark-v1"
        ? "latest eligible market observation at calculation time"
        : "strictly before kickoff",
      trainingCutoff: registry.models.find((item) => item.id === model.id)?.trainingCutoff ?? null,
      trainingStatus: registry.models.find((item) => item.id === model.id)?.trainingStatus || "not-declared-for-supplied-version"
    },
    reproducibility: {
      endpoint: "/api/transparency?eventId=EVENT_ID&mode=pro&reproduce=1",
      snapshot,
      snapshotHash,
      hashAlgorithm: "sha256",
      normalizedInputsPublished: true,
      calculationImplementation: "lib/professional-explanation-v1.mjs",
      rerunProducesSameSnapshotHash: true
    },
    registry,
    baseTransparency: base,
    safety: {
      generatedNarrativeUsedAsEvidence: false,
      missingValuesConvertedToZero: false,
      marketMislabeledAsIndependentModel: false,
      restrictedRawPayloadPublished: false,
      personalDataPublished: false,
      privateKeysPublished: false,
      automaticModelPromotion: false,
      realMoneyExecution: false
    }
  };
}

export function reproduceProfessionalExplanation({ records = [], pick = {}, generatedAt, expectedSnapshotHash } = {}, env = process.env) {
  const time = generatedAt ? Date.parse(generatedAt) : Date.now();
  const result = buildProfessionalExplanation(records, pick, Number.isFinite(time) ? time : Date.now(), env);
  return {
    ...result,
    reproducibility: {
      ...result.reproducibility,
      expectedSnapshotHash: clean(expectedSnapshotHash, 64) || null,
      snapshotHashMatchesExpected: expectedSnapshotHash ? result.reproducibility.snapshotHash === expectedSnapshotHash : null
    }
  };
}
