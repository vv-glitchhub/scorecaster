import { sportsDataGet } from "./sportsdata-fetcher.js";

const CACHE_TTL_MS = 2 * 60 * 1000;
const CACHE_KEY = "__scorecasterSportsDataSoccerLineupCacheV2";
const MAX_LOOKAHEAD_MS = 6 * 60 * 60 * 1000;
const MIN_MATCH_CONFIDENCE = 0.92;
const REQUIRED_STARTERS_PER_TEAM = 11;

// Competition IDs are from SportsDataIO's current Soccer coverage guide.
const SUPPORTED_COMPETITIONS = Object.freeze([
  { id: "1", key: "EPL", aliases: ["soccer epl", "premier league", "england premier league"] },
  { id: "2", key: "BUNDESLIGA", aliases: ["soccer germany bundesliga", "germany bundesliga"] },
  { id: "4", key: "LA_LIGA", aliases: ["soccer spain la liga", "la liga", "primera division"] },
  { id: "6", key: "SERIE_A", aliases: ["soccer italy serie a", "serie a"] },
  { id: "8", key: "MLS", aliases: ["soccer usa mls", "major league soccer", "united states mls", " mls"] },
  { id: "13", key: "LIGUE_1", aliases: ["soccer france ligue 1", "ligue 1"] },
  { id: "42", key: "ELITESERIEN", aliases: ["soccer norway eliteserien", "norway eliteserien", "eliteserien"] }
]);

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

function competitionForMatch(match = {}) {
  const value = ` ${clean(`${match.sport || ""} ${match.league || ""}`, 240).toLowerCase()} `;
  return SUPPORTED_COMPETITIONS.find((competition) =>
    competition.aliases.some((alias) => value.includes(alias))
  ) || null;
}

function utcDate(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function sportsDataSoccerBoxScoresPath(match = {}) {
  const competition = competitionForMatch(match);
  const date = utcDate(match.commenceTime);
  return competition && date
    ? `/v4/soccer/stats/JSON/BoxScoresByDate/${competition.id}/${date}`
    : null;
}

function gameFromBoxScore(row = {}) {
  return row?.Game || row?.game || {};
}

function lineupsFromBoxScore(row = {}) {
  const rows = row?.Lineups || row?.lineups || [];
  return Array.isArray(rows) ? rows : [];
}

function matchConfidence(row = {}, match = {}) {
  const game = gameFromBoxScore(row);
  const home = teamSimilarity(game.HomeTeamName || game.homeTeamName, match.homeTeam);
  const away = teamSimilarity(game.AwayTeamName || game.awayTeamName, match.awayTeam);
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
    position: clean(row?.Position || row?.position, 20) || null,
    confirmed: true,
    importance: 1
  })).filter((row) => row.name);
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
  const homeConfirmed = homeStarters.length === REQUIRED_STARTERS_PER_TEAM;
  const awayConfirmed = awayStarters.length === REQUIRED_STARTERS_PER_TEAM;

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

  const updatedAt = clean(game.Updated || selected.row?.Updated, 80) || null;
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
          side: "home",
          startersConfirmed: true,
          goalieConfirmed: false,
          keyPlayersAvailable: null,
          lineupStability: 0,
          source: "sportsdata-soccer-lineups",
          sourceType: "official_data_provider",
          sourceTrust: 0.9,
          updatedAt,
          startingPlayers: starterPayload(homeStarters)
        },
        {
          team: match.awayTeam,
          side: "away",
          startersConfirmed: true,
          goalieConfirmed: false,
          keyPlayersAvailable: null,
          lineupStability: 0,
          source: "sportsdata-soccer-lineups",
          sourceType: "official_data_provider",
          sourceTrust: 0.9,
          updatedAt,
          startingPlayers: starterPayload(awayStarters)
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
  const competition = competitionForMatch(match);
  if (!competition) {
    return { ok: true, source: "sportsdata-soccer-lineups", mode: "unsupported_league", retrievedAt, data: { teams: [] } };
  }

  const eventAt = Date.parse(String(match.commenceTime || ""));
  if (!Number.isFinite(eventAt)) {
    return { ok: false, source: "sportsdata-soccer-lineups", mode: "invalid_event_time", retrievedAt, data: { teams: [] } };
  }
  const untilEventMs = eventAt - now;
  if (untilEventMs > MAX_LOOKAHEAD_MS) {
    return {
      ok: true,
      source: "sportsdata-soccer-lineups",
      mode: "not_yet_available",
      retrievedAt,
      lineupWindowOpensAt: new Date(eventAt - MAX_LOOKAHEAD_MS).toISOString(),
      data: { teams: [] }
    };
  }
  if (untilEventMs < -2 * 60 * 60 * 1000) {
    return { ok: true, source: "sportsdata-soccer-lineups", mode: "event_started", retrievedAt, data: { teams: [] } };
  }

  const path = sportsDataSoccerBoxScoresPath(match);
  if (!path) return { ok: false, source: "sportsdata-soccer-lineups", mode: "invalid_event_time", retrievedAt, data: { teams: [] } };
  const response = await cachedGet(path, get);
  if (!response?.ok || response?.mode !== "live") {
    return {
      ok: false,
      source: "sportsdata-soccer-lineups",
      providerSource: response?.source || "sportsdata",
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
    source: "sportsdata-soccer-lineups",
    providerFamily: "sportsdataio",
    competitionId: competition.id,
    competitionKey: competition.key,
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
  supportedCompetitions: SUPPORTED_COMPETITIONS.map(({ id, key }) => ({ id, key })),
  confirmationRule: "exactly-11-starters-for-both-teams",
  probabilityChanged: false,
  paperOnly: true
});
