import { buildProviderAcquisitionPlan } from "./provider-acquisition-v1.mjs";

export const DATA_READINESS_VERSION = "scorecaster-data-readiness-v1";

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const ageMinutes = (value, now) => {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / 60000) : null;
};

function progress(value, target) {
  return {
    current: Math.max(0, finite(value)),
    target,
    ratio: Number(Math.min(1, Math.max(0, finite(value) / target)).toFixed(4)),
    remaining: Math.max(0, target - Math.max(0, finite(value)))
  };
}

export function buildDataReadiness(input = {}, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const acquisition = input.acquisition || buildProviderAcquisitionPlan();
  const captureAge = ageMinutes(input.marketCapture?.latestRun?.completed_at || input.marketCapture?.latestRun?.started_at, now);
  const captureEnabled = input.marketCapture?.workerEnabled !== false;
  const captureStatus = !captureEnabled
    ? "worker-disabled"
    : !input.marketCapture?.latestRun
      ? "awaiting-first-run"
      : !["success", "partial"].includes(input.marketCapture.latestRun.status)
        ? "degraded"
        : captureAge !== null && captureAge > 90
          ? "stale"
          : "healthy";

  const provider = input.liveMonitor?.provider || {};
  const latestLiveAge = ageMinutes(input.liveMonitor?.latestSnapshot?.captured_at, now);
  const liveStatus = !provider.contractReady
    ? provider.configured ? "contract-blocked" : "provider-required"
    : finite(input.liveMonitor?.snapshots24h) <= 0
      ? "awaiting-first-snapshot"
      : latestLiveAge !== null && latestLiveAge > 10
        ? "stale"
        : "healthy";

  const settled = progress(input.shadowLearning?.settledCount, 300);
  const clv = progress(input.shadowLearning?.clvCount, 100);
  const reviewReady = finite(input.shadowLearning?.reviewReadyCount) > 0 || input.shadowLearning?.latestCycle?.status === "challenger-review-ready";
  const shadowStatus = reviewReady ? "review-ready" : settled.current === 0 ? "awaiting-settled-paper-bets" : "collecting-evidence";
  const externalBlockers = acquisition.providerGapCount + (provider.contractReady ? 0 : 1);

  return {
    version: DATA_READINESS_VERSION,
    status: captureStatus === "healthy" ? "operational-with-external-gaps" : "degraded",
    generatedAt: new Date(now).toISOString(),
    marketCapture: {
      status: captureStatus,
      workerEnabled: captureEnabled,
      snapshotCount: finite(input.marketCapture?.snapshotCount),
      latestRun: input.marketCapture?.latestRun || null,
      ageMinutes: captureAge === null ? null : Number(captureAge.toFixed(1))
    },
    providerAcquisition: acquisition,
    verifiedLiveMonitor: {
      status: liveStatus,
      provider,
      snapshots24h: finite(input.liveMonitor?.snapshots24h),
      latestRun: input.liveMonitor?.latestRun || null,
      latestSnapshot: input.liveMonitor?.latestSnapshot || null,
      latestSnapshotAgeMinutes: latestLiveAge === null ? null : Number(latestLiveAge.toFixed(1))
    },
    shadowLearning: {
      status: shadowStatus,
      settled,
      clv,
      reviewReady,
      reviewReadyCount: finite(input.shadowLearning?.reviewReadyCount),
      latestCycle: input.shadowLearning?.latestCycle || null,
      automaticPromotion: false
    },
    summary: {
      externalBlockers,
      providerGapMarkets: acquisition.providerGapCount,
      providerCapableMarkets: acquisition.providerCapableCount,
      marketCaptureOperational: captureStatus === "healthy",
      liveProviderContractReady: provider.contractReady === true,
      shadowReviewReady: reviewReady
    },
    safety: {
      personalDataReturned: false,
      secretsReturned: false,
      rawProviderPayloadReturned: false,
      syntheticMarketDataAllowed: false,
      automaticModelPromotion: false,
      realMoneyExecution: false,
      paperOnly: true
    }
  };
}
