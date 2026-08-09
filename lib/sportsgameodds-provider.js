import {
  evaluateSportsGameOddsCandidates,
  safeSportsGameOddsMatchDiagnostics,
  SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE,
  SPORTSGAMEODDS_TIME_WINDOW_HOURS
} from "./sportsgameodds-match-v3.mjs";

const BASE_URL = "https://api.sportsgameodds.com/v2/events";
const TIME_WINDOW_MS = SPORTSGAMEODDS_TIME_WINDOW_HOURS * 60 * 60 * 1000;

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
    const evaluation = evaluateSportsGameOddsCandidates(events, match);
    const matchDiagnostics = safeSportsGameOddsMatchDiagnostics(evaluation.diagnostics);
    const matchResult = evaluation.matchResult;

    if (!matchResult) {
      return {
        ok: true,
        source: "sportsgameodds",
        mode: "no_match",
        leagueID,
        retrievedAt,
        candidateCount: events.length,
        matchDiagnostics,
        data: null
      };
    }

    if (matchResult.confidence < SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE) {
      return {
        ok: true,
        source: "sportsgameodds",
        mode: "low_match_confidence",
        leagueID,
        retrievedAt,
        candidateCount: events.length,
        matchConfidence: Number(matchResult.confidence.toFixed(3)),
        matchDiagnostics,
        data: null
      };
    }

    const providerHome = summarizeSide(marketOdds(matchResult.event, "home"));
    const providerAway = summarizeSide(marketOdds(matchResult.event, "away"));
    const home = matchResult.swapped ? providerAway : providerHome;
    const away = matchResult.swapped ? providerHome : providerAway;
    return {
      ok: true,
      source: "sportsgameodds",
      mode: "live",
      leagueID,
      retrievedAt,
      matchConfidence: Number(matchResult.confidence.toFixed(3)),
      matchDiagnostics,
      orientation: matchResult.swapped ? "provider-sides-swapped" : "direct",
      data: {
        eventId: clean(matchResult.event.eventID || matchResult.event.id, 180),
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        providerHomeTeam: matchResult.providerHome,
        providerAwayTeam: matchResult.providerAway,
        commenceTime: matchResult.event.startsAt || matchResult.event.startTime || match.commenceTime || null,
        timeDifferenceHours: matchResult.timeDifferenceHours === null ? null : Number(matchResult.timeDifferenceHours.toFixed(2)),
        matchConfidence: Number(matchResult.confidence.toFixed(3)),
        orientation: matchResult.swapped ? "provider-sides-swapped" : "direct",
        home,
        away,
        openCloseAvailable: Boolean(Object.values(matchResult.event?.odds || {}).some((market) => market?.openBookOdds || market?.closeBookOdds || market?.openOdds || market?.closeOdds))
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

export { SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE };
