import { fetchSportsDataSoccerLineupForMatch } from "./sportsdata-soccer-lineup-provider.js";

function clean(value, limit = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeStartingPlayers(data = {}) {
  const rows = Array.isArray(data.startingPlayers)
    ? data.startingPlayers
    : Array.isArray(data.starters)
      ? data.starters
      : [];
  return rows.slice(0, 20).map((player) => ({
    name: clean(player?.name || player?.playerName || "", 120),
    position: clean(player?.position || "", 20) || null,
    confirmed: player?.confirmed !== false,
    importance: Number.isFinite(Number(player?.importance)) ? Number(player.importance) : 1,
    playerId: player?.playerId ?? player?.PlayerId ?? null
  })).filter((player) => player.name);
}

function normalizeTeamRow(data = {}, fallbackTeam = "") {
  const team = clean(
    data.team || data.teamName || data.name || data.club || fallbackTeam,
    120
  );
  if (!team) return null;

  return {
    team,
    side: data.side === "home" || data.side === "away" ? data.side : null,
    startersConfirmed: Boolean(data.startersConfirmed || data.confirmed || data.isConfirmed),
    goalieConfirmed: Boolean(data.goalieConfirmed || data.startingGoalieConfirmed),
    keyPlayersAvailable: data.keyPlayersAvailable === false ? false : data.keyPlayersAvailable === true ? true : null,
    lineupStability: Math.max(-1, Math.min(1, Number(data.lineupStability || data.stability || 0))),
    source: clean(data.source || "lineup-provider", 100),
    sourceType: clean(data.sourceType || "official_data_provider", 60),
    sourceTrust: Math.max(0, Math.min(1, Number(data.sourceTrust || 0.9))),
    updatedAt: data.updatedAt || data.confirmedAt || data.timestamp || null,
    startingPlayers: normalizeStartingPlayers(data)
  };
}

function extractTeamRows(payload = {}, homeTeam, awayTeam) {
  const rows = [];
  const data = payload.lineup || payload.data || payload;

  if (Array.isArray(data)) rows.push(...data);
  if (Array.isArray(data?.teams)) rows.push(...data.teams);
  if (Array.isArray(data?.lineups)) rows.push(...data.lineups);
  if (data?.home && typeof data.home === "object") rows.push({ ...data.home, team: data.home.team || homeTeam, side: "home" });
  if (data?.away && typeof data.away === "object") rows.push({ ...data.away, team: data.away.team || awayTeam, side: "away" });
  if (data?.homeTeam && typeof data.homeTeam === "object") rows.push({ ...data.homeTeam, team: data.homeTeam.team || homeTeam, side: "home" });
  if (data?.awayTeam && typeof data.awayTeam === "object") rows.push({ ...data.awayTeam, team: data.awayTeam.team || awayTeam, side: "away" });

  const normalized = [];
  const seen = new Set();
  for (const row of rows) {
    const item = normalizeTeamRow(row);
    if (!item) continue;
    const key = item.team.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
  }
  return normalized.slice(0, 4);
}

function configuredProvider() {
  const baseUrl = String(process.env.LINEUP_API_URL || "").trim();
  const apiKey = String(process.env.LINEUP_API_KEY || "").trim();
  if (!baseUrl || !apiKey) return null;

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:") return null;
    return { url, apiKey };
  } catch {
    return null;
  }
}

async function fetchConfiguredLineup({ homeTeam, awayTeam, sport, league, eventId, commenceTime }) {
  const provider = configuredProvider();
  const retrievedAt = new Date().toISOString();

  if (!provider) {
    return {
      ok: true,
      source: "lineup-provider",
      mode: "not_configured",
      teams: [homeTeam, awayTeam],
      retrievedAt,
      data: { teams: [] }
    };
  }

  const url = new URL(provider.url);
  url.searchParams.set("home", String(homeTeam || ""));
  url.searchParams.set("away", String(awayTeam || ""));
  url.searchParams.set("sport", String(sport || ""));
  url.searchParams.set("league", String(league || ""));
  if (eventId) url.searchParams.set("eventId", String(eventId));
  if (commenceTime) url.searchParams.set("commenceTime", String(commenceTime));

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        Accept: "application/json"
      }
    });
    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        source: "lineup-provider",
        mode: "api_error",
        status: res.status,
        retrievedAt,
        data: { teams: [] }
      };
    }

    const teams = extractTeamRows(data, homeTeam, awayTeam).map((row) => ({
      ...row,
      updatedAt: row.updatedAt || retrievedAt
    }));

    return {
      ok: true,
      source: "lineup-provider",
      mode: "live",
      teams: [homeTeam, awayTeam],
      retrievedAt,
      count: teams.length,
      data: { teams }
    };
  } catch {
    return {
      ok: false,
      source: "lineup-provider",
      mode: "fetch_error",
      retrievedAt,
      data: { teams: [] }
    };
  }
}

function bothTeamsConfirmed(result = {}) {
  const rows = Array.isArray(result?.data?.teams) ? result.data.teams : [];
  return rows.filter((row) => row?.startersConfirmed === true).length >= 2;
}

export async function fetchLineupForMatch(match) {
  const primary = await fetchConfiguredLineup(match);
  if (primary.mode === "live" && bothTeamsConfirmed(primary)) {
    return {
      ...primary,
      fallbackUsed: false,
      providerFamily: primary.providerFamily || "configured-lineup-provider"
    };
  }

  const fallback = await fetchSportsDataSoccerLineupForMatch(match);
  if (fallback.mode === "live" && bothTeamsConfirmed(fallback)) {
    return {
      ...fallback,
      fallbackUsed: true,
      fallbackFrom: {
        source: primary.source,
        mode: primary.mode,
        ok: primary.ok === true
      }
    };
  }

  if (primary.mode === "not_configured") {
    if (fallback.mode !== "unsupported_league") {
      return {
        ...fallback,
        fallbackUsed: false,
        fallbackAttempted: true,
        primaryProviderMode: primary.mode
      };
    }
    return {
      ...primary,
      sportsDataFallbackMode: fallback.mode,
      fallbackAttempted: false
    };
  }

  return {
    ...primary,
    fallbackUsed: false,
    fallbackAttempted: fallback.mode !== "unsupported_league",
    sportsDataFallbackMode: fallback.mode,
    sportsDataSubscriptionUnavailable: fallback.subscriptionUnavailable === true
  };
}

export const LINEUP_FETCHER_POLICY = Object.freeze({
  configuredProviderFirst: true,
  sportsDataSoccerFallback: true,
  fallbackRequiresBothTeamsConfirmed: true,
  probabilityChanged: false,
  paperOnly: true
});
