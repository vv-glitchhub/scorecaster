function clean(value, limit = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeTeamRow(data = {}, fallbackTeam = "") {
  const team = clean(
    data.team || data.teamName || data.name || data.club || fallbackTeam,
    120
  );
  if (!team) return null;

  return {
    team,
    startersConfirmed: Boolean(data.startersConfirmed || data.confirmed || data.isConfirmed),
    goalieConfirmed: Boolean(data.goalieConfirmed || data.startingGoalieConfirmed),
    keyPlayersAvailable: data.keyPlayersAvailable === false ? false : data.keyPlayersAvailable === true ? true : null,
    lineupStability: Math.max(-1, Math.min(1, Number(data.lineupStability || data.stability || 0))),
    source: clean(data.source || "lineup-provider", 100),
    sourceType: clean(data.sourceType || "official_data_provider", 60),
    sourceTrust: 0.9,
    updatedAt: data.updatedAt || data.confirmedAt || data.timestamp || null
  };
}

function extractTeamRows(payload = {}, homeTeam, awayTeam) {
  const rows = [];
  const data = payload.lineup || payload.data || payload;

  if (Array.isArray(data)) rows.push(...data);
  if (Array.isArray(data?.teams)) rows.push(...data.teams);
  if (Array.isArray(data?.lineups)) rows.push(...data.lineups);
  if (data?.home && typeof data.home === "object") rows.push({ ...data.home, team: data.home.team || homeTeam });
  if (data?.away && typeof data.away === "object") rows.push({ ...data.away, team: data.away.team || awayTeam });
  if (data?.homeTeam && typeof data.homeTeam === "object") rows.push({ ...data.homeTeam, team: data.homeTeam.team || homeTeam });
  if (data?.awayTeam && typeof data.awayTeam === "object") rows.push({ ...data.awayTeam, team: data.awayTeam.team || awayTeam });

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

export async function fetchLineupForMatch({ homeTeam, awayTeam, sport, league, eventId, commenceTime }) {
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
