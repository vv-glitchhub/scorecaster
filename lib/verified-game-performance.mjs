// Point-in-time game-performance evidence derived ONLY from independently
// verified final scores. This module does not invent possession, shots or xG.
export const VERIFIED_GAME_DATA_VERSION = "scorecaster-verified-game-performance-v1";

function score(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isSafeInteger(num) && num >= 0 ? num : null;
}
const clean = (v) => String(v ?? "").trim();
const cleanTime = (v) => {
  const n = Date.parse(String(v || ""));
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
};

export function normalizeVerifiedMatchOutcome(row = {}) {
  if (row?.status !== "final" || row?.finality_verified !== true) return null;
  const home = clean(row.home_team);
  const away = clean(row.away_team);
  const homeScore = score(row.home_score);
  const awayScore = score(row.away_score);
  const matchTime = cleanTime(row.commence_time);
  const capturedAt = cleanTime(row.captured_at);
  const key = clean(row.event_id);
  const league = clean(row.sport_key);
  if (!key || !league || !home || !away || home === away ||
      homeScore === null || awayScore === null || !matchTime || !capturedAt) return null;

  const homeResult = homeScore > awayScore ? "W" : homeScore === awayScore ? "D" : "L";
  const awayResult = homeResult === "W" ? "L" : homeResult === "L" ? "W" : "D";
  return {
    eventId: key,
    sportKey: league,
    kickoffAt: matchTime,
    capturedAt,
    finalVerified: true,
    score: { home: homeScore, away: awayScore },
    teams: [
      { team: home, opponent: away, home: true,
        goalsFor: homeScore, goalsAgainst: awayScore, result: homeResult,
        points: homeResult === "W" ? 3 : homeResult === "D" ? 1 : 0 },
      { team: away, opponent: home, home: false,
        goalsFor: awayScore, goalsAgainst: homeScore, result: awayResult,
        points: awayResult === "W" ? 3 : awayResult === "D" ? 1 : 0 }
    ],
    // The following are UNKNOWN without a real independently licensed feed.
    shotsFor: null,
    shotsAgainst: null,
    expectedGoals: null,
    playerStatistics: null,
    source: "scorecaster-verified-event-outcomes",
    generatedFromConfirmedResult: true
  };
}

export function buildVerifiedGamePerformance(rows = [], {
  sportKey,
  team,
  before,
  limit = 100
} = {}) {
  const expectedSport = clean(sportKey);
  const normalizedTeam = clean(team).toLowerCase();
  const beforeMs = before ? Date.parse(before) : Infinity;
  if (before && !Number.isFinite(beforeMs)) throw new TypeError("Invalid historical cutoff");
  const max = Math.min(500, Math.max(1, Number.isInteger(limit) ? limit : 100));
  const byId = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const game = normalizeVerifiedMatchOutcome(row);
    if (!game || (expectedSport && game.sportKey !== expectedSport)) continue;
    const kick = Date.parse(game.kickoffAt);
    if (kick >= beforeMs) continue; // no target-game or future-score leakage
    if (normalizedTeam && !game.teams.some((t) => t.team.toLowerCase() === normalizedTeam)) continue;
    // Prefer the latest verified snapshot for a duplicated provider event ID.
    const previous = byId.get(game.eventId);
    if (!previous || game.capturedAt > previous.capturedAt) byId.set(game.eventId, game);
  }
  const games = [...byId.values()].sort((a,b)=>Date.parse(b.kickoffAt)-Date.parse(a.kickoffAt)).slice(0,max);
  const teamMatches = games.flatMap((game) => game.teams.map((t) => ({
    eventId: game.eventId,
    sportKey: game.sportKey,
    kickoffAt: game.kickoffAt,
    capturedAt: game.capturedAt,
    finalVerified: true,
    ...t
  }))).filter((record)=>!normalizedTeam || record.team.toLowerCase()===normalizedTeam);
  return {
    version: VERIFIED_GAME_DATA_VERSION,
    source: "scorecaster_event_outcomes_v1",
    gameCount: games.length,
    teamMatchCount: teamMatches.length,
    verifiedScoresOnly: true,
    advancedStatisticsAvailable: false,
    missing: ["shots", "xg", "possession", "corners", "player-minutes", "injuries"],
    games,
    teamMatches
  };
}
