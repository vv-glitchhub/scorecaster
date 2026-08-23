import { getFootballMarketReferenceTargets } from "./football-market-taxonomy-v2.mjs";

export const PROVIDER_ACQUISITION_VERSION = "scorecaster-provider-acquisition-v1";

const RIGHTS_GATES = Object.freeze([
  { key: "commercial-use", label: "Commercial application use" },
  { key: "display", label: "Display normalized prices and event state" },
  { key: "derived-analysis", label: "Create and show derived analysis" },
  { key: "retention", label: "Retain audit snapshots for an agreed period" },
  { key: "attribution", label: "Document attribution requirements" },
  { key: "no-raw-redistribution", label: "No standalone raw-feed redistribution" }
]);

const BUNDLES = Object.freeze([
  {
    key: "goal-event-timing",
    priority: 1,
    label: "Goal event and timing markets",
    targetKeys: ["first_goal_team", "first_half_first_goal", "first_goal_10min", "first_goal_15min"],
    requiredCapabilities: ["first scorer team", "period-specific goal event", "timestamped goal event bands"],
    liveDataRequired: true,
    settlementSpecificationRequired: true
  },
  {
    key: "result-combinations",
    priority: 2,
    label: "Result and total combinations",
    targetKeys: ["winner_total_25", "winner_total_35", "winner_total_45", "result_btts"],
    requiredCapabilities: ["same-game result combinations", "1X2 plus totals", "1X2 plus BTTS"],
    liveDataRequired: false,
    settlementSpecificationRequired: true
  },
  {
    key: "btts-combinations",
    priority: 2,
    label: "BTTS and total combinations",
    targetKeys: ["btts_total_25", "btts_total_35", "btts_total_45"],
    requiredCapabilities: ["same-game BTTS combinations", "BTTS plus alternate total lines"],
    liveDataRequired: false,
    settlementSpecificationRequired: true
  },
  {
    key: "special-outcomes",
    priority: 3,
    label: "Special outcomes",
    targetKeys: ["most_cards", "winning_margin", "special_combinations"],
    requiredCapabilities: ["team card result", "winning margin", "provider-defined special combinations"],
    liveDataRequired: false,
    settlementSpecificationRequired: true
  }
]);

export function getProviderRightsGates() {
  return RIGHTS_GATES.map((gate) => ({ ...gate }));
}

export function getProviderAcquisitionBundles() {
  return BUNDLES.map((bundle) => ({
    ...bundle,
    targetKeys: [...bundle.targetKeys],
    requiredCapabilities: [...bundle.requiredCapabilities]
  }));
}

export function buildProviderAcquisitionPlan(targets = getFootballMarketReferenceTargets()) {
  const gapTargets = targets.filter((target) => !target.providerKeys?.length);
  const targetByKey = new Map(gapTargets.map((target) => [target.key, target]));
  const bundles = getProviderAcquisitionBundles().map((bundle) => ({
    ...bundle,
    targets: bundle.targetKeys.map((key) => targetByKey.get(key)).filter(Boolean),
    status: "provider-contract-required",
    syntheticFallbackAllowed: false
  }));
  const mapped = new Set(bundles.flatMap((bundle) => bundle.targets.map((target) => target.key)));
  const unmappedTargetKeys = gapTargets.map((target) => target.key).filter((key) => !mapped.has(key));

  return {
    version: PROVIDER_ACQUISITION_VERSION,
    status: gapTargets.length ? "procurement-required" : "provider-complete",
    targetCount: targets.length,
    providerCapableCount: targets.length - gapTargets.length,
    providerGapCount: gapTargets.length,
    rightsGates: getProviderRightsGates(),
    bundles,
    unmappedTargetKeys,
    nextActions: [
      "Request a machine-readable market catalogue and example payloads.",
      "Confirm commercial display, derived-analysis, retention and attribution rights in writing.",
      "Map provider settlement rules to Scorecaster market keys and add fixture-based contract tests.",
      "Run the provider in shadow ingestion before enabling any public price display."
    ],
    safety: {
      inventedPricesAllowed: false,
      undocumentedEndpointsAllowed: false,
      rawRedistributionAllowed: false,
      providerActivationRequiresWrittenRights: true
    }
  };
}

export function acquisitionForTarget(key) {
  const plan = buildProviderAcquisitionPlan();
  const bundle = plan.bundles.find((item) => item.targetKeys.includes(String(key)));
  return bundle ? { key: bundle.key, label: bundle.label, priority: bundle.priority } : null;
}
