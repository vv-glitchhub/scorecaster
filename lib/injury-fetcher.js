import { sportsDataGet } from "./sportsdata-fetcher";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTeam(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|hc|bc|club|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamTokens(value) {
  return normalizeTeam(value).split(" ").filter((token) => token.length >= 3);
}

function matchesTeam(candidate, expected) {
  const left = normalizeTeam(candidate);
  const right = normalizeTeam(expected);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftTokens = new Set(teamTokens(left));
  const rightTokens = teamTokens(right);
  const overlap = rightTokens.filter((token) => leftTokens.has(token));
  return overlap.length >= Math.min(2, rightTokens.length);
}

function providerTeam(item = {}) {
  return item.Team || item.TeamName || item.TeamKey || item.team || item.teamName || "";
}

function normalizeInjuryItem(item = {}, retrievedAt) {
  return {
    name: String(
      item.Name ||
      item.PlayerName ||
      item.FullName ||
      item.name ||
      item.player ||
      "player"
    ).trim().slice(0, 120),
    team: String(providerTeam(item)).trim().slice(0, 120),
    status: String(
      item.Status ||
      item.InjuryStatus ||
      item.GameStatus ||
      item.status ||
      "unknown"
    ).trim().toLowerCase().slice(0, 80),
    injury: String(
      item.BodyPart ||
      item.Injury ||
      item.InjuryNotes ||
      item.reason ||
      ""
    ).trim().slice(0, 160) || null,
    importance: clamp(Number(item.importance || 1), 0.25, 3),
    source: "sportsdata",
    sourceType: "official_data_provider",
    sourceTrust: 0.9,
    updatedAt:
      item.Updated ||
      item.UpdatedAt ||
      item.updatedAt ||
      item.date ||
      retrievedAt
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

function attributedTeam(item, homeTeam, awayTeam) {
  const team = providerTeam(item);
  if (matchesTeam(team, homeTeam)) return homeTeam;
  if (matchesTeam(team, awayTeam)) return awayTeam;
  return null;
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
      coverageChecked: false,
      data: []
    };
  }

  const result = await sportsDataGet(`/v3/${selectedLeague}/scores/json/Injuries`);
  if (!result.ok) {
    return {
      ...result,
      teams: [homeTeam, awayTeam],
      retrievedAt,
      coverageChecked: false,
      data: []
    };
  }

  const rawItems = Array.isArray(result.data) ? result.data : [];
  const filtered = [];
  for (const item of rawItems) {
    const team = attributedTeam(item, homeTeam, awayTeam);
    if (!team) continue;
    filtered.push(normalizeInjuryItem({ ...item, Team: team }, retrievedAt));
  }

  return {
    ok: true,
    source: "sportsdata",
    mode: result.mode,
    league: selectedLeague,
    teams: [homeTeam, awayTeam],
    retrievedAt,
    coverageChecked: result.mode === "live",
    count: filtered.length,
    data: filtered.slice(0, 50)
  };
}
