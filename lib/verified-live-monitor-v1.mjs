export const VERIFIED_LIVE_MONITOR_VERSION = "scorecaster-verified-live-monitor-v1";
export const VERIFIED_LIVE_AUDIT_VERSION = "scorecaster-live-audit-v1";

const SUPPORTED_SPORT_PREFIXES = ["soccer", "icehockey", "basketball", "baseball", "americanfootball"];
const SUPPORTED_MARKETS = new Set(["h2h", "spreads", "totals"]);
const STATUSES = new Set(["scheduled", "live", "paused", "suspended", "final", "postponed", "cancelled"]);
const STATUS_RANK = Object.freeze({ scheduled: 0, live: 1, paused: 1, suspended: 1, final: 2, postponed: 2, cancelled: 2 });
const TERMINAL = new Set(["final", "postponed", "cancelled"]);
const CLOCK_DIRECTIONS = new Set(["up", "down", "unknown"]);
const DEFAULT_FRESH_SECONDS = 90;
const DEFAULT_STALE_SECONDS = 180;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 4) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
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
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];

function supportedSport(value) {
  const sport = clean(value, 100).toLowerCase();
  return SUPPORTED_SPORT_PREFIXES.some((prefix) => sport === prefix || sport.startsWith(`${prefix}_`));
}

function normalizedProbabilities(value) {
  const source = object(value);
  const entries = Object.entries(source)
    .map(([key, raw]) => [clean(key, 80), finite(raw)])
    .filter(([key, probability]) => key && probability !== null && probability >= 0 && probability <= 1);
  if (!entries.length) return {};
  const total = entries.reduce((sum, [, probability]) => sum + probability, 0);
  if (total <= 0) return {};
  return Object.fromEntries(entries.map(([key, probability]) => [key, round(probability / total, 6)]));
}

function normalizedPrices(value) {
  return array(value).map((row) => ({
    bookmaker: clean(row?.bookmaker ?? row?.bookmakerKey, 120),
    market: clean(row?.market, 40).toLowerCase(),
    selection: clean(row?.selection, 160),
    price: finite(row?.price),
    available: row?.available !== false,
    observedAt: iso(row?.observedAt ?? row?.observed_at)
  })).filter((row) => row.bookmaker && SUPPORTED_MARKETS.has(row.market) && row.selection && row.price > 1 && row.observedAt);
}

function normalizeSnapshot(row = {}, index, options) {
  const generatedAt = options.generatedAt;
  const eventId = clean(row.event_id ?? row.eventId, 180);
  const sport = clean(row.sport, 100).toLowerCase();
  const market = clean(row.market || "h2h", 40).toLowerCase();
  const status = clean(row.status, 30).toLowerCase();
  const clockDirection = clean(row.clock_direction ?? row.clockDirection || "unknown", 20).toLowerCase();
  const observedAt = iso(row.observed_at ?? row.observedAt);
  const providerUpdatedAt = iso(row.provider_updated_at ?? row.providerUpdatedAt) || observedAt;
  const capturedAt = iso(row.captured_at ?? row.capturedAt) || observedAt;
  const kickoffAt = iso(row.commence_time ?? row.commenceTime ?? row.kickoff_at ?? row.kickoffAt);
  const errors = [];

  if (!eventId || (options.eventId && eventId !== options.eventId)) errors.push("event-id-mismatch");
  if (!supportedSport(sport)) errors.push("unsupported-sport");
  if (!SUPPORTED_MARKETS.has(market)) errors.push("unsupported-market");
  if (!STATUSES.has(status)) errors.push("unsupported-status");
  if (!CLOCK_DIRECTIONS.has(clockDirection)) errors.push("unsupported-clock-direction");
  if (!observedAt || !providerUpdatedAt || !capturedAt) errors.push("missing-timestamp");
  for (const value of [observedAt, providerUpdatedAt, capturedAt]) {
    if (value && Date.parse(value) > Date.parse(generatedAt) + 5000) errors.push("future-timestamp");
  }

  const homeScore = finite(row.home_score ?? row.homeScore);
  const awayScore = finite(row.away_score ?? row.awayScore);
  const period = finite(row.period);
  const clockSeconds = finite(row.clock_seconds ?? row.clockSeconds);
  if (homeScore === null || homeScore < 0 || awayScore === null || awayScore < 0) errors.push("invalid-score");
  if (period !== null && period < 0) errors.push("invalid-period");
  if (clockSeconds !== null && clockSeconds < 0) errors.push("invalid-clock");
  if (status === "scheduled" && (homeScore > 0 || awayScore > 0 || period > 0)) errors.push("scheduled-state-has-live-values");

  const providerId = clean(row.provider_id ?? row.providerId, 100).toLowerCase();
  const sourceId = clean(row.source_id ?? row.sourceId, 100).toLowerCase();
  if (!providerId) errors.push("missing-provider-id");
  if (!sourceId) errors.push("missing-source-id");

  const freshnessSeconds = providerUpdatedAt
    ? Math.max(0, (Date.parse(generatedAt) - Date.parse(providerUpdatedAt)) / 1000)
    : null;
  const freshness = freshnessSeconds === null
    ? "unknown"
    : freshnessSeconds <= options.freshSeconds
      ? "fresh"
      : freshnessSeconds <= options.staleSeconds
        ? "delayed"
        : "stale";

  const id = clean(row.id, 100) || `${eventId}:${providerId}:${observedAt || index}`;
  return {
    id,
    eventId,
    sport,
    league: clean(row.league, 140) || null,
    market,
    providerId,
    sourceId,
    status,
    period: period === null ? null : Math.round(period),
    clockSeconds: clockSeconds === null ? null : Math.round(clockSeconds),
    clockDirection,
    homeScore: homeScore === null ? null : Math.round(homeScore),
    awayScore: awayScore === null ? null : Math.round(awayScore),
    homeTeam: clean(row.home_team ?? row.homeTeam, 140) || null,
    awayTeam: clean(row.away_team ?? row.awayTeam, 140) || null,
    kickoffAt,
    observedAt,
    providerUpdatedAt,
    capturedAt,
    correction: row.correction === true,
    correctionReason: clean(row.correction_reason ?? row.correctionReason, 300) || null,
    supersedesId: clean(row.supersedes_id ?? row.supersedesId, 100) || null,
    metrics: object(row.metrics),
    prices: normalizedPrices(row.prices),
    liveProbabilities: normalizedProbabilities(row.live_probabilities ?? row.liveProbabilities),
    liveModelVersion: clean(row.live_model_version ?? row.liveModelVersion, 120) || null,
    freshnessSeconds: round(freshnessSeconds, 1),
    freshness,
    errors: [...new Set(errors)]
  };
}

function removeSuperseded(rows) {
  const superseded = new Set(rows.map((row) => row.supersedesId).filter(Boolean));
  return rows.filter((row) => !superseded.has(row.id));
}

function stateRegressed(previous, current) {
  if (!previous || !current) return false;
  if (STATUS_RANK[current.status] < STATUS_RANK[previous.status]) return true;
  if (TERMINAL.has(previous.status) && current.status !== previous.status) return true;
  if ((current.homeScore ?? 0) < (previous.homeScore ?? 0) || (current.awayScore ?? 0) < (previous.awayScore ?? 0)) return true;
  if (current.period !== null && previous.period !== null && current.period < previous.period) return true;
  if (current.period === previous.period && current.clockSeconds !== null && previous.clockSeconds !== null) {
    if (current.clockDirection === "up" && current.clockSeconds < previous.clockSeconds) return true;
    if (current.clockDirection === "down" && current.clockSeconds > previous.clockSeconds) return true;
  }
  return false;
}

function providerTimelines(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.providerId)) groups.set(row.providerId, []);
    groups.get(row.providerId).push(row);
  }
  const accepted = [];
  const regressions = [];
  const corrections = [];
  for (const [providerId, source] of groups) {
    const ordered = [...source].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    let previous = null;
    for (const row of ordered) {
      if (stateRegressed(previous, row)) {
        if (row.correction && row.supersedesId && row.correctionReason) {
          corrections.push({ providerId, snapshotId: row.id, supersedesId: row.supersedesId, reason: row.correctionReason });
          accepted.push(row);
          previous = row;
        } else {
          regressions.push({ providerId, snapshotId: row.id, previousId: previous?.id || null, reason: "state-moved-backwards-without-correction" });
        }
        continue;
      }
      accepted.push(row);
      previous = row;
    }
  }
  return { accepted, regressions, corrections };
}

function latestPerProvider(rows) {
  const result = new Map();
  for (const row of rows) {
    const previous = result.get(row.providerId);
    if (!previous || Date.parse(row.observedAt) > Date.parse(previous.observedAt)) result.set(row.providerId, row);
  }
  return [...result.values()];
}

function stateKey(row) {
  return [row.status, row.period ?? "x", row.clockSeconds ?? "x", row.homeScore, row.awayScore].join("|");
}

function resolveCurrent(rows) {
  const fresh = rows.filter((row) => row.freshness === "fresh");
  const usable = fresh.length ? fresh : rows.filter((row) => row.freshness === "delayed");
  if (!usable.length) return { accepted: null, conflict: null, usable, fresh };
  const groups = new Map();
  for (const row of usable) {
    const key = stateKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const ordered = [...groups.entries()].sort((left, right) => right[1].length - left[1].length || Date.parse(right[1][0].observedAt) - Date.parse(left[1][0].observedAt));
  const leader = ordered[0];
  const challenger = ordered[1];
  const majority = leader[1].length > usable.length / 2;
  const materialConflict = Boolean(challenger && !majority);
  if (materialConflict) {
    return {
      accepted: null,
      usable,
      fresh,
      conflict: {
        reason: "provider-state-conflict",
        providers: usable.map((row) => row.providerId),
        states: ordered.map(([key, group]) => ({ key, providerCount: group.length, providers: group.map((row) => row.providerId) }))
      }
    };
  }
  const representative = [...leader[1]].sort((a, b) => Date.parse(b.providerUpdatedAt) - Date.parse(a.providerUpdatedAt))[0];
  return {
    accepted: {
      ...representative,
      supportingProviders: leader[1].map((row) => row.providerId),
      providerCount: leader[1].length,
      agreementShare: round(leader[1].length / usable.length)
    },
    usable,
    fresh,
    conflict: null
  };
}

function probabilityConsensus(rows) {
  const labels = [...new Set(rows.flatMap((row) => Object.keys(row.liveProbabilities || {})))];
  if (!labels.length) return null;
  const probabilities = {};
  const providerCounts = {};
  for (const label of labels) {
    const values = rows.map((row) => finite(row.liveProbabilities?.[label])).filter((value) => value !== null);
    if (values.length) {
      probabilities[label] = round(values.reduce((sum, value) => sum + value, 0) / values.length, 6);
      providerCounts[label] = values.length;
    }
  }
  const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;
  return {
    probabilities: Object.fromEntries(Object.entries(probabilities).map(([label, value]) => [label, round(value / total, 6)])),
    providerCounts,
    source: "live-provider-consensus",
    independentPreMatchModel: false,
    modelVersion: "live-provider-consensus-v1"
  };
}

function probabilityMovement(previous, current) {
  if (!previous || !current) return null;
  let maximum = 0;
  let label = null;
  for (const [key, value] of Object.entries(current.probabilities || {})) {
    const before = finite(previous.probabilities?.[key]);
    if (before === null) continue;
    const delta = value - before;
    if (Math.abs(delta) > Math.abs(maximum)) {
      maximum = delta;
      label = key;
    }
  }
  return label ? { label, delta: round(maximum, 6) } : null;
}

function alert(id, severity, title, message, evidence, generatedAt) {
  return {
    id,
    severity,
    title,
    message,
    evidenceIds: [...new Set(evidence.map((item) => item.id).filter(Boolean))],
    providers: [...new Set(evidence.map((item) => item.providerId).filter(Boolean))],
    evidenceObservedAt: evidence.map((item) => item.observedAt).filter(Boolean).sort().at(-1) || null,
    providerFreshness: Object.fromEntries(evidence.filter((item) => item.providerId).map((item) => [item.providerId, item.freshness])),
    generatedAt,
    actionMode: "informational-paper-only",
    realMoneyInstruction: false,
    realMoneyExecution: false
  };
}

function buildAlerts(timeline, current, resolution, regressions, corrections, generatedAt) {
  const alerts = [];
  const previous = timeline.length >= 2 ? timeline.at(-2) : null;
  const latest = timeline.at(-1) || null;

  if (resolution.conflict) alerts.push(alert("provider-conflict", "high", "Live event suspended", "Providers disagree on the current event state. Live interpretation is suspended until the conflict resolves.", resolution.usable, generatedAt));
  if (!resolution.fresh.length && resolution.usable.length) alerts.push(alert("provider-delay", "medium", "Live feed delayed", "No provider is inside the fresh-data threshold. Displayed evidence is delayed and cannot support a confident live interpretation.", resolution.usable, generatedAt));
  const stale = latestPerProvider(timeline).filter((row) => row.freshness === "stale");
  if (stale.length) alerts.push(alert("provider-stale", "medium", "Provider feed stale", `${stale.length} provider feed(s) exceeded the stale threshold.`, stale, generatedAt));
  if (regressions.length) alerts.push(alert("invalid-regression", "high", "Invalid backward event state rejected", `${regressions.length} state update(s) moved backwards without a visible correction and were excluded.`, timeline.filter((row) => regressions.some((item) => item.snapshotId === row.id)), generatedAt));
  if (corrections.length) alerts.push(alert("visible-correction", "info", "Provider correction recorded", `${corrections.length} correction event(s) superseded earlier evidence without rewriting history.`, timeline.filter((row) => corrections.some((item) => item.snapshotId === row.id)), generatedAt));

  if (current && previous) {
    if (previous.status === "scheduled" && current.status === "live") alerts.push(alert("event-started", "info", "Event started", "A fresh provider majority confirms that the event is live.", [current], generatedAt));
    if (current.homeScore !== previous.homeScore || current.awayScore !== previous.awayScore) alerts.push(alert("score-changed", "info", "Verified score change", `Score changed to ${current.homeScore}–${current.awayScore}.`, [previous, current], generatedAt));
    if (current.period !== previous.period) alerts.push(alert("period-changed", "info", "Verified period change", `Event period changed from ${previous.period ?? "unknown"} to ${current.period ?? "unknown"}.`, [previous, current], generatedAt));
    if (current.status === "final" && previous.status !== "final") alerts.push(alert("event-final", "info", "Event final", "A fresh provider majority confirms the event has ended.", [current], generatedAt));
  }

  return alerts;
}

export function buildVerifiedLiveMonitor(input = {}, configuration = {}) {
  const generatedAt = iso(input.generatedAt) || new Date().toISOString();
  const eventId = clean(input.eventId, 180);
  const freshSeconds = clamp(Math.round(finite(configuration.freshSeconds) ?? DEFAULT_FRESH_SECONDS), 15, 600);
  const staleSeconds = clamp(Math.round(finite(configuration.staleSeconds) ?? DEFAULT_STALE_SECONDS), freshSeconds + 1, 3600);
  if (!eventId) return { ok: false, version: VERIFIED_LIVE_MONITOR_VERSION, reason: "missing-event-id", paperOnly: true };

  const normalized = array(input.snapshots).slice(0, 10000).map((row, index) => normalizeSnapshot(row, index, { eventId, generatedAt, freshSeconds, staleSeconds }));
  const rejected = normalized.filter((row) => row.errors.length);
  const eligible = removeSuperseded(normalized.filter((row) => !row.errors.length));
  const integrity = providerTimelines(eligible);
  const timeline = integrity.accepted.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const latest = latestPerProvider(timeline);
  const resolution = resolveCurrent(latest);
  const current = resolution.accepted;

  const chronologicalConsensus = timeline.map((row, index) => {
    const cutoff = Date.parse(row.observedAt);
    const available = latestPerProvider(timeline.slice(0, index + 1).filter((item) => Date.parse(item.observedAt) <= cutoff && item.freshness !== "stale"));
    const consensus = probabilityConsensus(available);
    return consensus ? { observedAt: row.observedAt, ...consensus } : null;
  }).filter(Boolean);
  const liveProbability = probabilityConsensus(resolution.usable);
  const previousProbability = chronologicalConsensus.length >= 2 ? chronologicalConsensus.at(-2) : null;
  const movement = probabilityMovement(previousProbability, liveProbability);
  const alerts = buildAlerts(timeline, current, resolution, integrity.regressions, integrity.corrections, generatedAt);
  if (movement && Math.abs(movement.delta) >= 0.05 && resolution.fresh.length >= 2) {
    alerts.push(alert("live-probability-move", "medium", "Verified live probability movement", `${movement.label} moved ${movement.delta >= 0 ? "+" : ""}${(movement.delta * 100).toFixed(1)} percentage points across fresh provider evidence.`, resolution.fresh, generatedAt));
  }

  const suspended = Boolean(resolution.conflict || !current || current.freshness === "stale");
  return {
    ok: true,
    version: VERIFIED_LIVE_MONITOR_VERSION,
    auditVersion: VERIFIED_LIVE_AUDIT_VERSION,
    generatedAt,
    eventId,
    sport: current?.sport || timeline.at(-1)?.sport || null,
    league: current?.league || timeline.at(-1)?.league || null,
    status: suspended ? "suspended" : current.status,
    suspended,
    suspensionReason: resolution.conflict?.reason || (!current ? "no-current-verified-state" : current.freshness === "stale" ? "current-state-stale" : null),
    current: current ? {
      status: current.status,
      period: current.period,
      clockSeconds: current.clockSeconds,
      clockDirection: current.clockDirection,
      homeScore: current.homeScore,
      awayScore: current.awayScore,
      homeTeam: current.homeTeam,
      awayTeam: current.awayTeam,
      observedAt: current.observedAt,
      providerUpdatedAt: current.providerUpdatedAt,
      freshness: current.freshness,
      providerCount: current.providerCount,
      supportingProviders: current.supportingProviders,
      agreementShare: current.agreementShare
    } : null,
    providers: latest.map((row) => ({
      providerId: row.providerId,
      sourceId: row.sourceId,
      status: row.status,
      period: row.period,
      clockSeconds: row.clockSeconds,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      providerUpdatedAt: row.providerUpdatedAt,
      freshnessSeconds: row.freshnessSeconds,
      freshness: row.freshness
    })),
    liveProbability: liveProbability ? {
      ...liveProbability,
      movement,
      separatedFromPreMatchAudit: true,
      usableForPreMatchFeatures: false
    } : null,
    alerts,
    timeline: timeline.map((row) => ({
      id: row.id,
      providerId: row.providerId,
      sourceId: row.sourceId,
      status: row.status,
      period: row.period,
      clockSeconds: row.clockSeconds,
      clockDirection: row.clockDirection,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      observedAt: row.observedAt,
      providerUpdatedAt: row.providerUpdatedAt,
      freshness: row.freshness,
      correction: row.correction,
      correctionReason: row.correctionReason,
      supersedesId: row.supersedesId,
      metrics: row.metrics,
      prices: row.prices,
      liveProbabilities: row.liveProbabilities,
      liveModelVersion: row.liveModelVersion
    })),
    rejected: rejected.map((row) => ({ id: row.id, providerId: row.providerId, errors: row.errors })),
    integrity: {
      regressions: integrity.regressions,
      corrections: integrity.corrections,
      providerConflict: resolution.conflict,
      freshProviderCount: resolution.fresh.length,
      usableProviderCount: resolution.usable.length,
      thresholds: { freshSeconds, staleSeconds }
    },
    boundaries: {
      preMatchAuditChanged: false,
      preMatchModelFeaturesChanged: false,
      liveAndPreMatchVersionsSeparate: true,
      alertsInformationalOnly: true,
      stakeSuggested: false,
      bookmakerAccountAccess: false,
      realMoneyInstruction: false,
      realMoneyExecution: false,
      unsupportedSportsDisabled: true,
      unsupportedMarketsDisabled: true,
      rawProviderPayloadReturned: false,
      paperOnly: true
    }
  };
}
