export const VERIFIED_MARKET_JOURNEY_VERSION = "scorecaster-verified-market-journey-v1";

export const VERIFIED_MARKET_JOURNEY_POLICY = Object.freeze({
  minimumSnapshots: 3,
  minimumSpanMinutes: 30,
  requiresSameEventSelection: true,
  requiresChronologySafePregameHistory: true,
  externalProviderRequestMade: false,
  probabilityChanged: false,
  decisionChanged: false,
  stakeChanged: false,
  paperOnly: true
});

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveOdds(value) {
  const parsed = finite(value);
  return parsed !== null && parsed > 1.001 && parsed < 1000 ? Number(parsed.toFixed(4)) : null;
}

function boundedInteger(value, maximum = 160) {
  const parsed = finite(value);
  return parsed === null ? null : Math.max(0, Math.min(maximum, Math.trunc(parsed)));
}

function clean(value, maximum = 100) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function iso(value) {
  if (!value) return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function buildVerifiedMarketJourneyV1(history = {}) {
  const source = clean(history?.source, 80) || "scorecaster-market-history";
  const mode = clean(history?.mode, 60) || "unavailable";
  const snapshotCount = boundedInteger(history?.snapshotCount);
  const spanMinutesRaw = finite(history?.spanMinutes);
  const spanMinutes = spanMinutesRaw === null ? null : Number(Math.max(0, spanMinutesRaw).toFixed(2));
  const openingOdds = positiveOdds(history?.openingOdds);
  const currentOdds = positiveOdds(history?.currentOdds);
  const movementRaw = finite(history?.movementPct);
  const movementPct = movementRaw === null ? null : Number(Math.max(-99.9, Math.min(10000, movementRaw)).toFixed(4));
  const chronologySafe = history?.chronologySafe === true;
  const sameEventSelection = history?.sameEventSelection === true;

  const ready = history?.ok === true
    && source === "scorecaster-market-history"
    && mode === "live"
    && chronologySafe
    && sameEventSelection
    && snapshotCount !== null
    && snapshotCount >= VERIFIED_MARKET_JOURNEY_POLICY.minimumSnapshots
    && spanMinutes !== null
    && spanMinutes >= VERIFIED_MARKET_JOURNEY_POLICY.minimumSpanMinutes
    && openingOdds !== null
    && currentOdds !== null
    && movementPct !== null;

  return {
    version: VERIFIED_MARKET_JOURNEY_VERSION,
    status: ready ? "ready" : "unavailable",
    source,
    mode,
    snapshotCount,
    openingOdds: ready ? openingOdds : null,
    currentOdds: ready ? currentOdds : null,
    movementPct: ready ? movementPct : null,
    spanMinutes: ready ? spanMinutes : null,
    openingCapturedAt: ready ? iso(history?.openingCapturedAt) : null,
    latestHistoricalCapturedAt: ready ? iso(history?.latestHistoricalCapturedAt) : null,
    chronologySafe: ready,
    sameEventSelection: ready,
    externalProviderRequestMade: false,
    probabilityChanged: false,
    decisionChanged: false,
    stakeChanged: false,
    paperOnly: true
  };
}
