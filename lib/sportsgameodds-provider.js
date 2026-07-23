const BASE_URL = "https://api.sportsgameodds.com/v2/events";
const TIME_WINDOW_MS = 8 * 60 * 60 * 1000;

const DEFAULT_LEAGUE_MAP = Object.freeze({
  basketball_nba: "NBA",
  basketball_wnba: "WNBA",
  icehockey_nhl: "NHL",
  baseball_mlb: "MLB",
  americanfootball_nfl: "NFL",
  soccer_epl: "EPL",
  soccer_spain_la_liga: "LA_LIGA",
  soccer_usa_mls: "MLS"
});

function clean(value, limit = 160) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizedTeam(value) {
  return clean(value, 160)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|hc|bc|club|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamTokens(value) {
  return normalizedTeam(value).split(" ").filter((token) => token.length >= 3);
}

function teamMatches(candidate, expected) {
  const left = normalizedTeam(candidate);
  const right = normalizedTeam(expected);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftTokens = new Set(teamTokens(left));
  const rightTokens = teamTokens(right);
  const overlap = rightTokens.filter((token) => leftTokens.has(token));
  return overlap.length >= Math.min(2, rightTokens.length);
}

function leagueMap() {
  try {
    const configured = JSON.parse(process.env.SPORTSGAMEODDS_LEAGUE_MAP_JSON || "{}");
    return { ...DEFAULT_LEAGUE_MAP, ...(configured && typeof configured === "object" ? configured : {}) };
  } catch {
    return DEFAULT_LEAGUE_MAP;
  }
}

function americanToDecimal(value) {
  const number = Number(String(value || "").replace(/[^0-9+.-]/g, ""));
  if (!Number.isFinite(number) || number === 0) return null;
  return Number((number > 0 ? 1 + number / 100 : 1 + 100 / Math.abs(number)).toFixed(4));
}

function eventTeamName(event, side) {
  const team = event?.teams?.[side] || event?.[`${side}Team`] || event?.[`${side}_team`] || {};
  if (typeof team === "string") return team;
  return clean(team?.names?.long || team?.names?.medium || team?.name || team?.teamName || team?.displayName, 160);
}

function marketOdds(event, side) {
  const markets = event?.odds && typeof event.odds === "object" ? Object.values(event.odds) : [];
  const candidates = markets.filter((market) => {
    const sideId = String(market?.sideID || market?.sideId || "").toLowerCase();
    const betType = String(market?.betTypeID || market?.betTypeId || "").toLowerCase();
    const period = String(market?.periodID || market?.periodId || "").toLowerCase();
    return sideId === side && ["ml", "moneyline"].includes(betType) && ["game", "all", "reg", ""].includes(period);
  });

  const rows = [];
  for (const market of candidates) {
    const byBookmaker = market?.byBookmaker && typeof market.byBookmaker === "object" ? market.byBookmaker : {};
    for (const [bookmaker, quote] of Object.entries(byBookmaker)) {
      if (quote?.available === false) continue;
      const decimal = americanToDecimal(quote?.odds);
      if (!decimal) continue;
      rows.push({
        bookmaker: clean(bookmaker, 80),
        odds: decimal,
        updatedAt: quote?.lastUpdatedAt || event?.updatedAt || null
      });
    }
  }
  return rows;
}

function summarizeSide(rows = []) {
  if (!rows.length) return { best: null, average: null, bookmakerCount: 0, latestAt: null, quotes: [] };
  const odds = rows.map((row) => row.odds).filter(Number.isFinite);
  const latest = rows.map((row) => Date.parse(row.updatedAt || "")).filter(Number.isFinite).sort((a, b) => b - a)[0];
  return {
    best: Math.max(...odds),
    average: Number((odds.reduce((sum, value) => sum + value, 0) / odds.length).toFixed(4)),
    bookmakerCount: new Set(rows.map((row) => row.bookmaker)).size,
    latestAt: latest ? new Date(latest).toISOString() : null,
    quotes: rows.slice(0, 30)
  };
}

function findMatchingEvent(events, match) {
  return events.find((event) => {
    const home = eventTeamName(event, "home");
    const away = eventTeamName(event, "away");
    return teamMatches(home, match.homeTeam) && teamMatches(away, match.awayTeam);
  }) || events.find((event) => {
    const home = eventTeamName(event, "home");
    const away = eventTeamName(event, "away");
    return teamMatches(home, match.awayTeam) && teamMatches(away, match.homeTeam);
  }) || null;
}

export async function fetchSportsGameOddsForMatch(match = {}) {
  const apiKey = String(process.env.SPORTSGAMEODDS_API_KEY || "").trim();
  const retrievedAt = new Date().toISOString();
  if (!apiKey) {
    return { ok: true, source: "sportsgameodds", mode: "not_configured", retrievedAt, data: null };
  }

  const leagueID = leagueMap()[match.sportKey || match.sport || match.league] || null;
  if (!leagueID) {
    return { ok: true, source: "sportsgameodds", mode: "unsupported_league", retrievedAt, data: null };
  }

  const commence = Date.parse(match.commenceTime || match.commence_time || "");
  const center = Number.isFinite(commence) ? commence : Date.now();
  const url = new URL(BASE_URL);
  url.searchParams.set("leagueID", leagueID);
  url.searchParams.set("oddsAvailable", "true");
  url.searchParams.set("includeOpenCloseOdds", "true");
  url.searchParams.set("startsAfter", new Date(center - TIME_WINDOW_MS).toISOString());
  url.searchParams.set("startsBefore", new Date(center + TIME_WINDOW_MS).toISOString());
  url.searchParams.set("limit", "50");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
      headers: { Accept: "application/json", "x-api-key": apiKey }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success === false) {
      return { ok: false, source: "sportsgameodds", mode: "api_error", status: response.status, retrievedAt, data: null };
    }
    const events = Array.isArray(payload?.data) ? payload.data : [];
    const event = findMatchingEvent(events, match);
    if (!event) {
      return { ok: true, source: "sportsgameodds", mode: "no_match", leagueID, retrievedAt, data: null };
    }

    const home = summarizeSide(marketOdds(event, "home"));
    const away = summarizeSide(marketOdds(event, "away"));
    return {
      ok: true,
      source: "sportsgameodds",
      mode: "live",
      leagueID,
      retrievedAt,
      data: {
        eventId: clean(event.eventID || event.id, 180),
        homeTeam: eventTeamName(event, "home") || match.homeTeam,
        awayTeam: eventTeamName(event, "away") || match.awayTeam,
        commenceTime: event.startsAt || event.startTime || match.commenceTime || null,
        home,
        away,
        openCloseAvailable: Boolean(Object.values(event?.odds || {}).some((market) => market?.openBookOdds || market?.closeBookOdds || market?.openOdds || market?.closeOdds))
      }
    };
  } catch (error) {
    return {
      ok: false,
      source: "sportsgameodds",
      mode: error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "fetch_error",
      retrievedAt,
      data: null
    };
  }
}
