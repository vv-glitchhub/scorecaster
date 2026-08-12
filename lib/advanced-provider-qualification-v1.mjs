export const ADVANCED_PROVIDER_QUALIFICATION_VERSION = "scorecaster-advanced-provider-qualification-v1";
export const REQUIRED_PROVIDER_CONTRACT = "scorecaster-sports-analytics-v5";

const ADVANCED_FAMILIES = new Set(["expected-performance", "performance-statistics", "tracking"]);
const MAX_OPERATIONAL_AGE_MS = 72 * 60 * 60 * 1000;

function clean(value, limit = 180) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function outputIsAdvanced(row = {}) {
  const families = Array.isArray(row?.signalLineageV1?.signalFamilies)
    ? row.signalLineageV1.signalFamilies
    : Array.isArray(row?.signalFamilies)
      ? row.signalFamilies
      : [];
  return families.some((family) => ADVANCED_FAMILIES.has(clean(family, 80).toLowerCase()));
}

function predictionHorizon(pick = {}, now = Date.now()) {
  const commence = timestamp(pick.commenceTime || pick.commence_time);
  return commence === null ? now : Math.min(now, commence);
}

export function buildAdvancedProviderQualificationV1(pick = {}, {
  providerConfiguration = {},
  now = Date.now()
} = {}) {
  const status = pick.advancedShadowInputStatus || {};
  const factory = pick.modelFactoryV1 || {};
  const outputs = (Array.isArray(factory.outputs) ? factory.outputs : []).filter(outputIsAdvanced);
  const horizon = predictionHorizon(pick, now);
  const newestObserved = timestamp(status.newestObservedAt);
  const providerConfigured = providerConfiguration?.configured === true;
  const providerContract = clean(providerConfiguration?.contract, 120) || null;
  const contractCompatible = providerContract === REQUIRED_PROVIDER_CONTRACT;
  const independentDataPresent = status.ok === true && Number(status.providerCount || 0) > 0;
  const chronologySafe = outputs.length > 0 && outputs.every((row) => row?.audit?.chronologySafe === true);
  const inputHashesPresent = outputs.length > 0 && outputs.every((row) => Boolean(row?.audit?.inputSnapshotHash));
  const operationallyFresh = newestObserved !== null && newestObserved <= horizon && (horizon - newestObserved) <= MAX_OPERATIONAL_AGE_MS;
  const reasons = [];

  if (!providerConfigured) reasons.push("advanced-provider-not-configured");
  if (providerConfigured && !contractCompatible) reasons.push("advanced-provider-contract-incompatible");
  if (!independentDataPresent) reasons.push("no-independent-advanced-data");
  if (independentDataPresent && !operationallyFresh) reasons.push("advanced-data-operationally-stale-or-undated");
  if (outputs.length === 0) reasons.push("no-audited-advanced-model-output");
  if (outputs.length > 0 && !chronologySafe) reasons.push("advanced-model-chronology-not-safe");
  if (outputs.length > 0 && !inputHashesPresent) reasons.push("advanced-model-input-hash-missing");

  const shadowQualified = reasons.length === 0;
  const stage = !providerConfigured
    ? "provider-not-configured"
    : !contractCompatible
      ? "provider-contract-incompatible"
      : !independentDataPresent
        ? "configured-no-independent-data"
        : outputs.length === 0
          ? "data-present-model-not-admitted"
          : shadowQualified
            ? "qualified-for-shadow-holdout"
            : "advanced-data-or-model-blocked";

  return {
    version: ADVANCED_PROVIDER_QUALIFICATION_VERSION,
    generatedAt: new Date(now).toISOString(),
    stage,
    shadowQualified,
    holdoutCaptureEligible: shadowQualified && inputHashesPresent,
    productionEligible: false,
    reasons: [...new Set(reasons)],
    provider: {
      configured: providerConfigured,
      source: clean(providerConfiguration?.source, 100) || null,
      transport: clean(providerConfiguration?.transport, 80) || null,
      contract: providerContract,
      requiredContract: REQUIRED_PROVIDER_CONTRACT,
      contractCompatible
    },
    data: {
      mode: clean(status.mode, 100) || null,
      sport: clean(status.sport, 80) || null,
      providerCount: Number(status.providerCount || 0),
      newestObservedAt: status.newestObservedAt || null,
      horizon: status.horizon || null,
      operationalFreshnessHours: newestObserved === null ? null : Number(((horizon - newestObserved) / 3_600_000).toFixed(2)),
      operationalFreshnessLimitHours: MAX_OPERATIONAL_AGE_MS / 3_600_000,
      independentDataPresent,
      operationallyFresh
    },
    models: {
      auditedAdvancedOutputs: outputs.length,
      modelIds: outputs.map((row) => row.modelId).filter(Boolean),
      dependenceGroups: [...new Set(outputs.map((row) => row.dependenceGroup).filter(Boolean))],
      chronologySafe,
      inputHashesPresent
    },
    contract: {
      providerConfiguredDoesNotMeanModelReady: true,
      rawAdvancedDataDoesNotCreateProbability: true,
      marketPricingCannotQualifyAsAdvancedIndependentData: true,
      chronologyRequired: true,
      inputSnapshotHashRequiredForHoldout: true,
      automaticPromotionAllowed: false,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      paperOnly: true
    }
  };
}
