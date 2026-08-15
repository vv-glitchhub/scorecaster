import { sportsDataGet } from "./sportsdata-fetcher.js";

const INJURY_CACHE_TTL_MS = 2 * 60 * 1000;
const TEAM_DIRECTORY_TTL_MS = 6 * 60 * 60 * 1000;
const INJURY_CACHE_KEY = "__scorecasterSportsDataInjuryCacheV3";
const TEAM_CACHE_KEY = "__scorecasterSportsDataTeamDirectoryV1";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cacheStore(key) {
  if (!globalThis[key]) globalThis[key] = new Map();
  return globalThis[key];
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
  return normalizeTeam(value).split(" ").filter((token) => token.length >= 2);
}

function matchesTeam(candidate, expected) {
  const left = normalizeTeam(candidate);
  const right = normalizeTeam(expected);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const leftTokens = new Set(teamTokens(left));
  const rightTokens = teamTokens(right);
  const overlap = rightTokens.filter((token) => leftTokens.has(token));
  return overlap.length >= Math.min(2, rightTokens.length);
}

function providerTeam(item = {}) {
  return item.TeamName || item.FullTeamName || item.Team || item.TeamKey || item.team || item.teamName || "";
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
      item.InjuryStatus ||
      item.GameStatus ||
      item.Status ||
      item.status ||
      "unknown"
    ).trim().toLowerCase().slice(0, 80),
    injury: String(
      item.InjuryBodyPart ||
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
      item.InjuryStartDate ||
      item.updatedAt ||
      item.date ||
      retrievedAt
  };
}

export function sportToSportsDataLeague(sport = "", league = "") {
  const value = `${sport} ${league}`.toLowerCase();
  if (value.includes("wnba")) return "wnba";
  if (value.includes("nfl")) return "nfl";
  if (value.includes("nba")) return "nba";
  if (value.includes("nhl")) return "nhl";
  if (value.includes("mlb")) return "mlb";
  return null;
}

export function sportsDataInjuryPath(selectedLeague) {
  if (selectedLeague === "wnba") return "/v3/wnba/scores/JSON/Players";
  return selectedLeague ? `/v3/${selectedLeague}/scores/json/Injuries` : null;
}

export function filterSportsDataInjuryRows(selectedLeague, rows = []) {
  if (!Array.isArray(rows)) return [];
  if (selectedLeague !== "wnba") return rows;
  return rows.filter((row) => String(row?.InjuryStatus || "").trim().length > 0);
}

function teamDirectoryRow(row = {}) {
  const key = String(row.Key || row.Team || row.TeamKey || "").trim();
  const city = String(row.City || "").trim();
  const name = String(row.Name || row.FullName || row.TeamName || "").trim();
  const fullName = String(row.FullName || row.TeamName || `${city} ${name}`).replace(/\s+/g, " ").trim();
  const teamId = row.TeamID ?? row.TeamId ?? row.GlobalTeamID ?? null;
  if (!key && !fullName && teamId == null) return null;
  return { key, city, name, fullName, teamId: teamId == null ? null : String(teamId) };
}

async function cachedSportsData(path, cacheKey, ttlMs, get = sportsDataGet) {
  const store = cacheStore(cacheKey);
  const now = Date.now();
  const cached = store.get(path);
  if (cached && now - cached.storedAt <= ttlMs) return { ...cached.result, cached: true };

  const result = await get(path);
  if (result.ok === true && result.mode === "live") {
    store.set(path, { storedAt: now, result });
  }
  return { ...result, cached: false };
}

async function fetchTeamDirectory(selectedLeague, get = sportsDataGet) {
  const result = await cachedSportsData(
    `/v3/${selectedLeague}/scores/json/Teams`,
    TEAM_CACHE_KEY,
    TEAM_DIRECTORY_TTL_MS,
    get
  );
  if (!result.ok || result.mode !== "live" || !Array.isArray(result.data)) return [];
  return result.data.map(teamDirectoryRow).filter(Boolean);
}

function directoryMatch(item, expected, directory = []) {
  const providerValue = providerTeam(item);
  const itemTeamId = item.TeamID ?? item.TeamId ?? item.GlobalTeamID ?? null;

  for (const row of directory) {
    const idMatch = itemTeamId != null && row.teamId != null && String(itemTeamId) === row.teamId;
    const keyMatch = providerValue && row.key && normalizeTeam(providerValue) === normalizeTeam(row.key);
    if (!idMatch && !keyMatch) continue;
    if ([row.fullName, row.city, row.name].some((candidate) => matchesTeam(candidate, expected))) return true;
  }
  return false;
}

function attributedTeam(item, homeTeam, awayTeam, directory = []) {
  const team = providerTeam(item);
  if (matchesTeam(team, homeTeam) || directoryMatch(item, homeTeam, directory)) return homeTeam;
  if (matchesTeam(team, awayTeam) || directoryMatch(item, awayTeam, directory)) return awayTeam;
  return null;
}

export async function fetchInjuriesForMatch(
  { homeTeam, awayTeam, sport, league },
  { get = sportsDataGet } = {}
) {
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

  const injuryPath = sportsDataInjuryPath(selectedLeague);
  const [result, directory] = await Promise.all([
    cachedSportsData(
      injuryPath,
      INJURY_CACHE_KEY,
      INJURY_CACHE_TTL_MS,
      get
    ),
    fetchTeamDirectory(selectedLeague, get)
  ]);

  if (!result.ok) {
    return {
      ...result,
      teams: [homeTeam, awayTeam],
      retrievedAt,
      coverageChecked: false,
      data: []
    };
  }

  const rawItems = filterSportsDataInjuryRows(selectedLeague, result.data);
  const filtered = [];
  for (const item of rawItems) {
    const team = attributedTeam(item, homeTeam, awayTeam, directory);
    if (!team) continue;
    filtered.push(normalizeInjuryItem({ ...item, TeamName: team }, retrievedAt));
  }

  return {
    ok: true,
    source: result.mode === "live" ? "sportsdata" : result.source || "sportsdata-injury-fetcher",
    mode: result.mode,
    league: selectedLeague,
    path: injuryPath,
    teams: [homeTeam, awayTeam],
    retrievedAt,
    coverageChecked: result.mode === "live",
    providerTeamDirectory: directory.length > 0,
    rawProviderCount: Array.isArray(result.data) ? result.data.length : 0,
    injuryCandidateCount: rawItems.length,
    count: filtered.length,
    data: filtered.slice(0, 50)
  };
}

export function resetInjuryFetcherCachesForTests() {
  cacheStore(INJURY_CACHE_KEY).clear();
  cacheStore(TEAM_CACHE_KEY).clear();
}

export const INJURY_FETCHER_POLICY = Object.freeze({
  injuryCacheTtlMs: INJURY_CACHE_TTL_MS,
  teamDirectoryTtlMs: TEAM_DIRECTORY_TTL_MS,
  supportedLeagues: ["wnba", "nfl", "nba", "nhl", "mlb"],
  wnbaEndpoint: "/v3/wnba/scores/JSON/Players",
  wnbaHealthyPlayersExcluded: true
});
