import { buildFeatureSnapshotV1 } from "./feature-engine-v1.mjs";
import { buildModelFactoryV1 } from "./model-factory-v1.mjs";
import { buildEnsembleSnapshotV1 } from "./ensemble-engine-v1.mjs";

export const DECISION_ARCHITECTURE_VERSION = "scorecaster-decision-architecture-v1";

export function attachDecisionArchitectureV1(pick = {}, { now = Date.now() } = {}) {
  const featureEngine = buildFeatureSnapshotV1(pick, { now });
  const modelFactory = buildModelFactoryV1(pick, { now });
  const ensembleInput = {
    ...pick,
    independentModelOutputs: modelFactory.outputs,
    modelOutputsV1: [],
    independentModelProbability: undefined,
    independentModelAudit: undefined,
    independentModelPerformance: undefined
  };
  const ensembleEngine = buildEnsembleSnapshotV1(ensembleInput, featureEngine, { now });

  return {
    ...pick,
    featureEngineV1: featureEngine,
    modelFactoryV1: modelFactory,
    ensembleEngineV1: ensembleEngine,
    decisionArchitectureV1: {
      version: DECISION_ARCHITECTURE_VERSION,
      generatedAt: new Date(now).toISOString(),
      featureSnapshotHash: featureEngine.snapshotHash,
      featureEligibilityRate: featureEngine.eligibilityRate,
      modelFactoryVersion: modelFactory.version,
      modelFactoryAcceptedOutputCount: modelFactory.counts.acceptedOutputs,
      modelFactoryRejectedOutputCount: modelFactory.counts.rejectedOutputs,
      modelFactoryCalibrationReadyOutputCount: modelFactory.counts.calibrationReadyOutputs,
      researchModelCount: ensembleEngine.counts.researchEligible,
      researchModelGroupCount: ensembleEngine.counts.researchGroups,
      calibrationReadyModelCount: ensembleEngine.counts.calibrationReady,
      calibrationReadyModelGroupCount: ensembleEngine.counts.calibrationReadyGroups,
      shadowProbability: ensembleEngine.shadowProbability,
      calibratedShadowProbability: ensembleEngine.calibratedShadowProbability,
      modelDisagreement: ensembleEngine.uncertainty,
      researchRiskGate: ensembleEngine.researchRiskGate,
      correlatedModelVariantsDoubleCounted: false,
      modelFactoryBypassed: false,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      paperOnly: true
    },
    productionProbabilityAdjustedByFeatureEnsemble: false,
    productionDecisionAdjustedByFeatureEnsemble: false
  };
}
