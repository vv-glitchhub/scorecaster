import {
  buildVerifiedLiveMonitor as buildBaseMonitor,
  VERIFIED_LIVE_AUDIT_VERSION
} from "./verified-live-monitor-v1.mjs";

export const VERIFIED_LIVE_MONITOR_VERSION = "scorecaster-verified-live-monitor-v1.1";
export { VERIFIED_LIVE_AUDIT_VERSION };

const VALID_STATUSES = new Set(["scheduled", "live", "paused", "suspended", "final", "postponed", "cancelled"]);
const VALID_CLOCK_DIRECTIONS = new Set(["up", "down", "unknown"]);
const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);
const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];

function auditRow(row, eventId, generatedAt, index) {
  const rowEventId = clean(row.event_id ?? row.eventId, 180);
  const observedAt = iso(row.observed_at ?? row.observedAt);
  const status = clean(row.status, 30).toLowerCase();
  const providerId = clean(row.provider_id ?? row.providerId, 100).toLowerCase();
  const homeScore = finite(row.home_score ?? row.homeScore);
  const awayScore = finite(row.away_score ?? row.awayScore);
  const errors = [];
  if (!rowEventId || rowEventId !== eventId) errors.push("event-id-mismatch");
  if (!observedAt || Date.parse(observedAt) > Date.parse(generatedAt) + 5000) errors.push("invalid-observed-at");
  if (!VALID_STATUSES.has(status)) errors.push("unsupported-status");
  if (!providerId) errors.push("missing-provider-id");
  if (homeScore === null || homeScore < 0 || awayScore === null || awayScore < 0) errors.push("invalid-score");
  if (errors.length) return null;

  const correction = row.correction === true;
  const correctionReason = clean(row.correction_reason ?? row.correctionReason, 300) || null;
  const supersedesId = clean(row.supersedes_id ?? row.supersedesId, 180) || null;
  if (correction && (!correctionReason || !supersedesId)) return null;
  const clockDirection = clean(row.clock_direction ?? row.clockDirection || "unknown", 20).toLowerCase();
  return {
    id: clean(row.id, 180) || `${rowEventId}:${providerId}:${observedAt}:${index}`,
    providerId,
    sourceId: clean(row.source_id ?? row.sourceId, 100).toLowerCase() || null,
    status,
    period: finite(row.period),
    clockSeconds: finite(row.clock_seconds ?? row.clockSeconds),
    clockDirection: VALID_CLOCK_DIRECTIONS.has(clockDirection) ? clockDirection : "unknown",
    homeScore: Math.round(homeScore),
    awayScore: Math.round(awayScore),
    observedAt,
    providerUpdatedAt: iso(row.provider_updated_at ?? row.providerUpdatedAt) || observedAt,
    freshness: clean(row.freshness, 30) || null,
    correction,
    correctionReason,
    supersedesId,
    metrics: object(row.metrics),
    prices: array(row.prices),
    liveProbabilities: object(row.live_probabilities ?? row.liveProbabilities),
    liveModelVersion: clean(row.live_model_version ?? row.liveModelVersion, 120) || null
  };
}

function correctionAlert(corrections, generatedAt) {
  if (!corrections.length) return null;
  const latest = corrections.at(-1);
  return {
    id: "visible-correction",
    severity: "info",
    title: "Provider correction recorded",
    message: `${corrections.length} correction event(s) superseded earlier evidence without rewriting history.`,
    evidenceIds: corrections.map((row) => row.id),
    providers: [...new Set(corrections.map((row) => row.providerId))],
    evidenceObservedAt: latest.observedAt,
    providerFreshness: Object.fromEntries(corrections.map((row) => [row.providerId, row.freshness || "unknown"])),
    generatedAt,
    actionMode: "informational-paper-only",
    realMoneyInstruction: false,
    realMoneyExecution: false
  };
}

export function buildVerifiedLiveMonitor(input = {}, configuration = {}) {
  const generatedAt = iso(input.generatedAt) || new Date().toISOString();
  const eventId = clean(input.eventId, 180);
  const base = buildBaseMonitor({ ...input, generatedAt }, configuration);
  if (!base.ok || !eventId) return base;

  const appendOnlyTimeline = array(input.snapshots)
    .map((row, index) => auditRow(row, eventId, generatedAt, index))
    .filter(Boolean)
    .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
  const corrections = appendOnlyTimeline.filter((row) => row.correction);
  const alerts = [...array(base.alerts)];
  const visibleCorrection = correctionAlert(corrections, generatedAt);
  if (visibleCorrection && !alerts.some((alert) => alert.id === "visible-correction")) alerts.push(visibleCorrection);

  return {
    ...base,
    version: VERIFIED_LIVE_MONITOR_VERSION,
    baseVersion: base.version,
    generatedAt,
    timeline: appendOnlyTimeline,
    alerts,
    integrity: {
      ...base.integrity,
      corrections: corrections.map((row) => ({
        providerId: row.providerId,
        snapshotId: row.id,
        supersedesId: row.supersedesId,
        reason: row.correctionReason
      })),
      appendOnlyTimelineRows: appendOnlyTimeline.length,
      supersededRowsRetainedInAudit: corrections.every((correction) => appendOnlyTimeline.some((row) => row.id === correction.supersedesId))
    },
    boundaries: {
      ...base.boundaries,
      historyRewritten: false,
      appendOnlyCorrectionAudit: true,
      supersededEvidenceRetained: true
    }
  };
}
