export const MODEL_FORMULA_REGISTRY_VERSION = "scorecaster-model-formula-registry-v1";

export const FORMULA_REGISTRY = Object.freeze([
  {
    id: "market-implied-probability",
    name: "Market implied probability",
    formula: "p_implied = 1 / decimal_odds",
    category: "market-benchmark",
    implementationPath: "lib/decision-transparency.mjs",
    inputCutoffRule: "price observation must be available before the displayed decision timestamp",
    trained: false,
    note: "A single price includes bookmaker margin and is not an independent predictive model."
  },
  {
    id: "no-vig-consensus",
    name: "No-vig market consensus",
    formula: "p_i_no_vig = (1 / odds_i) / sum_j(1 / odds_j)",
    category: "market-benchmark",
    implementationPath: "lib/bookmaker-market.mjs",
    inputCutoffRule: "only eligible provider prices observed before event start",
    trained: false,
    note: "The consensus is a market benchmark, not Scorecaster's independent probability."
  },
  {
    id: "model-edge",
    name: "Probability edge",
    formula: "edge = p_model - p_market",
    category: "decision",
    implementationPath: "lib/decision-transparency.mjs",
    inputCutoffRule: "both probabilities must exist at the decision timestamp",
    trained: false,
    note: "Edge is missing when an independent model probability is unavailable."
  },
  {
    id: "expected-value",
    name: "Expected value per unit",
    formula: "EV = p_decision * decimal_odds - 1",
    category: "decision",
    implementationPath: "lib/decision-transparency.mjs",
    inputCutoffRule: "probability and selected price must share a valid pre-event audit",
    trained: false,
    note: "EV is an estimate and never a guaranteed return."
  },
  {
    id: "data-quality",
    name: "Evidence quality",
    formula: "quality = 0.30*trust + 0.25*confidence + 0.20*freshness + 0.15*coverage + 0.10*diversity",
    category: "evidence-quality",
    implementationPath: "lib/decision-transparency.mjs",
    inputCutoffRule: "latest publishable observations at calculation time",
    trained: false,
    note: "Each component is bounded to [0,1] and missing evidence lowers the total."
  },
  {
    id: "ranking-score",
    name: "Evidence ranking score",
    formula: "score = 70*quality + 30*min(abs(edge),0.15)/0.15",
    category: "ranking",
    implementationPath: "lib/decision-transparency.mjs",
    inputCutoffRule: "same snapshot as the displayed quality and edge",
    trained: false,
    note: "Ranking score is not a probability."
  },
  {
    id: "feature-engine-eligibility-v1",
    name: "Feature Engine eligibility gate",
    formula: "eligible = value_present AND chronology_safe AND source_status_ok AND trust>=0.55 AND confidence>=0.45",
    category: "feature-engine",
    implementationPath: "lib/feature-engine-v1.mjs",
    inputCutoffRule: "feature observation must not be later than the decision horizon; market benchmarks are never relabeled as independent features",
    trained: false,
    note: "Missing values remain null and custom features require an explicit audit flag."
  },
  {
    id: "historical-rating-elo-v1",
    name: "Historical Rating recent Elo shadow",
    formula: "P_home = 1 / (1 + 10^(-((R_home + H - R_away) / 400))); R_new = R_old + K*(actual-expected)",
    category: "research-shadow-model",
    implementationPath: "lib/historical-rating-shadow-model.mjs",
    inputCutoffRule: "only completed historical league events strictly before the target fixture may update ratings",
    trained: false,
    note: "Initial rating, K-factor and home advantage are published research defaults; the model remains shadow-only until league-specific chronological calibration."
  },
  {
    id: "nhl-xg-goalie-poisson-v1",
    name: "NHL xG + starting-goalie Poisson shadow",
    formula: "attack=0.8*xGF60+0.2*postShotXGF60 when available; base=sqrt(attack*oppXGA60); lambda=clamp(base-clamp(oppStarterGSAx60,-0.75,0.75),0.8,6); H2H=Poisson regulation win + 0.5*tie",
    category: "independent-shadow-model",
    implementationPath: "lib/nhl-xg-goalie-shadow-v1.mjs",
    inputCutoffRule: "only trusted independent advanced observations with observedAt and capturedAt no later than the pregame prediction horizon; both starting goalies must be confirmed",
    trained: false,
    note: "A transparent untrained research baseline using xG/xGA and starting-goalie GSAx/60. Market, context and mirrored providers are excluded and validated holdout evidence is required before performance weighting."
  },
  {
    id: "soccer-xg-poisson-v1",
    name: "Soccer xG Poisson 1X2 shadow",
    formula: "attack=0.8*xGF90+0.2*postShotXGF90 when available; lambda=sqrt(attack*oppXGA90); score matrix -> home/draw/away",
    category: "independent-shadow-model",
    implementationPath: "lib/soccer-xg-poisson-shadow-v1.mjs",
    inputCutoffRule: "only trusted independent xGF/xGA observations captured no later than the pregame prediction horizon; market-derived and mirrored providers are excluded",
    trained: false,
    note: "A transparent untrained 1X2 research challenger. Post-shot xG is optional, missing values remain missing, and chronological holdout evidence is required before any performance weighting."
  },
  {
    id: "historical-results-dependence-group-v1",
    name: "Historical-results dependence group",
    formula: "one top-level ensemble vote per dependenceGroup; correlated member weights are not summed",
    category: "research-ensemble-safety",
    implementationPath: "lib/model-factory-v1.mjs",
    inputCutoffRule: "form/rest and historical-rating outputs derived from the same results family share a sport-specific dependence group",
    trained: false,
    note: "Different formulas over substantially shared historical-result inputs do not create artificial top-level model independence."
  },
  {
    id: "ensemble-shadow-probability-v1",
    name: "Independent-model shadow ensemble",
    formula: "p_shadow = sum_g(w_g * p_g) / sum_g(w_g)",
    category: "research-ensemble",
    implementationPath: "lib/ensemble-engine-v1.mjs",
    inputCutoffRule: "only deterministic chronology-safe independent model outputs are eligible and correlated variants are first collapsed by dependence group",
    trained: false,
    note: "Research weights are equal by dependence group unless validated calibration or chronological holdout evidence supplies an explicit group-safe performance weight."
  },
  {
    id: "ensemble-disagreement-v1",
    name: "Independent-model disagreement",
    formula: "sigma = sqrt(sum_g(w_g * (p_g - p_shadow)^2) / sum_g(w_g))",
    category: "research-risk",
    implementationPath: "lib/ensemble-engine-v1.mjs",
    inputCutoffRule: "same eligible dependence-group snapshot as the shadow ensemble",
    trained: false,
    note: "High disagreement creates a research NO_BET gate and never upgrades a production decision."
  },
  {
    id: "advanced-model-holdout-v1",
    name: "Advanced-model chronological holdout",
    formula: "latest immutable pregame capture per event+model -> settled outcome -> Brier + log loss + classwise calibration gap",
    category: "evaluation",
    implementationPath: "lib/advanced-model-holdout-v1.mjs",
    inputCutoffRule: "prediction capture and prediction horizon must be no later than event start; inputSnapshotHash is mandatory; outcome is joined only after settlement",
    trained: false,
    note: "The holdout can mark a sample review-ready at 100 settled predictions but never invents an ensemble performance weight or automatically promotes a model."
  },
  {
    id: "model-performance-readiness-v1",
    name: "Model performance evidence readiness",
    formula: "ready = sample>=100 AND chronological_validation AND Brier/logloss/calibration_present AND approved_weight_source AND no_leakage",
    category: "evaluation-gate",
    implementationPath: "lib/model-performance-evidence-v1.mjs",
    inputCutoffRule: "training and holdout chronology must precede the prediction horizon; pre-event-only evidence is mandatory",
    trained: false,
    note: "A model without complete valid evidence may remain research-visible but cannot supply an ensemble performance weight."
  },
  {
    id: "elo-davidson-1x2",
    name: "Transparent Elo-Davidson 1X2 baseline",
    formula: "rating difference -> Davidson home/draw/away probabilities",
    category: "independent-baseline-model",
    implementationPath: "lib/transparent-1x2-engine.mjs",
    inputCutoffRule: "ratings and form observations strictly before kickoff",
    trained: false,
    note: "A deterministic baseline with published parameters; league calibration remains separate evidence."
  },
  {
    id: "poisson-scoreline",
    name: "Poisson scoreline baseline",
    formula: "P(X=k) = exp(-lambda) * lambda^k / k!",
    category: "independent-baseline-model",
    implementationPath: "lib/transparent-1x2-engine.mjs",
    inputCutoffRule: "attack, defence and league-goal inputs strictly before kickoff",
    trained: false,
    note: "The displayed 1X2 probabilities are derived from the published score matrix."
  },
  {
    id: "context-contribution",
    name: "Bounded context contribution",
    formula: "delta_elo = clamp(impact * confirmation * confidence * trust * freshness * category_cap)",
    category: "sensitivity",
    implementationPath: "lib/context-engine.mjs",
    inputCutoffRule: "context observation and effective time must be no later than kickoff",
    trained: false,
    note: "Context is a bounded sensitivity preview and cannot independently promote PLAY."
  },
  {
    id: "calibration-metrics",
    name: "Calibration evidence",
    formula: "Brier, bounded log loss, reliability bins and Wilson intervals",
    category: "evaluation",
    implementationPath: "lib/calibration-lab-v1.mjs",
    inputCutoffRule: "settled paper decisions joined to eligible pre-start closing evidence",
    trained: false,
    note: "Calibration supports human review; automatic model promotion is disabled."
  }
]);

export const MODEL_REGISTRY = Object.freeze([
  {
    id: "market-consensus-benchmark-v1",
    name: "Market consensus benchmark",
    role: "benchmark",
    probabilityType: "market-derived",
    implementationPaths: ["lib/bookmaker-market.mjs", "app/api/top-picks/route.js"],
    trainingCutoff: null,
    trainingStatus: "not-trained",
    featureAvailabilityCutoff: "latest eligible pre-event market observation",
    automaticPromotion: false,
    independentPredictiveModel: false
  },
  {
    id: "scorecaster-feature-engine-v1",
    name: "Feature Engine V1",
    role: "feature-normalization-and-audit",
    probabilityType: "none",
    implementationPaths: ["lib/feature-engine-v1.mjs", "lib/decision-architecture-v1.mjs"],
    trainingCutoff: null,
    trainingStatus: "deterministic-not-trained",
    featureAvailabilityCutoff: "decision-time chronology horizon",
    automaticPromotion: false,
    independentPredictiveModel: false
  },
  {
    id: "scorecaster-model-factory-v1",
    name: "Model Factory V1",
    role: "shadow-model-admission-and-dependence-boundary",
    probabilityType: "none",
    implementationPaths: ["lib/model-factory-v1.mjs", "lib/model-performance-evidence-v1.mjs", "lib/decision-architecture-v1.mjs"],
    trainingCutoff: null,
    trainingStatus: "deterministic-admission-gate",
    featureAvailabilityCutoff: "model output and attached evidence must pass decision-time chronology",
    automaticPromotion: false,
    independentPredictiveModel: false
  },
  {
    id: "historical-rating-shadow-v1",
    name: "Historical Rating Shadow V1",
    role: "historical-results-rating-challenger",
    probabilityType: "research-shadow-model-derived",
    implementationPaths: ["lib/historical-rating-shadow-model.mjs", "lib/model-factory-v1.mjs"],
    trainingCutoff: "dynamic: completed league events strictly before target fixture",
    trainingStatus: "research-default-parameters-not-league-calibrated",
    featureAvailabilityCutoff: "strictly before target fixture",
    automaticPromotion: false,
    independentPredictiveModel: true,
    dependenceGroupPolicy: "shares sport-specific historical-results-family with form/rest"
  },
  {
    id: "nhl-xg-goalie-poisson-v1",
    name: "NHL xG + Goalie Shadow V1",
    role: "expected-performance-independent-challenger",
    probabilityType: "research-shadow-model-derived",
    implementationPaths: ["lib/nhl-xg-goalie-shadow-v1.mjs", "lib/sports-analytics-shadow-input-loader.js", "lib/model-factory-v1.mjs"],
    trainingCutoff: null,
    trainingStatus: "transparent-untrained-research-baseline",
    featureAvailabilityCutoff: "trusted independent xG/xGA and confirmed starting-goalie GSAx/60 observations no later than the prediction horizon",
    automaticPromotion: false,
    independentPredictiveModel: true,
    dependenceGroupPolicy: "lineage-derived expected-performance family; market and historical-results families are excluded from inputs"
  },
  {
    id: "soccer-xg-poisson-v1",
    name: "Soccer xG Poisson Shadow V1",
    role: "expected-performance-independent-challenger",
    probabilityType: "research-shadow-model-derived",
    implementationPaths: ["lib/soccer-xg-poisson-shadow-v1.mjs", "lib/sports-analytics-shadow-input-loader.js", "lib/model-factory-v1.mjs"],
    trainingCutoff: null,
    trainingStatus: "transparent-untrained-research-baseline",
    featureAvailabilityCutoff: "trusted independent xGF/xGA per-90 observations no later than the prediction horizon",
    automaticPromotion: false,
    independentPredictiveModel: true,
    dependenceGroupPolicy: "lineage-derived expected-performance family; market and historical-results families are excluded from inputs"
  },
  {
    id: "scorecaster-advanced-model-holdout-v1",
    name: "Advanced Model Holdout V1",
    role: "chronological-shadow-evaluation",
    probabilityType: "evaluation-only",
    implementationPaths: ["lib/advanced-model-holdout-v1.mjs", "lib/advanced-model-holdout-service.js", "app/api/model-holdout/route.js"],
    trainingCutoff: null,
    trainingStatus: "post-settlement-evaluation-of-immutable-pregame-snapshots",
    featureAvailabilityCutoff: "prediction snapshot and input hash captured before kickoff; results joined after settlement",
    automaticPromotion: false,
    independentPredictiveModel: false
  },
  {
    id: "scorecaster-ensemble-engine-v1",
    name: "Ensemble Engine V1",
    role: "shadow-independent-model-ensemble",
    probabilityType: "research-shadow-model-derived",
    implementationPaths: ["lib/ensemble-engine-v1.mjs", "lib/decision-architecture-v1.mjs"],
    trainingCutoff: null,
    trainingStatus: "shadow-first; validated external performance weights only",
    featureAvailabilityCutoff: "all component model predictions and performance evidence must be chronology-safe",
    automaticPromotion: false,
    independentPredictiveModel: false
  },
  {
    id: "transparent-1x2-v1",
    name: "Transparent 1X2 baseline",
    role: "independent-baseline",
    probabilityType: "model-derived",
    implementationPaths: ["lib/transparent-1x2-engine.mjs"],
    trainingCutoff: null,
    trainingStatus: "deterministic-published-parameters",
    featureAvailabilityCutoff: "strictly before kickoff",
    automaticPromotion: false,
    independentPredictiveModel: true
  },
  {
    id: "context-engine-v1",
    name: "Context sensitivity engine",
    role: "bounded-sensitivity",
    probabilityType: "model-sensitivity",
    implementationPaths: ["lib/context-engine.mjs"],
    trainingCutoff: null,
    trainingStatus: "deterministic-published-caps",
    featureAvailabilityCutoff: "observed and effective no later than kickoff",
    automaticPromotion: false,
    independentPredictiveModel: false
  },
  {
    id: "scorecaster-calibration-lab-v1",
    name: "Calibration Lab",
    role: "evaluation",
    probabilityType: "evaluation-only",
    implementationPaths: ["lib/calibration-lab-v1.mjs"],
    trainingCutoff: null,
    trainingStatus: "post-settlement-evaluation",
    featureAvailabilityCutoff: "closing evidence before kickoff; outcome after settlement",
    automaticPromotion: false,
    independentPredictiveModel: false
  }
]);

export function publicModelFormulaRegistry() {
  return {
    version: MODEL_FORMULA_REGISTRY_VERSION,
    formulas: FORMULA_REGISTRY,
    models: MODEL_REGISTRY,
    disclosure: {
      implementationPathsPublished: true,
      privateKeysPublished: false,
      personalDataPublished: false,
      restrictedRawPayloadsPublished: false,
      automaticModelPromotion: false
    }
  };
}
