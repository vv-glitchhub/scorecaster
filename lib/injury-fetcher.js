import { sportsDataGet } from "./sportsdata-fetcher";

function normalizeInjuryItem(item = {}) {
  return {
    name:
      item.Name ||
      item.PlayerName ||
      item.FullName ||
      item.name ||
      item.player ||
      "Unknown player",
    team:
      item.Team ||
      item.TeamKey ||
      item.team ||
      "unknown",
    status:
      item.Status ||
      item.InjuryStatus ||
      item.GameStatus ||
      item.status ||
      "unknown",
    injury:
      item.BodyPart ||
      item.Injury ||
      item.InjuryNotes ||
      item.reason ||
      null,
    importance: Number(item.importance || 1),
    source: item.source || "sportsdata",
    sourceType: item.sourceType || "official_data_provider",
    sourceTrust: item.sourceTrust ?? 0.85,
    updatedAt:
      item.Updated ||
      item.UpdatedAt ||
      item.updatedAt ||
      item.date ||
      null
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

function teamMatches(item, homeTeam, awayTeam) {
  const teamText = `${item.Team || ""} ${item.TeamKey || ""} ${item.TeamName || ""}`.toLowerCase();
  const home = String(homeTeam || "").toLowerCase();
  const away = String(awayTeam || "").toLowerCase();

  if (!teamText) return true;

  return (
    home.includes(teamText) ||
    away.includes(teamText) ||
    teamText.includes(home.split(" ")[0]) ||
    teamText.includes(away.split(" ")[0])
  );
}

export async function fetchInjuriesForMatch({ homeTeam, awayTeam, sport, league }) {
  const selectedLeague = sportToSportsDataLeague(sport, league);

  if (!selectedLeague) {
    return {
      ok: true,
      source: "sportsdata-injury-fetcher",
      mode: "unsupported_league",
      teams: [homeTeam, awayTeam],
      data: []
    };
  }

  const result = await sportsDataGet(`/v3/${selectedLeague}/scores/json/Injuries`);

  if (!result.ok) {
    return {
      ...result,
      teams: [homeTeam, awayTeam],
      data: []
    };
  }

  const rawItems = Array.isArray(result.data) ? result.data : [];
  const filtered = rawItems.filter((item) => teamMatches(item, homeTeam, awayTeam));

  return {
    ok: true,
    source: "sportsdata",
    mode: result.mode,
    league: selectedLeague,
    teams: [homeTeam, awayTeam],
    count: filtered.length,
    data: filtered.map(normalizeInjuryItem)
  };
}
