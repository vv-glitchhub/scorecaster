import { sportsDataGet } from "./sportsdata-fetcher.js";

const CACHE_TTL_MS = 2 * 60 * 1000;
const CACHE_KEY = "__scorecasterSportsDataSoccerLineupCacheV1";
const MAX_LOOKAHEAD_MS = 6 * 60 * 60 * 1000;
const MIN_MATCH_CONFIDENCE = 0.92;
const REQUIRED_STARTERS_PER_TEAM = 11;

function clean(value, limit = 180) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function normalizedTeam(value) {
  return clean(value, 140)
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|club|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamTokens(value) {
  return normalizedTeam(value).split(" ").filter((token) => token.length >= 2);
}

function teamSimilarity(left, right) {
  const a = normalizedTeam(left);
  const b = normalizedTeam(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.96;
  const aTokens = new Set(teamTokens(a));
  const bTokens = new Set(teamTokens(b));
  if (!aTokens.size || !bTokens.size) return 0;
  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function isSoccer(match = {}) {
  return clean(`${match.sport || ""} ${match.league || ""}`, 220).toLowerCase().includes("soccer") ||
    /(mls|allsvenskan|eliteserien|veikkausliiga|premier league|la liga|serie a|bundesliga)/i.test(`${match.sport || ""} ${match.league || ""}`);
}

function utcDate(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function sportsDataSoccerBoxScoresPath(match = {}) {
  const date = utcDate(match.commenceTime);
  return date ? `/v3/soccer/stats/json/BoxScoresByDate/${date}` : null;
}

function gameFromBoxScore(row = {}) {
  return row?.Game || row?.game || row?.Score || row?.score || {};
}

function lineupsFromBoxScore(row = {}) {
  const rows = row?.Lineups || row?.lineups || [];
  return Array.isArray(rows) ? rows : [];
}

function matchConfidence(row = {}, match = {}) {
  const game = gameFromBoxScore(row);
  const home = teamSimilarity(game.HomeTeamName || game.homeTeamName || game.HomeTeam || game.homeTeam, match.homeTeam);
  const away = teamSimilarity(game.AwayTeamName || game.awayTeamName || game.AwayTeam || game.awayTeam, match.awayTeam);
  if (home < 0.75 || away < 0.75) return 0;
  return Number(((home + away) / 2).toFixed(3));
}

function starterRows(lineups = [], teamId) {
  return lineups.filter((row) => {
    const type = clean(row?.Type || row?.type, 30).toLowerCase();
    const rowTeamId = row?.TeamId ?? row?.TeamID ?? row?.teamId ?? null;
    return type === "starter" && rowTeamId != null && teamId != null && String(rowTeamId) === String(teamId);
  });
}

function starterPayload(rows = []) {
  return rows.slice(0, REQUIRED_STARTERS_PER_TEAM).map((row) => ({
    playerId: row?.PlayerId ?? row?.PlayerID ?? row?.playerId ?? null,
    name: clean(row?.Name || row?.PlayerName || row?.name, 100),
    position: clean(row?.Position || row?.position, 20) || null
  }));
}

export function normalizeSportsDataSoccerLineup(payload, match = {}) {
  const boxScores = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.BoxScores)
        ? payload.BoxScores
        : [];
  const candidates = boxScores
    .map((row) => ({ row, confidence: matchConfidence(row, match) }))
    .filter((item) => item.confidence >= MIN_MATCH_CONFIDENCE)
    .sort((left, right) => right.confidence - left.confidence);

  if (candidates.length !== 1) {
    return {
      ok: false,
      mode: candidates.length > 1 ? "ambiguous_match" : "event_not_found",
      candidateCount: candidates.length,
      matchConfidence: candidates[0]?.confidence || 0,
      data: { teams: [] }
    };
  }

  const selected = candidates[0];
  const game = gameFromBoxScore(selected.row);
  const lineups = lineupsFromBoxScore(selected.row);
  const homeTeamId = game.HomeTeamId ?? game.HomeTeamID ?? game.homeTeamId ?? null;
  const awayTeamId = game.AwayTeamId ?? game.AwayTeamID ?? game.awayTeamId ?? null;
  const homeStarters = starterRows(lineups, homeTeamId);
  const awayStarters = starterRows(lineups, awayTeamId);
  const homeConfirmed = homeStarters.length >= REQUIRED_STARTERS_PER_TEAM;
  const awayConfirmed = awayStarters.length >= REQUIRED_STARTERS_PER_TEAM;

  if (!homeConfirmed || !awayConfirmed) {
    return {
      ok: true,
      mode: "not_confirmed",
      candidateCount: 1,
      matchConfidence: selected.confidence,
      gameId: game.GameId ?? game.GameID ?? game.gameId ?? null,
      starterCounts: { home: homeStarters.length, away: awayStarters.length },
      data: { teams: [] }
    };
  }

  const updatedAt = clean(game.UpdatedUtc || game.Updated || selected.row?.UpdatedUtc || selected.row?.Updated, 80) || null;
  return {
    ok: true,
    mode: "live",
    candidateCount: 1,
    matchConfidence: selected.confidence,
    gameId: game.GameId ?? game.GameID ?? game.gameId ?? null,
    starterCounts: { home: homeStarters.length, away: awayStarters.length },
    data: {
      teams: [
        {
          team: match.homeTeam,
          startersConfirmed: true,
          goalieConfirmed: false,
          keyPlayersAvailable: null,
          lineupStability: 0,
          source: "sportsdata",
          sourceType: "official_data_provider",
          sourceTrust: 0.9,
          updatedAt,
          starters: starterPayload(homeStarters)
        },
        {
          team: match.awayTeam,
          startersConfirmed: true,
          goalieConfirmed: false,
          keyPlayersAvailable: null,
          lineupStability: 0,
          source: "sportsdata",
          sourceType: "official_data_provider",
          sourceTrust: 0.9,
          updatedAt,
          starters: starterPayload(awayStarters)
        }
      ]
    }
  };
}

function cacheStore() {
  if (!globalThis[CACHE_KEY]) globalThis[CACHE_KEY] = new Map();
  return globalThis[CACHE_KEY];
}

async function cachedGet(path, get = sportsDataGet) {
  const store = cacheStore();
  const now = Date.now();
  const cached = store.get(path);
  if (cached && now - cached.storedAt <= CACHE_TTL_MS) return { ...cached.result, cached: true };
  const result = await get(path);
  if (result?.mode === "live") store.set(path, { storedAt: now, result });
  return { ...result, cached: false };
}

export async function fetchSportsDataSoccerLineupForMatch(match = {}, { now = Date.now(), get = sportsDataGet } = {}) {
  const retrievedAt = new Date(now).toISOString();
  if (!isSoccer(match)) {
    return { ok: true, source: "sportsdata", mode: "unsupported_league", retrievedAt, data: { teams: [] } };
  }

  const eventAt = Date.parse(String(match.commenceTime || ""));
  if (!Number.isFinite(eventAt)) {
    return { ok: false, source: "sportsdata", mode: "invalid_event_time", retrievedAt, data: { teams: [] } };
  }
  const untilEventMs = eventAt - now;
  if (untilEventMs > MAX_LOOKAHEAD_MS) {
    return {
      ok: true,
      source: "sportsdata",
      mode: "not_yet_available",
      retrievedAt,
      lineupWindowOpensAt: new Date(eventAt - MAX_LOOKAHEAD_MS).toISOString(),
      data: { teams: [] }
    };
  }
  if (untilEventMs < -2 * 60 * 60 * 1000) {
    return { ok: true, source: "sportsdata", mode: "event_started", retrievedAt, data: { teams: [] } };
  }

  const path = sportsDataSoccerBoxScoresPath(match);
  if (!path) return { ok: false, source: "sportsdata", mode: "invalid_event_time", retrievedAt, data: { teams: [] } };
  const response = await cachedGet(path, get);
  if (!response?.ok || response?.mode !== "live") {
    return {
      ok: false,
      source: "sportsdata",
      mode: response?.mode || "unavailable",
      status: response?.status || null,
      retrievedAt,
      subscriptionUnavailable: response?.mode === "subscription_unavailable",
      data: { teams: [] }
    };
  }

  const normalized = normalizeSportsDataSoccerLineup(response.data, match);
  return {
    ...normalized,
    source: "sportsdata",
    providerFamily: "sportsdataio",
    retrievedAt,
    cached: response.cached === true,
    paperOnly: true
  };
}

export function resetSportsDataSoccerLineupCacheForTests() {
  cacheStore().clear();
}

export const SPORTSDATA_SOCCER_LINEUP_POLICY = Object.freeze({
  cacheTtlMs: CACHE_TTL_MS,
  maximumLookaheadHours: MAX_LOOKAHEAD_MS / 3_600_000,
  minimumMatchConfidence: MIN_MATCH_CONFIDENCE,
  requiredStartersPerTeam: REQUIRED_STARTERS_PER_TEAM,
  supportedFamily: "soccer",
  confirmationRule: "both-teams-have-11-starter-rows",
  probabilityChanged: false,
  paperOnly: true
});
