import { publicModelFormulaRegistry as basePublicModelFormulaRegistry } from "./model-formula-registry-v1.mjs";

export const PUBLIC_MODEL_FORMULA_REGISTRY_VERSION = "scorecaster-model-formula-registry-v2";

const BASKETBALL_FORMULA = Object.freeze({
  id: "basketball-efficiency-pace-v1",
  name: "NBA/WNBA pace + efficiency H2H shadow",
  formula: "possessions=clamp(sqrt(homePace*awayPace)); homeRating=mean(homeORtg,awayDRtg)+boundedLineup; awayRating=mean(awayORtg,homeDRtg)+boundedLineup; projectedPoints=possessions*rating/100; P(home)=logistic(projectedMargin/researchScale)",
  category: "independent-shadow-model",
  implementationPath: "lib/basketball-efficiency-shadow-v1.mjs",
  inputCutoffRule: "trusted independent pace, offensive-rating, defensive-rating and optional bounded lineup-impact observations must be observed and captured no later than the pregame prediction horizon",
  trained: false,
  note: "NBA and WNBA use separate transparent research profiles. Parameters are not claimed calibrated; chronological holdout evidence is required before any performance weighting."
});

const BASKETBALL_MODELS = Object.freeze([
  Object.freeze({
    id: "nba-efficiency-pace-v1",
    name: "NBA Efficiency + Pace Shadow V1",
    role: "performance-statistics-independent-challenger",
    probabilityType: "research-shadow-model-derived",
    implementationPaths: ["lib/basketball-efficiency-shadow-v1.mjs", "lib/sports-analytics-shadow-input-loader.js", "lib/model-factory-v1.mjs"],
    trainingCutoff: null,
    trainingStatus: "transparent-untrained-research-baseline",
    featureAvailabilityCutoff: "trusted independent pace and offensive/defensive rating observations no later than the prediction horizon; optional lineup impact is bounded",
    automaticPromotion: false,
    independentPredictiveModel: true,
    dependenceGroupPolicy: "lineage-derived basketball_nba-performance-statistics-family; market and historical-results inputs are excluded"
  }),
  Object.freeze({
    id: "wnba-efficiency-pace-v1",
    name: "WNBA Efficiency + Pace Shadow V1",
    role: "performance-statistics-independent-challenger",
    probabilityType: "research-shadow-model-derived",
    implementationPaths: ["lib/basketball-efficiency-shadow-v1.mjs", "lib/sports-analytics-shadow-input-loader.js", "lib/model-factory-v1.mjs"],
    trainingCutoff: null,
    trainingStatus: "transparent-untrained-research-baseline",
    featureAvailabilityCutoff: "trusted independent pace and offensive/defensive rating observations no later than the prediction horizon; optional lineup impact is bounded",
    automaticPromotion: false,
    independentPredictiveModel: true,
    dependenceGroupPolicy: "lineage-derived basketball_wnba-performance-statistics-family; market and historical-results inputs are excluded"
  })
]);

function appendUnique(rows = [], additions = []) {
  const ids = new Set(rows.map((row) => row?.id).filter(Boolean));
  return [...rows, ...additions.filter((row) => row?.id && !ids.has(row.id))];
}

export function publicModelFormulaRegistry() {
  const base = basePublicModelFormulaRegistry();
  return {
    ...base,
    version: PUBLIC_MODEL_FORMULA_REGISTRY_VERSION,
    formulas: appendUnique(base.formulas || [], [BASKETBALL_FORMULA]),
    models: appendUnique(base.models || [], BASKETBALL_MODELS),
    disclosure: {
      ...(base.disclosure || {}),
      basketballEfficiencyFormulaPublished: true,
      basketballResearchParametersClaimedCalibrated: false,
      automaticModelPromotion: false
    }
  };
}

export const BASKETBALL_PUBLIC_FORMULA = BASKETBALL_FORMULA;
export const BASKETBALL_PUBLIC_MODELS = BASKETBALL_MODELS;
