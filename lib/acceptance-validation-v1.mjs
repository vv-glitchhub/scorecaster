import { VALIDATION_REVIEW_POLICY } from "./validation-lab-v1.mjs";

export const ACCEPTANCE_VALIDATION_VERSION = "scorecaster-acceptance-validation-v1";

const count = (value) => value === null || value === undefined || value === ""
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const policyNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function collectorReady(control = {}) {
  const blockers = Array.isArray(control?.readiness?.blockers) ? control.readiness.blockers : [];
  return !blockers.some((item) => [
    "no-publishable-records",
    "collector-stale",
    "no-active-source",
    "collector-degraded"
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
  const healthAvailable = Boolean(health?.app || health?.status);
  const intelligenceAvailable = Boolean(intelligence?.ok || intelligence?.storage || intelligence?.contracts);
  const calibrationAvailable = Boolean(calibration && Object.keys(calibration).length);
  const controlAvailable = Boolean(control && Object.keys(control).length);
  const services = health?.services || {};
  const storage = intelligence?.storage || {};
  const account = operations?.accountActivity || {};
  const checklist = operations?.checklist || {};
  const minimumReviewSample = policyNumber(VALIDATION_REVIEW_POLICY.minimumPairedEvents, 100);

  const metrics = {
    modelPredictions: intelligenceAvailable ? count(storage.shadowPredictions) : null,
    baselinePredictions: intelligenceAvailable ? count(storage.ownBaselinePredictions) : null,
    mlPredictions: intelligenceAvailable ? count(storage.selfTrainedMlPredictions) : null,
    verifiedFinalOutcomes: intelligenceAvailable ? count(storage.verifiedFinalOutcomes) : null,
    learningExamples: intelligenceAvailable ? count(storage.learningExamples) : null,
    trainingEligibleExamples: intelligenceAvailable ? count(storage.trainingEligibleExamples) : null,
    calibrationObservations: calibrationAvailable ? count(calibration?.eligibleObservationCount) : null,
    calibrationExclusions: calibrationAvailable ? count(calibration?.exclusionCount) : null,
    openPaperBets: operations ? count(account.openPaperBets) : null,
    activePushDevices: operations ? count(account.activeNotificationDevices) : null
  };

  const hasPredictionStream = (metrics.modelPredictions ?? 0) > 0;
  const hasOutcomeStream = (metrics.verifiedFinalOutcomes ?? 0) > 0;
  const hasLearningEvidence = (metrics.learningExamples ?? 0) > 0;
  const hasCalibrationEvidence = (metrics.calibrationObservations ?? 0) > 0;
  const reviewSampleReady = (metrics.learningExamples ?? 0) >= minimumReviewSample
    && (metrics.calibrationObservations ?? 0) >= minimumReviewSample;

  const evidenceSourcesLoaded = intelligenceAvailable && calibrationAvailable;
  const evidenceStage = !evidenceSourcesLoaded
    ? "checking"
    : !hasPredictionStream || !hasOutcomeStream
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
      status: healthAvailable ? status(health?.status === "ok" && health?.deployment === "production") : "unknown",
      detail: health?.commit || null
    },
    {
      id: "database",
      label: "Supabase configured",
      status: healthAvailable ? status(services.supabaseConfigured === true) : "unknown"
    },
    {
      id: "odds-provider",
      label: "Primary odds provider",
      status: healthAvailable ? status(services.oddsApiConfigured === true) : "unknown"
    },
    {
      id: "collector",
      label: "Collector freshness",
      status: controlAvailable ? status(collectorReady(control)) : "unknown"
    },
    {
      id: "intelligence-core",
      label: "Owned intelligence core",
      status: intelligenceAvailable ? status(intelligence?.ok === true && intelligence?.contracts?.paperOnly === true) : "unknown"
    },
    {
      id: "calibration-storage",
      label: "Calibration storage",
      status: calibrationAvailable ? status(calibration?.storageAvailable === true) : "unknown"
    },
    {
      id: "paper-boundary",
      label: "Paper-only safety boundary",
      status: healthAvailable && intelligenceAvailable
        ? status(services.realMoneyBetting === false && intelligence?.contracts?.realMoneyActionAvailable === false)
        : "unknown"
    },
    {
      id: "automatic-promotion",
      label: "No automatic model promotion",
      status: intelligenceAvailable ? status(intelligence?.modelGovernance?.automaticPromotionAllowed === false) : "unknown"
    }
  ];

  const evidenceChecks = [
    {
      id: "prediction-stream",
      label: "Pregame prediction stream",
      status: intelligenceAvailable ? status(hasPredictionStream, "collecting") : "unknown",
      value: metrics.modelPredictions
    },
    {
      id: "verified-results",
      label: "Verified final outcomes",
      status: intelligenceAvailable ? status(hasOutcomeStream, "collecting") : "unknown",
      value: metrics.verifiedFinalOutcomes
    },
    {
      id: "learning-examples",
      label: `Chronology-safe learning examples (${minimumReviewSample}+)`,
      status: intelligenceAvailable
        ? (metrics.learningExamples >= minimumReviewSample ? "ready" : "collecting")
        : "unknown",
      value: metrics.learningExamples
    },
    {
      id: "calibration-observations",
      label: `Settled paper calibration observations (${minimumReviewSample}+)`,
      status: calibrationAvailable
        ? (metrics.calibrationObservations >= minimumReviewSample ? "ready" : "collecting")
        : "unknown",
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
      detail: operations ? `${metrics.activePushDevices ?? 0} active device(s)` : "Sign in to inspect account-scoped device state"
    },
    {
      id: "push-delivery",
      label: "Push delivery enabled after device test",
      status: operations ? (checklist.notificationDeliveryEnabled ? "ready" : "external") : "auth-required"
    },
    {
      id: "lineups",
      label: "Governed lineup provider",
      status: healthAvailable ? (services.lineupProviderConfigured ? "ready" : "optional-gap") : "unknown"
    },
    {
      id: "liiga-provider",
      label: "Liiga primary market capability",
      status: !healthAvailable
        ? "unknown"
        : unavailableLeagues.some((item) => item?.key === "icehockey_finland_liiga")
          ? "provider-gap"
          : "ready"
    }
  ];

  const requiredCodeKnown = codeChecks.every((item) => item.status !== "unknown");
  const codeReady = requiredCodeKnown && codeChecks.every((item) => item.status === "ready");
  const evidenceReady = evidenceSourcesLoaded && evidenceChecks.every((item) => item.status === "ready");
  const externalBlocking = externalChecks.some((item) => ["external", "auth-required"].includes(item.status));

  const overallStatus = !requiredCodeKnown || !evidenceSourcesLoaded
    ? "checking"
    : !codeReady
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
