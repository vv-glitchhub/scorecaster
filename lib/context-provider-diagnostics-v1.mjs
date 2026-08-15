export const CONTEXT_PROVIDER_DIAGNOSTICS_VERSION = "scorecaster-context-provider-diagnostics-v1";

const FAMILIES = Object.freeze(["injuries", "lineups", "context", "news", "weather"]);
const BLOCKED_MODES = new Set([
  "api_error",
  "budget_exhausted",
  "fetch_error",
  "not_configured",
  "not_confirmed",
  "not_verified",
  "provider_error",
  "subscription_unavailable",
  "timeout",
  "unavailable"
]);
const NOT_APPLICABLE_MODES = new Set(["not_applicable", "not_applicable_indoor"]);
const UNSUPPORTED_MODES = new Set(["unsupported", "unsupported_league", "unsupported_sport"]);

function clean(value, limit = 160) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function integer(value, max = 100000) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(max, Math.trunc(number))) : null;
}

function time(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safePath(value) {
  const raw = clean(value, 180);
  if (!raw) return null;
  const path = raw.split("?")[0];
  return path.startsWith("/") ? path : null;
}

function starterCounts(value) {
  if (!value || typeof value !== "object") return null;
  const home = integer(value.home, 30);
  const away = integer(value.away, 30);
  return home === null && away === null ? null : { home, away };
}

function normalize(row = {}) {
  const family = clean(row.family, 40).toLowerCase();
  if (!FAMILIES.includes(family)) return null;
  const details = row.details && typeof row.details === "object" ? row.details : {};
  const mode = clean(row.mode || details.mode || "unavailable", 60).toLowerCase() || "unavailable";
  const subscriptionUnavailable = details.subscriptionUnavailable === true || mode === "subscription_unavailable";
  const fallbackMode = clean(details.fallbackMode || details.sportsDataFallbackMode, 60).toLowerCase() || null;
  const observedAt = clean(row.captured_at || row.observed_at || details.retrievedAt, 80) || null;

  return {
    family,
    provider: clean(row.provider_key || details.source || "unavailable", 100) || "unavailable",
    mode,
    ok: row.ok === true || details.ok === true,
    status: integer(details.status, 599),
    path: safePath(details.path),
    providerFamily: clean(details.providerFamily, 80) || null,
    coverageChecked: details.coverageChecked === true,
    count: integer(details.count, 500),
    rawProviderCount: integer(details.rawProviderCount, 5000),
    injuryCandidateCount: integer(details.injuryCandidateCount, 500),
    starterCounts: starterCounts(details.starterCounts),
    verifiedTeams: integer(details.verifiedTeams, 2),
    starterCount: integer(details.starterCount, 30),
    fallbackAttempted: details.fallbackAttempted === true,
    fallbackUsed: details.fallbackUsed === true,
    fallbackMode,
    primaryProviderMode: clean(details.primaryProviderMode, 60).toLowerCase() || null,
    subscriptionUnavailable: subscriptionUnavailable || fallbackMode === "subscription_unavailable",
    observedAt,
    observedAtMs: time(observedAt),
    eventKey: clean(row.event_id, 180) || null
  };
}

function modeRows(rows) {
  const counts = new Map();
  rows.forEach((row) => counts.set(row.mode, (counts.get(row.mode) || 0) + 1));
  return [...counts.entries()]
    .map(([mode, count]) => ({ mode, count }))
    .sort((left, right) => right.count - left.count || left.mode.localeCompare(right.mode))
    .slice(0, 8);
}

function providerRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const current = groups.get(row.provider) || { provider: row.provider, observations: 0, live: 0, blocked: 0, subscriptionUnavailable: 0, latestAtMs: 0, latestMode: null };
    current.observations += 1;
    if (row.ok && row.mode === "live") current.live += 1;
    if (row.subscriptionUnavailable || BLOCKED_MODES.has(row.mode)) current.blocked += 1;
    if (row.subscriptionUnavailable) current.subscriptionUnavailable += 1;
    if (row.observedAtMs >= current.latestAtMs) {
      current.latestAtMs = row.observedAtMs;
      current.latestMode = row.mode;
    }
    groups.set(row.provider, current);
  }
  return [...groups.values()]
    .map(({ latestAtMs, ...item }) => item)
    .sort((left, right) => right.observations - left.observations || left.provider.localeCompare(right.provider))
    .slice(0, 8);
}

function familySummary(family, sourceRows) {
  const rows = sourceRows.filter((row) => row.family === family).sort((left, right) => right.observedAtMs - left.observedAtMs);
  const latest = rows[0] || null;
  const live = rows.filter((row) => row.ok && row.mode === "live").length;
  const blocked = rows.filter((row) => row.subscriptionUnavailable || BLOCKED_MODES.has(row.mode)).length;
  const unsupported = rows.filter((row) => UNSUPPORTED_MODES.has(row.mode)).length;
  const notApplicable = rows.filter((row) => NOT_APPLICABLE_MODES.has(row.mode)).length;
  const subscriptionUnavailable = rows.filter((row) => row.subscriptionUnavailable).length;
  const uniqueEvents = new Set(rows.map((row) => row.eventKey).filter(Boolean)).size;

  let state = "unobserved";
  if (rows.length > 0) {
    if (latest?.ok && latest?.mode === "live") state = blocked > 0 ? "partially-available" : "available";
    else if (notApplicable === rows.length) state = "not-applicable";
    else if (unsupported === rows.length) state = "unsupported";
    else if (subscriptionUnavailable > 0 || blocked > 0) state = "blocked";
    else if (live > 0) state = "partially-available";
    else state = "degraded";
  }

  return {
    family,
    state,
    observations: rows.length,
    uniqueEvents,
    liveObservations: live,
    blockedObservations: blocked,
    unsupportedObservations: unsupported,
    notApplicableObservations: notApplicable,
    subscriptionUnavailableObservations: subscriptionUnavailable,
    availabilityRate: rows.length ? Number((live / rows.length).toFixed(3)) : null,
    latest: latest ? {
      provider: latest.provider,
      mode: latest.mode,
      ok: latest.ok,
      status: latest.status,
      path: latest.path,
      providerFamily: latest.providerFamily,
      coverageChecked: latest.coverageChecked,
      count: latest.count,
      rawProviderCount: latest.rawProviderCount,
      injuryCandidateCount: latest.injuryCandidateCount,
      starterCounts: latest.starterCounts,
      verifiedTeams: latest.verifiedTeams,
      starterCount: latest.starterCount,
      fallbackAttempted: latest.fallbackAttempted,
      fallbackUsed: latest.fallbackUsed,
      fallbackMode: latest.fallbackMode,
      primaryProviderMode: latest.primaryProviderMode,
      subscriptionUnavailable: latest.subscriptionUnavailable,
      observedAt: latest.observedAt
    } : null,
    modes: modeRows(rows),
    providers: providerRows(rows)
  };
}

export function buildContextProviderDiagnostics(providerObservations = []) {
  const rows = (Array.isArray(providerObservations) ? providerObservations : []).map(normalize).filter(Boolean);
  const families = FAMILIES.map((family) => familySummary(family, rows));
  const observed = families.filter((family) => family.observations > 0);
  const blocked = observed.filter((family) => family.state === "blocked");
  const subscriptionBlocked = observed.filter((family) => family.subscriptionUnavailableObservations > 0);
  const latestObservedAt = rows.sort((left, right) => right.observedAtMs - left.observedAtMs)[0]?.observedAt || null;

  return {
    version: CONTEXT_PROVIDER_DIAGNOSTICS_VERSION,
    families,
    summary: {
      observations: rows.length,
      familiesObserved: observed.length,
      blockedFamilies: blocked.map((family) => family.family),
      subscriptionBlockedFamilies: subscriptionBlocked.map((family) => family.family),
      availableFamilies: observed.filter((family) => family.state === "available" || family.state === "partially-available").map((family) => family.family),
      latestObservedAt
    },
    safety: {
      eventIdsExposed: false,
      teamNamesExposed: false,
      rawPayloadRetained: false,
      credentialsRetained: false,
      probabilityChanged: false,
      decisionChanged: false,
      stakeChanged: false,
      paperOnly: true
    }
  };
}

export const CONTEXT_PROVIDER_DIAGNOSTICS_POLICY = Object.freeze({
  families: FAMILIES,
  eventIdsExposed: false,
  teamNamesExposed: false,
  rawPayloadRetained: false,
  credentialsRetained: false,
  probabilityChanged: false,
  decisionChanged: false,
  stakeChanged: false,
  paperOnly: true
});
