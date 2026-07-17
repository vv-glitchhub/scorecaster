import { sportsDataGet } from "./sportsdata-fetcher";

function text(value, max = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeInjuryItem(item = {}) {
  const name = text(item.Name || item.PlayerName || item.FullName || item.name || item.player, 120);
  const team = text(item.Team || item.TeamKey || item.TeamName || item.team, 120);
  const status = text(item.Status || item.InjuryStatus || item.GameStatus || item.status, 80);
  if (!name || !team || !status) return null;

  return {
    name,
    team,
    status,
    injury: text(item.BodyPart || item.Injury || item.InjuryNotes || item.reason, 180) || null,
    importance: Number.isFinite(Number(item.importance)) ? Math.max(0, Math.min(5, Number(item.importance))) : 0,
    source: "sportsdata",
    sourceType: "official_data_provider",
    sourceTrust: 0.85,
    updatedAt: item.Updated || item.UpdatedAt || item.updatedAt || item.date || null
  };
}

function sportToSportsDataLeague(sport = "", league = "") {
  const value = `${sport} ${league}`.toLowerCase();
  if (value.includes("nfl")) return "nfl";
  if (value.includes("nba")) return "nba";
  if (value.includes("nhl")) return "nhl";
  if (value.includes("mlb")) return "mlb";
  return null;
}

function tokens(value) {
  return text(value, 160).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3);
}

function sameTeam(providerTeam, requestedTeam) {
  const providerTokens = tokens(providerTeam);
  const requestedTokens = tokens(requestedTeam);
  if (!providerTokens.length || !requestedTokens.length) return false;
  const shared = providerTokens.filter((token) => requestedTokens.includes(token));
  return shared.length >= Math.min(2, providerTokens.length, requestedTokens.length);
}

function teamMatches(item, homeTeam, awayTeam) {
  const providerTeam = item.Team || item.TeamKey || item.TeamName || item.team;
  return sameTeam(providerTeam, homeTeam) || sameTeam(providerTeam, awayTeam);
}

export async function fetchInjuriesForMatch({ homeTeam, awayTeam, sport, league }) {
  const selectedLeague = sportToSportsDataLeague(sport, league);
  const retrievedAt = new Date().toISOString();

  if (!selectedLeague) {
    return {
      ok: true,
      source: "sportsdata-injury-fetcher",
      mode: "unsupported_league",
      teams: [homeTeam, awayTeam],
      retrievedAt,
      data: []
    };
  }

  const result = await sportsDataGet(`/v3/${selectedLeague}/scores/json/Injuries`);
  if (!result.ok || result.mode !== "live") {
    return {
      ...result,
      teams: [homeTeam, awayTeam],
      retrievedAt,
      data: []
    };
  }

  const rawItems = Array.isArray(result.data) ? result.data : [];
  const data = rawItems
    .filter((item) => teamMatches(item, homeTeam, awayTeam))
    .map(normalizeInjuryItem)
    .filter(Boolean)
    .slice(0, 30);

  return {
    ok: true,
    source: "sportsdata",
    mode: "live",
    league: selectedLeague,
    teams: [homeTeam, awayTeam],
    retrievedAt,
    count: data.length,
    data
  };
}
