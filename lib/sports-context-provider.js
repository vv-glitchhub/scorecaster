function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, 0)));
}

function normalizeTeamContext(row = {}, fallbackTeam = "") {
  const starters = Array.isArray(row.starters) ? row.starters : Array.isArray(row.startingPlayers) ? row.startingPlayers : [];
  return {
    team: clean(row.team || row.teamName || fallbackTeam, 140),
    form: {
      sampleSize: Math.max(0, Math.min(20, finite(row.form?.sampleSize ?? row.sampleSize, 0))),
      strength: clamp(row.form?.strength ?? row.formStrength, -1, 1),
      weightedResultRate: clamp(row.form?.weightedResultRate ?? row.weightedResultRate, 0, 1),
      scoreMargin: clamp(row.form?.scoreMargin ?? row.normalizedScoreMargin, -1, 1)
    },
    schedule: {
      restHours: finite(row.schedule?.restHours ?? row.restHours),
      restDays: finite(row.schedule?.restDays ?? row.restDays),
      backToBack: Boolean(row.schedule?.backToBack ?? row.backToBack),
      gamesLast7Days: Math.max(0, Math.min(14, finite(row.schedule?.gamesLast7Days ?? row.gamesLast7Days, 0))),
      gamesLast14Days: Math.max(0, Math.min(28, finite(row.schedule?.gamesLast14Days ?? row.gamesLast14Days, 0)))
    },
    travel: {
      distanceKm: Math.max(0, finite(row.travel?.distanceKm ?? row.travelDistanceKm, 0)),
      timeZonesCrossed: Math.max(0, Math.min(12, finite(row.travel?.timeZonesCrossed ?? row.timeZonesCrossed, 0))),
      roadGamesInTrip: Math.max(0, Math.min(20, finite(row.travel?.roadGamesInTrip ?? row.roadGamesInTrip, 0)))
    },
    startersConfirmed: Boolean(row.startersConfirmed || row.confirmed),
    startingPlayers: starters.slice(0, 30).map((player) => ({
      name: clean(player?.name || player?.playerName || player, 120),
      position: clean(player?.position, 50) || null,
      confirmed: player?.confirmed !== false,
      importance: clamp(player?.importance ?? 1, 0.25, 3)
    })).filter((player) => player.name),
    updatedAt: row.updatedAt || row.timestamp || null
  };
}

function normalizeResponse(payload = {}, match = {}) {
  const data = payload.data || payload.context || payload;
  const home = normalizeTeamContext(data.home || data.homeTeam || {}, match.homeTeam);
  const away = normalizeTeamContext(data.away || data.awayTeam || {}, match.awayTeam);
  const venue = data.venue || {};
  return {
    home,
    away,
    venue: {
      name: clean(venue.name || match.venue, 160) || null,
      latitude: finite(venue.latitude ?? venue.lat),
      longitude: finite(venue.longitude ?? venue.lon ?? venue.lng),
      indoor: venue.indoor === true ? true : venue.outdoor === true ? false : null
    },
    source: clean(data.source || payload.source || "sports-context-provider", 100),
    sourceType: clean(data.sourceType || "official_data_provider", 60),
    sourceTrust: clamp(data.sourceTrust ?? 0.88, 0, 1),
    updatedAt: data.updatedAt || payload.updatedAt || new Date().toISOString()
  };
}

function configuredProvider() {
  const rawUrl = String(process.env.SPORTS_CONTEXT_API_URL || "").trim();
  const apiKey = String(process.env.SPORTS_CONTEXT_API_KEY || "").trim();
  if (!rawUrl || !apiKey) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    return { url, apiKey };
  } catch {
    return null;
  }
}

export async function fetchSportsContextForMatch(match = {}) {
  const provider = configuredProvider();
  const retrievedAt = new Date().toISOString();
  if (!provider) {
    return { ok: true, source: "sports-context-provider", mode: "not_configured", retrievedAt, data: null };
  }

  const url = new URL(provider.url);
  url.searchParams.set("home", String(match.homeTeam || ""));
  url.searchParams.set("away", String(match.awayTeam || ""));
  url.searchParams.set("sport", String(match.sportKey || match.sport || ""));
  url.searchParams.set("league", String(match.league || ""));
  if (match.eventId) url.searchParams.set("eventId", String(match.eventId));
  if (match.commenceTime) url.searchParams.set("commenceTime", String(match.commenceTime));

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
      headers: { Accept: "application/json", Authorization: `Bearer ${provider.apiKey}` }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      return { ok: false, source: "sports-context-provider", mode: "api_error", status: response.status, retrievedAt, data: null };
    }
    return {
      ok: true,
      source: "sports-context-provider",
      mode: "live",
      retrievedAt,
      data: normalizeResponse(payload, match)
    };
  } catch (error) {
    return {
      ok: false,
      source: "sports-context-provider",
      mode: error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "fetch_error",
      retrievedAt,
      data: null
    };
  }
}
