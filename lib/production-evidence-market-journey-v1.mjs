import { VERIFIED_MARKET_JOURNEY_POLICY } from "./verified-market-journey-v1.mjs";

export const PRODUCTION_EVIDENCE_MARKET_JOURNEY_VERSION = "scorecaster-production-evidence-market-journey-v1";

const finiteTime = (value) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const clean = (value) => String(value || "").trim();
const round = (value, digits = 2) => {
  if (!Number.isFinite(Number(value))) return 0;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
};

function snapshotIdentity(row = {}) {
  const eventId = clean(row.eventId || row.event_id);
  const selection = clean(row.selection || row.selectionKey || row.selection_key);
  return eventId && selection ? `${eventId}\u0000${selection}` : null;
}

export function buildProductionEvidenceMarketJourneyV1(
  snapshots = [],
  { now = Date.now(), policy = VERIFIED_MARKET_JOURNEY_POLICY } = {}
) {
  const groups = new Map();

  for (const row of Array.isArray(snapshots) ? snapshots : []) {
    const key = snapshotIdentity(row);
    if (!key) continue;

    const captured = finiteTime(row.capturedAt || row.captured_at);
    const commence = finiteTime(row.commenceTime || row.commence_time);
    if (captured === null || commence === null) continue;
    if (commence <= now || captured >= commence) continue;

    const current = groups.get(key) || { captures: [] };
    current.captures.push(captured);
    groups.set(key, current);
  }

  let journeyReady = 0;
  let thinHistory = 0;
  let shortSpan = 0;
  let maxSnapshots = 0;
  let maxSpanMinutes = 0;

  for (const group of groups.values()) {
    const captures = [...new Set(group.captures)].sort((a, b) => a - b);
    const snapshotCount = captures.length;
    const spanMinutes = snapshotCount > 1
      ? Math.max(0, (captures[captures.length - 1] - captures[0]) / 60000)
      : 0;

    maxSnapshots = Math.max(maxSnapshots, snapshotCount);
    maxSpanMinutes = Math.max(maxSpanMinutes, spanMinutes);

    if (snapshotCount < policy.minimumSnapshots) thinHistory += 1;
    else if (spanMinutes < policy.minimumSpanMinutes) shortSpan += 1;
    else journeyReady += 1;
  }

  const futureEventSelections = groups.size;
  return {
    version: PRODUCTION_EVIDENCE_MARKET_JOURNEY_VERSION,
    futureEventSelections,
    journeyReady,
    readyRatePct: futureEventSelections > 0 ? round((journeyReady / futureEventSelections) * 100, 1) : 0,
    thinHistory,
    shortSpan,
    maxSnapshots,
    maxSpanMinutes: round(maxSpanMinutes, 2),
    thresholds: {
      minimumSnapshots: policy.minimumSnapshots,
      minimumSpanMinutes: policy.minimumSpanMinutes
    },
    chronology: {
      futureEventsOnly: true,
      pregameOnly: true,
      sameEventSelection: true
    },
    safety: {
      aggregateOnly: true,
      rawSnapshotsExposed: false,
      eventIdentifiersExposed: false,
      selectionsExposed: false,
      observationalOnly: true,
      probabilityChanged: false,
      decisionChanged: false,
      stakeChanged: false,
      paperOnly: true
    }
  };
}
