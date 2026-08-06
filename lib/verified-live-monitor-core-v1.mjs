export const VERIFIED_LIVE_MONITOR_VERSION = "scorecaster-verified-live-monitor-core-v1";
export const VERIFIED_LIVE_AUDIT_VERSION = "scorecaster-live-audit-v1";

const SPORT_PREFIXES = ["soccer", "icehockey", "basketball", "baseball", "americanfootball"];
const MARKETS = new Set(["h2h", "spreads", "totals"]);
const STATUSES = new Set(["scheduled", "live", "paused", "suspended", "final", "postponed", "cancelled"]);
const STATUS_RANK = Object.freeze({ scheduled: 0, live: 1, paused: 1, suspended: 1, final: 2, postponed: 2, cancelled: 2 });
const TERMINAL = new Set(["final", "postponed", "cancelled"]);
const CLOCK_DIRECTIONS = new Set(["up", "down", "unknown"]);

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
const supportedSport = (sport) => SPORT_PREFIXES.some((prefix) => sport === prefix || sport.startsWith(`${prefix}_`));

function normalizedProbabilities(value) {
  const entries = Object.entries(object(value))
    .map(([label, raw]) => [clean(label, 80), finite(raw)])
    .filter(([label, probability]) => label && probability !== null && probability >= 0 && probability <= 1);
  const total = entries.reduce((sum, [, probability]) => sum + probability, 0);
  if (!entries.length || total <= 0) return {};
  return Object.fromEntries(entries.map(([label, probability]) => [label, round(probability / total, 6)]));
}

function normalizedPrices(value) {
  return array(value).map((row) => ({
    bookmaker: clean(row?.bookmaker ?? row?.bookmakerKey, 120),
    market: clean(row?.market, 40).toLowerCase(),
    selection: clean(row?.selection, 160),
    price: finite(row?.price),
    available: row?.available !== false,
    observedAt: iso(row?.observedAt ?? row?.observed_at)
  })).filter((row) => row.bookmaker && MARKETS.has(row.market) && row.selection && row.price > 1 && row.observedAt);
}

function normalizeSnapshot(row, index, options) {
  const eventId = clean(row.event_id ?? row.eventId, 180);
  const sport = clean(row.sport, 100).toLowerCase();
  const market = clean(row.market || "h2h", 40).toLowerCase();
  const providerId = clean(row.provider_id ?? row.providerId, 100).toLowerCase();
  const sourceId = clean(row.source_id ?? row.sourceId, 100).toLowerCase();
  const status = clean(row.status, 30).toLowerCase();
  const clockDirection = clean((row.clock_direction ?? row.clockDirection) || "unknown", 20).toLowerCase();
  const observedAt = iso(row.observed_at ?? row.observedAt);
  const providerUpdatedAt = iso(row.provider_updated_at ?? row.providerUpdatedAt) || observedAt;
  const capturedAt = iso(row.captured_at ?? row.capturedAt) || observedAt;
  const homeScore = finite(row.home_score ?? row.homeScore);
  const awayScore = finite(row.away_score ?? row.awayScore);
  const period = finite(row.period);
  const clockSeconds = finite(row.clock_seconds ?? row.clockSeconds);
  const correction = row.correction === true;
  const correctionReason = clean(row.correction_reason ?? row.correctionReason, 300) || null;
  const supersedesId = clean(row.supersedes_id ?? row.supersedesId, 180) || null;
  const errors = [];

  if (!eventId || eventId !== options.eventId) errors.push("event-id-mismatch");
  if (!supportedSport(sport)) errors.push("unsupported-sport");
  if (!MARKETS.has(market)) errors.push("unsupported-market");
  if (!providerId) errors.push("missing-provider-id");
  if (!sourceId) errors.push("missing-source-id");
  if (!STATUSES.has(status)) errors.push("unsupported-status");
  if (!CLOCK_DIRECTIONS.has(clockDirection)) errors.push("unsupported-clock-direction");
  if (!observedAt || !providerUpdatedAt || !capturedAt) errors.push("missing-timestamp");
  for (const timestamp of [observedAt, providerUpdatedAt, capturedAt]) {
    if (timestamp && Date.parse(timestamp) > Date.parse(options.generatedAt) + 5000) errors.push("future-timestamp");
  }
  if (homeScore === null || homeScore < 0 || awayScore === null || awayScore < 0) errors.push("invalid-score");
  if (period !== null && period < 0) errors.push("invalid-period");
  if (clockSeconds !== null && clockSeconds < 0) errors.push("invalid-clock");
  if (status === "scheduled" && ((homeScore ?? 0) > 0 || (awayScore ?? 0) > 0 || (period ?? 0) > 0)) errors.push("scheduled-state-has-live-values");
  if (correction && (!correctionReason || !supersedesId)) errors.push("invalid-correction");

  const ageSeconds = providerUpdatedAt
    ? Math.max(0, (Date.parse(options.generatedAt) - Date.parse(providerUpdatedAt)) / 1000)
    : null;
  const freshness = ageSeconds === null
    ? "unknown"
    : ageSeconds <= options.freshSeconds
      ? "fresh"
      : ageSeconds <= options.staleSeconds
        ? "delayed"
        : "stale";

  return {
    id: clean(row.id, 180) || `${eventId || "event"}:${providerId || "provider"}:${observedAt || index}`,
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
    homeTeam: clean(row.home_team ?? row.homeTeam, 140) || null,
    awayTeam: clean(row.away_team ?? row.awayTeam, 140) || null,
    homeScore: homeScore === null ? null : Math.round(homeScore),
    awayScore: awayScore === null ? null : Math.round(awayScore),
    kickoffAt: iso(row.commence_time ?? row.commenceTime ?? row.kickoff_at ?? row.kickoffAt),
    observedAt,
    providerUpdatedAt,
    capturedAt,
    correction,
    correctionReason,
    supersedesId,
    metrics: object(row.metrics),
    prices: normalizedPrices(row.prices),
    liveProbabilities: normalizedProbabilities(row.live_probabilities ?? row.liveProbabilities),
    liveModelVersion: clean(row.live_model_version ?? row.liveModelVersion, 120) || null,
    freshnessSeconds: round(ageSeconds, 1),
    freshness,
    errors: [...new Set(errors)]
  };
}

function stateRegressed(previous, current) {
  if (!previous) return false;
  if (STATUS_RANK[current.status] < STATUS_RANK[previous.status]) return true;
  if (TERMINAL.has(previous.status) && current.status !== previous.status) return true;
  if (current.homeScore < previous.homeScore || current.awayScore < previous.awayScore) return true;
  if (current.period !== null && previous.period !== null && current.period < previous.period) return true;
  if (current.period === previous.period && current.clockSeconds !== null && previous.clockSeconds !== null) {
    if (current.clockDirection === "up" && current.clockSeconds < previous.clockSeconds) return true;
    if (current.clockDirection === "down" && current.clockSeconds > previous.clockSeconds) return true;
  }
  return false;
}

function validateProviderTimelines(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.providerId)) groups.set(row.providerId, []);
    groups.get(row.providerId).push(row);
  }
  const accepted = [];
  const regressions = [];
  const corrections = [];

  for (const [providerId, providerRows] of groups) {
    const ordered = [...providerRows].sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
    let previous = null;
    for (const row of ordered) {
      const regressed = stateRegressed(previous, row);
      if (regressed && !row.correction) {
        regressions.push({ providerId, snapshotId: row.id, previousId: previous?.id || null, reason: "state-moved-backwards-without-correction" });
        continue;
      }
      if (row.correction) {
        corrections.push({ providerId, snapshotId: row.id, supersedesId: row.supersedesId, reason: row.correctionReason });
      }
      accepted.push(row);
      previous = row;
    }
  }
  return { accepted, regressions, corrections };
}

function latestRows(rows) {
  const latest = new Map();
  for (const row of rows) {
    const previous = latest.get(row.providerId);
    if (!previous || Date.parse(row.observedAt) > Date.parse(previous.observedAt)) latest.set(row.providerId, row);
  }
  return [...latest.values()];
}

function previousRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.providerId)) groups.set(row.providerId, []);
    groups.get(row.providerId).push(row);
  }
  const previous = [];
  for (const providerRows of groups.values()) {
    const ordered = [...providerRows].sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
    if (ordered.length >= 2) previous.push(ordered.at(-2));
  }
  return previous;
}

function stateKey(row) {
  return [row.status, row.period ?? "x", row.clockSeconds ?? "x", row.homeScore, row.awayScore].join("|");
}

function resolveProviderState(rows) {
  const fresh = rows.filter((row) => row.freshness === "fresh");
  const delayed = rows.filter((row) => row.freshness === "delayed");
  const usable = fresh.length ? fresh : delayed;
  if (!usable.length) return { current: null, conflict: null, fresh, usable };

  const groups = new Map();
  for (const row of usable) {
    const key = stateKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const ranked = [...groups.entries()].sort((left, right) => right[1].length - left[1].length);
  const [leaderKey, leaderRows] = ranked[0];
  if (leaderRows.length <= usable.length / 2) {
    return {
      current: null,
      fresh,
      usable,
      conflict: {
        reason: "provider-state-conflict",
        providers: usable.map((row) => row.providerId),
        states: ranked.map(([key, group]) => ({ key, providerCount: group.length, providers: group.map((row) => row.providerId) }))
      }
    };
  }
  const representative = [...leaderRows].sort((left, right) => Date.parse(right.providerUpdatedAt) - Date.parse(left.providerUpdatedAt))[0];
  return {
    current: {
      ...representative,
      stateKey: leaderKey,
      providerCount: leaderRows.length,
      supportingProviders: leaderRows.map((row) => row.providerId),
      agreementShare: round(leaderRows.length / usable.length)
    },
    conflict: null,
    fresh,
    usable
  };
}

function probabilityConsensus(rows) {
  if (!rows.length) return null;
  const labels = [...new Set(rows.flatMap((row) => Object.keys(row.liveProbabilities || {})))];
  if (!labels.length) return null;
  const values = {};
  const providerCounts = {};
  for (const label of labels) {
    const probabilities = rows.map((row) => finite(row.liveProbabilities?.[label])).filter((value) => value !== null);
    if (!probabilities.length) continue;
    values[label] = probabilities.reduce((sum, probability) => sum + probability, 0) / probabilities.length;
    providerCounts[label] = probabilities.length;
  }
  const total = Object.values(values).reduce((sum, probability) => sum + probability, 0);
  if (total <= 0) return null;
  return {
    probabilities: Object.fromEntries(Object.entries(values).map(([label, probability]) => [label, round(probability / total, 6)])),
    providerCounts,
    source: "live-provider-consensus",
    independentPreMatchModel: false,
    modelVersion: "live-provider-consensus-v1"
  };
}

function probabilityMovement(previous, current) {
  if (!previous || !current) return null;
  let strongest = null;
  for (const [label, probability] of Object.entries(current.probabilities)) {
    const before = finite(previous.probabilities?.[label]);
    if (before === null) continue;
    const delta = probability - before;
    if (!strongest || Math.abs(delta) > Math.abs(strongest.delta)) strongest = { label, delta: round(delta, 6) };
  }
  return strongest;
}

function makeAlert(id, severity, title, message, evidence, generatedAt) {
  return {
    id,
    severity,
    title,
    message,
    evidenceIds: [...new Set(evidence.map((row) => row.id).filter(Boolean))],
    providers: [...new Set(evidence.map((row) => row.providerId).filter(Boolean))],
    evidenceObservedAt: evidence.map((row) => row.observedAt).filter(Boolean).sort().at(-1) || null,
    providerFreshness: Object.fromEntries(evidence.filter((row) => row.providerId).map((row) => [row.providerId, row.freshness])),
    generatedAt,
    actionMode: "informational-paper-only",
    realMoneyInstruction: false,
    realMoneyExecution: false
  };
}

function eventChangeAlerts(previous, current, generatedAt) {
  if (!previous || !current) return [];
  const alerts = [];
  if (previous.status === "scheduled" && current.status === "live") alerts.push(makeAlert("event-started", "info", "Event started", "A fresh provider majority confirms that the event is live.", [previous, current], generatedAt));
  if (previous.homeScore !== current.homeScore || previous.awayScore !== current.awayScore) alerts.push(makeAlert("score-changed", "info", "Verified score change", `Score changed to ${current.homeScore}–${current.awayScore}.`, [previous, current], generatedAt));
  if (previous.period !== current.period) alerts.push(makeAlert("period-changed", "info", "Verified period change", `Event period changed from ${previous.period ?? "unknown"} to ${current.period ?? "unknown"}.`, [previous, current], generatedAt));
  if (previous.status !== "final" && current.status === "final") alerts.push(makeAlert("event-final", "info", "Event final", "A fresh provider majority confirms the event has ended.", [previous, current], generatedAt));
  return alerts;
}

export function buildVerifiedLiveMonitor(input = {}, configuration = {}) {
  const generatedAt = iso(input.generatedAt) || new Date().toISOString();
  const eventId = clean(input.eventId, 180);
  const freshSeconds = clamp(Math.round(finite(configuration.freshSeconds) ?? 90), 15, 600);
  const staleSeconds = clamp(Math.round(finite(configuration.staleSeconds) ?? 180), freshSeconds + 1, 3600);
  if (!eventId) return { ok: false, version: VERIFIED_LIVE_MONITOR_VERSION, reason: "missing-event-id", paperOnly: true };

  const normalized = array(input.snapshots).slice(0, 10000).map((row, index) => normalizeSnapshot(row, index, { eventId, generatedAt, freshSeconds, staleSeconds }));
  const structurallyRejected = normalized.filter((row) => row.errors.length);
  const structurallyEligible = normalized.filter((row) => !row.errors.length);
  const integrity = validateProviderTimelines(structurallyEligible);
  const accepted = [...integrity.accepted].sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
  const latest = latestRows(accepted);
  const resolution = resolveProviderState(latest);
  const current = resolution.current;
  const previousResolution = resolveProviderState(previousRows(accepted));
  const currentProbability = current ? probabilityConsensus(resolution.usable) : null;
  const previousProbability = probabilityConsensus(previousResolution.usable);
  const movement = probabilityMovement(previousProbability, currentProbability);
  const alerts = [];

  if (resolution.conflict) alerts.push(makeAlert("provider-conflict", "high", "Live event suspended", "Providers disagree on the current event state. Live interpretation is suspended until the conflict resolves.", resolution.usable, generatedAt));
  if (!resolution.fresh.length && resolution.usable.length) alerts.push(makeAlert("provider-delay", "medium", "Live feed delayed", "No provider is inside the fresh-data threshold. Delayed evidence cannot support a confident live interpretation.", resolution.usable, generatedAt));
  const staleRows = latest.filter((row) => row.freshness === "stale");
  if (staleRows.length) alerts.push(makeAlert("provider-stale", "medium", "Provider feed stale", `${staleRows.length} provider feed(s) exceeded the stale threshold.`, staleRows, generatedAt));
  if (integrity.regressions.length) alerts.push(makeAlert("invalid-regression", "high", "Invalid backward event state rejected", `${integrity.regressions.length} state update(s) moved backwards without a visible correction and were excluded.`, structurallyEligible.filter((row) => integrity.regressions.some((entry) => entry.snapshotId === row.id)), generatedAt));
  if (integrity.corrections.length) alerts.push(makeAlert("visible-correction", "info", "Provider correction recorded", `${integrity.corrections.length} correction event(s) superseded earlier evidence without rewriting history.`, accepted.filter((row) => row.correction), generatedAt));
  alerts.push(...eventChangeAlerts(previousResolution.current, current, generatedAt));
  if (movement && Math.abs(movement.delta) >= 0.05 && resolution.fresh.length >= 2) alerts.push(makeAlert("live-probability-move", "medium", "Verified live probability movement", `${movement.label} moved ${movement.delta >= 0 ? "+" : ""}${(movement.delta * 100).toFixed(1)} percentage points across fresh provider evidence.`, resolution.fresh, generatedAt));

  const suspended = Boolean(resolution.conflict || !current);
  return {
    ok: true,
    version: VERIFIED_LIVE_MONITOR_VERSION,
    auditVersion: VERIFIED_LIVE_AUDIT_VERSION,
    generatedAt,
    eventId,
    sport: current?.sport || accepted.at(-1)?.sport || null,
    league: current?.league || accepted.at(-1)?.league || null,
    status: suspended ? "suspended" : current.status,
    suspended,
    suspensionReason: resolution.conflict?.reason || (!current ? "no-current-verified-state" : null),
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
    liveProbability: currentProbability ? {
      ...currentProbability,
      movement,
      separatedFromPreMatchAudit: true,
      usableForPreMatchFeatures: false
    } : null,
    alerts,
    timeline: accepted.map((row) => ({
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
    rejected: [
      ...structurallyRejected.map((row) => ({ id: row.id, providerId: row.providerId, errors: row.errors })),
      ...integrity.regressions.map((entry) => ({ id: entry.snapshotId, providerId: entry.providerId, errors: [entry.reason] }))
    ],
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
