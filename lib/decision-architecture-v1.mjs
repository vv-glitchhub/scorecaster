import { buildFeatureSnapshotV1 } from "./feature-engine-v1.mjs";
import { buildEnsembleSnapshotV1 } from "./ensemble-engine-v1.mjs";

export const DECISION_ARCHITECTURE_VERSION = "scorecaster-decision-architecture-v1";

export function attachDecisionArchitectureV1(pick = {}, { now = Date.now() } = {}) {
  const featureEngine = buildFeatureSnapshotV1(pick, { now });
  const ensembleEngine = buildEnsembleSnapshotV1(pick, featureEngine, { now });

  return {
    ...pick,
    featureEngineV1: featureEngine,
    ensembleEngineV1: ensembleEngine,
    decisionArchitectureV1: {
      version: DECISION_ARCHITECTURE_VERSION,
      generatedAt: new Date(now).toISOString(),
      featureSnapshotHash: featureEngine.snapshotHash,
      featureEligibilityRate: featureEngine.eligibilityRate,
      researchModelCount: ensembleEngine.counts.researchEligible,
      researchModelGroupCount: ensembleEngine.counts.researchGroups,
      calibrationReadyModelCount: ensembleEngine.counts.calibrationReady,
      calibrationReadyModelGroupCount: ensembleEngine.counts.calibrationReadyGroups,
      shadowProbability: ensembleEngine.shadowProbability,
      calibratedShadowProbability: ensembleEngine.calibratedShadowProbability,
      modelDisagreement: ensembleEngine.uncertainty,
      researchRiskGate: ensembleEngine.researchRiskGate,
      correlatedModelVariantsDoubleCounted: false,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      paperOnly: true
    },
    productionProbabilityAdjustedByFeatureEnsemble: false,
    productionDecisionAdjustedByFeatureEnsemble: false
  };
}
