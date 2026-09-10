import { VALIDATION_REVIEW_POLICY } from "./validation-lab-v1.mjs";

export const ACCEPTANCE_VALIDATION_VERSION = "scorecaster-acceptance-validation-v1";

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const bool = (value) => value === true;

function collectorReady(control = {}) {
  const blockers = Array.isArray(control?.readiness?.blockers) ? control.readiness.blockers : [];
  return !blockers.some((item) => [
    "no-publishable-records",
    "collector-stale",
    "no-active-source",
    "collector-degraded",
    "collector-stale"
  ].includes(item));
}

function status(ready, pending = "blocked") {
  return ready ? "ready" : pending;
}

export function buildAcceptanceValidationV1({
  health = null,
  intelligence = null,
  calibration = null,
  control = null,
  operations = null
} = {}) {
  const services = health?.services || {};
  const storage = intelligence?.storage || {};
  const account = operations?.accountActivity || {};
  const checklist = operations?.checklist || {};
  const minimumReviewSample = number(VALIDATION_REVIEW_POLICY.minimumPairedEvents) || 100;

  const metrics = {
    modelPredictions: number(storage.shadowPredictions),
    baselinePredictions: number(storage.ownBaselinePredictions),
    mlPredictions: number(storage.selfTrainedMlPredictions),
    verifiedFinalOutcomes: number(storage.verifiedFinalOutcomes),
    learningExamples: number(storage.learningExamples),
    trainingEligibleExamples: number(storage.trainingEligibleExamples),
    calibrationObservations: number(calibration?.eligibleObservationCount),
    calibrationExclusions: number(calibration?.exclusionCount),
    openPaperBets: number(account.openPaperBets),
    activePushDevices: number(account.activeNotificationDevices)
  };

  const hasPredictionStream = metrics.modelPredictions > 0;
  const hasOutcomeStream = metrics.verifiedFinalOutcomes > 0;
  const hasLearningEvidence = metrics.learningExamples > 0;
  const hasCalibrationEvidence = metrics.calibrationObservations > 0;
  const reviewSampleReady = metrics.learningExamples >= minimumReviewSample
    && metrics.calibrationObservations >= minimumReviewSample;

  const evidenceStage = !hasPredictionStream || !hasOutcomeStream
    ? "pipeline-starting"
    : !hasLearningEvidence && !hasCalibrationEvidence
      ? "collecting-first-evidence"
      : !reviewSampleReady
        ? "growing-sample"
        : "review-sample-ready";

  const codeChecks = [
    {
      id: "production",
      label: "Production deployment",
      status: status(health?.status === "ok" && health?.deployment === "production"),
      detail: health?.commit || null
    },
    {
      id: "database",
      label: "Supabase configured",
      status: status(bool(services.supabaseConfigured))
    },
    {
      id: "odds-provider",
      label: "Primary odds provider",
      status: status(bool(services.oddsApiConfigured))
    },
    {
      id: "collector",
      label: "Collector freshness",
      status: control ? status(collectorReady(control)) : "unknown"
    },
    {
      id: "intelligence-core",
      label: "Owned intelligence core",
      status: status(intelligence?.ok === true && intelligence?.contracts?.paperOnly === true)
    },
    {
      id: "calibration-storage",
      label: "Calibration storage",
      status: calibration?.storageAvailable === true ? "ready" : calibration ? "blocked" : "unknown"
    },
    {
      id: "paper-boundary",
      label: "Paper-only safety boundary",
      status: status(services.realMoneyBetting === false && intelligence?.contracts?.realMoneyActionAvailable === false)
    },
    {
      id: "automatic-promotion",
      label: "No automatic model promotion",
      status: status(intelligence?.modelGovernance?.automaticPromotionAllowed === false)
    }
  ];

  const evidenceChecks = [
    {
      id: "prediction-stream",
      label: "Pregame prediction stream",
      status: status(hasPredictionStream, "collecting"),
      value: metrics.modelPredictions
    },
    {
      id: "verified-results",
      label: "Verified final outcomes",
      status: status(hasOutcomeStream, "collecting"),
      value: metrics.verifiedFinalOutcomes
    },
    {
      id: "learning-examples",
      label: `Chronology-safe learning examples (${minimumReviewSample}+)`,
      status: metrics.learningExamples >= minimumReviewSample ? "ready" : "collecting",
      value: metrics.learningExamples
    },
    {
      id: "calibration-observations",
      label: `Settled paper calibration observations (${minimumReviewSample}+)`,
      status: metrics.calibrationObservations >= minimumReviewSample ? "ready" : "collecting",
      value: metrics.calibrationObservations
    }
  ];

  const unavailableLeagues = Array.isArray(health?.marketUniverse?.unavailableLeagues)
    ? health.marketUniverse.unavailableLeagues
    : [];
  const externalChecks = [
    {
      id: "leaked-password-protection",
      label: "Supabase leaked-password protection",
      status: "external",
      detail: "Verify in Supabase Auth security settings"
    },
    {
      id: "password-reset-email",
      label: "Real password-reset email link",
      status: "external",
      detail: "Requires an inbox and test account"
    },
    {
      id: "physical-push",
      label: "Physical push device",
      status: operations ? (checklist.physicalPushDeviceRegistered ? "ready" : "external") : "auth-required",
      detail: operations ? `${metrics.activePushDevices} active device(s)` : "Sign in to inspect account-scoped device state"
    },
    {
      id: "push-delivery",
      label: "Push delivery enabled after device test",
      status: operations ? (checklist.notificationDeliveryEnabled ? "ready" : "external") : "auth-required"
    },
    {
      id: "lineups",
      label: "Governed lineup provider",
      status: services.lineupProviderConfigured ? "ready" : "optional-gap"
    },
    {
      id: "liiga-provider",
      label: "Liiga primary market capability",
      status: unavailableLeagues.some((item) => item?.key === "icehockey_finland_liiga") ? "provider-gap" : "ready"
    }
  ];

  const codeReady = codeChecks.every((item) => item.status === "ready");
  const evidenceReady = evidenceChecks.every((item) => item.status === "ready");
  const externalBlocking = externalChecks.some((item) => ["external", "auth-required", "provider-gap"].includes(item.status) && item.id !== "liiga-provider");

  const overallStatus = !codeReady
    ? "code-blocked"
    : !evidenceReady
      ? "collecting-evidence"
      : externalBlocking
        ? "external-acceptance-pending"
        : "release-review-ready";

  return {
    version: ACCEPTANCE_VALIDATION_VERSION,
    overallStatus,
    evidenceStage,
    minimumReviewSample,
    codeReady,
    evidenceReady,
    metrics,
    codeChecks,
    evidenceChecks,
    externalChecks,
    safety: {
      paperOnly: true,
      realMoneyBetting: false,
      automaticModelPromotionAllowed: false,
      historicalEvidenceIsProfitGuarantee: false
    }
  };
}
