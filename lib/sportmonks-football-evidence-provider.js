import { createHash } from "node:crypto";

const BASE_URL = "https://api.sportmonks.com/v3/football";
const TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const HISTORY_DAYS = 100;
const MAX_HISTORY_MATCHES = 8;
const MIN_HISTORY_MATCHES = 4;
const TEAM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HISTORY_CACHE_TTL_MS = 15 * 60 * 1000;
const GLOBAL_TEAM_CACHE = "__scorecasterSportmonksTeamCacheV1";
const GLOBAL_HISTORY_CACHE = "__scorecasterSportmonksHistoryCacheV1";

function clean(value, limit = 180) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function bool(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value) {
  const parsed = timestamp(value);
  return parsed === null ? null : new Date(parsed).toISOString();
}

function normalizeName(value) {
  return clean(value, 140)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|club|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalizeName(value).split(" ").filter((token) => token.length >= 2);
}

function nameSimilarity(left, right) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.96;
  const aa = new Set(tokens(a));
  const bb = new Set(tokens(b));
  if (!aa.size || !bb.size) return 0;
  const overlap = [...aa].filter((token) => bb.has(token)).length;
  return overlap / Math.max(aa.size, bb.size);
}

function cache(name) {
  if (!globalThis[name]) globalThis[name] = new Map();
  return globalThis[name];
}

function cached(name, key, ttlMs, now = Date.now()) {
  const value = cache(name).get(key);
  if (!value || now - value.at > ttlMs) return null;
  return value.data;
}

function writeCache(name, key, data, now = Date.now()) {
  const store = cache(name);
  store.set(key, { at: now, data });
  if (store.size > 500) store.delete(store.keys().next().value);
}

export function sportmonksFootballEvidenceConfiguration(env = process.env) {
  const tokenPresent = Boolean(clean(env.SPORTMONKS_API_TOKEN, 40));
  const enabled = bool(env.SPORTMONKS_FOOTBALL_EVIDENCE_ENABLED);
  const commercialUseAllowed = bool(env.SPORTMONKS_COMMERCIAL_USE_ALLOWED);
  const modelUseAllowed = bool(env.SPORTMONKS_MODEL_USE_ALLOWED);
  const displayAllowed = bool(env.SPORTMONKS_DERIVED_DISPLAY_ALLOWED);
  const entitled = tokenPresent && enabled && commercialUseAllowed && modelUseAllowed;
  return {
    configured: entitled,
    tokenPresent,
    enabled,
    commercialUseAllowed,
    modelUseAllowed,
    displayAllowed,
    source: "sportmonks-football",
    transport: entitled ? "https-get" : "not-configured",
    contract: "scorecaster-sports-analytics-v5",
    baseUrl: BASE_URL,
    rawRedistributionAllowed: false,
    derivedAnalysisOnly: true,
    timeoutMs: TIMEOUT_MS,
    maximumResponseBytes: MAX_RESPONSE_BYTES,
    historyDays: HISTORY_DAYS,
    historyMatches: MAX_HISTORY_MATCHES,
    minimumHistoryMatches: MIN_HISTORY_MATCHES,
    reason: entitled ? null : !tokenPresent ? "sportmonks-token-missing" : !enabled ? "sportmonks-evidence-disabled" : !commercialUseAllowed ? "sportmonks-commercial-use-not-confirmed" : !modelUseAllowed ? "sportmonks-model-use-not-confirmed" : "sportmonks-not-entitled"
  };
}

async function boundedJson(response) {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_RESPONSE_BYTES) throw new Error("Sportmonks response exceeds configured size boundary");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("Sportmonks response exceeds configured size boundary");
  return JSON.parse(text);
}

async function sportmonksGet(path, params = {}, { env = process.env } = {}) {
  const config = sportmonksFootballEvidenceConfiguration(env);
  if (!config.configured) return { ok: false, mode: "not-configured", status: null, data: [], reason: config.reason };
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_token", String(env.SPORTMONKS_API_TOKEN));
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json", "User-Agent": "Scorecaster-Football-Evidence/1.0" } });
    if (!response.ok) return { ok: false, mode: response.status === 403 ? "subscription-unavailable" : "api-error", status: response.status, data: [], reason: `Sportmonks returned HTTP ${response.status}` };
    const payload = await boundedJson(response);
    return { ok: true, mode: "live", status: response.status, data: Array.isArray(payload?.data) ? payload.data : [], pagination: payload?.pagination || null, reason: null };
  } catch (error) {
    return { ok: false, mode: "degraded", status: null, data: [], reason: process.env.NODE_ENV === "production" ? "Sportmonks football evidence unavailable" : String(error) };
  }
}

async function resolveTeam(teamName, options = {}) {
  const key = normalizeName(teamName);
  if (!key) return { ok: false, reason: "missing-team-name" };
  const hit = cached(GLOBAL_TEAM_CACHE, key, TEAM_CACHE_TTL_MS);
  if (hit) return { ...hit, cached: true };
  const response = await sportmonksGet(`/teams/search/${encodeURIComponent(clean(teamName, 120))}`, { per_page: 25 }, options);
  if (!response.ok) return { ok: false, reason: response.reason, mode: response.mode };
  const candidates = response.data
    .map((row) => ({ id: finite(row?.id), name: clean(row?.name, 140), similarity: nameSimilarity(row?.name, teamName) }))
    .filter((row) => row.id !== null && row.similarity >= 0.88)
    .sort((a, b) => b.similarity - a.similarity);
  const best = candidates[0] || null;
  const ambiguous = best && candidates[1] && Math.abs(best.similarity - candidates[1].similarity) < 0.015;
  const result = best && !ambiguous ? { ok: true, id: best.id, name: best.name, similarity: best.similarity, cached: false } : { ok: false, reason: ambiguous ? "ambiguous-team-match" : "team-not-found", candidates: candidates.slice(0, 3) };
  if (result.ok) writeCache(GLOBAL_TEAM_CACHE, key, result);
  return result;
}

function xgRows(fixture = {}) {
  const rows = fixture?.xGFixture || fixture?.expected || fixture?.xg_fixture || fixture?.xgFixture || [];
  return Array.isArray(rows) ? rows : Array.isArray(rows?.data) ? rows.data : [];
}

function participantRows(fixture = {}) {
  const rows = fixture?.participants || [];
  return Array.isArray(rows) ? rows : Array.isArray(rows?.data) ? rows.data : [];
}

function statRows(fixture = {}) {
  const rows = fixture?.statistics || [];
  return Array.isArray(rows) ? rows : Array.isArray(rows?.data) ? rows.data : [];
}

function statLabel(row = {}) {
  return clean(row?.type?.developer_name || row?.type?.name || row?.type?.code || row?.name || row?.metric, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function statValue(row = {}) {
  return finite(row?.data?.value ?? row?.value ?? row?.data);
}

function sideFromParticipant(participant = {}) {
  const location = clean(participant?.meta?.location || participant?.location, 30).toLowerCase();
  return location === "home" || location === "away" ? location : null;
}

function fixtureSample(fixture, teamId, cutoff) {
  const startedAt = timestamp(fixture?.starting_at || fixture?.startingAt);
  if (startedAt === null || startedAt >= cutoff) return null;
  const resultInfo = clean(fixture?.result_info || fixture?.resultInfo, 180).toLowerCase();
  const stateId = finite(fixture?.state_id || fixture?.stateId);
  if (!(stateId === 5 || resultInfo.includes("won") || resultInfo.includes("draw") || resultInfo.includes("after full-time") || resultInfo.includes("full time"))) return null;
  const expected = xgRows(fixture);
  const teamXg = expected.find((row) => Number(row?.participant_id ?? row?.participantId) === Number(teamId));
  const opponentXg = expected.find((row) => Number(row?.participant_id ?? row?.participantId) !== Number(teamId));
  const xgFor = finite(teamXg?.data?.value ?? teamXg?.value);
  const xgAgainst = finite(opponentXg?.data?.value ?? opponentXg?.value);
  if (xgFor === null || xgAgainst === null) return null;
  const length = clamp(finite(fixture?.length) || 90, 45, 130);
  const scale = 90 / length;
  const participants = participantRows(fixture);
  const teamParticipant = participants.find((row) => Number(row?.id) === Number(teamId));
  const side = sideFromParticipant(teamParticipant) || clean(teamXg?.location, 20).toLowerCase() || null;
  const statistics = statRows(fixture);
  const teamStats = statistics.filter((row) => Number(row?.participant_id ?? row?.participantId) === Number(teamId));
  const opponentStats = statistics.filter((row) => Number(row?.participant_id ?? row?.participantId) !== Number(teamId));
  const findStat = (rows, patterns) => rows.find((row) => patterns.some((pattern) => statLabel(row).includes(pattern)));
  const shotsFor = statValue(findStat(teamStats, ["shots-total", "total-shots", "shots"]));
  const shotsAgainst = statValue(findStat(opponentStats, ["shots-total", "total-shots", "shots"]));
  const shotsOnTargetFor = statValue(findStat(teamStats, ["shots-on-target", "shots-ongoal", "shots-on-goal"]));
  const shotsOnTargetAgainst = statValue(findStat(opponentStats, ["shots-on-target", "shots-ongoal", "shots-on-goal"]));
  return {
    fixtureId: finite(fixture?.id),
    startedAt: new Date(startedAt).toISOString(),
    side,
    xgFor90: xgFor * scale,
    xgAgainst90: xgAgainst * scale,
    shotsFor90: shotsFor === null ? null : shotsFor * scale,
    shotsAgainst90: shotsAgainst === null ? null : shotsAgainst * scale,
    shotsOnTargetFor90: shotsOnTargetFor === null ? null : shotsOnTargetFor * scale,
    shotsOnTargetAgainst90: shotsOnTargetAgainst === null ? null : shotsOnTargetAgainst * scale
  };
}

function mean(samples, field) {
  const values = samples.map((row) => finite(row[field])).filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function rounded(value, digits = 4) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

async function teamHistory(team, cutoff, options = {}) {
  const date = new Date(cutoff);
  const endDate = new Date(Math.min(cutoff - 60_000, Date.now())).toISOString().slice(0, 10);
  const startDate = new Date(date.getTime() - HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
  const key = `${team.id}:${startDate}:${endDate}`;
  const hit = cached(GLOBAL_HISTORY_CACHE, key, HISTORY_CACHE_TTL_MS);
  if (hit) return { ...hit, cached: true };
  const response = await sportmonksGet(`/fixtures/between/${startDate}/${endDate}/${team.id}`, { include: "participants;xGFixture;statistics.type", per_page: 50, order: "desc" }, options);
  if (!response.ok) return { ok: false, mode: response.mode, reason: response.reason, samples: [] };
  const samples = response.data.map((fixture) => fixtureSample(fixture, team.id, cutoff)).filter(Boolean).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, MAX_HISTORY_MATCHES);
  const result = { ok: samples.length >= MIN_HISTORY_MATCHES, mode: samples.length >= MIN_HISTORY_MATCHES ? "live" : "insufficient-history", samples, reason: samples.length >= MIN_HISTORY_MATCHES ? null : "insufficient-xg-history" };
  writeCache(GLOBAL_HISTORY_CACHE, key, result);
  return result;
}

function teamObservations({ targetEventId, targetTeamName, targetSide, team, history, capturedAt }) {
  const samples = history.samples || [];
  const latest = samples[0]?.startedAt || capturedAt;
  const confidence = clamp(samples.length / MAX_HISTORY_MATCHES, 0.5, 0.95);
  const metadata = {
    team: targetTeamName,
    teamSide: targetSide,
    sportmonksTeamId: team.id,
    sampleSize: samples.length,
    sampleFixtureIds: samples.map((row) => row.fixtureId).filter(Boolean),
    sampleStartAt: samples.at(-1)?.startedAt || null,
    sampleEndAt: samples[0]?.startedAt || null,
    aggregation: `mean of last ${samples.length} completed pregame fixtures, normalized per 90`,
    rawFeedRedistributed: false,
    derivedEvidenceOnly: true
  };
  const metric = (name, value, unit = "per-90") => value === null ? null : ({ eventId: targetEventId, participantId: targetTeamName, family: "expected", metric: name, value: rounded(value), unit, observedAt: latest, capturedAt, provider: "sportmonks-football", sourceTrust: 0.9, confidence, metadata });
  return [
    metric("xg-for-per-90", mean(samples, "xgFor90")),
    metric("xg-against-per-90", mean(samples, "xgAgainst90")),
    metric("shots-for-per-90", mean(samples, "shotsFor90")),
    metric("shots-against-per-90", mean(samples, "shotsAgainst90")),
    metric("shots-on-target-for-per-90", mean(samples, "shotsOnTargetFor90")),
    metric("shots-on-target-against-per-90", mean(samples, "shotsOnTargetAgainst90"))
  ].filter(Boolean);
}

export async function fetchSportmonksFootballEvidence(match = {}, { capturedAt = new Date().toISOString(), env = process.env } = {}) {
  const config = sportmonksFootballEvidenceConfiguration(env);
  const eventId = clean(match.eventId, 180);
  const cutoff = timestamp(match.commenceTime) ?? timestamp(capturedAt) ?? Date.now();
  if (!config.configured) return { ok: false, mode: "not-configured", source: config.source, retrievedAt: capturedAt, observations: [], golfShots: [], reason: config.reason, entitlement: config };
  if (!eventId || !match.homeTeam || !match.awayTeam) return { ok: false, mode: "invalid-match", source: config.source, retrievedAt: capturedAt, observations: [], golfShots: [], reason: "missing-event-or-team-identity", entitlement: config };
  const [home, away] = await Promise.all([resolveTeam(match.homeTeam, { env }), resolveTeam(match.awayTeam, { env })]);
  if (!home.ok || !away.ok) return { ok: false, mode: "team-resolution-failed", source: config.source, retrievedAt: capturedAt, observations: [], golfShots: [], reason: home.reason || away.reason || "team-resolution-failed", entitlement: config };
  const [homeHistory, awayHistory] = await Promise.all([teamHistory(home, cutoff, { env }), teamHistory(away, cutoff, { env })]);
  if (!homeHistory.ok || !awayHistory.ok) return { ok: false, mode: "insufficient-history", source: config.source, retrievedAt: capturedAt, observations: [], golfShots: [], reason: homeHistory.reason || awayHistory.reason || "insufficient-xg-history", entitlement: config };
  const observations = [
    ...teamObservations({ targetEventId: eventId, targetTeamName: match.homeTeam, targetSide: "home", team: home, history: homeHistory, capturedAt }),
    ...teamObservations({ targetEventId: eventId, targetTeamName: match.awayTeam, targetSide: "away", team: away, history: awayHistory, capturedAt })
  ];
  const lineageHash = createHash("sha256").update(JSON.stringify({ eventId, home: homeHistory.samples.map((row) => [row.fixtureId, row.startedAt]), away: awayHistory.samples.map((row) => [row.fixtureId, row.startedAt]) })).digest("hex");
  return {
    ok: observations.filter((row) => row.metric.startsWith("xg-")).length >= 4,
    mode: "live",
    source: config.source,
    retrievedAt: capturedAt,
    observations,
    golfShots: [],
    reason: null,
    lineageHash,
    entitlement: { commercialUseAllowed: config.commercialUseAllowed, modelUseAllowed: config.modelUseAllowed, rawRedistributionAllowed: false, derivedAnalysisOnly: true },
    audit: { pregameOnly: true, completedHistoryOnly: true, marketInputsUsed: false, targetFixtureResultUsed: false, rawFeedRedistributed: false, inputLineageHashed: true }
  };
}

export function resetSportmonksFootballEvidenceCachesForTests() {
  cache(GLOBAL_TEAM_CACHE).clear();
  cache(GLOBAL_HISTORY_CACHE).clear();
}

export const SPORTMONKS_FOOTBALL_EVIDENCE_POLICY = Object.freeze({
  baseUrl: BASE_URL,
  historyDays: HISTORY_DAYS,
  maximumHistoryMatches: MAX_HISTORY_MATCHES,
  minimumHistoryMatches: MIN_HISTORY_MATCHES,
  entitlementFailClosed: true,
  requiresCommercialUseFlag: true,
  requiresModelUseFlag: true,
  rawRedistributionAllowed: false,
  targetFixtureOutcomeUsed: false,
  marketPricingUsed: false,
  paperOnly: true
});