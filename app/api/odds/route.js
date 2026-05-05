import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let cachedData = null;
let cachedAt = 0;

const CACHE_MS = 10 * 60 * 1000;

const DEMO_DATA = {
  source: "demo",
  status: "demo",
  provider: "demo",
  cached: false,
  reason:
    "Live-dataa ei saatu normalisoitua. Näytetään testidata, jotta käyttöliittymää voi käyttää.",
  matches: [
    {
      id: "demo-nhl-1",
      sport_key: "icehockey_nhl",
      sport_title: "NHL",
      commence_time: new Date().toISOString(),
      home_team: "Florida Panthers",
      away_team: "Tampa Bay Lightning",
      bestOdds: {
        home: 2.05,
        draw: null,
        away: 1.82,
        point: null,
        over: null,
        under: null,
        spreadPointHome: null,
        spreadPointAway: null,
        spreadHome: null,
        spreadAway: null,
      },
    },
  ],
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function getArrayFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function extractName(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "string") return value;

  return (
    value.name ||
    value.displayName ||
    value.fullName ||
    value.teamName ||
    value.shortName ||
    value.abbreviation ||
    value.id ||
    fallback
  );
}

function getEventId(event) {
  return String(
    firstDefined(
      event.eventID,
      event.eventId,
      event.gameID,
      event.gameId,
      event.id,
      event.event_id
    )
  );
}

function normalizeEventBase(event) {
  const eventID = getEventId(event);

  const homeTeam = extractName(
    firstDefined(
      event.homeTeam,
      event.home_team,
      event.home,
      event.teams?.home,
      event.competitors?.home,
      event.participants?.home,
      event.homeCompetitor
    ),
    "Home"
  );

  const awayTeam = extractName(
    firstDefined(
      event.awayTeam,
      event.away_team,
      event.away,
      event.teams?.away,
      event.competitors?.away,
      event.participants?.away,
      event.awayCompetitor
    ),
    "Away"
  );

  return {
    id: eventID,
    sport_key: String(firstDefined(event.sportID, event.sport, "HOCKEY")),
    sport_title: String(firstDefined(event.leagueID, event.league, "NHL")),
    commence_time: firstDefined(
      event.startTime,
      event.startDate,
      event.commence_time,
      event.gameTime,
      event.eventTime,
      null
    ),
    home_team: homeTeam,
    away_team: awayTeam,
    bestOdds: {
      home: null,
      draw: null,
      away: null,
      point: null,
      over: null,
      under: null,
      spreadPointHome: null,
      spreadPointAway: null,
      spreadHome: null,
      spreadAway: null,
    },
  };
}

function classifyOutcome(outcome, match) {
  const text = String(
    firstDefined(
      outcome.name,
      outcome.label,
      outcome.outcome,
      outcome.side,
      outcome.selection,
      outcome.betName,
      outcome.participant,
      outcome.team,
      outcome.teamID,
      ""
    )
  ).toLowerCase();

  const home = String(match.home_team || "").toLowerCase();
  const away = String(match.away_team || "").toLowerCase();

  if (text.includes(home) || text === "home" || text.includes("home")) return "home";
  if (text.includes(away) || text === "away" || text.includes("away")) return "away";
  if (text.includes("draw") || text.includes("tie")) return "draw";
  if (text.includes("over")) return "over";
  if (text.includes("under")) return "under";

  return null;
}

function getPrice(outcome) {
  return toNumber(
    firstDefined(
      outcome.price,
      outcome.odds,
      outcome.decimalOdds,
      outcome.currentOdds,
      outcome.bookOdds,
      outcome.value
    )
  );
}

function applyOddsFromObject(match, obj) {
  if (!obj || typeof obj !== "object") return match;

  const homeDirect = toNumber(
    firstDefined(
      obj.homeOdds,
      obj.moneylineHome,
      obj.homeMoneyline,
      obj.odds?.home,
      obj.bestOdds?.home
    )
  );

  const awayDirect = toNumber(
    firstDefined(
      obj.awayOdds,
      obj.moneylineAway,
      obj.awayMoneyline,
      obj.odds?.away,
      obj.bestOdds?.away
    )
  );

  const drawDirect = toNumber(
    firstDefined(
      obj.drawOdds,
      obj.moneylineDraw,
      obj.drawMoneyline,
      obj.odds?.draw,
      obj.bestOdds?.draw
    )
  );

  if (homeDirect) match.bestOdds.home = Math.max(match.bestOdds.home || 0, homeDirect);
  if (awayDirect) match.bestOdds.away = Math.max(match.bestOdds.away || 0, awayDirect);
  if (drawDirect) match.bestOdds.draw = Math.max(match.bestOdds.draw || 0, drawDirect);

  return match;
}

function walkOdds(match, value) {
  if (!value || typeof value !== "object") return match;

  if (Array.isArray(value)) {
    for (const item of value) walkOdds(match, item);
    return match;
  }

  applyOddsFromObject(match, value);

  const price = getPrice(value);
  if (price) {
    const side = classifyOutcome(value, match);

    if (side === "home") {
      match.bestOdds.home = Math.max(match.bestOdds.home || 0, price);
    }

    if (side === "away") {
      match.bestOdds.away = Math.max(match.bestOdds.away || 0, price);
    }

    if (side === "draw") {
      match.bestOdds.draw = Math.max(match.bestOdds.draw || 0, price);
    }

    if (side === "over") {
      match.bestOdds.over = Math.max(match.bestOdds.over || 0, price);
      match.bestOdds.point = firstDefined(match.bestOdds.point, toNumber(value.point), toNumber(value.line));
    }

    if (side === "under") {
      match.bestOdds.under = Math.max(match.bestOdds.under || 0, price);
      match.bestOdds.point = firstDefined(match.bestOdds.point, toNumber(value.point), toNumber(value.line));
    }
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      walkOdds(match, child);
    }
  }

  return match;
}

function normalizeSportsGameOddsEvent(event) {
  const match = normalizeEventBase(event);
  walkOdds(match, event);

  return match;
}

async function fetchJson(url, apiKey) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      text,
      payload: null,
    };
  }

  return {
    ok: true,
    status: response.status,
    text,
    payload: JSON.parse(text),
  };
}

async function fetchSportsGameOdds() {
  const apiKey = process.env.SPORTSGAMEODDS_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      error: "SPORTSGAMEODDS_API_KEY puuttuu Vercelistä.",
    };
  }

  const eventsUrl =
    "https://api.sportsgameodds.com/v2/events" +
    `?apiKey=${apiKey}` +
    "&leagueID=NHL" +
    "&oddsAvailable=true" +
    "&includeAltLines=false" +
    "&limit=25";

  const eventsResponse = await fetchJson(eventsUrl, apiKey);

  if (!eventsResponse.ok) {
    return {
      ok: false,
      error: `SportsGameOdds events error ${eventsResponse.status}: ${eventsResponse.text}`,
    };
  }

  const events = getArrayFromPayload(eventsResponse.payload);

  const matches = events
    .map(normalizeSportsGameOddsEvent)
    .filter((match) => match.id && match.home_team && match.away_team);

  const hasUsableOdds = matches.some(
    (match) => match.bestOdds.home || match.bestOdds.away || match.bestOdds.draw
  );

  if (!hasUsableOdds) {
    return {
      ok: true,
      data: {
        source: "live",
        status: "events_only",
        provider: "sportsgameodds",
        cached: false,
        reason:
          "SportsGameOdds palautti ottelut, mutta moneyline-kertoimia ei löytynyt tästä payloadista. Tarvitaan odds-rakenne endpointista tai docsien market-esimerkki.",
        debug: {
          firstEventKeys: events[0] ? Object.keys(events[0]) : [],
          firstEventSample: events[0] || null,
        },
        matches,
      },
    };
  }

  return {
    ok: true,
    data: {
      source: "live",
      status: "fresh",
      provider: "sportsgameodds",
      cached: false,
      reason: "",
      matches,
    },
  };
}

export async function GET(request) {
  const now = Date.now();
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  if (!force && cachedData && now - cachedAt < CACHE_MS) {
    return NextResponse.json({
      ...cachedData,
      cached: true,
      cacheAgeSeconds: Math.round((now - cachedAt) / 1000),
    });
  }

  const primary = await fetchSportsGameOdds();

  if (primary.ok) {
    cachedData = primary.data;
    cachedAt = now;
    return NextResponse.json(primary.data);
  }

  return NextResponse.json({
    ...DEMO_DATA,
    status: "api_error",
    reason: primary.error,
    debug: {
      primaryError: primary.error,
    },
  });
}
