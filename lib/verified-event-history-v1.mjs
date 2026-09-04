import { getSupabaseAdmin } from "./supabase-admin.js";

export const VERIFIED_EVENT_HISTORY_VERSION = "scorecaster-verified-event-history-v1";

const EUROPEAN_SOCCER_STANDINGS = new Set([
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one"
]);

const OUTCOME_COLUMNS = "event_id,sport_key,league,home_team,away_team,commence_time,home_score,away_score,outcome,confidence,source_count,finality_verified";

function clean(value, maximum = 180) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeOutcome(row = {}) {
  const homeScore = finite(row.home_score);
  const awayScore = finite(row.away_score);
  const eventId = clean(row.event_id, 180);
  const homeTeam = clean(row.home_team, 140);
  const awayTeam = clean(row.away_team, 140);
  const commenceTime = timestamp(row.commence_time);
  if (!eventId || !homeTeam || !awayTeam || homeScore === null || awayScore === null || commenceTime === null || row.finality_verified !== true) return null;
  return {
    eventId,
    sportKey: clean(row.sport_key, 120),
    league: clean(row.league, 120) || null,
    homeTeam,
    awayTeam,
    commenceTime: new Date(commenceTime).toISOString(),
    homeScore,
    awayScore,
    outcome: clean(row.outcome, 30) || (homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw"),
    confidence: finite(row.confidence),
    sourceCount: Math.max(0, Math.trunc(finite(row.source_count) || 0)),
    finalityVerified: true
  };
}

function seasonStartFor(cutoffMs) {
  const date = new Date(cutoffMs);
  const year = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 6, 1, 0, 0, 0)).toISOString();
}

function standingRow(name) {
  return { team: name, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
}

export function buildVerifiedStandings(rows = []) {
  const table = new Map();
  for (const raw of Array.isArray(rows) ? rows : []) {
    const row = safeOutcome(raw);
    if (!row) continue;
    if (!table.has(row.homeTeam)) table.set(row.homeTeam, standingRow(row.homeTeam));
    if (!table.has(row.awayTeam)) table.set(row.awayTeam, standingRow(row.awayTeam));
    const home = table.get(row.homeTeam);
    const away = table.get(row.awayTeam);
    home.played += 1;
    away.played += 1;
    home.goalsFor += row.homeScore;
    home.goalsAgainst += row.awayScore;
    away.goalsFor += row.awayScore;
    away.goalsAgainst += row.homeScore;
    if (row.homeScore > row.awayScore) {
      home.wins += 1; home.points += 3; away.losses += 1;
    } else if (row.homeScore < row.awayScore) {
      away.wins += 1; away.points += 3; home.losses += 1;
    } else {
      home.draws += 1; away.draws += 1; home.points += 1; away.points += 1;
    }
  }
  return [...table.values()]
    .map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort((left, right) => right.points - left.points || right.goalDifference - left.goalDifference || right.goalsFor - left.goalsFor || left.team.localeCompare(right.team))
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function perspective(row, team) {
  const isHome = row.homeTeam === team;
  const goalsFor = isHome ? row.homeScore : row.awayScore;
  const goalsAgainst = isHome ? row.awayScore : row.homeScore;
  return {
    ...row,
    opponent: isHome ? row.awayTeam : row.homeTeam,
    venue: isHome ? "home" : "away",
    result: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
    goalsFor,
    goalsAgainst
  };
}

function recentFor(rows, team, maximum = 5) {
  return rows
    .filter((row) => row.homeTeam === team || row.awayTeam === team)
    .sort((a, b) => Date.parse(b.commenceTime) - Date.parse(a.commenceTime))
    .slice(0, maximum)
    .map((row) => perspective(row, team));
}

async function directionalH2h(admin, { sportKey, homeTeam, awayTeam, cutoffIso }) {
  const { data, error } = await admin
    .from("scorecaster_event_outcomes_v1")
    .select(OUTCOME_COLUMNS)
    .eq("sport_key", sportKey)
    .eq("home_team", homeTeam)
    .eq("away_team", awayTeam)
    .eq("finality_verified", true)
    .lt("commence_time", cutoffIso)
    .order("commence_time", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(safeOutcome).filter(Boolean);
}

async function currentSeasonRows(admin, { sportKey, cutoffIso, seasonStart }) {
  const { data, error } = await admin
    .from("scorecaster_event_outcomes_v1")
    .select(OUTCOME_COLUMNS)
    .eq("sport_key", sportKey)
    .eq("finality_verified", true)
    .gte("commence_time", seasonStart)
    .lt("commence_time", cutoffIso)
    .order("commence_time", { ascending: true })
    .limit(600);
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(safeOutcome).filter(Boolean);
}

export async function loadVerifiedEventHistoryV1({ sportKey, homeTeam, awayTeam, commenceTime } = {}) {
  const sport = clean(sportKey, 120);
  const home = clean(homeTeam, 140);
  const away = clean(awayTeam, 140);
  const cutoff = timestamp(commenceTime);
  const base = {
    version: VERIFIED_EVENT_HISTORY_VERSION,
    source: "scorecaster-canonical-outcomes",
    finalityRequired: true,
    rawProviderPayloadIncluded: false,
    paperOnly: true,
    h2h: [],
    recent: { home: [], away: [] },
    standings: { available: false, mode: "unsupported-or-unavailable", seasonStart: null, fixtureCount: 0, teamCount: 0, rows: [] }
  };
  if (!sport || !home || !away || cutoff === null) return { ...base, status: "invalid-event" };
  const admin = getSupabaseAdmin();
  if (!admin) return { ...base, status: "database-unavailable" };

  const cutoffIso = new Date(cutoff).toISOString();
  const seasonStart = seasonStartFor(cutoff);
  try {
    const standingsSupported = EUROPEAN_SOCCER_STANDINGS.has(sport);
    const [forward, reverse, seasonRows] = await Promise.all([
      directionalH2h(admin, { sportKey: sport, homeTeam: home, awayTeam: away, cutoffIso }),
      directionalH2h(admin, { sportKey: sport, homeTeam: away, awayTeam: home, cutoffIso }),
      standingsSupported ? currentSeasonRows(admin, { sportKey: sport, cutoffIso, seasonStart }) : Promise.resolve([])
    ]);
    const h2h = [...forward, ...reverse]
      .sort((a, b) => Date.parse(b.commenceTime) - Date.parse(a.commenceTime))
      .filter((row, index, all) => all.findIndex((candidate) => candidate.eventId === row.eventId) === index)
      .slice(0, 10);
    const table = standingsSupported ? buildVerifiedStandings(seasonRows) : [];
    return {
      ...base,
      status: "ready",
      cutoff: cutoffIso,
      h2h,
      recent: {
        home: recentFor(seasonRows, home),
        away: recentFor(seasonRows, away)
      },
      standings: standingsSupported ? {
        available: seasonRows.length > 0 && table.length > 1,
        mode: "derived-from-verified-final-results",
        seasonStart,
        fixtureCount: seasonRows.length,
        teamCount: table.length,
        rows: table
      } : base.standings
    };
  } catch {
    return { ...base, status: "query-unavailable" };
  }
}
