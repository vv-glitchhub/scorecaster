const BASE_URL = "https://api.sportsgameodds.com/v2/events";
const TIME_WINDOW_MS = 8 * 60 * 60 * 1000;
const MIN_MATCH_CONFIDENCE = 0.72;

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

function teamSimilarity(candidate, expected) {
  const left = normalizedTeam(candidate);
  const right = normalizedTeam(expected);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const leftTokens = new Set(teamTokens(left));
  const rightTokens = new Set(teamTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...rightTokens].filter((token) => leftTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return Math.min(0.85, overlap / Math.max(1, union) + (overlap >= 2 ? 0.2 : 0));
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

function eventStart(event) {
  const value = event?.startsAt || event?.startTime || event?.commenceTime || event?.commence_time;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
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

function scoreEvent(event, match, swapped = false) {
  const providerHome = eventTeamName(event, "home");
  const providerAway = eventTeamName(event, "away");
  const expectedHome = swapped ? match.awayTeam : match.homeTeam;
  const expectedAway = swapped ? match.homeTeam : match.awayTeam;
  const homeScore = teamSimilarity(providerHome, expectedHome);
  const awayScore = teamSimilarity(providerAway, expectedAway);
  const targetStart = Date.parse(match.commenceTime || match.commence_time || "");
  const providerStart = eventStart(event);
  const timeDifferenceHours = Number.isFinite(targetStart) && providerStart !== null
    ? Math.abs(providerStart - targetStart) / 3_600_000
    : null;
  const timeScore = timeDifferenceHours === null ? 0.5 : Math.max(0, 1 - timeDifferenceHours / 8);
  const confidence = (homeScore + awayScore) / 2 * 0.85 + timeScore * 0.15;
  return { event, swapped, providerHome, providerAway, homeScore, awayScore, timeDifferenceHours, confidence };
}

function findMatchingEvent(events, match) {
  const candidates = [];
  for (const event of events) {
    candidates.push(scoreEvent(event, match, false), scoreEvent(event, match, true));
  }
  return candidates
    .filter((candidate) => candidate.homeScore >= 0.55 && candidate.awayScore >= 0.55)
    .filter((candidate) => candidate.timeDifferenceHours === null || candidate.timeDifferenceHours <= 8)
    .sort((left, right) => right.confidence - left.confidence)[0] || null;
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
    const matchResult = findMatchingEvent(events, match);
    if (!matchResult) {
      return { ok: true, source: "sportsgameodds", mode: "no_match", leagueID, retrievedAt, candidateCount: events.length, data: null };
    }
    if (matchResult.confidence < MIN_MATCH_CONFIDENCE) {
      return {
        ok: true,
        source: "sportsgameodds",
        mode: "low_match_confidence",
        leagueID,
        retrievedAt,
        candidateCount: events.length,
        matchConfidence: Number(matchResult.confidence.toFixed(3)),
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

export const SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE = MIN_MATCH_CONFIDENCE;