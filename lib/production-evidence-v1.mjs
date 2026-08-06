export const PRODUCTION_EVIDENCE_VERSION = "scorecaster-production-evidence-v1";

export const PRODUCTION_EVIDENCE_THRESHOLDS = Object.freeze({
  workerSuccessRate: 0.95,
  workerMinimumCycles: 20,
  verifiedIdentityRate: 0.9,
  providerAvailabilityRate: 0.9,
  multiProviderRate: 0.5,
  closingLineCoverage: 0.8,
  averageCoverageScore: 0.7,
  maximumProviderDisagreement: 0.12,
  freshnessMinutes: 90,
  disableAfterMinutes: 360,
  minimumLeagueEvents: 5,
  enabledLeagueEvents: 20,
  minimumClosingEligibleEvents: 5
});

const finite = (value) => value === null || value === undefined || value === ""
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, finite(value) ?? 0));
const round = (value, digits = 4) => {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
};
const clean = (value, fallback = "unknown") => String(value || fallback).trim().toLowerCase() || fallback;
const time = (value) => {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
};
const ratio = (numerator, denominator) => denominator > 0 ? round(numerator / denominator) : null;
const average = (values = []) => {
  const valid = values.map(finite).filter((value) => value !== null);
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
};
const ageMinutes = (value, now) => {
  const parsed = time(value);
  return parsed === null ? null : Math.max(0, round((now - parsed) / 60000, 1));
};

function latestRows(rows, keyFor, timeFor) {
  const output = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    if (!key) continue;
    const observed = timeFor(row) ?? 0;
    const previous = output.get(key);
    if (!previous || observed >= previous.observed) output.set(key, { row, observed });
  }
  return [...output.values()].map((entry) => entry.row);
}

function eventId(row) {
  return String(row.eventId || row.event_id || "").trim();
}

function sportKey(row) {
  return clean(row.sportKey || row.sport_key || row.sport);
}

function leagueName(row) {
  return clean(row.league);
}

function capturedAt(row) {
  return row.capturedAt || row.captured_at || row.observedAt || row.observed_at || null;
}

function eventKey(row, index) {
  const id = eventId(row);
  if (id) return id;
  const home = clean(row.homeTeam || row.home_team, "");
  const away = clean(row.awayTeam || row.away_team, "");
  const commence = row.commenceTime || row.commence_time || "";
  return home || away || commence ? `missing:${home}:${away}:${commence}` : `missing-row:${index}`;
}

function verifiedIdentity(row) {
  const home = String(row.homeTeam || row.home_team || "").trim();
  const away = String(row.awayTeam || row.away_team || "").trim();
  return Boolean(eventId(row) && home && away && home !== away && time(row.commenceTime || row.commence_time) !== null);
}

function severity(row) {
  return clean(row.severity, "info");
}

function incidentMatchesLeague(row, league) {
  const details = row.details && typeof row.details === "object" ? row.details : {};
  const incidentEvent = eventId(row);
  if (incidentEvent && league.eventIds.has(incidentEvent)) return true;
  const incidentLeague = clean(details.league, "");
  const incidentSport = clean(details.sportKey || details.sport_key || details.sport, "");
  if (incidentLeague && incidentLeague === league.league && (!incidentSport || incidentSport === league.sport)) return true;
  return !incidentEvent && !incidentLeague && ["provider_health", "capture_stale", "worker_failure"].includes(clean(row.incidentType || row.incident_type, ""));
}

function freshnessComponent(age, threshold) {
  if (age === null) return 0;
  if (age <= threshold) return 1;
  return clamp(1 - (age - threshold) / (threshold * 3));
}

export function buildWorkerEvidence(runs = [], { now = Date.now(), thresholds = PRODUCTION_EVIDENCE_THRESHOLDS } = {}) {
  const ordered = [...runs]
    .filter((row) => time(row.startedAt || row.started_at) !== null)
    .sort((a, b) => time(b.startedAt || b.started_at) - time(a.startedAt || a.started_at));
  const completed = ordered.filter((row) => ["success", "partial", "failed"].includes(clean(row.status, "")));
  const successes = completed.filter((row) => clean(row.status, "") === "success").length;
  const partial = completed.filter((row) => clean(row.status, "") === "partial").length;
  const failed = completed.filter((row) => clean(row.status, "") === "failed").length;
  const inFlight = ordered.filter((row) => clean(row.status, "") === "running").length;
  const latest = ordered[0] || null;
  const latestAt = latest?.completedAt || latest?.completed_at || latest?.startedAt || latest?.started_at || null;
  const latestAgeMinutes = ageMinutes(latestAt, now);
  const successRate = ratio(successes, completed.length);
  const enoughCycles = completed.length >= thresholds.workerMinimumCycles;
  const fresh = latestAgeMinutes !== null && latestAgeMinutes <= thresholds.freshnessMinutes;
  const passing = enoughCycles && fresh && successRate !== null && successRate >= thresholds.workerSuccessRate;
  const disabled = !ordered.length || (completed.length >= 5 && (successRate ?? 0) < 0.8) || (latestAgeMinutes ?? Infinity) > thresholds.disableAfterMinutes;

  return {
    state: passing ? "enabled" : disabled ? "disabled" : "degraded",
    cycles: completed.length,
    observedCycles: ordered.length,
    inFlight,
    successes,
    partial,
    failed,
    successRate,
    latestStatus: latest ? clean(latest.status, "unknown") : "missing",
    latestAt,
    latestAgeMinutes,
    denominator: completed.length,
    target: thresholds.workerSuccessRate,
    enoughCycles,
    fresh
  };
}

export function buildProviderEvidence(observations = [], { now = Date.now(), thresholds = PRODUCTION_EVIDENCE_THRESHOLDS } = {}) {
  const latest = latestRows(
    observations,
    (row) => `${eventId(row)}:${clean(row.providerKey || row.provider_key)}:${clean(row.family)}`,
    (row) => time(row.observedAt || row.observed_at || row.capturedAt || row.captured_at)
  );
  const groups = new Map();
  for (const row of latest) {
    const provider = clean(row.providerKey || row.provider_key);
    const current = groups.get(provider) || { provider, rows: [], events: new Set(), families: new Set() };
    current.rows.push(row);
    if (eventId(row)) current.events.add(eventId(row));
    current.families.add(clean(row.family));
    groups.set(provider, current);
  }

  return [...groups.values()].map((group) => {
    const ok = group.rows.filter((row) => row.ok === true).length;
    const availabilityRate = ratio(ok, group.rows.length);
    const latestAt = group.rows.reduce((value, row) => {
      const candidate = row.observedAt || row.observed_at || row.capturedAt || row.captured_at;
      return (time(candidate) ?? 0) > (time(value) ?? 0) ? candidate : value;
    }, null);
    const latestAgeMinutes = ageMinutes(latestAt, now);
    const trust = average(group.rows.map((row) => row.trust));
    const confidence = average(group.rows.map((row) => row.confidence));
    const passing = availabilityRate !== null
      && availabilityRate >= thresholds.providerAvailabilityRate
      && (latestAgeMinutes ?? Infinity) <= thresholds.freshnessMinutes
      && (trust ?? 0) >= 0.7;
    const disabled = (availabilityRate ?? 0) < 0.5 || (latestAgeMinutes ?? Infinity) > thresholds.disableAfterMinutes;
    return {
      provider: group.provider,
      state: passing ? "enabled" : disabled ? "disabled" : "degraded",
      observations: group.rows.length,
      successfulObservations: ok,
      availabilityRate,
      events: group.events.size,
      families: [...group.families].sort(),
      trust,
      confidence,
      latestAt,
      latestAgeMinutes,
      denominator: group.rows.length
    };
  }).sort((a, b) => (b.availabilityRate ?? -1) - (a.availabilityRate ?? -1) || a.provider.localeCompare(b.provider));
}

export function buildLeagueReadiness({
  snapshots = [],
  closingRecords = [],
  incidents = [],
  providers = [],
  worker = null,
  now = Date.now(),
  thresholds = PRODUCTION_EVIDENCE_THRESHOLDS,
  dataAvailability = {}
} = {}) {
  const indexed = snapshots.map((row, index) => ({ ...row, _eventKey: eventKey(row, index) }));
  const latestEvents = latestRows(indexed, (row) => row._eventKey, (row) => time(capturedAt(row)));
  const groups = new Map();
  for (const row of latestEvents) {
    const sport = sportKey(row);
    const league = leagueName(row);
    const key = `${sport}:${league}`;
    const current = groups.get(key) || { key, sport, league, events: [], eventIds: new Set() };
    current.events.push(row);
    if (eventId(row)) current.eventIds.add(eventId(row));
    groups.set(key, current);
  }

  const validClosingEvents = new Set(closingRecords.filter((row) => {
    const commence = time(row.commenceTime || row.commence_time);
    const captured = time(row.closingCapturedAt || row.closing_captured_at);
    return eventId(row) && finite(row.closingOdds ?? row.closing_odds) > 1 && commence !== null && captured !== null && captured <= commence;
  }).map(eventId));
  const providerAvailability = average(providers.map((row) => row.availabilityRate));
  const sourceAvailabilityMissing = Object.entries(dataAvailability).filter(([, available]) => available === false).map(([source]) => source);

  return [...groups.values()].map((group) => {
    const events = group.events;
    const identityCount = events.filter(verifiedIdentity).length;
    const identityRate = ratio(identityCount, events.length);
    const multiProviderCount = events.filter((row) => (finite(row.providerCount ?? row.provider_count) ?? 0) >= 2).length;
    const multiProviderRate = ratio(multiProviderCount, events.length);
    const coverageScore = average(events.map((row) => row.coverageScore ?? row.coverage_score));
    const disagreement = average(events.map((row) => row.providerDisagreement ?? row.provider_disagreement));
    const latestAt = events.reduce((value, row) => (time(capturedAt(row)) ?? 0) > (time(value) ?? 0) ? capturedAt(row) : value, null);
    const latestAgeMinutes = ageMinutes(latestAt, now);
    const eligibleEvents = events.filter((row) => {
      const commence = time(row.commenceTime || row.commence_time);
      return commence !== null && commence <= now;
    });
    const closingCount = eligibleEvents.filter((row) => validClosingEvents.has(eventId(row))).length;
    const closingCoverage = ratio(closingCount, eligibleEvents.length);
    const activeIncidents = incidents.filter((row) => row.active !== false && incidentMatchesLeague(row, group));
    const highIncidents = activeIncidents.filter((row) => severity(row) === "high").length;
    const reasons = [];
    const hardReasons = [];

    if (events.length < thresholds.minimumLeagueEvents) hardReasons.push("insufficient-event-evidence");
    if (group.sport === "unknown" || group.league === "unknown") hardReasons.push("unverified-league-identity");
    if ((identityRate ?? 0) < 0.75) hardReasons.push("fixture-identity-critically-low");
    if ((latestAgeMinutes ?? Infinity) > thresholds.disableAfterMinutes) hardReasons.push("league-data-stale");
    if (highIncidents > 0) hardReasons.push("active-high-severity-incident");
    if (worker?.state === "disabled") hardReasons.push("protected-worker-disabled");
    if (providers.length && providerAvailability !== null && providerAvailability < 0.5) hardReasons.push("provider-availability-critically-low");

    if (events.length < thresholds.enabledLeagueEvents) reasons.push("sample-below-enabled-threshold");
    if ((identityRate ?? 0) < thresholds.verifiedIdentityRate) reasons.push("fixture-identity-below-target");
    if ((latestAgeMinutes ?? Infinity) > thresholds.freshnessMinutes) reasons.push("freshness-below-target");
    if ((multiProviderRate ?? 0) < thresholds.multiProviderRate) reasons.push("multi-provider-coverage-below-target");
    if ((coverageScore ?? 0) < thresholds.averageCoverageScore) reasons.push("evidence-coverage-below-target");
    if (disagreement !== null && disagreement > thresholds.maximumProviderDisagreement) reasons.push("provider-disagreement-above-limit");
    if (!providers.length) reasons.push("provider-observation-evidence-missing");
    else if ((providerAvailability ?? 0) < thresholds.providerAvailabilityRate) reasons.push("provider-availability-below-target");
    if (eligibleEvents.length < thresholds.minimumClosingEligibleEvents) reasons.push("closing-line-denominator-too-small");
    else if ((closingCoverage ?? 0) < thresholds.closingLineCoverage) reasons.push("closing-line-coverage-below-target");
    if (worker?.state !== "enabled") reasons.push("worker-evidence-below-target");
    if (activeIncidents.length) reasons.push("active-incidents");
    for (const source of sourceAvailabilityMissing) reasons.push(`${source}-source-unavailable`);

    const uniqueHardReasons = [...new Set(hardReasons)];
    const uniqueReasons = [...new Set([...hardReasons, ...reasons])];
    const state = uniqueHardReasons.length ? "disabled" : uniqueReasons.length ? "degraded" : "enabled";
    const providerComponent = average([
      multiProviderRate ?? 0,
      providerAvailability ?? 0,
      disagreement === null ? 0 : clamp(1 - disagreement / Math.max(0.001, thresholds.maximumProviderDisagreement * 2))
    ]) ?? 0;
    const score = round(100 * (
      0.25 * (identityRate ?? 0)
      + 0.2 * freshnessComponent(latestAgeMinutes, thresholds.freshnessMinutes)
      + 0.2 * providerComponent
      + 0.2 * (closingCoverage ?? 0)
      + 0.15 * (coverageScore ?? 0)
    ), 1);

    return {
      sport: group.sport,
      league: group.league,
      state,
      score,
      events: events.length,
      verifiedIdentities: identityCount,
      verifiedIdentityRate: identityRate,
      multiProviderEvents: multiProviderCount,
      multiProviderRate,
      averageProviderCount: average(events.map((row) => row.providerCount ?? row.provider_count)),
      averageProviderDisagreement: disagreement,
      averageCoverageScore: coverageScore,
      latestAt,
      latestAgeMinutes,
      closingEligibleEvents: eligibleEvents.length,
      closingEvents: closingCount,
      closingLineCoverage: closingCoverage,
      activeIncidents: activeIncidents.length,
      highSeverityIncidents: highIncidents,
      reasons: uniqueReasons,
      denominators: {
        identity: events.length,
        multiProvider: events.length,
        closingLine: eligibleEvents.length
      }
    };
  }).sort((a, b) => {
    const order = { disabled: 0, degraded: 1, enabled: 2 };
    return order[a.state] - order[b.state] || b.events - a.events || a.league.localeCompare(b.league);
  });
}

export function buildProductionEvidence({
  snapshots = [],
  providerObservations = [],
  closingRecords = [],
  incidents = [],
  collectorRuns = [],
  dataAvailability = {},
  now = Date.now(),
  windowDays = 30,
  thresholds = PRODUCTION_EVIDENCE_THRESHOLDS
} = {}) {
  const worker = buildWorkerEvidence(collectorRuns, { now, thresholds });
  const providers = buildProviderEvidence(providerObservations, { now, thresholds });
  const leagues = buildLeagueReadiness({ snapshots, closingRecords, incidents, providers, worker, now, thresholds, dataAvailability });
  const enabled = leagues.filter((row) => row.state === "enabled").length;
  const degraded = leagues.filter((row) => row.state === "degraded").length;
  const disabled = leagues.filter((row) => row.state === "disabled").length;
  const eventCount = leagues.reduce((sum, row) => sum + row.events, 0);
  const identityCount = leagues.reduce((sum, row) => sum + row.verifiedIdentities, 0);
  const multiProviderCount = leagues.reduce((sum, row) => sum + row.multiProviderEvents, 0);
  const closingEligible = leagues.reduce((sum, row) => sum + row.closingEligibleEvents, 0);
  const closingCount = leagues.reduce((sum, row) => sum + row.closingEvents, 0);
  const activeIncidents = incidents.filter((row) => row.active !== false).length;
  const unavailableSources = Object.entries(dataAvailability).filter(([, available]) => available === false).map(([source]) => source);
  const blockers = [];
  if (!leagues.length) blockers.push("no-league-evidence");
  if (worker.state === "disabled") blockers.push("protected-worker-disabled");
  if (!providers.length) blockers.push("provider-evidence-missing");
  if (dataAvailability.snapshots === false) blockers.push("snapshot-source-unavailable");
  if (enabled === 0) blockers.push("no-enabled-leagues");
  const degradedSystem = blockers.length
    || degraded > 0
    || disabled > 0
    || worker.state !== "enabled"
    || unavailableSources.length > 0
    || activeIncidents > 0;
  const releaseState = blockers.length ? "blocked" : degradedSystem ? "degraded" : "ready";

  return {
    ok: true,
    version: PRODUCTION_EVIDENCE_VERSION,
    generatedAt: new Date(now).toISOString(),
    windowDays,
    releaseState,
    ready: releaseState === "ready",
    blockers: [...new Set(blockers)],
    summary: {
      leagues: leagues.length,
      enabledLeagues: enabled,
      degradedLeagues: degraded,
      disabledLeagues: disabled,
      events: eventCount,
      verifiedFixtureIdentityRate: ratio(identityCount, eventCount),
      multiProviderEventRate: ratio(multiProviderCount, eventCount),
      closingEligibleEvents: closingEligible,
      closingEvents: closingCount,
      closingLineCoverage: ratio(closingCount, closingEligible),
      providerCount: providers.length,
      averageProviderAvailability: average(providers.map((row) => row.availabilityRate)),
      activeIncidents
    },
    worker,
    providers,
    leagues,
    dataAvailability: {
      snapshots: dataAvailability.snapshots !== false,
      providerObservations: dataAvailability.providerObservations !== false,
      closingRecords: dataAvailability.closingRecords !== false,
      incidents: dataAvailability.incidents !== false,
      collectorRuns: dataAvailability.collectorRuns !== false,
      unavailableSources
    },
    thresholds: { ...thresholds },
    methodology: {
      eventDeduplication: "Latest snapshot per event inside the selected chronological window",
      identityDenominator: "Unique latest event snapshots",
      providerDenominator: "Latest event-provider-family observations",
      closingLineDenominator: "Unique events whose scheduled start is at or before report generation",
      closingLineChronology: "Only closing observations captured at or before scheduled start are counted",
      workerDenominator: "Collector cycles started inside the selected window",
      missingEvidence: "Missing or unavailable evidence degrades or disables readiness; it is never imputed"
    },
    safety: {
      paperOnly: true,
      realMoneyExecution: false,
      bookmakerCredentials: false,
      probabilityChanged: false,
      automaticPlayUpgrade: false,
      rawProviderPayloadsExposed: false,
      userIdentifiersExposed: false,
      closingLineUsedForPregameDecision: false
    }
  };
}
