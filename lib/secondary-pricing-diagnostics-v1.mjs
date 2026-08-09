export const SECONDARY_PRICING_DIAGNOSTICS_VERSION = "scorecaster-secondary-pricing-diagnostics-v1";

const MODE_KEYS = Object.freeze([
  "live",
  "no_match",
  "low_match_confidence",
  "unsupported_league",
  "not_configured",
  "api_error",
  "fetch_error",
  "timeout",
  "not_verified",
  "unavailable",
  "other"
]);

const NON_ELIGIBLE_MODES = new Set(["unsupported_league", "not_configured"]);

function clean(value, fallback = "unknown", limit = 120) {
  const text = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return (text || fallback).slice(0, limit);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  const number = finite(value);
  if (number === null) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function time(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function modeKey(value) {
  const mode = clean(value, "other", 60);
  return MODE_KEYS.includes(mode) ? mode : "other";
}

function emptyModeCounts() {
  return Object.fromEntries(MODE_KEYS.map((key) => [key, 0]));
}

function latestRows(rows, keyFor, timeFor) {
  const latest = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = keyFor(row);
    if (!key) continue;
    const observed = timeFor(row);
    const previous = latest.get(key);
    if (!previous || observed >= previous.observed) latest.set(key, { row, observed });
  }
  return [...latest.values()].map((entry) => entry.row);
}

function latestSnapshots(snapshots = []) {
  return latestRows(
    snapshots,
    (row) => String(row.event_id || row.eventId || "").trim(),
    (row) => time(row.captured_at || row.capturedAt)
  );
}

function latestOddsObservations(observations = []) {
  return latestRows(
    observations.filter((row) => clean(row.family, "") === "odds"),
    (row) => {
      const eventId = String(row.event_id || row.eventId || "").trim();
      const provider = clean(row.provider_key || row.providerKey, "");
      return eventId && provider ? `${eventId}:${provider}` : "";
    },
    (row) => time(row.observed_at || row.observedAt || row.captured_at || row.capturedAt)
  );
}

function aggregateConfidence(rows = []) {
  const values = rows.map((row) => finite(row.confidence)).filter((value) => value !== null && value >= 0 && value <= 1);
  if (!values.length) return { average: null, minimum: null, maximum: null, samples: 0 };
  return {
    average: round(values.reduce((sum, value) => sum + value, 0) / values.length, 3),
    minimum: round(Math.min(...values), 3),
    maximum: round(Math.max(...values), 3),
    samples: values.length
  };
}

function aggregateRows(rows = [], totalLeagueEvents = null) {
  const counts = emptyModeCounts();
  for (const row of rows) counts[modeKey(row.mode)] += 1;
  const eligible = rows.filter((row) => !NON_ELIGIBLE_MODES.has(modeKey(row.mode)));
  const live = eligible.filter((row) => modeKey(row.mode) === "live" && row.ok === true);
  const confidence = aggregateConfidence(rows);
  return {
    observations: rows.length,
    eligibleObservations: eligible.length,
    liveObservations: live.length,
    usableRate: eligible.length ? round(live.length / eligible.length) : null,
    liveCoverageOfLeague: Number.isFinite(Number(totalLeagueEvents)) && Number(totalLeagueEvents) > 0
      ? round(live.length / Number(totalLeagueEvents))
      : null,
    excludedUnsupportedOrUnconfigured: rows.length - eligible.length,
    modeCounts: counts,
    confidence
  };
}

export function buildSecondaryPricingDiagnostics({ snapshots = [], providerObservations = [] } = {}) {
  const currentSnapshots = latestSnapshots(snapshots);
  const observations = latestOddsObservations(providerObservations);
  const eventMeta = new Map(currentSnapshots.map((row) => [String(row.event_id || row.eventId || "").trim(), {
    sport: clean(row.sport_key || row.sportKey || row.sport),
    league: clean(row.league),
    eventId: String(row.event_id || row.eventId || "").trim()
  }]));

  const leagueTotals = new Map();
  for (const meta of eventMeta.values()) {
    const key = `${meta.sport}:${meta.league}`;
    leagueTotals.set(key, (leagueTotals.get(key) || 0) + 1);
  }

  const providerGroups = new Map();
  const providerLeagueGroups = new Map();
  for (const row of observations) {
    const provider = clean(row.provider_key || row.providerKey);
    const eventId = String(row.event_id || row.eventId || "").trim();
    const meta = eventMeta.get(eventId) || { sport: "unknown", league: "unknown" };
    if (!providerGroups.has(provider)) providerGroups.set(provider, []);
    providerGroups.get(provider).push(row);
    const leagueKey = `${provider}:${meta.sport}:${meta.league}`;
    if (!providerLeagueGroups.has(leagueKey)) providerLeagueGroups.set(leagueKey, { provider, sport: meta.sport, league: meta.league, rows: [] });
    providerLeagueGroups.get(leagueKey).rows.push(row);
  }

  const providers = [...providerGroups.entries()].map(([provider, rows]) => ({
    provider,
    ...aggregateRows(rows),
    leaguesObserved: new Set(rows.map((row) => {
      const meta = eventMeta.get(String(row.event_id || row.eventId || "").trim());
      return meta ? `${meta.sport}:${meta.league}` : "unknown:unknown";
    })).size
  })).sort((left, right) => left.provider.localeCompare(right.provider));

  const byLeague = [...providerLeagueGroups.values()].map((group) => {
    const totalLeagueEvents = leagueTotals.get(`${group.sport}:${group.league}`) || 0;
    return {
      provider: group.provider,
      sport: group.sport,
      league: group.league,
      totalLeagueEvents,
      ...aggregateRows(group.rows, totalLeagueEvents)
    };
  }).sort((left, right) => left.provider.localeCompare(right.provider)
    || left.sport.localeCompare(right.sport)
    || left.league.localeCompare(right.league));

  const leagues = [...leagueTotals.entries()].map(([key, eventCount]) => {
    const separator = key.indexOf(":");
    return {
      sport: key.slice(0, separator),
      league: key.slice(separator + 1),
      eventCount
    };
  }).sort((left, right) => left.sport.localeCompare(right.sport) || left.league.localeCompare(right.league));

  return {
    version: SECONDARY_PRICING_DIAGNOSTICS_VERSION,
    eventCount: currentSnapshots.length,
    oddsObservationCount: observations.length,
    providers,
    byLeague,
    leagues,
    semantics: {
      latestObservationPerEventProvider: true,
      unsupportedLeagueExcludedFromUsableRateDenominator: true,
      notConfiguredExcludedFromUsableRateDenominator: true,
      noMatchCountsAsUnusable: true,
      lowMatchConfidenceCountsAsUnusable: true,
      thresholdChanged: false,
      eventIdentifiersExposed: false,
      teamNamesExposed: false,
      rawProviderPayloadsExposed: false
    },
    safety: {
      paperOnly: true,
      bookmakerCredentials: false,
      realMoneyExecution: false,
      probabilityChanged: false,
      stakeChanged: false
    }
  };
}
